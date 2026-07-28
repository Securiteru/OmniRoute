/**
 * ACP Chat API — POST /api/acp/chat
 *
 * Routes a chat completion request through a Droid ACP session.
 * Spawns `droid exec --output-format acp`, performs the JSON-RPC handshake,
 * and streams the assistant response as SSE (OpenAI-compatible chunks).
 *
 * Body:
 *   { agentId: "droid", prompt: "...", model?: "auto", stream?: boolean, cwd?: string }
 *
 * Response:
 *   - stream=true:  SSE text/event-stream (OpenAI chat.completion.chunk format)
 *   - stream=false: JSON { id, object, choices, ... }
 */

import { NextResponse } from "next/server";
import { DroidAcpClient } from "@/lib/acp/droidClient";
import { isAuthenticated } from "@/shared/utils/apiAuth";

interface ChatRequestBody {
  agentId?: string;
  prompt?: string;
  model?: string;
  stream?: boolean;
  cwd?: string;
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const agentId = body.agentId || "droid";
  if (agentId !== "droid") {
    return NextResponse.json(
      { error: `ACP chat currently only supports agentId 'droid', got '${agentId}'` },
      { status: 400 }
    );
  }

  const prompt = body.prompt;
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required and must be a string" }, { status: 400 });
  }

  const stream = body.stream ?? false;
  const model = body.model || "auto";
  const cwd = body.cwd || process.cwd();

  const encoder = new TextEncoder();
  const completionId = `acp-chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const created = Math.floor(Date.now() / 1000);

  if (stream) {
    const readable = new ReadableStream({
      async start(controller) {
        const client = new DroidAcpClient({ cwd, model });

        try {
          await client.connect();
          await client.createSession();

          const gen = client.sendPrompt(prompt, 120000);
          let fullText = "";

          for await (const chunk of gen) {
            if (chunk.type === "text") {
              fullText += chunk.text;
              const sseChunk = {
                id: completionId,
                object: "chat.completion.chunk",
                created,
                model: `droid/${model}`,
                choices: [
                  {
                    index: 0,
                    delta: { content: chunk.text },
                    finish_reason: null,
                  },
                ],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk)}\n\n`));
            } else if (chunk.type === "done") {
              const finalChunk = {
                id: completionId,
                object: "chat.completion.chunk",
                created,
                model: `droid/${model}`,
                choices: [
                  {
                    index: 0,
                    delta: {},
                    finish_reason: "stop",
                  },
                ],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Unknown ACP error";
          const errorChunk = {
            id: completionId,
            object: "chat.completion.chunk",
            created,
            model: `droid/${model}`,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: "error",
                error: { message: errMsg },
              },
            ],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } finally {
          await client.disconnect();
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming: collect all chunks and return as JSON
  try {
    const client = new DroidAcpClient({ cwd, model });
    try {
      await client.connect();
      await client.createSession();

      const gen = client.sendPrompt(prompt, 120000);
      let fullText = "";

      for await (const chunk of gen) {
        if (chunk.type === "text") {
          fullText += chunk.text;
        }
      }

      return NextResponse.json({
        id: completionId,
        object: "chat.completion",
        created,
        model: `droid/${model}`,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: fullText },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      });
    } finally {
      await client.disconnect();
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown ACP error";
    return NextResponse.json({ error: errMsg }, { status: 502 });
  }
}
