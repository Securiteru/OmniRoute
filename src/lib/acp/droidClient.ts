/**
 * Droid ACP Client — proper ACP (Agent Client Protocol) JSON-RPC 2.0 client.
 *
 * Spawns `droid exec --output-format acp` and communicates via NDJSON
 * JSON-RPC 2.0 over stdio. Implements the full ACP handshake:
 *   initialize → session/new → session/prompt → session/update (streaming)
 *
 * Protocol details confirmed against droid 0.181.0 (not in Factory docs):
 * - initialize: {protocolVersion:1, clientCapabilities:{}}
 *   → result.agentInfo {@factory/cli "Factory Droid"}
 * - session/new: params MUST include cwd + mcpServers (both required)
 *   → result.sessionId (camelCase)
 * - session/prompt: params = {sessionId, prompt} where prompt is an ARRAY OF PARTS
 *   e.g. [{"type":"text","text":"..."}]
 * - Assistant text streams via session/update notifications with
 *   update.sessionUpdate === "agent_message_chunk" and update.content.text
 * - Turn end = id response with result.stopReason (e.g. "end_turn")
 *
 * Reference: gbrain scenextras/omniroute-droid-acp-path
 */

import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import path from "path";

export interface DroidAcpOptions {
  binary?: string;
  cwd?: string;
  model?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface AcpMessage {
  jsonrpc: "2.0";
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface DroidSession {
  sessionId: string;
  agentInfo: unknown;
}

export class DroidAcpClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = "";
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private nextId = 1;
  private initialized = false;
  private session: DroidSession | null = null;
  private options: Required<DroidAcpOptions>;

  constructor(options: DroidAcpOptions = {}) {
    super();
    this.options = {
      binary: options.binary || "droid",
      cwd: options.cwd || process.cwd(),
      model: options.model || "auto",
      env: options.env || {},
      timeoutMs: options.timeoutMs || 120000,
    };
  }

  /**
   * Spawn the droid process and perform the ACP initialize handshake.
   */
  async connect(): Promise<void> {
    if (this.process) return;

    const args = ["exec", "--output-format", "acp"];
    if (this.options.model && this.options.model !== "auto") {
      args.push("--model", this.options.model);
    }

    this.process = spawn(this.options.binary, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.options.env },
      cwd: this.options.cwd,
      shell: false,
    });

    this.process.stdout?.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.process.stderr?.on("data", (chunk: Buffer) => {
      this.emit("stderr", chunk.toString());
    });

    this.process.on("exit", (code, signal) => {
      this.emit("exit", { code, signal });
      this.rejectAllPending(new Error(`Droid process exited (code=${code}, signal=${signal})`));
    });

    this.process.on("error", (err) => {
      this.emit("error", err);
      this.rejectAllPending(err);
    });

    // Perform initialize handshake
    const result = await this.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: {},
    });

    this.initialized = true;
    this.emit("initialized", result);
  }

  /**
   * Create a new ACP session. cwd and mcpServers are required.
   */
  async createSession(): Promise<DroidSession> {
    if (!this.initialized) {
      await this.connect();
    }

    const result = await this.request("session/new", {
      cwd: this.options.cwd,
      mcpServers: [],
    });

    const sessionId = (result as { sessionId: string }).sessionId;
    if (!sessionId) {
      throw new Error("session/new did not return a sessionId");
    }

    this.session = { sessionId, agentInfo: result };
    this.emit("session", this.session);
    return this.session;
  }

  /**
   * Send a prompt and stream the assistant response via an async generator.
   * Yields text chunks as they arrive via session/update notifications.
   */
  async *sendPrompt(
    prompt: string,
    timeoutMs?: number
  ): AsyncGenerator<{ type: string; text: string }, void, unknown> {
    if (!this.session) {
      await this.createSession();
    }

    const requestId = this.nextId++;
    const promptParts = [{ type: "text", text: prompt }];

    const streamEmitter = new EventEmitter();
    let streamDone = false;
    let streamError: Error | null = null;
    let stopReason: string | null = null;

    // Set up response handler for this request ID
    const originalHandleMessage = this.handleMessage.bind(this);
    this.pendingRequests.set(requestId, {
      resolve: (result) => {
        stopReason = (result as { stopReason?: string })?.stopReason || "end_turn";
        streamDone = true;
        streamEmitter.emit("done", stopReason);
      },
      reject: (err) => {
        streamError = err;
        streamDone = true;
        streamEmitter.emit("done", null);
      },
      timeout: setTimeout(() => {
        streamError = new Error(
          `session/prompt timed out after ${timeoutMs || this.options.timeoutMs}ms`
        );
        streamDone = true;
        streamEmitter.emit("done", null);
      }, timeoutMs || this.options.timeoutMs),
    });

    // Send the session/prompt request
    this.sendMessage({
      jsonrpc: "2.0",
      id: requestId,
      method: "session/prompt",
      params: {
        sessionId: this.session!.sessionId,
        prompt: promptParts,
      },
    });

    // Temporarily intercept notifications for this stream
    const notificationHandler = (msg: AcpMessage) => {
      if (msg.method === "session/update" && msg.params) {
        const params = msg.params as {
          update?: {
            sessionUpdate?: string;
            content?: { text?: string };
          };
        };
        const update = params.update;
        if (update?.sessionUpdate === "agent_message_chunk" && update.content?.text) {
          streamEmitter.emit("chunk", update.content.text);
        }
      }
    };

    this.on("notification", notificationHandler);

    try {
      const queue: string[] = [];
      let resolver: (() => void) | null = null;

      streamEmitter.on("chunk", (text: string) => {
        queue.push(text);
        if (resolver) {
          resolver();
          resolver = null;
        }
      });

      streamEmitter.on("done", () => {
        if (resolver) {
          resolver();
          resolver = null;
        }
      });

      while (!streamDone || queue.length > 0) {
        if (queue.length > 0) {
          yield { type: "text", text: queue.shift()! };
        } else if (!streamDone) {
          await new Promise<void>((resolve) => {
            resolver = resolve;
          });
        }
      }

      if (streamError) {
        throw streamError;
      }

      yield { type: "done", text: stopReason || "end_turn" };
    } finally {
      this.off("notification", notificationHandler);
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);
      }
    }
  }

  /**
   * Send a JSON-RPC request and await the response.
   */
  private async request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`ACP request '${method}' timed out after ${this.options.timeoutMs}ms`));
      }, this.options.timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.sendMessage({ jsonrpc: "2.0", id, method, params });
    });
  }

  /**
   * Send a JSON-RPC message (request or notification).
   */
  private sendMessage(msg: AcpMessage): void {
    if (!this.process?.stdin?.writable) {
      throw new Error("Droid process is not writable");
    }
    this.process.stdin.write(JSON.stringify(msg) + "\n");
  }

  /**
   * Process the stdout buffer, extracting complete NDJSON lines.
   */
  private processBuffer(): void {
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;

      try {
        const msg = JSON.parse(line) as AcpMessage;
        this.handleMessage(msg);
      } catch {
        // Not valid JSON — could be debug output
        this.emit("parse_error", line);
      }
    }
  }

  /**
   * Route an incoming JSON-RPC message to the right handler.
   */
  private handleMessage(msg: AcpMessage): void {
    // Response to a request
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(`ACP error ${msg.error.code}: ${msg.error.message}`));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Notification (no id, has method)
    if (msg.method && msg.id === undefined) {
      this.emit("notification", msg);
      return;
    }
  }

  /**
   * Reject all pending requests (used on process exit).
   */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Kill the droid process and clean up.
   */
  async disconnect(): Promise<void> {
    if (!this.process) return;

    this.rejectAllPending(new Error("Client disconnecting"));

    // Try graceful shutdown
    try {
      this.sendMessage({ jsonrpc: "2.0", method: "shutdown" });
    } catch {
      // Process may already be dead
    }

    // SIGTERM with 5s grace
    this.process.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (this.process) {
          this.process.kill("SIGKILL");
        }
        resolve();
      }, 5000);

      this.process?.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    this.process = null;
    this.initialized = false;
    this.session = null;
  }

  /** Whether the client is connected and initialized */
  get isConnected(): boolean {
    return this.initialized && this.process !== null;
  }

  /** Current session info */
  get currentSession(): DroidSession | null {
    return this.session;
  }
}
