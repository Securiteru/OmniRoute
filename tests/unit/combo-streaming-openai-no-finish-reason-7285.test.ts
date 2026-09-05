import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-combo-7285-"));

const { handleComboChat, validateResponseQuality } =
  await import("../../open-sse/services/combo.ts");

const encoder = new TextEncoder();
const silentLog = { warn: () => {} };

function sseStream(body: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
}

function makeResponse(events: unknown[]): Response {
  const body = events
    .map((event) =>
      typeof event === "string" ? `data: ${event}\n\n` : `data: ${JSON.stringify(event)}\n\n`
    )
    .join("");
  return new Response(sseStream(body), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

test("#7285 role-only OpenAI stream without finish_reason fails quality", async () => {
  const res = makeResponse([
    {
      id: "chatcmpl-role-only",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
    },
  ]);
  const out = await validateResponseQuality(res, true, silentLog);
  assert.equal(out.valid, false);
  assert.match(out.reason ?? "", /finish_reason/i);
});

test("#7285 tool-call OpenAI stream without finish_reason fails before combo returns 200", async () => {
  const res = makeResponse([
    {
      id: "chatcmpl-tool-truncated",
      object: "chat.completion.chunk",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: { name: "lookup", arguments: "{}" },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    { choices: [] },
    "[DONE]",
  ]);
  const out = await validateResponseQuality(res, true, silentLog);
  assert.equal(out.valid, false);
  assert.match(out.reason ?? "", /tool-call.*truncated/i);
});

test("#7285 reasoning prefix cannot hide a truncated tool-call stream", async () => {
  const res = makeResponse([
    {
      id: "chatcmpl-reasoning-tool-truncated",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: { reasoning_content: "planning" }, finish_reason: null }],
    },
    {
      id: "chatcmpl-reasoning-tool-truncated",
      object: "chat.completion.chunk",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: { name: "lookup", arguments: "{}" },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    { choices: [] },
    "[DONE]",
  ]);
  const out = await validateResponseQuality(res, true, silentLog);
  assert.equal(out.valid, false);
  assert.match(out.reason ?? "", /tool-call.*truncated/i);
});

test("#7285 completed tool-call OpenAI stream remains valid", async () => {
  const res = makeResponse([
    {
      id: "chatcmpl-tool-complete",
      object: "chat.completion.chunk",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: { name: "lookup", arguments: "{}" },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    {
      id: "chatcmpl-tool-complete",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
    },
    "[DONE]",
  ]);
  const out = await validateResponseQuality(res, true, silentLog);
  assert.equal(out.valid, true);
  assert.ok(out.clonedResponse);
});

test("#7285 priority combo advances after a truncated tool-call stream", async () => {
  const attempted: string[] = [];
  const log = { info: () => {}, warn: () => {}, debug: () => {}, error: () => {} };
  const handleSingleModel = async (_body: unknown, model: string) => {
    attempted.push(model);
    if (model === "opencode-go/ox-alpha-free") {
      return makeResponse([
        {
          id: "chatcmpl-reasoning",
          object: "chat.completion.chunk",
          choices: [{ index: 0, delta: { reasoning_content: "planning" }, finish_reason: null }],
        },
        {
          id: "chatcmpl-truncated",
          object: "chat.completion.chunk",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_1",
                    type: "function",
                    function: { name: "lookup", arguments: "{}" },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        { choices: [] },
        "[DONE]",
      ]);
    }
    return makeResponse([
      {
        id: "chatcmpl-luna",
        object: "chat.completion.chunk",
        choices: [{ index: 0, delta: { content: "Luna reached" }, finish_reason: null }],
      },
      {
        id: "chatcmpl-luna",
        object: "chat.completion.chunk",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      },
      "[DONE]",
    ]);
  };

  const result = await handleComboChat({
    body: { model: "SHARED_OS_SOTA", stream: true, messages: [{ role: "user", content: "hi" }] },
    combo: {
      name: "SHARED_OS_SOTA",
      strategy: "priority",
      models: [{ model: "opencode-go/ox-alpha-free" }, { model: "codex/gpt-5.6-luna-xhigh" }],
      config: {},
    },
    handleSingleModel,
    log,
    settings: {},
    allCombos: [],
  });

  assert.deepEqual(attempted, ["opencode-go/ox-alpha-free", "codex/gpt-5.6-luna-xhigh"]);
  assert.equal(result.status, 200);
  assert.match(await result.text(), /Luna reached/);
});
