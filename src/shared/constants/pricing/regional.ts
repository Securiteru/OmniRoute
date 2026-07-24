/**
 * Pricing data — regional family (China + other regional providers (incl. GLM/Zhipu)).
 * Pure data; merged by default-pricing.ts via spread (god-file decomposition; semantic split).
 */
import { GLM_PRICING } from "./shared-tiers";

export const DEFAULT_PRICING_REGIONAL = {
  glm: GLM_PRICING,
  glmt: GLM_PRICING,
  kimi: {
    "kimi-latest": {
      input: 1.0,
      output: 4.0,
      cached: 0.5,
      reasoning: 6.0,
      cache_creation: 1.0,
    },
    // Kimi K2.5 — acesso direto via Moonshot API
    // Context: 262.144 tokens | Capabilities: reasoning, vision, agentic, tools
    "kimi-k2.5": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
    "kimi-k2.5-thinking": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
    "kimi-for-coding": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
    "moonshot-kimi-k2.5": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
  },
  kmc: {
    "kimi-k2.5": { input: 0.6, output: 3.0, cached: 0.3, reasoning: 4.5, cache_creation: 0.6 },
    "kimi-k2.5-thinking": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
    "kimi-latest": { input: 1.0, output: 4.0, cached: 0.5, reasoning: 6.0, cache_creation: 1.0 },
  },
  kmca: {
    "kimi-k2.5": { input: 0.6, output: 3.0, cached: 0.3, reasoning: 4.5, cache_creation: 0.6 },
    "kimi-k2.5-thinking": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
    "kimi-latest": { input: 1.0, output: 4.0, cached: 0.5, reasoning: 6.0, cache_creation: 1.0 },
  },
  minimax: {
    // MiniMax M3 — new default model (upstream upgrade from M2.7).
    // Same api.minimax.io endpoint; pricing mirrors the M2.x base tier.
    "minimax-m3": {
      input: 0.5,
      output: 2.0,
      cached: 0.25,
      reasoning: 3.0,
      cache_creation: 0.5,
    },
    "MiniMax-M3": {
      input: 0.5,
      output: 2.0,
      cached: 0.25,
      reasoning: 3.0,
      cache_creation: 0.5,
    },
    "minimax-m2.1": {
      input: 0.5,
      output: 2.0,
      cached: 0.25,
      reasoning: 3.0,
      cache_creation: 0.5,
    },
    "MiniMax-M2.1": {
      input: 0.5,
      output: 2.0,
      cached: 0.25,
      reasoning: 3.0,
      cache_creation: 0.5,
    },
    // MiniMax M2.5 — mais barato que M2.1, reasoning + tools
    // Context: 204.800 tokens | Max Output: 16.384 tokens
    "minimax-m2.5": {
      input: 0.27,
      output: 0.95,
      cached: 0.135,
      reasoning: 1.425,
      cache_creation: 0.27,
    },
    "MiniMax-M2.5": {
      input: 0.27,
      output: 0.95,
      cached: 0.135,
      reasoning: 1.425,
      cache_creation: 0.27,
    },
    // T12: MiniMax M2.7 — new default model (sub2api PR #1120)
    // Upgraded from M2.5, same API endpoint api.minimax.io
    // Pricing estimated, check https://platform.minimaxi.com/document/Price
    "minimax-m2.7": {
      input: 0.4,
      output: 1.6,
      cached: 0.2,
      reasoning: 2.4,
      cache_creation: 0.4,
    },
    "MiniMax-M2.7": {
      input: 0.4,
      output: 1.6,
      cached: 0.2,
      reasoning: 2.4,
      cache_creation: 0.4,
    },
    "minimax-m2.7-highspeed": {
      input: 0.4,
      output: 1.6,
      cached: 0.2,
      reasoning: 2.4,
      cache_creation: 0.4,
    },
  },
  zai: {
    "glm-5": {
      input: 0.38,
      output: 1.98,
      cached: 0.19,
      reasoning: 2.97,
      cache_creation: 0.38,
    },
    "glm-5-turbo": {
      input: 1.2,
      output: 4.0,
      cached: 0.6,
      reasoning: 6.0,
      cache_creation: 1.2,
    },
    "glm-4.7": {
      input: 0.38,
      output: 1.98,
      cached: 0.19,
      reasoning: 2.97,
      cache_creation: 0.38,
    },
  },
  // Alibaba / DashScope / Bailian Model Studio (OpenAI-compat).
  // Rates are $/MTok from OpenRouter list prices for the closest public
  // Qwen/GLM rows when Alibaba has not published a per-token card for a
  // preview model. Update when DashScope publishes official rates.
  alibaba: {
    // Preview max tier — OpenRouter only lists qwen3.6-max-preview today;
    // use that rate for 3.8-max-preview until a dedicated row lands.
    "qwen3.8-max-preview": {
      input: 1.04,
      output: 6.24,
      cached: 0.208,
      reasoning: 6.24,
      cache_creation: 1.3,
    },
    "qwen3.6-max-preview": {
      input: 1.04,
      output: 6.24,
      cached: 0.208,
      reasoning: 6.24,
      cache_creation: 1.3,
    },
    "qwen3.7-max": {
      input: 1.475,
      output: 4.425,
      cached: 0.295,
      reasoning: 4.425,
      cache_creation: 1.844,
    },
    "qwen3-max": {
      input: 0.78,
      output: 3.9,
      cached: 0.156,
      reasoning: 3.9,
      cache_creation: 0.975,
    },
    "qwen3.7-plus": {
      input: 0.4,
      output: 1.2,
      cached: 0.06,
      reasoning: 1.2,
      cache_creation: 0.4,
    },
    "glm-5.2": GLM_PRICING["glm-5.2"],
  },
  "alibaba-cn": {
    "qwen3.8-max-preview": {
      input: 1.04,
      output: 6.24,
      cached: 0.208,
      reasoning: 6.24,
      cache_creation: 1.3,
    },
    "qwen3.6-max-preview": {
      input: 1.04,
      output: 6.24,
      cached: 0.208,
      reasoning: 6.24,
      cache_creation: 1.3,
    },
    "qwen3.7-max": {
      input: 1.475,
      output: 4.425,
      cached: 0.295,
      reasoning: 4.425,
      cache_creation: 1.844,
    },
    "glm-5.2": GLM_PRICING["glm-5.2"],
  },
};
