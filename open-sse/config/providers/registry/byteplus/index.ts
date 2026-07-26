import type { RegistryEntry } from "../../shared.ts";

// BytePlus ModelArk (Ark) — OpenAI-compatible, ap-southeast-1 region, Bearer auth.
// All 51 models from /api/providers/24cff978-2a62-4999-984e-24da6506bbb0/models
export const byteplusProvider: RegistryEntry = {
  id: "byteplus",
  alias: "bpm",
  format: "openai",
  executor: "default",
  baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions",
  modelsUrl: "https://ark.ap-southeast.bytepluses.com/api/v3/models",
  authType: "apikey",
  authHeader: "bearer",
  defaultContextLength: 128000,
  models: [
    // DeepSeek
    { id: "deepseek-r1-250120", name: "DeepSeek R1 (250120)" },
    { id: "deepseek-r1-distill-qwen-32b-250120", name: "DeepSeek R1 Distill Qwen 32B" },
    { id: "deepseek-v3-241226", name: "DeepSeek V3 (241226)" },
    { id: "deepseek-v3", name: "DeepSeek V3" },
    { id: "deepseek-r1-250528", name: "DeepSeek R1 (250528)", supportsReasoning: true },
    { id: "deepseek-v3-1-250821", name: "DeepSeek V3.1" },
    { id: "deepseek-v3-2-251201", name: "DeepSeek V3.2" },
    { id: "deepseek-v4-pro-260425", name: "DeepSeek V4 Pro", supportsReasoning: true },
    { id: "deepseek-v4-flash-260425", name: "DeepSeek V4 Flash", supportsReasoning: true },
    // GLM
    { id: "glm-4-7-251222", name: "GLM 4.7" },
    { id: "glm-5-2-260617", name: "GLM 5.2", supportsReasoning: true },
    // GPT-OSS
    { id: "gpt-oss-120b-250805", name: "GPT-OSS-120B", supportsReasoning: true },
    // Kimi
    { id: "kimi-k2-250711", name: "Kimi K2 (250711)" },
    { id: "kimi-k2-250905", name: "Kimi K2 (250905)" },
    { id: "kimi-k2-thinking-251104", name: "Kimi K2 Thinking", supportsReasoning: true },
    // Skylark
    { id: "skylark-pro-250215", name: "Skylark Pro (250215)" },
    { id: "skylark-lite-250215", name: "Skylark Lite (250215)" },
    { id: "skylark-pro", name: "Skylark Pro" },
    { id: "skylark-vision-250515", name: "Skylark Vision", supportsVision: true },
    // Seed (text/code)
    { id: "seed-1-6-flash-250615", name: "Seed 1.6 Flash" },
    { id: "seed-1-6-250615", name: "Seed 1.6" },
    { id: "seed-1-6-flash-250715", name: "Seed 1.6 Flash (250715)" },
    { id: "seed-1-6-250915", name: "Seed 1.6 (250915)" },
    { id: "seed-translation-250915", name: "Seed Translation" },
    { id: "seed-1-8-251228", name: "Seed 1.8" },
    { id: "seed-2-0-mini-260215", name: "Seed 2.0 Mini" },
    { id: "seed-2-0-lite-260228", name: "Seed 2.0 Lite" },
    { id: "seed-2-0-pro-260328", name: "Seed 2.0 Pro" },
    { id: "seed-2-0-code-preview-260328", name: "Seed 2.0 Code Preview" },
    { id: "seed-2-0-mini-260428", name: "Seed 2.0 Mini (260428)" },
    { id: "seed-2-0-lite-260428", name: "Seed 2.0 Lite (260428)" },
    { id: "dola-seed-2-1-turbo-260628", name: "Dola Seed 2.1 Turbo" },
    // Doubao (Seed)
    { id: "doubao-seed-1-6-250615", name: "Doubao Seed 1.6" },
    { id: "doubao-seed-1-6-250915", name: "Doubao Seed 1.6 (250915)" },
    { id: "doubao-seed-1-6-flash-250615", name: "Doubao Seed 1.6 Flash" },
    { id: "doubao-seed-1-6-flash-250715", name: "Doubao Seed 1.6 Flash (250715)" },
    { id: "doubao-seed-1-6-flash-250828", name: "Doubao Seed 1.6 Flash (250828)" },
    { id: "doubao-seed-1-6-251015", name: "Doubao Seed 1.6 (251015)" },
    { id: "doubao-seed-1-8-251228", name: "Doubao Seed 1.8" },
    { id: "doubao-seed-2-0-pro-260215", name: "Doubao Seed 2.0 Pro" },
    { id: "doubao-seed-2-0-lite-260215", name: "Doubao Seed 2.0 Lite" },
    { id: "doubao-seed-2-0-mini-260215", name: "Doubao Seed 2.0 Mini" },
    { id: "doubao-seed-2-0-code-preview-260215", name: "Doubao Seed 2.0 Code Preview" },
    { id: "doubao-1-5-pro-32k-250115", name: "Doubao 1.5 Pro 32K" },
    { id: "doubao-pro-32k", name: "Doubao Pro 32K" },
  ],
};
