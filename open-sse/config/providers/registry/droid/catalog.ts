import type { RegistryModel } from "../../shared.ts";

// Fork-only: Factory Droid ACP catalog (mirrors src/lib/acp/registry.ts).
// Model ids map 1:1 onto `droid exec --model <id>`; "auto" is Droid's own
// router. Discovery source: GET /api/acp/models.
const M = (id: string, name: string): RegistryModel => ({ id, name, toolCalling: false });

export const DROID_MODEL_CATALOG: RegistryModel[] = [
  M("auto", "Auto (Factory Router)"),
  M("claude-opus-5", "Claude Opus 5"),
  M("claude-opus-5-fast", "Claude Opus 5 Fast"),
  M("claude-opus-4-8", "Claude Opus 4.8"),
  M("claude-sonnet-5", "Claude Sonnet 5"),
  M("claude-sonnet-4-6", "Claude Sonnet 4.6"),
  M("claude-haiku-4-5-20251001", "Claude Haiku 4.5"),
  M("gpt-5.6-sol", "GPT-5.6 Sol"),
  M("gpt-5.6-terra", "GPT-5.6 Terra"),
  M("gpt-5.6-luna", "GPT-5.6 Luna"),
  M("gpt-5.5", "GPT-5.5"),
  M("gpt-5.5-pro", "GPT-5.5 Pro"),
  M("gpt-5.4", "GPT-5.4"),
  M("gpt-5.3-codex", "GPT-5.3 Codex"),
  M("gpt-5.2", "GPT-5.2"),
  M("gemini-3.1-pro-preview", "Gemini 3.1 Pro"),
  M("gemini-3.5-flash", "Gemini 3.5 Flash"),
  M("glm-5.2", "GLM 5.2 / Droid Core"),
  M("glm-5.2-fast", "GLM 5.2 Fast"),
  M("kimi-k3", "Kimi K3"),
  M("kimi-k2.7-code", "Kimi K2.7 Code"),
  M("deepseek-v4-pro", "DeepSeek V4 Pro"),
  M("minimax-m3", "MiniMax M3"),
  M("minimax-m2.7", "MiniMax M2.7"),
  M("grok-4.5", "Grok 4.5"),
  M("nemotron-3-ultra", "Nemotron 3 Ultra"),
];
