/**
 * CursorCliExecutor — routes completions through the Cursor Agent CLI binary
 * (`cursor-agent`) in non-interactive print mode with stream-json output.
 *
 *   cursor-agent -p --output-format stream-json \
 *     --model <model> --force <prompt>
 *
 * NDJSON events on stdout:
 *   {"type":"system","subtype":"init",...}
 *   {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
 *   {"type":"result","subtype":"success","result":"...","duration_ms":N}
 *
 * Auth: credentials.apiKey / accessToken → CURSOR_API_KEY env var. If unset,
 * cursor-agent falls back to its own stored login state.
 *
 * Binary discovery: CLI_CURSOR_BIN env var → PATH → /opt/cursor-agent.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { BaseExecutor, type ExecuteInput } from "./base.ts";
import type { OpenAITool } from "../utils/cliToolCallBridge.ts";
import { safeKillWithGroup } from "../utils/safeKill.ts";
import { buildToolPromptSuffix, parseToolCallResponse } from "../utils/cliToolCallBridge.ts";

function resolveCursorBin(): string {
  const envBin = process.env.CLI_CURSOR_BIN?.trim();
  if (envBin) return envBin;
  const isWin = process.platform === "win32";
  const home = os.homedir();
  for (const candidate of [
    "/opt/cursor-agent/cursor-agent",
    path.join(home, ".local", "bin", "cursor-agent"),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return isWin ? "cursor-agent.exe" : "cursor-agent";
}

type OpenAIMsg = { role?: string; content?: unknown };

function buildPromptText(messages: OpenAIMsg[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    const role = String(m.role || "user");
    let text = "";
    if (typeof m.content === "string") text = m.content;
    else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p && typeof p === "object" && (p as Record<string, unknown>).type === "text") {
          text += String((p as Record<string, unknown>).text || "");
        }
      }
    }
    if (!text.trim()) continue;
    lines.push(role === "system" ? `[System]\n${text}` : role === "assistant" ? `[Assistant]\n${text}` : `[User]\n${text}`);
  }
  return lines.join("\n\n") || "(empty)";
}

export class CursorCliExecutor extends BaseExecutor {
  constructor() {
    super("cursor-cli", { id: "cursor-cli", baseUrl: "" });
  }

  buildUrl(): string {
    return "cursor://cli/stdio";
  }

  buildHeaders(): Record<string, string> {
    return {};
  }

  transformRequest(): unknown {
    return null;
  }

  async execute({ model, body, credentials, signal, log }: ExecuteInput): Promise<{
    response: Response;
    url: string;
    headers: Record<string, string>;
    transformedBody: unknown;
  }> {
    const b = (body ?? {}) as Record<string, unknown>;
    const messages: OpenAIMsg[] = Array.isArray(b.messages) ? (b.messages as OpenAIMsg[]) : [];
    const tools = Array.isArray(b.tools) ? (b.tools as OpenAITool[]) : [];
    const hasTools = tools.length > 0;
    const promptText =
      buildPromptText(messages) + (hasTools ? buildToolPromptSuffix(tools, b.tool_choice) : "");
    const apiKey =
      credentials.apiKey || credentials.accessToken || process.env.CURSOR_API_KEY || "";
    const cursorBin = resolveCursorBin();

    log?.info?.("CURSOR", `cursor-agent -p → model=${model}, bin=${cursorBin}`);

    const sseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        const emit = (data: string) => controller.enqueue(enc.encode(data));

        const env: NodeJS.ProcessEnv = { ...process.env };
        if (apiKey) env.CURSOR_API_KEY = apiKey;

        const args = [
          "-p",
          "--output-format",
          "stream-json",
          "--trust",
          "--mode",
          "ask",
        ];
        if (model) args.push("--model", model);
        args.push("--", promptText);

        const isWin = process.platform === "win32";
        const child = spawn(cursorBin, args, {
          env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          shell: isWin,
          detached: !isWin,
        });

        const safeKill = (sig: NodeJS.Signals, group = false) => {
          safeKillWithGroup(child, sig, { group });
        };

        const responseId = `chatcmpl-cursor-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);
        let roleEmitted = false;
        let totalText = "";
        let resultText = "";
        let finished = false;
        let stderrBuf = "";

        child.stderr?.on("data", (chunk: Buffer) => {
          stderrBuf += chunk.toString("utf8");
          if (stderrBuf.length > 4096) stderrBuf = stderrBuf.slice(-4096);
        });

        const finish = (error?: string) => {
          if (finished) return;
          finished = true;
          if (error) {
            emit(`data: ${JSON.stringify({ error: { message: error, type: "cursor_cli_error" } })}\n\n`);
          } else {
            const outText = totalText || resultText;
            const calls = hasTools ? parseToolCallResponse(outText) : null;
            if (calls) {
              emit(
                `data: ${JSON.stringify({
                  id: responseId,
                  object: "chat.completion.chunk",
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        role: "assistant",
                        tool_calls: calls.map((c, i) => ({
                          index: i,
                          id: `call_${Date.now()}_${i}`,
                          type: "function",
                          function: { name: c.name, arguments: JSON.stringify(c.arguments) },
                        })),
                      },
                      finish_reason: "tool_calls",
                    },
                  ],
                  usage: {
                    prompt_tokens: Math.ceil(promptText.length / 4),
                    completion_tokens: Math.ceil(outText.length / 4),
                    total_tokens: Math.ceil((promptText.length + outText.length) / 4),
                    estimated: true,
                  },
                })}\n\n`
              );
              emit("data: [DONE]\n\n");
              safeKill("SIGTERM");
              const killTimer = setTimeout(() => safeKill("SIGKILL", true), 2000);
              killTimer.unref?.();
              controller.close();
              return;
            }
            if (hasTools && outText && !roleEmitted) {
              // Model answered in plain text despite tools — emit as normal message.
              roleEmitted = true;
              emit(
                `data: ${JSON.stringify({
                  id: responseId,
                  object: "chat.completion.chunk",
                  created,
                  model,
                  choices: [
                    { index: 0, delta: { role: "assistant", content: outText }, finish_reason: null },
                  ],
                })}\n\n`
              );
            }
            emit(
              `data: ${JSON.stringify({
                id: responseId,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                usage: {
                  prompt_tokens: Math.ceil(promptText.length / 4),
                  completion_tokens: Math.ceil((totalText || resultText).length / 4),
                  total_tokens: Math.ceil((promptText.length + (totalText || resultText).length) / 4),
                  estimated: true,
                },
              })}\n\n`
            );
          }
          emit("data: [DONE]\n\n");
          safeKill("SIGTERM");
          const killTimer = setTimeout(() => safeKill("SIGKILL", true), 2000);
          killTimer.unref?.();
          controller.close();
        };

        const emitDelta = (text: string) => {
          if (!text) return;
          if (hasTools) {
            totalText += text;
            return;
          }
          if (!roleEmitted) {
            emit(
              `data: ${JSON.stringify({
                id: responseId,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
              })}\n\n`
            );
            roleEmitted = true;
          }
          totalText += text;
          emit(
            `data: ${JSON.stringify({
              id: responseId,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
            })}\n\n`
          );
        };

        child.on("error", (err) => {
          const msg =
            err.message.includes("ENOENT") || err.message.includes("not found")
              ? `Cursor Agent CLI not found: ${cursorBin}. Install via https://cursor.com/install or set CLI_CURSOR_BIN.`
              : `Cursor Agent spawn error: ${err.message}`;
          finish(msg);
        });

        child.on("exit", (code) => {
          if (finished) return;
          if (code !== 0) {
            const detail = stderrBuf.trim().split("\n").pop() || `exit code ${code}`;
            finish(`Cursor Agent CLI failed: ${detail}`);
            return;
          }
          // Emit final result text if no streamed deltas arrived.
          if (!totalText && resultText) emitDelta(resultText);
          finish();
        });

        let buffer = "";
        child.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf8");
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            let ev: Record<string, unknown>;
            try {
              ev = JSON.parse(line);
            } catch {
              continue;
            }
            const type = ev.type as string | undefined;
            if (type === "assistant") {
              const content = (ev.message as Record<string, unknown> | undefined)?.content;
              if (Array.isArray(content)) {
                // Each assistant event carries the full message text; emit
                // only the suffix beyond what we already sent.
                const snap = content
                  .map((part) => (part as Record<string, unknown>)?.text)
                  .filter((t): t is string => typeof t === "string")
                  .join("");
                if (snap.length > totalText.length) emitDelta(snap.slice(totalText.length));
              }
            } else if (type === "result") {
              const r = ev.result;
              if (typeof r === "string") resultText = r;
            } else if (type === "error") {
              finish(String(ev.message || ev.error || "Cursor Agent error"));
              return;
            }
          }
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
      url: "cursor://cli/stdio",
      headers: {},
      transformedBody: null,
    };
  }
}
