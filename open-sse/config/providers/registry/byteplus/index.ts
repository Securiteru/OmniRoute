import type { RegistryEntry } from "../../shared.ts";

// BytePlus ModelArk (Ark) — OpenAI-compatible, ap-southeast-1 region, Bearer auth.
//
// Coding Plan base URL: https://ark.ap-southeast.bytepluses.com/api/coding/v3
// ⚠️ Do NOT use https://ark.ap-southeast.bytepluses.com/api/v3 — that is the
// Pay-As-You-Go endpoint. Requests there do NOT consume the Coding Plan quota
// and instead incur additional charges.
//
// Only the models below are supported by the Coding Plan endpoint; the PAYG
// /models catalog returns 51 models but ~42 of them return
// `UnsupportedModel` against /api/coding/v3/*. The list was verified by
// probing each candidate against /api/coding/v3/chat/completions (200 == OK).
// `ark-code-latest` is BytePlus's meta-router that auto-selects an optimal
// model. Both the dated IDs and their aliases (e.g. glm-5.2 / glm-5-2-260617)
// are accepted; we register the dated IDs to match /models.
export const byteplusProvider: RegistryEntry = {
  id: "byteplus",
  alias: "bpm",
  format: "openai",
  executor: "default",
  baseUrl: "https://ark.ap-southeast.bytepluses.com/api/coding/v3/chat/completions",
  modelsUrl: "https://ark.ap-southeast.bytepluses.com/api/coding/v3/models",
  authType: "apikey",
  authHeader: "bearer",
  defaultContextLength: 128000,
  passthroughModels: true,
  models: [
    { id: "ark-code-latest", name: "Ark Code Latest (auto-router)", supportsReasoning: true },
    { id: "seed-2-0-pro-260328", name: "Dola Seed 2.0 Pro", supportsReasoning: true },
    { id: "seed-2-0-lite-260228", name: "Dola Seed 2.0 Lite" },
    { id: "seed-2-0-code-preview-260328", name: "Dola Seed 2.0 Code", supportsReasoning: true },
    { id: "glm-5-2-260617", name: "GLM 5.2", supportsReasoning: true },
    { id: "glm-5-1-260408", name: "GLM 5.1", supportsReasoning: true },
    { id: "deepseek-v4-flash-260425", name: "DeepSeek V4 Flash", supportsReasoning: true },
    { id: "deepseek-v4-pro-260425", name: "DeepSeek V4 Pro", supportsReasoning: true },
    { id: "kimi-k2-5-260127", name: "Kimi K2.5" },
    { id: "gpt-oss-120b-250805", name: "GPT-OSS-120B", supportsReasoning: true },
  ],
};
