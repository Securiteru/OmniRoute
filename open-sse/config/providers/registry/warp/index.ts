import type { RegistryEntry } from "../../shared.ts";

// Warp (Oz) — OpenAI-compatible proxy that routes requests through Warp's Oz
// agent infrastructure using `oz agent run`. This gives OmniRoute access to
// Warp's model fleet (Claude, GPT, Gemini, Grok, DeepSeek, GLM, Kimi, etc.)
// via a local proxy that wraps the Oz CLI.
//
// The proxy is a separate process (warp_proxy/server.py) that must be running
// on a reachable host. The default baseUrl points to localhost; operators should
// override it with their Tailscale IP or other reachable address when creating
// a connection via the dashboard.
//
// `passthroughModels: true` — the live model catalog comes from the proxy's
// `/v1/models` endpoint (which calls `oz model list`). Any model ID from Warp's
// fleet is accepted even if not in the seed list below.
//
// Seed list is a fallback ONLY — 89+ models are available at runtime via /models.
export const warpProvider: RegistryEntry = {
  id: "warp",
  alias: "oz",
  format: "openai",
  executor: "default",
  baseUrl: "http://127.0.0.1:4444/v1/chat/completions",
  modelsUrl: "http://127.0.0.1:4444/v1/models",
  authType: "apikey",
  authHeader: "bearer",
  anonymousApiKey: "warp-proxy",
  defaultContextLength: 200000,
  passthroughModels: true,
  models: [
    // Claude family
    {
      id: "claude-4-5-haiku",
      name: "Claude 4.5 Haiku (Warp)",
      contextLength: 200000,
      toolCalling: true,
    },
    {
      id: "claude-4-5-sonnet",
      name: "Claude 4.5 Sonnet (Warp)",
      contextLength: 200000,
      toolCalling: true,
    },
    {
      id: "claude-4-5-opus",
      name: "Claude 4.5 Opus (Warp)",
      contextLength: 200000,
      toolCalling: true,
    },
    {
      id: "claude-5-sonnet-high",
      name: "Claude 5 Sonnet High (Warp)",
      contextLength: 200000,
      toolCalling: true,
    },
    {
      id: "claude-5-opus-high",
      name: "Claude 5 Opus High (Warp)",
      contextLength: 200000,
      toolCalling: true,
    },
    // GPT family
    {
      id: "gpt-5-2-medium",
      name: "GPT-5.2 Medium (Warp)",
      contextLength: 200000,
      toolCalling: true,
    },
    { id: "gpt-5-2-high", name: "GPT-5.2 High (Warp)", contextLength: 200000, toolCalling: true },
    {
      id: "gpt-5-2-codex-high",
      name: "GPT-5.2 Codex High (Warp)",
      contextLength: 200000,
      toolCalling: true,
    },
    {
      id: "gpt-5-3-codex-high",
      name: "GPT-5.3 Codex High (Warp)",
      contextLength: 200000,
      toolCalling: true,
    },
    { id: "gpt-5-4-high", name: "GPT-5.4 High (Warp)", contextLength: 200000, toolCalling: true },
    { id: "gpt-5-5-high", name: "GPT-5.5 High (Warp)", contextLength: 200000, toolCalling: true },
    // Gemini family
    {
      id: "gemini-3.5-flash",
      name: "Gemini 3.5 Flash (Warp)",
      contextLength: 1000000,
      toolCalling: true,
    },
    {
      id: "gemini-3.6-flash",
      name: "Gemini 3.6 Flash (Warp)",
      contextLength: 1000000,
      toolCalling: true,
    },
    // Grok family
    { id: "grok-4-5-high", name: "Grok 4.5 High (Warp)", contextLength: 200000, toolCalling: true },
    // DeepSeek
    {
      id: "deepseek-v4-pro-fireworks",
      name: "DeepSeek V4 Pro (Warp)",
      contextLength: 128000,
      toolCalling: true,
    },
    // GLM
    { id: "glm-5.2-fireworks", name: "GLM 5.2 (Warp)", contextLength: 128000, toolCalling: true },
    // Kimi
    { id: "kimi-k3-fireworks", name: "Kimi K3 (Warp)", contextLength: 128000, toolCalling: true },
    {
      id: "kimi-k27-code-fireworks",
      name: "Kimi K2.7 Code (Warp)",
      contextLength: 128000,
      toolCalling: true,
    },
    // MiniMax
    {
      id: "minimax-3-fireworks",
      name: "MiniMax M3 (Warp)",
      contextLength: 128000,
      toolCalling: true,
    },
    {
      id: "minimax-2.7-fireworks",
      name: "MiniMax M2.7 (Warp)",
      contextLength: 128000,
      toolCalling: true,
    },
    // Qwen
    {
      id: "qwen-3.7-plus-fireworks",
      name: "Qwen 3.7 Plus (Warp)",
      contextLength: 128000,
      toolCalling: true,
    },
    // Auto
    { id: "auto", name: "Auto (Warp)", contextLength: 200000, toolCalling: true },
    {
      id: "auto-efficient",
      name: "Auto Efficient (Warp)",
      contextLength: 200000,
      toolCalling: true,
    },
    { id: "auto-genius", name: "Auto Genius (Warp)", contextLength: 200000, toolCalling: true },
    { id: "auto-open", name: "Auto Open (Warp)", contextLength: 200000, toolCalling: true },
  ],
};
