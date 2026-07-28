/**
 * DroidExecutor — routes completions through the Factory Droid CLI binary
 * via the Agent Client Protocol (ACP) JSON-RPC 2.0 over stdio.
 *
 * Protocol flow:
 *   1. Spawn `droid exec --output-format acp` as a subprocess
 *   2. Send: initialize → session/new (with model + cwd) → session/prompt
 *   3. Receive: session/update notifications (streaming text deltas)
 *   4. Emit deltas as OpenAI-compatible SSE chunks
 *   5. Kill subprocess on [DONE] or error
 *
 * Authentication:
 *   Droid uses local credentials stored by `droid login`. No API key needed
 *   when running on a machine with an active droid session.
 *
 * Binary discovery:
 *   1. CLI_DROID_BIN env var (absolute path override)
 *   2. PATH lookup ("droid")
 *   3. ~/.local/bin/droid
 *
 * Model selection:
 *   Passed via --model flag on spawn (e.g. "glm-5.2", "kimi-k3", "auto").
 *   Droid resolves them against its built-in model catalog.
 *
 * Reference: gbrain scenextras/omniroute-droid-acp-path
 */

import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { BaseExecutor, type ExecuteInput } from "./base.ts";
import { safeKillWithGroup } from "../utils/safeKill.ts";

// ─── Binary discovery ────────────────────────────────────────────────────────

function resolveDroidBin(): string {
  const envBin = process.env.CLI_DROID_BIN?.trim();
  if (envBin) return envBin;

  const isWin = process.platform === "win32";
  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const winPath = path.join(localAppData, "droid", "cli", "bin", "droid.exe");
    if (fs.existsSync(winPath)) return winPath;
  }

  const home = os.homedir();
  for (const candidate of [
    path.join(home, ".local", "bin", "droid"),
    path.join(home, ".factory", "bin", "droid"),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return isWin ? "droid.exe" : "droid";
}

// ─── ACP JSON-RPC helpers ────────────────────────────────────────────────────

type AcpMessage = {
  jsonrpc: "2.0";
  method?: string;
  result?: unknown;
  error?: { code: number; message: string };
  params?: unknown;
  id?: number | null;
};

function rpc(method: string, params: unknown, id?: number): string {
  const msg: AcpMessage = { jsonrpc: "2.0", method, params };
  if (id !== undefined) msg.id = id;
  return JSON.stringify(msg) + "\n";
}

// ─── Multi-turn message → single prompt builder ───────────────────────────────

type OpenAIMsg = { role?: string; content?: unknown };

function buildPromptText(messages: OpenAIMsg[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    const role = String(m.role || "user");
    let text = "";
    if (typeof m.content === "string") {
      text = m.content;
    } else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p && typeof p === "object" && (p as Record<string, unknown>).type === "text") {
          text += String((p as Record<string, unknown>).text || "");
        }
      }
    }
    if (!text.trim()) continue;
    if (role === "system") {
      lines.push(`[System]\n${text}`);
    } else if (role === "assistant") {
      lines.push(`[Assistant]\n${text}`);
    } else {
      lines.push(`[User]\n${text}`);
    }
  }
  return lines.join("\n\n") || "(empty)";
}

// ─── DroidExecutor ───────────────────────────────────────────────────────────

export class DroidExecutor extends BaseExecutor {
  constructor() {
    super("droid", { id: "droid", baseUrl: "" });
  }

  buildUrl(): string {
    return "droid://acp/stdio";
  }

  buildHeaders(): Record<string, string> {
    return {};
  }

  transformRequest(): unknown {
    return null;
  }

  async execute({ model, body, stream: _stream, credentials, signal, log }: ExecuteInput): Promise<{
    response: Response;
    url: string;
    headers: Record<string, string>;
    transformedBody: unknown;
  }> {
    const b = (body ?? {}) as Record<string, unknown>;
    const messages: OpenAIMsg[] = Array.isArray(b.messages) ? (b.messages as OpenAIMsg[]) : [];
    const promptText = buildPromptText(messages);
    const droidBin = resolveDroidBin();

    log?.info?.("DROID", `droid exec --output-format acp → model=${model}, bin=${droidBin}`);

    const sseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        const emit = (data: string) => {
          try {
            controller.enqueue(enc.encode(data));
          } catch {
            // Controller already closed
          }
        };

        const env: NodeJS.ProcessEnv = { ...process.env };
        if (credentials.apiKey) {
          env.FACTORY_API_KEY = credentials.apiKey;
        }

        const args = ["exec", "--output-format", "acp"];
        if (model && model.trim() && model !== "auto") {
          args.push("--model", model.trim());
        }

        const isWin = process.platform === "win32";
        const child = spawn(droidBin, args, {
          env,
          stdio: ["pipe", "pipe", "pipe"],
          shell: isWin,
          detached: !isWin,
          cwd: process.env.DROID_ACP_CWD?.trim() || process.env.HOME || process.cwd(),
        });

        const safeKill = (sig: NodeJS.Signals, group = false) => {
          safeKillWithGroup(child, sig, { group });
        };

        let spawnError: Error | null = null;
        let stdinClosed = false;

        child.on("error", (err) => {
          spawnError = err;
          const msg =
            err.message.includes("ENOENT") || err.message.includes("not found")
              ? `Droid CLI not found: ${droidBin}. Install droid or set CLI_DROID_BIN env var.`
              : `Droid CLI spawn error: ${err.message}`;
          emit(
            `data: ${JSON.stringify({ error: { message: msg, type: "droid_error", code: "spawn_failed" } })}\n\n`
          );
          emit("data: [DONE]\n\n");
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });

        if (signal) {
          signal.addEventListener("abort", () => {
            safeKill("SIGTERM");
            const abortKillTimer = setTimeout(() => safeKill("SIGKILL", true), 2000);
            abortKillTimer.unref?.();
          });
        }

        // ── JSON-RPC state machine ──────────────────────────────────────────
        let idCounter = 1;
        let sessionId: string | null = null;
        let initDone = false;
        let sessionCreated = false;
        let promptSent = false;
        const responseId = `chatcmpl-droid-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);
        let roleEmitted = false;
        let totalText = "";
        let finished = false;

        const sendRpc = (method: string, params: unknown) => {
          if (stdinClosed || child.stdin.destroyed) return;
          const id = idCounter++;
          try {
            child.stdin.write(rpc(method, params, id));
          } catch {
            /* ignore write errors after close */
          }
          return id;
        };

        const finish = (error?: string) => {
          if (finished) return;
          finished = true;

          if (error) {
            emit(`data: ${JSON.stringify({ error: { message: error, type: "droid_error" } })}\n\n`);
          } else {
            emit(
              `data: ${JSON.stringify({
                id: responseId,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                usage: {
                  prompt_tokens: Math.ceil(promptText.length / 4),
                  completion_tokens: Math.ceil(totalText.length / 4),
                  total_tokens: Math.ceil((promptText.length + totalText.length) / 4),
                  estimated: true,
                },
              })}\n\n`
            );
          }
          emit("data: [DONE]\n\n");

          try {
            if (!stdinClosed) {
              stdinClosed = true;
              child.stdin.end();
            }
          } catch {
            /* ignore */
          }

          const killTimer = setTimeout(() => safeKill("SIGKILL", true), 2000);
          killTimer.unref?.();

          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        // ── stdout reader (NDJSON) ──────────────────────────────────────────
        let buffer = "";

        child.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf8");
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;

            let msg: AcpMessage;
            try {
              msg = JSON.parse(line);
            } catch {
              continue;
            }

            // ── Initialize response ───────────────────────────────────────
            if (!initDone && msg.result !== undefined && !msg.method) {
              initDone = true;
              const sessionCwd =
                process.env.DROID_ACP_CWD?.trim() || process.env.HOME || process.cwd();
              sendRpc("session/new", {
                cwd: sessionCwd,
                mcpServers: [],
              });
              continue;
            }

            // ── session/new response → get sessionId ──────────────────────
            if (initDone && !sessionCreated && msg.result !== undefined && !msg.method) {
              const res = msg.result as Record<string, unknown>;
              sessionId = (res?.sessionId as string) || null;
              if (!sessionId) {
                finish("Droid ACP: session/new returned no sessionId");
                return;
              }
              sessionCreated = true;
              promptSent = true;
              sendRpc("session/prompt", {
                sessionId,
                prompt: [{ type: "text", text: promptText }],
              });
              continue;
            }

            // ── session/prompt response (ack or final) ─────────────────────
            if (
              sessionCreated &&
              promptSent &&
              msg.result !== undefined &&
              !msg.method &&
              !finished
            ) {
              const res = msg.result as Record<string, unknown> | undefined;
              if (!roleEmitted && res) {
                const content = extractResultText(res);
                if (content) {
                  emit(
                    `data: ${JSON.stringify({
                      id: responseId,
                      object: "chat.completion.chunk",
                      created,
                      model,
                      choices: [
                        {
                          index: 0,
                          delta: { role: "assistant", content: "" },
                          finish_reason: null,
                        },
                      ],
                    })}\n\n`
                  );
                  roleEmitted = true;
                  totalText = content;
                  emit(
                    `data: ${JSON.stringify({
                      id: responseId,
                      object: "chat.completion.chunk",
                      created,
                      model,
                      choices: [{ index: 0, delta: { content }, finish_reason: null }],
                    })}\n\n`
                  );
                }
              }
              const stopReason = (res?.stopReason as string) || "";
              if (stopReason && stopReason !== "cancelled") {
                finish();
              }
              continue;
            }

            // ── Streaming notifications (session/update) ──────────────────
            if (msg.method === "session/update" || msg.method === "$/update") {
              const params = msg.params as Record<string, unknown> | undefined;
              if (!params) continue;

              const update = (params.update as Record<string, unknown> | undefined) || {};
              const type = (params.type || update.sessionUpdate) as string | undefined;
              const content = update.content ?? params.content;

              if (
                type === "message_delta" ||
                type === "text_delta" ||
                type === "content_delta" ||
                type === "agent_message_chunk"
              ) {
                const delta =
                  (typeof content === "string"
                    ? content
                    : ((content as Record<string, unknown> | undefined)?.text as string)) ||
                  (params.delta as string) ||
                  (params.text as string) ||
                  "";
                if (delta) {
                  if (!roleEmitted) {
                    emit(
                      `data: ${JSON.stringify({
                        id: responseId,
                        object: "chat.completion.chunk",
                        created,
                        model,
                        choices: [
                          {
                            index: 0,
                            delta: { role: "assistant", content: "" },
                            finish_reason: null,
                          },
                        ],
                      })}\n\n`
                    );
                    roleEmitted = true;
                  }
                  totalText += delta;
                  emit(
                    `data: ${JSON.stringify({
                      id: responseId,
                      object: "chat.completion.chunk",
                      created,
                      model,
                      choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
                    })}\n\n`
                  );
                }
              } else if (type === "message_stop" || type === "stop" || type === "done") {
                finish();
                return;
              } else if (type === "error") {
                finish(String(params.message || params.error || "Droid ACP error"));
                return;
              }
              continue;
            }

            // ── Error responses ───────────────────────────────────────────
            if (msg.error) {
              const detail =
                msg.error.data !== undefined
                  ? ` ${typeof msg.error.data === "string" ? msg.error.data : JSON.stringify(msg.error.data)}`
                  : "";
              log?.warn?.(
                "DROID",
                `ACP error id=${String(msg.id)} code=${msg.error.code} msg=${msg.error.message}${detail}`
              );
              finish(`Droid ACP error ${msg.error.code}: ${msg.error.message}${detail}`);
              return;
            }
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          log?.debug?.("DROID", `stderr: ${chunk.toString("utf8").slice(0, 200)}`);
        });

        child.on("close", (code) => {
          if (!finished) {
            if (code !== 0 && !spawnError) {
              finish(roleEmitted ? undefined : `Droid CLI exited with code ${code}`);
            } else {
              finish();
            }
          }
        });

        // ── Send initialize ───────────────────────────────────────────────
        sendRpc("initialize", {
          protocolVersion: 1,
          clientInfo: { name: "omniroute", version: "1.0" },
          clientCapabilities: {},
        });
      },
    });

    return {
      response: new Response(sseStream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }),
      url: "droid://acp/stdio",
      headers: {},
      transformedBody: { model, promptLength: (body as Record<string, unknown>)?.messages },
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractResultText(result: Record<string, unknown>): string {
  if (typeof result.content === "string") return result.content;
  if (typeof result.text === "string") return result.text;
  const msg = result.message as Record<string, unknown> | undefined;
  if (msg && typeof msg.content === "string") return msg.content;
  const msgs = result.messages as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(msgs)) {
    return msgs
      .filter((m) => m.role === "assistant")
      .map((m) => String(m.content || ""))
      .join("\n");
  }
  return "";
}
