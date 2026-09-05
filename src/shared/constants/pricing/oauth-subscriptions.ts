/**
 * Pricing data — oauth-subscriptions family (OAuth / IDE subscription aliases (cc, codex, antigravity, copilot, kiro…)).
 * Pure data; merged by default-pricing.ts via spread (god-file decomposition; semantic split).
 */
import {
  CLAUDE_OPUS_4_PRICING,
  CLAUDE_OPUS_5_PRICING,
  CLAUDE_SONNET_4_PRICING,
  CLAUDE_SONNET_46_PRICING,
  CLAUDE_SONNET_5_PRICING,
  GEMINI_3_7_FLASH_PROMO_PRICING,
  GLM_PRICING,
  GPT_5_3_CODEX_PRICING,
  GPT_5_5_PRICING,
  GPT_5_6_LUNA_PRICING,
  GPT_5_6_SOL_PRICING,
  GPT_5_6_TERRA_PRICING,
} from "./shared-tiers";

const ANTIGRAVITY_GEMINI_3_7_PRICING = {
  "gemini-3.7-flash-low": GEMINI_3_7_FLASH_PROMO_PRICING,
  "gemini-3.7-flash-medium": GEMINI_3_7_FLASH_PROMO_PRICING,
  "gemini-3.7-flash-high": GEMINI_3_7_FLASH_PROMO_PRICING,
};

export const DEFAULT_PRICING_OAUTH = {
  cc: {
    "claude-fable-5": {
      input: 10.0,
      output: 50.0,
      cached: 1.0,
      reasoning: 50.0,
      cache_creation: 12.5,
    },
    "claude-opus-5": CLAUDE_OPUS_5_PRICING,
    "claude-opus-4-8": {
      input: 5.0,
      output: 25.0,
      cached: 0.5,
      reasoning: 25.0,
      cache_creation: 6.25,
    },
    "claude-opus-4-7": {
      input: 5.0,
      output: 25.0,
      cached: 0.5,
      reasoning: 25.0,
      cache_creation: 6.25,
    },
    "claude-opus-4-6": {
      input: 5.0,
      output: 25.0,
      cached: 0.5,
      reasoning: 25.0,
      cache_creation: 6.25,
    },
    "claude-sonnet-4-6": {
      input: 3.0,
      output: 15.0,
      cached: 0.3,
      reasoning: 15.0,
      cache_creation: 3.75,
    },
    "claude-sonnet-5": {
      input: 3.0,
      output: 15.0,
      cached: 0.3,
      reasoning: 15.0,
      cache_creation: 3.75,
    },
    "claude-opus-4-5-20251101": {
      input: 5.0,
      output: 25.0,
      cached: 0.5,
      reasoning: 25.0,
      cache_creation: 6.25,
    },
    "claude-sonnet-4-5-20250929": {
      input: 3.0,
      output: 15.0,
      cached: 0.3,
      reasoning: 15.0,
      cache_creation: 3.75,
    },
    "claude-haiku-4-5-20251001": {
      input: 1.0,
      output: 5.0,
      cached: 0.1,
      reasoning: 5.0,
      cache_creation: 1.25,
    },
  },
  cx: {
    "codex-auto-review": GPT_5_5_PRICING,
    // Codex uses credits per 1M tokens. OmniRoute stores the dollar-equivalent
    // values below at the documented conversion of 25 credits per USD.
    "gpt-5.6-sol": GPT_5_6_SOL_PRICING,
    "gpt-5.6-sol-ultra": GPT_5_6_SOL_PRICING,
    "gpt-5.6-sol-max": GPT_5_6_SOL_PRICING,
    "gpt-5.6-sol-xhigh": GPT_5_6_SOL_PRICING,
    "gpt-5.6-sol-high": GPT_5_6_SOL_PRICING,
    "gpt-5.6-sol-medium": GPT_5_6_SOL_PRICING,
    "gpt-5.6-sol-low": GPT_5_6_SOL_PRICING,
    "gpt-5.6-terra": GPT_5_6_TERRA_PRICING,
    "gpt-5.6-terra-ultra": GPT_5_6_TERRA_PRICING,
    "gpt-5.6-terra-max": GPT_5_6_TERRA_PRICING,
    "gpt-5.6-terra-xhigh": GPT_5_6_TERRA_PRICING,
    "gpt-5.6-terra-high": GPT_5_6_TERRA_PRICING,
    "gpt-5.6-terra-medium": GPT_5_6_TERRA_PRICING,
    "gpt-5.6-terra-low": GPT_5_6_TERRA_PRICING,
    "gpt-5.6-luna": GPT_5_6_LUNA_PRICING,
    "gpt-5.6-luna-max": GPT_5_6_LUNA_PRICING,
    "gpt-5.6-luna-xhigh": GPT_5_6_LUNA_PRICING,
    "gpt-5.6-luna-high": GPT_5_6_LUNA_PRICING,
    "gpt-5.6-luna-medium": GPT_5_6_LUNA_PRICING,
    "gpt-5.6-luna-low": GPT_5_6_LUNA_PRICING,
    // GPT 5.5
    "gpt-5.5": GPT_5_5_PRICING,
    "gpt5.5": GPT_5_5_PRICING,
    "gpt-5.5-xhigh": GPT_5_5_PRICING,
    "gpt-5.5-high": GPT_5_5_PRICING,
    "gpt-5.5-medium": GPT_5_5_PRICING,
    "gpt-5.5-low": GPT_5_5_PRICING,
    "gpt-5.5-none": GPT_5_5_PRICING,
    // GPT 5.3 Codex family (all same pricing tier)
    "gpt-5.3-codex-spark": GPT_5_3_CODEX_PRICING,
    "gpt-5.3-codex": GPT_5_3_CODEX_PRICING,
    "gpt-5.3-codex-xhigh": GPT_5_3_CODEX_PRICING,
    "gpt-5.3-codex-high": GPT_5_3_CODEX_PRICING,
    "gpt-5.3-codex-low": GPT_5_3_CODEX_PRICING,
    "gpt-5.3-codex-none": GPT_5_3_CODEX_PRICING,
    "gpt-5.1-codex-mini-high": {
      input: 1.5,
      output: 6.0,
      cached: 0.75,
      reasoning: 9.0,
      cache_creation: 1.5,
    },
    "gpt-5.2-codex": {
      input: 5.0,
      output: 20.0,
      cached: 2.5,
      reasoning: 30.0,
      cache_creation: 5.0,
    },

    "gpt-5.2": {
      input: 5.0,
      output: 20.0,
      cached: 2.5,
      reasoning: 30.0,
      cache_creation: 5.0,
    },
    "gpt-5.1-codex-max": {
      input: 8.0,
      output: 32.0,
      cached: 4.0,
      reasoning: 48.0,
      cache_creation: 8.0,
    },
    "gpt-5.1-codex": {
      input: 4.0,
      output: 16.0,
      cached: 2.0,
      reasoning: 24.0,
      cache_creation: 4.0,
    },
    "gpt-5.1-codex-mini": {
      input: 1.5,
      output: 6.0,
      cached: 0.75,
      reasoning: 9.0,
      cache_creation: 1.5,
    },
    "gpt-5.1": {
      input: 4.0,
      output: 16.0,
      cached: 2.0,
      reasoning: 24.0,
      cache_creation: 4.0,
    },
    "gpt-5-codex": {
      input: 3.0,
      output: 12.0,
      cached: 1.5,
      reasoning: 18.0,
      cache_creation: 3.0,
    },
    "gpt-5-codex-mini": {
      input: 1.0,
      output: 4.0,
      cached: 0.5,
      reasoning: 6.0,
      cache_creation: 1.0,
    },
  },
  if: {
    "qwen3-coder-plus": {
      input: 1.0,
      output: 4.0,
      cached: 0.5,
      reasoning: 6.0,
      cache_creation: 1.0,
    },
    "kimi-k2": {
      input: 1.0,
      output: 4.0,
      cached: 0.5,
      reasoning: 6.0,
      cache_creation: 1.0,
    },
    "kimi-k2-thinking": {
      input: 1.5,
      output: 6.0,
      cached: 0.75,
      reasoning: 9.0,
      cache_creation: 1.5,
    },
    "deepseek-r1": {
      input: 0.75,
      output: 3.0,
      cached: 0.375,
      reasoning: 4.5,
      cache_creation: 0.75,
    },
    "deepseek-v3.2-chat": {
      input: 0.28,
      output: 0.42,
      cached: 0.014,
      reasoning: 0.63,
      cache_creation: 0.28,
    },
    "deepseek-v3.2": {
      input: 0.28,
      output: 0.42,
      cached: 0.014,
      reasoning: 0.63,
      cache_creation: 0.28,
    },
    "deepseek-v3.2-reasoner": {
      input: 0.55,
      output: 2.19,
      cached: 0.14,
      reasoning: 2.19,
      cache_creation: 0.55,
    },
    // Short-form aliases (Mar 2026)
    "deepseek-3.1": {
      input: 0.27,
      output: 1.1,
      cached: 0.07,
      reasoning: 2.2,
      cache_creation: 0.27,
    },
    "deepseek-3.2": {
      input: 0.27,
      output: 1.1,
      cached: 0.07,
      reasoning: 2.2,
      cache_creation: 0.27,
    },
    "minimax-m2": {
      input: 0.5,
      output: 2.0,
      cached: 0.25,
      reasoning: 3.0,
      cache_creation: 0.5,
    },
    "glm-4.6": {
      input: 0.5,
      output: 2.0,
      cached: 0.25,
      reasoning: 3.0,
      cache_creation: 0.5,
    },
    "glm-4.7": {
      input: 0.75,
      output: 3.0,
      cached: 0.375,
      reasoning: 4.5,
      cache_creation: 0.75,
    },
  },
  ag: {
    "gemini-3.1-pro-low": {
      input: 2.0,
      output: 12.0,
      cached: 0.25,
      reasoning: 18.0,
      cache_creation: 2.0,
    },
    "gemini-pro-agent": {
      input: 4.0,
      output: 18.0,
      cached: 0.5,
      reasoning: 27.0,
      cache_creation: 4.0,
    },
    ...ANTIGRAVITY_GEMINI_3_7_PRICING,
    "claude-sonnet-4-6": {
      input: 3.0,
      output: 15.0,
      cached: 0.3,
      reasoning: 22.5,
      cache_creation: 3.0,
    },
    "claude-opus-4-6-thinking": {
      input: 5.0,
      output: 25.0,
      cached: 0.5,
      reasoning: 37.5,
      cache_creation: 5.0,
    },
    "gpt-oss-120b-medium": {
      input: 0.5,
      output: 2.0,
      cached: 0.25,
      reasoning: 3.0,
      cache_creation: 0.5,
    },
  },
  antigravity: ANTIGRAVITY_GEMINI_3_7_PRICING,
  agy: ANTIGRAVITY_GEMINI_3_7_PRICING,
  gh: {
    "claude-opus-5": CLAUDE_OPUS_5_PRICING,
    "gpt-5": {
      input: 3.0,
      output: 12.0,
      cached: 1.5,
      reasoning: 18.0,
      cache_creation: 3.0,
    },
    "gpt-5-mini": {
      input: 0.75,
      output: 3.0,
      cached: 0.375,
      reasoning: 4.5,
      cache_creation: 0.75,
    },
    "gpt-5.1-codex": {
      input: 4.0,
      output: 16.0,
      cached: 2.0,
      reasoning: 24.0,
      cache_creation: 4.0,
    },
    "gpt-5.1-codex-max": {
      input: 8.0,
      output: 32.0,
      cached: 4.0,
      reasoning: 48.0,
      cache_creation: 8.0,
    },
    "gpt-4.1": {
      input: 2.5,
      output: 10.0,
      cached: 1.25,
      reasoning: 15.0,
      cache_creation: 2.5,
    },
    "claude-4.5-sonnet": {
      input: 3.0,
      output: 15.0,
      cached: 0.3,
      reasoning: 22.5,
      cache_creation: 3.0,
    },
    "claude-4.5-opus": {
      input: 5.0,
      output: 25.0,
      cached: 0.5,
      reasoning: 37.5,
      cache_creation: 5.0,
    },
    "claude-4.5-haiku": {
      input: 0.5,
      output: 2.5,
      cached: 0.05,
      reasoning: 3.75,
      cache_creation: 0.5,
    },
    "gemini-3-pro": {
      input: 2.0,
      output: 12.0,
      cached: 0.25,
      reasoning: 18.0,
      cache_creation: 2.0,
    },
    "gemini-3-flash": {
      input: 0.5,
      output: 3.0,
      cached: 0.03,
      reasoning: 4.5,
      cache_creation: 0.5,
    },
    "gemini-3.7-flash": GEMINI_3_7_FLASH_PROMO_PRICING,
    "gemini-2.5-pro": {
      input: 2.0,
      output: 12.0,
      cached: 0.25,
      reasoning: 18.0,
      cache_creation: 2.0,
    },
    "grok-code-fast-1": {
      input: 0.5,
      output: 2.0,
      cached: 0.25,
      reasoning: 3.0,
      cache_creation: 0.5,
    },
  },
  kiro: {
    "claude-sonnet-4.5": {
      input: 3.0,
      output: 15.0,
      cached: 1.5,
      reasoning: 15.0,
      cache_creation: 3.0,
    },
    "claude-haiku-4.5": {
      input: 0.5,
      output: 2.5,
      cached: 0.25,
      reasoning: 2.5,
      cache_creation: 0.5,
    },
    "claude-sonnet-5": {
      input: 3.0,
      output: 15.0,
      cached: 1.5,
      reasoning: 15.0,
      cache_creation: 3.0,
    },
    "deepseek-v3.2": {
      input: 0.27,
      output: 1.1,
      cached: 0.07,
      reasoning: 1.1,
      cache_creation: 0.27,
    },
    // Registry exposes this model as "deepseek-3.2" (no "v") — keep both keys priced.
    "deepseek-3.2": {
      input: 0.27,
      output: 1.1,
      cached: 0.07,
      reasoning: 1.1,
      cache_creation: 0.27,
    },
    "minimax-m2.1": {
      input: 0.4,
      output: 1.6,
      cached: 0.1,
      reasoning: 1.6,
      cache_creation: 0.4,
    },
    // MiniMax M2.5 — cheaper than M2.1, reasoning + tools
    "minimax-m2.5": {
      input: 0.27,
      output: 0.95,
      cached: 0.135,
      reasoning: 1.425,
      cache_creation: 0.27,
    },
    "glm-5": {
      input: 1.0,
      output: 3.2,
      cached: 0.2,
      reasoning: 4.8,
      cache_creation: 1.0,
    },
    "qwen3-coder-next": {
      input: 2.0,
      output: 8.0,
      cached: 0.5,
      reasoning: 8.0,
      cache_creation: 2.0,
    },
    // Kiro "Auto" pricing — retained for both the upstream "auto" id and the
    // local "auto-kiro" selector. The translator maps auto-kiro back to auto.
    auto: {
      input: 3.0,
      output: 15.0,
      cached: 1.5,
      reasoning: 15.0,
      cache_creation: 3.0,
    },
    "auto-kiro": {
      input: 3.0,
      output: 15.0,
      cached: 1.5,
      reasoning: 15.0,
      cache_creation: 3.0,
    },
    // Kiro's GPT-5.6 family (kiro.dev/changelog/models, 2026-07-14) — same
    // per-tier rates the codex/openai aliases already bill at.
    "gpt-5.6-sol": GPT_5_6_SOL_PRICING,
    "gpt-5.6-terra": GPT_5_6_TERRA_PRICING,
    "gpt-5.6-luna": GPT_5_6_LUNA_PRICING,
  },
  // #5460/#5465 — coding-plan OAuth / noauth providers were missing pricing
  // rows, so getPricingForModel returned null and downstream cost / quota
  // calculations silently fell back to $0 (UI showed `$0.00` or `—` for
  // providers with non-zero token activity: Kilo Code 11.6M, OpenCode Free
  // 106M over 30d; Minimax Coding 165M was also affected but its `minimax:`
  // key was already defined in `regional.ts` and won the spread-merge).
  //
  // Convention used below:
  //   - Pass-through models (Claude / GPT-5.6 / DeepSeek / GLM / Qwen /
  //     MiniMax) → bill at the upstream $/MTok rate, matching what `kiro:`
  //     / `cc:` already bill at for the same model id.
  //   - Genuinely free models (Kilo `free` router, OpenCode Free `*-free`)
  //     → explicit 0.0 across all five rate fields so the UI shows `$0.00`
  //     instead of `—`.
  //   - Unknown / not-yet-routed models → left out intentionally; the
  //     lookup will keep returning null for those (preserves the existing
  //     `source:"local_catalog",intentional:true` skip path on the API).
  kc: {
    // Kilo Code — anonymous-fallback OAuth coding plan (free + paid tiers).
    // Upstream-model rows mirror `kiro:` / `cc:` rates so the Cost Explorer
    // totals match what the same model would bill on a paid subscription.
    "claude-opus-4.8": CLAUDE_OPUS_4_PRICING,
    "claude-opus-4.7": CLAUDE_OPUS_4_PRICING,
    "claude-opus-4.6": CLAUDE_OPUS_4_PRICING,
    "claude-opus-4.5": CLAUDE_OPUS_4_PRICING,
    "claude-opus-4.1": CLAUDE_OPUS_4_PRICING,
    "claude-opus-4": CLAUDE_OPUS_4_PRICING,
    "claude-sonnet-5": CLAUDE_SONNET_5_PRICING,
    "claude-sonnet-4.6": CLAUDE_SONNET_46_PRICING,
    "claude-sonnet-4.5": CLAUDE_SONNET_4_PRICING,
    "claude-sonnet-4": CLAUDE_SONNET_4_PRICING,
    "claude-haiku-4.5": {
      input: 0.5,
      output: 2.5,
      cached: 0.05,
      reasoning: 2.5,
      cache_creation: 0.5,
    },
    "claude-3-haiku": {
      input: 0.25,
      output: 1.25,
      cached: 0.03,
      reasoning: 1.25,
      cache_creation: 0.25,
    },
    "gpt-5.5": GPT_5_5_PRICING,
    "gpt-5.6-sol": GPT_5_6_SOL_PRICING,
    "gpt-5.6-terra": GPT_5_6_TERRA_PRICING,
    "gpt-5.6-luna": GPT_5_6_LUNA_PRICING,
    "deepseek-v4-pro": {
      input: 0.27,
      output: 1.1,
      cached: 0.07,
      reasoning: 1.1,
      cache_creation: 0.27,
    },
    "deepseek-v4-flash": {
      input: 0.06,
      output: 0.24,
      cached: 0.015,
      reasoning: 0.24,
      cache_creation: 0.06,
    },
    "minimax-m3": {
      input: 0.5,
      output: 2.0,
      cached: 0.25,
      reasoning: 3.0,
      cache_creation: 0.5,
    },
    "minimax-m2.7": {
      input: 0.3,
      output: 1.2,
      cached: 0.075,
      reasoning: 1.2,
      cache_creation: 0.3,
    },
    "minimax-m2.5": {
      input: 0.27,
      output: 0.95,
      cached: 0.135,
      reasoning: 1.425,
      cache_creation: 0.27,
    },
    "minimax-m2.1": {
      input: 0.4,
      output: 1.6,
      cached: 0.1,
      reasoning: 1.6,
      cache_creation: 0.4,
    },
    "glm-5.2": GLM_PRICING["glm-5.2"],
    "qwen3.7-plus": {
      input: 0.4,
      output: 1.2,
      cached: 0.06,
      reasoning: 1.2,
      cache_creation: 0.4,
    },
    "kimi-k3": {
      input: 0.6,
      output: 2.5,
      cached: 0.15,
      reasoning: 2.5,
      cache_creation: 0.6,
    },
    // Kilo's free routing tier (`kilo-auto/free`) and the explicit
    // anonymous-fallback `free` selector — both are $0 to the end user.
    free: { input: 0, output: 0, cached: 0, reasoning: 0, cache_creation: 0 },
    "kilo-auto/free": { input: 0, output: 0, cached: 0, reasoning: 0, cache_creation: 0 },
    "kilo-auto/balanced": {
      // Kilo Pro / balanced router — paid tier, ~$0 amortized across the
      // blended Claude/GPT/DeepSeek mix. Update once Kilo publishes a
      // per-tier rate card.
      input: 1.0,
      output: 4.0,
      cached: 0.25,
      reasoning: 4.0,
      cache_creation: 1.0,
    },
    "kilo-auto/efficient": {
      input: 0.4,
      output: 1.6,
      cached: 0.1,
      reasoning: 1.6,
      cache_creation: 0.4,
    },
    "kilo-auto/frontier": CLAUDE_OPUS_4_PRICING,
    "kilo-auto/small": {
      input: 0.1,
      output: 0.4,
      cached: 0.025,
      reasoning: 0.4,
      cache_creation: 0.1,
    },
  },
  oc: {
    // OpenCode Free — public anonymous endpoint (`noAuth: true`,
    // `hasFree: true`). All models on the public endpoint are zero-cost
    // to the caller. Rows cover every model seen in the Cost Explorer
    // (incl. the explicit `*-free` suffixes from the free-catalog data)
    // so `getPricingForModel` never returns null for OpenCode and the
    // dashboard stops showing `—`.
    "deepseek-v4-flash-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "deepseek-v4-pro-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "minimax-m2.5-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "minimax-m2.7-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "minimax-m3-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "ling-2.6-1t-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "ling-3.0-flash:free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "trinity-large-preview-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "nemotron-3-super-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "nemotron-3-ultra-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "qwen3.6-plus-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "kimi-k2-thinking-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "mimo-v2.5-free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "big-pickle": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "kat-coder-pro-v2.5:free": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
  },
  // MiniMax Coding (minimax.io) was deliberately NOT added here — its
  // pricing block already lives in `regional.ts` and the spread-merge
  // order in `default-pricing.ts` (REGIONAL last) means the regional
  // rates win. If a coding-plan OAuth alias for MiniMax is ever added,
  // put its rows here and rename the regional key to avoid the collision.
};
