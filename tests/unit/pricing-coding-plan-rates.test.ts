import test from "node:test";
import assert from "node:assert/strict";

import { getDefaultPricing, getPricingForModel } from "../../src/shared/constants/pricing.ts";

// #5460/#5465 — coding-plan OAuth / free providers were missing pricing
// rows, so getPricingForModel returned null and downstream cost / quota
// calculations silently fell back to $0 (UI showed `$0.00` or `—` for
// providers with non-zero token activity: Kilo Code 11.6M, OpenCode Free
// 106M, Minimax Coding 165M over 30d).
//
// The 30d-byProvider snapshot pulled from the deployed OmniRoute at
// 2026-07-24 was the source of truth for "which models are actually in
// use and need a price row today". New rows should be added the same way
// the kiro: / cc: / ag: blocks grow: look at the live byModel feed and
// mirror the upstream tier rates that the existing paid-coding-plan blocks
// already bill at.
//
// Convention enforced by these tests:
//   - Pass-through models (Claude / GPT-5.6 / DeepSeek / GLM / Qwen /
//     MiniMax) → match the upstream $/MTok rate used by `kiro:` / `cc:`
//     for the same model id, so cross-provider totals stay comparable.
//   - Genuinely free models (Kilo `free` router, OpenCode `*-free`) →
//     all five rate fields are exactly 0, so the UI shows `$0.00` and
//     not `—`.
//   - getPricingForModel is a non-null lookup for every model id the
//     Cost Explorer saw over 30d, so the dashboard stop falling back to
//     `$0.00` for providers that have non-zero token activity.

// ─── kc — Kilo Code ───────────────────────────────────────────────────────

test("kc/claude-opus-4.8 matches the upstream Opus 4 rate (parity with kiro:)", () => {
  const p = getDefaultPricing().kc["claude-opus-4.8"];
  assert.equal(p.input, 15.0);
  assert.equal(p.output, 75.0);
  assert.equal(p.cached, 7.5);
  assert.equal(p.reasoning, 112.5);
  assert.equal(p.cache_creation, 15.0);
});

test("kc/claude-sonnet-4.6 matches the upstream Sonnet 4.6 rate", () => {
  const p = getDefaultPricing().kc["claude-sonnet-4.6"];
  assert.equal(p.input, 3.0);
  assert.equal(p.output, 15.0);
  assert.equal(p.cached, 1.5);
  assert.equal(p.reasoning, 22.5);
  assert.equal(p.cache_creation, 3.0);
});

test("kc/gpt-5.6-sol is the shared GPT-5.6 SOL tier", () => {
  const p = getDefaultPricing().kc["gpt-5.6-sol"];
  assert.equal(p.input, 5.0);
  assert.equal(p.output, 30.0);
  assert.equal(p.cached, 0.5);
  assert.equal(p.reasoning, 30.0);
  assert.equal(p.cache_creation, 6.25);
});

test("kc/free is explicitly zero so the dashboard shows $0.00 (not —)", () => {
  const p = getDefaultPricing().kc.free;
  assert.equal(p.input, 0);
  assert.equal(p.output, 0);
  assert.equal(p.cached, 0);
  assert.equal(p.reasoning, 0);
  assert.equal(p.cache_creation, 0);
});

test("kc/kilo-auto/free is explicitly zero (anonymous-fallback router)", () => {
  const p = getDefaultPricing().kc["kilo-auto/free"];
  assert.equal(p.input, 0);
  assert.equal(p.output, 0);
  assert.equal(p.cached, 0);
  assert.equal(p.reasoning, 0);
  assert.equal(p.cache_creation, 0);
});

test("kc/kilo-auto/frontier matches the Opus 4 rate (frontier tier routes to Claude)", () => {
  const p = getDefaultPricing().kc["kilo-auto/frontier"];
  assert.equal(p.input, 15.0);
  assert.equal(p.output, 75.0);
  assert.equal(p.cached, 7.5);
});

// ─── oc — OpenCode Free ───────────────────────────────────────────────────

test("oc/*-free rows are all-zero (genuinely free anonymous endpoint)", () => {
  const pricing = getDefaultPricing().oc;
  for (const modelId of [
    "deepseek-v4-flash-free",
    "deepseek-v4-pro-free",
    "minimax-m2.5-free",
    "minimax-m2.7-free",
    "minimax-m3-free",
    "ling-2.6-1t-free",
    "ling-3.0-flash:free",
    "trinity-large-preview-free",
    "nemotron-3-super-free",
    "nemotron-3-ultra-free",
    "qwen3.6-plus-free",
    "kimi-k2-thinking-free",
    "mimo-v2.5-free",
    "big-pickle",
    "kat-coder-pro-v2.5:free",
  ]) {
    const p = pricing[modelId];
    assert.ok(p, `oc/${modelId} should have a pricing row`);
    assert.equal(p.input, 0, `oc/${modelId}.input`);
    assert.equal(p.output, 0, `oc/${modelId}.output`);
    assert.equal(p.cached, 0, `oc/${modelId}.cached`);
    assert.equal(p.reasoning, 0, `oc/${modelId}.reasoning`);
    assert.equal(p.cache_creation, 0, `oc/${modelId}.cache_creation`);
  }
});

// ─── minimax — MiniMax Coding ─────────────────────────────────────────────
// Note: MiniMax Coding pricing lives in `regional.ts` (the apikey/regional
// provider), not `oauth-subscriptions.ts`. The spread-merge in
// `default-pricing.ts` is OAUTH → FRONTIER → INFERENCE → REGIONAL, so the
// regional block wins and these rows are the ones the Cost Explorer
// actually reads. They are tested here as a regression guard against
// accidental key collisions (an OAuth-side `minimax:` row would be
// silently overridden, leaving the user-visible rates unchanged).

test("minimax/minimax-m3 uses the regional block (regression guard)", () => {
  const p = getDefaultPricing().minimax["minimax-m3"];
  assert.equal(p.input, 0.5);
  assert.equal(p.output, 2.0);
  assert.equal(p.cached, 0.25);
  assert.equal(p.reasoning, 3.0);
  assert.equal(p.cache_creation, 0.5);
});

test("minimax/minimax-m2.5 uses the regional block", () => {
  const p = getDefaultPricing().minimax["minimax-m2.5"];
  assert.equal(p.input, 0.27);
  assert.equal(p.output, 0.95);
  assert.equal(p.cached, 0.135);
  assert.equal(p.reasoning, 1.425);
  assert.equal(p.cache_creation, 0.27);
});

// ─── Cross-cutting: getPricingForModel no longer null for affected models ─

test("getPricingForModel returns non-null for every model seen in the 30d Cost Explorer", () => {
  // 30d byModel snapshot (2026-07-24) — the canonical "in-use" set.
  const seen = [
    ["kc", "claude-opus-4.8"],
    ["kc", "gpt-5.6-sol"],
    ["kc", "gpt-5.5"],
    ["kc", "kimi-k3"],
    ["kc", "free"],
    ["kc", "deepseek-v4-pro"],
    ["kc", "deepseek-v4-flash"],
    ["kc", "minimax-m3"],
    ["kc", "qwen3.7-plus"],
    ["kc", "glm-5.2"],
    ["oc", "deepseek-v4-flash-free"],
    ["oc", "mimo-v2.5-free"],
    ["minimax", "minimax-m3"],
  ];
  for (const [provider, model] of seen) {
    const p = getPricingForModel(provider, model);
    assert.ok(p, `getPricingForModel("${provider}", "${model}") should not be null`);
    assert.equal(typeof p.input, "number");
    assert.equal(typeof p.output, "number");
  }
});
