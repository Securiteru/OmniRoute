import type { RegistryEntry } from "../../shared.ts";

// Factory Droid — ACP-native CLI agent (JSON-RPC 2.0 over stdio).
//
// `droid exec --output-format acp` spawns a subprocess that speaks ACP.
// The DroidExecutor handles the full handshake: initialize → session/new →
// session/prompt → session/update (streaming).
//
// Authentication:
//   Droid uses local credentials stored by `droid login`. No API key needed
//   when running on a machine with an active droid session. The FACTORY_API_KEY
//   env var can be used to pass a key explicitly if needed.
//
// Models:
//   Model list comes from `droid exec --model __invalid__` discovery (see
//   /api/acp/models endpoint) or the static fallback list below.
//   `passthroughModels: true` allows any droid model ID to be used.
export const droidProvider: RegistryEntry = {
  id: "droid",
  alias: "drd",
  format: "openai",
  executor: "droid",
  baseUrl: "droid://acp/stdio",
  authType: "none",
  defaultContextLength: 200000,
  passthroughModels: true,
  models: [
    { id: "auto", name: "Auto (Factory Router)" },
    { id: "glm-5.2", name: "GLM 5.2 / Droid Core" },
    { id: "glm-5.2-fast", name: "GLM 5.2 Fast" },
    { id: "kimi-k3", name: "Kimi K3" },
    { id: "kimi-k2.7-code", name: "Kimi K2.7 Code" },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
    { id: "minimax-m3", name: "MiniMax M3" },
    { id: "minimax-m2.7", name: "MiniMax M2.7" },
    { id: "claude-opus-5", name: "Claude Opus 5" },
    { id: "claude-opus-5-fast", name: "Claude Opus 5 Fast" },
    { id: "claude-opus-4-8", name: "Claude Opus 4.8" },
    { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
    { id: "gpt-5.6-sol", name: "GPT-5.6 Sol" },
    { id: "gpt-5.6-terra", name: "GPT-5.6 Terra" },
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna" },
    { id: "gpt-5.5", name: "GPT-5.5" },
    { id: "gpt-5.4", name: "GPT-5.4" },
    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
    { id: "grok-4.5", name: "Grok 4.5" },
    { id: "nemotron-3-ultra", name: "Nemotron 3 Ultra" },
  ],
};
