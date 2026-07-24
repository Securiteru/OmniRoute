/**
 * openrouterPricingLookup.ts — Fallback to OpenRouter's public pricing for any
 * model when the local pricing rows don't have it.
 *
 * The OmniRoute fork maintains its own per-provider pricing for popular
 * providers (OpenAI, Anthropic, Mistral, DeepSeek, GLM, etc.), but the Cost
 * Explorer was rendering $0.00 for every token routed through a flat-rate /
 * coding-plan provider (Minimax Coding, GLM Coding, Kiro, Kilo Code, OpenCode
 * Free, Qwen Web, …) because those providers carry no per-token pricing row
 * and the cost calculator was set to `flatRateAsZero: true` for them (#5552).
 *
 * The user's request was: "use the pricing from OPENROUTER for that model.
 * Be careful that sometimes models are prefixed by the providers or use `.`
 * instead of `-`."  OpenRouter maintains the most complete public list of
 * model list-prices, so we look up any unknown model there as a fallback
 * BEFORE rendering $0.00. The label is still the user's actual provider
 * (e.g. "Minimax Coding"); only the cost-estimation primitive uses the
 * upstream public rate.
 *
 * The lookup is synchronous and reads the catalog from the on-disk cache
 * (`/data/cache/openrouter-catalog.json` or `process.cwd()/data/cache/...`).
 * The cache is refreshed periodically by `openrouterCatalog.refreshOpenRouterCatalog`.
 * On a cold start the cache may be stale or missing; in that case the lookup
 * returns null and the cost falls back to whatever the local rows say.
 *
 * Model-name normalization (the "be careful" part):
 * 1. Drop any leading `<provider>/` prefix from the model (the user can pass
 *    `anthropic/claude-3-opus` or `claude-3-opus`; both should match).
 * 2. Lowercase for case-insensitive matching (the DB stores `MiniMax-M3`,
 *    OpenRouter stores `minimax-m3`).
 * 3. Generate candidates by:
 *    - keeping the model name as-is,
 *    - swapping every `.` for `-` and vice versa (the DB sometimes records
 *      `mistral-medium-3.5` and the catalog has `mistral-medium-3-5`),
 *    - dropping a trailing `:free` (OpenRouter convention; the DB may carry
 *      `kilo-auto/free` while the catalog row is `provider/foo:free`).
 * 4. Return the first catalog entry whose `<provider>/<name>` matches any
 *    candidate (case-insensitive).
 *
 * The conversion from OpenRouter's per-token rate to OmniRoute's per-1M-token
 * rate multiplies by 1_000_000. OpenRouter also exposes `input_cache_read`
 * which maps to OmniRoute's `cached`, and `input_cache_write` to
 * `cache_creation`. Reasoning (extended-thinking) is a separate dimension that
 * OpenRouter does NOT publish — we leave it unset so the cost calculator
 * falls back to the output rate (its default behavior).
 *
 * @module lib/pricing/openrouterPricingLookup
 */

import fs from "node:fs";
import path from "node:path";

interface OpenRouterPricing {
  prompt?: string;
  completion?: string;
  input_cache_read?: string;
  input_cache_write?: string;
  // OpenRouter-specific dimensions we don't need to translate:
  image?: string;
  request?: string;
  web_search?: string;
  input_cache_write_1h?: string;
}

interface OpenRouterCatalogEntry {
  id: string;
  pricing?: OpenRouterPricing;
}

interface OpenRouterCatalogFile {
  fetchedAt: string;
  data: OpenRouterCatalogEntry[];
}

type PricingEntry = {
  input: number;
  output: number;
  cached?: number;
  cache_creation?: number;
  /** Source tag — the UI surfaces this as "Estimated upstream value". */
  source: "openrouter";
  /** OpenRouter's `provider/model` id, for debugging / tooltips. */
  openrouterId?: string;
};

function getCacheFilePath(): string {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  return path.join(dataDir, "cache", "openrouter-catalog.json");
}

/** Read the OpenRouter catalog from the on-disk cache. Returns [] on miss / parse error. */
export function readOpenRouterCatalogSync(): OpenRouterCatalogEntry[] {
  const filePath = getCacheFilePath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as OpenRouterCatalogFile;
    return Array.isArray(parsed.data) ? parsed.data : [];
  } catch {
    return [];
  }
}

/**
 * Build a fast lookup index: lowercased `<provider>/<name>` → entry.
 * Callers should reuse the index across many lookups; the function is
 * exported separately so tests can pin behavior without re-reading the file.
 */
export function buildOpenRouterIndex(
  entries: OpenRouterCatalogEntry[]
): Map<string, OpenRouterCatalogEntry> {
  const idx = new Map<string, OpenRouterCatalogEntry>();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id) continue;
    idx.set(entry.id.toLowerCase(), entry);
  }
  return idx;
}

/**
 * Strip any leading `<provider>/` prefix from a model id. We use a very small
 * allowlist of well-known provider prefixes (matching the OpenRouter catalog
 * naming) to avoid accidentally stripping a `claude-3-opus/foo` style suffix
 * that the user actually wants to keep.
 */
const OPENROUTER_PROVIDER_PREFIXES: ReadonlySet<string> = new Set([
  "anthropic",
  "openai",
  "google",
  "x-ai",
  "mistralai",
  "deepseek",
  "minimax",
  "z-ai",
  "qwen",
  "moonshotai",
  "meta-llama",
  "cohere",
  "perplexity",
  "nousresearch",
  "microsoft",
  "amazon",
  "ai21",
  "nvidia",
  "01-ai",
  "alibaba",
  "baidu",
  "tencent",
  "stepfun",
  "xiaomi",
  "bytedance",
  "inclusionai",
  "cognitivecomputations",
  "poolside",
  "nvidia",
  "openrouter",
  "kilo",
  "kilocode",
  "opencode",
  "kiro",
  "agy",
  "antigravity",
  "claude",
  "claude-code",
  "codex",
  "github",
  "huggingface",
  "huggingchat",
  "venice",
  "featherless",
  "inworld",
  "runway",
  "elevenlabs",
  "cartesia",
  "groq",
  "cerebras",
  "fireworks",
  "together",
  "lambda",
  "sambanova",
  "nscale",
  "baseten",
  "publicai",
  "friendli",
  "wandb",
  "inference-net",
  "predibase",
  "bytez",
  "monsterapi",
  "modelscope",
  "byteplus",
  "digitalocean",
  "vercel",
  "nebius",
  "siliconflow",
  "hyperbolic",
  "ollama",
  "ollama-cloud",
  "deepinfra",
  "felo",
  "muse",
  "muse-spark",
  "llama-cpp",
  "llamacpp",
  "lm-studio",
  "ollama-local",
  "duckduckgo",
]);

function stripProviderPrefix(model: string): string {
  if (!model || typeof model !== "string") return model;
  const slashIdx = model.indexOf("/");
  if (slashIdx <= 0) return model;
  const prefix = model.slice(0, slashIdx).toLowerCase();
  if (OPENROUTER_PROVIDER_PREFIXES.has(prefix)) {
    return model.slice(slashIdx + 1);
  }
  return model;
}

/**
 * Generate candidate model names to try against the OpenRouter index, in
 * priority order. The DB may store `mistral-medium-3.5` while the catalog
 * has `mistral-medium-3-5`; we try both. OpenRouter also has a `:free`
 * convention for free-tier rows; we strip the suffix.
 */
function generateModelCandidates(model: string): string[] {
  if (!model || typeof model !== "string") return [];
  const lower = model.toLowerCase();
  const stripped = lower.endsWith(":free") ? lower.slice(0, -":free".length) : lower;
  // We also strip a trailing "/free" (kilo-auto convention).
  const strippedAlt = stripped.endsWith("/free") ? stripped.slice(0, -"/free".length) : stripped;
  const dashVariant = strippedAlt.replace(/\./g, "-");
  const dotVariant = strippedAlt.replace(/-/g, ".");
  const candidates = new Set<string>();
  candidates.add(stripped);
  candidates.add(strippedAlt);
  candidates.add(dashVariant);
  candidates.add(dotVariant);
  return Array.from(candidates);
}

/**
 * Look up the OpenRouter pricing for a model. Returns null if not found in
 * the cache OR if the cache is missing.
 *
 * The provider argument is a hint — if known, we only consider catalog rows
 * under that provider's namespace. If unknown (most common — the cost row
 * has `provider="ADI_SUB"`, model=`MiniMax-M3`), we scan all providers
 * because the model itself is the unique signal.
 */
export function lookupOpenRouterPricing(
  provider: string | null | undefined,
  model: string | null | undefined
): PricingEntry | null {
  if (!model || typeof model !== "string") return null;
  const entries = readOpenRouterCatalogSync();
  if (entries.length === 0) return null;
  const idx = buildOpenRouterIndex(entries);

  const bare = stripProviderPrefix(model);
  const candidates = generateModelCandidates(bare);

  // First, try the canonical OpenRouter `<provider>/<name>` form. The provider
  // hint can be either the OpenRouter namespace ("anthropic") or the OmniRoute
  // id ("cc"); the caller will have already aliased, but we accept both.
  const providerLower = (provider || "").toLowerCase().trim();
  if (providerLower) {
    for (const candidate of candidates) {
      const id = `${providerLower}/${candidate}`;
      const entry = idx.get(id);
      if (entry?.pricing) {
        return buildEntry(entry.pricing, entry.id);
      }
    }
  }

  // Fallback: scan all entries for the first match on any candidate.
  for (const candidate of candidates) {
    for (const [id, entry] of idx.entries()) {
      // `id` is `<provider>/<name>`; we only need to compare the trailing
      // portion to the candidate.
      const slashIdx = id.lastIndexOf("/");
      const name = slashIdx >= 0 ? id.slice(slashIdx + 1) : id;
      if (name === candidate && entry?.pricing) {
        return buildEntry(entry.pricing, entry.id);
      }
    }
  }

  return null;
}

function buildEntry(pricing: OpenRouterPricing, openrouterId: string): PricingEntry | null {
  const input = parseRate(pricing.prompt);
  const output = parseRate(pricing.completion);
  if (input === null || output === null) return null;

  const entry: PricingEntry = {
    input,
    output,
    source: "openrouter",
    openrouterId,
  };

  const cached = parseRate(pricing.input_cache_read);
  if (cached !== null) entry.cached = cached;

  const cacheCreation = parseRate(pricing.input_cache_write);
  if (cacheCreation !== null) entry.cache_creation = cacheCreation;

  return entry;
}

/** Parse a per-token USD rate string and return the per-1M-tokens rate. */
function parseRate(raw: string | undefined | null): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  // Per-token → per-1M-tokens. Round to 6 decimals to drop binary-FP artifacts
  // (e.g. 0.00000030000004 becomes 0.30 instead of 0.30000004).
  return Math.round(parsed * 1_000_000 * 1_000_000) / 1_000_000;
}

export type { PricingEntry as OpenRouterPricingEntry };
