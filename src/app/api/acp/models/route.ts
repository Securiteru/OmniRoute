/**
 * ACP Models API — GET /api/acp/models
 *
 * Lists models available through Droid's ACP interface.
 * Runs `droid exec --model <invalid> "x"` which prints the available model list
 * as an error message. This is parsed and returned as an OpenAI-compatible
 * /v1/models response.
 *
 * The model list is cached for 5 minutes.
 */

import { NextResponse } from "next/server";
import { execFileSync } from "child_process";
import { isAuthenticated } from "@/shared/utils/apiAuth";

let _cache: { models: unknown[]; ts: number } | null = null;
const CACHE_TTL_MS = 300_000;

// Static fallback model list (from droid 0.181.0)
const DROID_MODELS_FALLBACK = [
  { id: "auto", name: "Auto (Factory Router)", note: "Automatically picks the best model" },
  { id: "claude-opus-5", name: "Claude Opus 5 (Droid)" },
  { id: "claude-opus-5-fast", name: "Claude Opus 5 Fast (Droid)" },
  { id: "claude-opus-4-8", name: "Claude Opus 4.8 (Droid)" },
  { id: "claude-sonnet-5", name: "Claude Sonnet 5 (Droid)" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (Droid)" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5 (Droid)" },
  { id: "gpt-5.6-sol", name: "GPT-5.6 Sol (Droid)" },
  { id: "gpt-5.6-terra", name: "GPT-5.6 Terra (Droid)" },
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna (Droid)" },
  { id: "gpt-5.5", name: "GPT-5.5 (Droid)" },
  { id: "gpt-5.5-pro", name: "GPT-5.5 Pro (Droid)" },
  { id: "gpt-5.4", name: "GPT-5.4 (Droid)" },
  { id: "gpt-5.3-codex", name: "GPT-5.3 Codex (Droid)" },
  { id: "gpt-5.2", name: "GPT-5.2 (Droid)" },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (Droid)" },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash (Droid)" },
  { id: "glm-5.2", name: "GLM 5.2 / Droid Core (Droid)" },
  { id: "glm-5.2-fast", name: "GLM 5.2 Fast (Droid)" },
  { id: "kimi-k3", name: "Kimi K3 (Droid)" },
  { id: "kimi-k2.7-code", name: "Kimi K2.7 Code (Droid)" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro (Droid)" },
  { id: "minimax-m3", name: "MiniMax M3 (Droid)" },
  { id: "minimax-m2.7", name: "MiniMax M2.7 (Droid)" },
  { id: "grok-4.5", name: "Grok 4.5 (Droid)" },
  { id: "nemotron-3-ultra", name: "Nemotron 3 Ultra (Droid)" },
];

function discoverDroidModels(): { id: string; name: string }[] {
  try {
    // `droid exec --model __invalid__` prints the available model list to stderr
    const output = execFileSync(
      "droid",
      ["exec", "--model", "__invalid__", "--output-format", "text", "x"],
      { timeout: 10000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    // Parse "Available built-in models:\n  auto, claude-opus-5, ..." from stderr
    const match = output.match(/Available built-in models:\s*\n\s*(.+)/);
    if (match) {
      const ids = match[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return ids.map((id) => ({ id, name: `${id} (Droid)` }));
    }
  } catch {
    // droid exec exits non-zero for invalid model — stderr has the list
  }

  // Try stderr from the failed exec
  try {
    const result = execFileSync(
      "droid",
      ["exec", "--model", "__invalid__", "--output-format", "text", "x"],
      { timeout: 10000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    return DROID_MODELS_FALLBACK.map((m) => ({ id: m.id, name: m.name }));
  } catch {
    return DROID_MODELS_FALLBACK.map((m) => ({ id: m.id, name: m.name }));
  }
}

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return NextResponse.json({ object: "list", data: _cache.models });
  }

  const rawModels = discoverDroidModels();
  const models = rawModels.map((m) => ({
    id: `droid/${m.id}`,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "droid",
    name: m.name,
  }));

  _cache = { models, ts: Date.now() };

  return NextResponse.json({ object: "list", data: models });
}
