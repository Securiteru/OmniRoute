import type { RegistryEntry } from "../../shared.ts";

export const nvidiaProvider: RegistryEntry = {
  id: "nvidia",
  alias: "nvidia",
  format: "openai",
  executor: "default",
  baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
  authType: "apikey",
  authHeader: "bearer",
  toolNameMaxLength: 64,
  // #6773: NVIDIA multiplexes models from multiple upstream vendors
  // (moonshotai/, deepseek-ai/, nvidia/, meta/, poolside/, google/, openai/)
  // behind ONE connection — mark it passthrough
  // so a single stale/renamed model's 404 locks out only that model instead
  // of cooling down the whole connection (see accountFallback.ts
  // hasPerModelQuota doc comment; matches modelscope/synthetic/kilo-gateway).
  passthroughModels: true,
  models: [
    { id: "moonshotai/kimi-k3", name: "Kimi K3" },
    {
      id: "deepseek-ai/deepseek-v4-pro-0813",
      name: "DeepSeek V4 Pro 0813",
      supportsReasoning: true,
    },
    {
      id: "deepseek-ai/deepseek-v4-flash-0731",
      name: "DeepSeek V4 Flash 0731",
      supportsReasoning: true,
    },
    { id: "meta/muse-glimmer-30b", name: "Muse Glimmer 30B" },
    { id: "poolside/laguna-xs-2.1", name: "Laguna XS 2.1" },
    { id: "google/gemma-4-31b-it", name: "Gemma 4 31B" },
    { id: "google/diffusiongemma-26b-a4b-it", name: "DiffusionGemma 26B A4B IT" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 3 Ultra 550B A55B" },
    { id: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 3 Super 120B A12B" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 3 Ultra 550B" },
    // Port of decolua/9router#2373 ("fix(nvidia): expand NIM chat model catalog"):
    // additional live-catalog models observed to serve /v1/chat/completions.
    // `minimaxai/minimax-m3` from that PR is intentionally NOT re-added — it stays
    // excluded per the #3329 guard (nvidia-minimax-m3-removed-3329.test.ts).
    // Non-chat entries from the same PR (nvidia/gliner-pii — NER tagger, not a chat
    // model; google/diffusiongemma-26b-a4b-it — diffusion model) are dropped for the
    // same reason: this registry only models the /v1/chat/completions surface.
    { id: "abacusai/dracarys-llama-3.1-70b-instruct", name: "Dracarys Llama 3.1 70B Instruct" },
    { id: "google/gemma-2-2b-it", name: "Gemma 2 2B IT" },
    { id: "google/gemma-3n-e2b-it", name: "Gemma 3n E2B IT" },
    { id: "meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B Instruct", toolCalling: false },
    {
      id: "meta/llama-3.2-11b-vision-instruct",
      name: "Llama 3.2 11B Vision Instruct",
      supportsVision: true,
    },
    { id: "meta/llama-3.2-1b-instruct", name: "Llama 3.2 1B Instruct" },
    { id: "meta/llama-3.2-3b-instruct", name: "Llama 3.2 3B Instruct", toolCalling: false },
    {
      id: "meta/llama-3.2-90b-vision-instruct",
      name: "Llama 3.2 90B Vision Instruct",
      supportsVision: true,
    },
    { id: "meta/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick 17B 128E Instruct" },
    { id: "meta/llama-guard-4-12b", name: "Llama Guard 4 12B", toolCalling: false },
    { id: "mistralai/ministral-14b-instruct-2512", name: "Ministral 14B Instruct 2512" },
    { id: "mistralai/mistral-medium-3.5-128b", name: "Mistral Medium 3.5 128B" },
    { id: "mistralai/mistral-nemotron", name: "Mistral Nemotron" },
    { id: "mistralai/mixtral-8x7b-instruct-v0.1", name: "Mixtral 8x7B Instruct v0.1" },
    {
      id: "nvidia/ising-calibration-1-35b-a3b",
      name: "Ising Calibration 1 35B A3B",
      supportsReasoning: true,
    },
    {
      id: "nvidia/llama-3.1-nemoguard-8b-content-safety",
      name: "Llama 3.1 Nemoguard 8B Content Safety",
    },
    {
      id: "nvidia/llama-3.1-nemoguard-8b-topic-control",
      name: "Llama 3.1 Nemoguard 8B Topic Control",
    },
    { id: "nvidia/llama-3.1-nemotron-nano-8b-v1", name: "Llama 3.1 Nemotron Nano 8B v1" },
    {
      id: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
      name: "Llama 3.1 Nemotron Nano VL 8B v1",
      supportsVision: true,
    },
    {
      id: "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
      name: "Llama 3.1 Nemotron Safety Guard 8B v3",
    },
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1", name: "Llama 3.3 Nemotron Super 49B v1" },
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5", name: "Llama 3.3 Nemotron Super 49B v1.5" },
    { id: "nvidia/nemotron-3-content-safety", name: "Nemotron 3 Content Safety" },
    {
      id: "nvidia/nemotron-3-nano-30b-a3b",
      name: "Nemotron 3 Nano 30B A3B",
      supportsReasoning: true,
    },
    {
      id: "nvidia/nemotron-3.5-lightning-30b-a3b",
      name: "Nemotron 3.5 Lightning 30B A3B",
    },
    {
      id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      name: "Nemotron 3 Nano Omni 30B A3B Reasoning",
      supportsReasoning: true,
      supportsVision: true,
    },
    { id: "openai/gpt-oss-120b", name: "GPT OSS 120B", toolCalling: false },
  ],
};
