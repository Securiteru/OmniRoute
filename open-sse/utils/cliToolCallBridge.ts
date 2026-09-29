/**
 * cliToolCallBridge — OpenAI-style tool calling over text-only CLI agents.
 *
 * CLI executors (droid, cursor-cli, devin-cli) speak plain text. To support
 * the OpenAI `tools`/`tool_calls` contract we:
 *   1. Append the tool schemas + a strict output contract to the prompt.
 *   2. Buffer the response text instead of streaming deltas.
 *   3. If the text parses as a tool-call payload, emit tool_calls; else emit
 *      the text as a normal assistant message.
 */

export type OpenAITool = {
  type?: string;
  function?: { name?: string; description?: string; parameters?: unknown };
};

export function buildToolPromptSuffix(tools: OpenAITool[], toolChoice?: unknown): string {
  const defs = tools
    .map((t) => {
      const fn = t.function ?? (t as { name?: string });
      return JSON.stringify({
        name: fn.name,
        description: (t.function?.description as string) ?? undefined,
        parameters: t.function?.parameters ?? { type: "object", properties: {} },
      });
    })
    .join("\n");
  const forced =
    toolChoice && typeof toolChoice === "object"
      ? (toolChoice as { function?: { name?: string } }).function?.name
      : toolChoice === "none"
        ? "none"
        : undefined;

  return [
    "",
    "[Available Tools]",
    "You may call the following tools by replying with ONLY this JSON object (no other text):",
    '{"tool_calls":[{"name":"<tool_name>","arguments":{...}}]}',
    "If no tool is needed or the request can be answered directly, reply normally in plain text.",
    forced === "none"
      ? "Do NOT call any tool for this request — answer in plain text."
      : forced
        ? `For this request you MUST call the tool "${forced}".`
        : "Call a tool only when needed to answer.",
    defs,
  ].join("\n");
}

type ParsedToolCall = { name?: string; arguments?: unknown };

export function parseToolCallResponse(
  text: string
): { name: string; arguments: Record<string, unknown> }[] | null {
  if (!text) return null;
  const candidates: string[] = [];
  const trimmed = text.trim();
  candidates.push(trimmed);
  // tolerate ```json fences and surrounding prose
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());
  const brace = trimmed.match(/\{[\s\S]*"[\w-]*calls?"[\s\S]*\}/);
  if (brace) candidates.push(brace[0]);

  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as Record<string, unknown>;
      // Accept "tool_calls" plus fuzzy variants — some CLI models corrupt the
      // literal key (e.g. emitting "olsertslls" instead of "tool_calls").
      const calls = Object.values(obj ?? {}).find(
        (v): v is ParsedToolCall[] =>
          Array.isArray(v) &&
          v.length > 0 &&
          v.every(
            (i) => typeof (i as ParsedToolCall)?.name === "string" && (i as ParsedToolCall).name
          )
      );
      if (calls) {
        return calls
          .filter((t) => typeof t.name === "string" && t.name)
          .map((t) => ({
            name: t.name as string,
            arguments:
              typeof t.arguments === "string"
                ? safeJsonObj(t.arguments)
                : (t.arguments as Record<string, unknown>) ?? {},
          }));
      }
    } catch {
      /* not JSON */
    }
  }
  return null;
}

function safeJsonObj(s: string): Record<string, unknown> {
  try {
    const o = JSON.parse(s);
    return o && typeof o === "object" ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
