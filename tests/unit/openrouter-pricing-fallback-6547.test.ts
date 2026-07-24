/**
 * #6547 — OpenRouter pricing fallback tests.
 *
 * Verifies that when a cost row references a model with no local pricing row
 * (e.g. a flat-rate coding-plan connection routing tokens to `minimax-m3`),
 * `getPricingForModel` falls back to the OpenRouter public catalog instead of
 * returning null. The dashboard was rendering $0.00 for every flat-rate
 * provider; with the fallback wired in, the user sees a meaningful estimate
 * derived from the same model's public list price.
 *
 * The catalog is read from `data/cache/openrouter-catalog.json`. Tests use a
 * tmpdir DATA_DIR and write a fixture file there so the production code path
 * (which always reads from disk) is exercised end-to-end.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-or-pricing-6547-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = process.env.API_KEY_SECRET || "openrouter-6547-secret";

const CACHE_DIR = path.join(TEST_DATA_DIR, "cache");
fs.mkdirSync(CACHE_DIR, { recursive: true });

const FIXTURE_CATALOG = {
  fetchedAt: "2026-07-24T12:00:00.000Z",
  data: [
    {
      id: "minimax/minimax-m3",
      pricing: {
        prompt: "0.0000003",
        completion: "0.0000012",
        input_cache_read: "0.00000006",
      },
    },
    {
      id: "minimax/minimax-m2.7",
      pricing: {
        prompt: "0.00000025",
        completion: "0.000001",
        input_cache_read: "0.00000005",
      },
    },
    {
      id: "mistralai/mistral-medium-3-5",
      pricing: {
        prompt: "0.0000015",
        completion: "0.0000075",
      },
    },
    {
      id: "z-ai/glm-5",
      pricing: {
        prompt: "0.00000095",
        completion: "0.00000255",
      },
    },
    {
      id: "anthropic/claude-opus-4.5",
      pricing: {
        prompt: "0.000005",
        completion: "0.000025",
        input_cache_read: "0.0000005",
      },
    },
    {
      id: "moonshotai/kimi-k2.5",
      pricing: {
        prompt: "0.00000057",
        completion: "0.00000285",
      },
    },
    {
      id: "deepseek/deepseek-v4-pro",
      pricing: {
        prompt: "0.000000435",
        completion: "0.00000087",
      },
    },
  ],
};

fs.writeFileSync(
  path.join(CACHE_DIR, "openrouter-catalog.json"),
  JSON.stringify(FIXTURE_CATALOG),
  "utf8"
);

const { lookupOpenRouterPricing, buildOpenRouterIndex, readOpenRouterCatalogSync } =
  await import("../../src/lib/pricing/openrouterPricingLookup.ts");

test("lookupOpenRouterPricing: MiniMax-M3 (PascalCase) → upstream list price", () => {
  const r = lookupOpenRouterPricing(null, "MiniMax-M3");
  assert.ok(r, "should find a row");
  assert.equal(r!.input, 0.3);
  assert.equal(r!.output, 1.2);
  assert.equal(r!.cached, 0.06);
  assert.equal(r!.source, "openrouter");
  assert.equal(r!.openrouterId, "minimax/minimax-m3");
});

test("lookupOpenRouterPricing: minimax-m3 (lowercase, hyphen) matches", () => {
  const r = lookupOpenRouterPricing(null, "minimax-m3");
  assert.equal(r?.input, 0.3);
  assert.equal(r?.output, 1.2);
});

test("lookupOpenRouterPricing: mistral-medium-3.5 (dot) matches hyphen variant", () => {
  // The DB sometimes records `mistral-medium-3.5`; OpenRouter has the hyphen
  // form. The normalization must swap `.` for `-`.
  const r = lookupOpenRouterPricing(null, "mistral-medium-3.5");
  assert.ok(r, "dot variant should match the hyphen row");
  assert.equal(r!.input, 1.5);
  assert.equal(r!.output, 7.5);
});

test("lookupOpenRouterPricing: mistral-medium-3-5 (hyphen) matches directly", () => {
  const r = lookupOpenRouterPricing(null, "mistral-medium-3-5");
  assert.equal(r?.input, 1.5);
});

test("lookupOpenRouterPricing: provider hint narrows to that namespace", () => {
  // When the cost row carries the OmniRoute id `minimax`, the hint can be
  // "minimax" (which is also the OpenRouter namespace for MiniMax models).
  // The lookup should match the `<provider>/<name>` form first.
  const r = lookupOpenRouterPricing("minimax", "minimax-m3");
  assert.equal(r?.openrouterId, "minimax/minimax-m3");
  assert.equal(r?.input, 0.3);
});

test("lookupOpenRouterPricing: unknown model → null", () => {
  const r = lookupOpenRouterPricing(null, "totally-made-up-model-9000");
  assert.equal(r, null);
});

test("lookupOpenRouterPricing: empty model → null", () => {
  assert.equal(lookupOpenRouterPricing(null, ""), null);
  assert.equal(lookupOpenRouterPricing(null, null), null);
  assert.equal(lookupOpenRouterPricing(null, undefined), null);
});

test("lookupOpenRouterPricing: glmt-5.2 (Z.AI variant) → z-ai/glm-5.2 NOT present", () => {
  // Sanity: the fixture has `z-ai/glm-5` but not `z-ai/glm-5.2`. The lookup
  // must NOT silently match a different version. (Coverage check: we don't
  // pick a random row from the same provider just because the model isn't
  // found — we return null.)
  const r = lookupOpenRouterPricing(null, "glm-5.2");
  assert.equal(r, null, "should NOT match z-ai/glm-5 (different model)");
});

test("lookupOpenRouterPricing: kimi-k2.5 → moonshotai/kimi-k2.5", () => {
  const r = lookupOpenRouterPricing(null, "kimi-k2.5");
  assert.equal(r?.openrouterId, "moonshotai/kimi-k2.5");
  assert.equal(r?.input, 0.57);
});

test("lookupOpenRouterPricing: claude-opus-4.5 → anthropic/claude-opus-4.5", () => {
  const r = lookupOpenRouterPricing(null, "claude-opus-4.5");
  assert.equal(r?.openrouterId, "anthropic/claude-opus-4.5");
  assert.equal(r?.input, 5);
  assert.equal(r?.output, 25);
  assert.equal(r?.cached, 0.5);
});

test("lookupOpenRouterPricing: deepseek-v4-pro → deepseek/deepseek-v4-pro", () => {
  const r = lookupOpenRouterPricing(null, "deepseek-v4-pro");
  assert.equal(r?.input, 0.435);
  assert.equal(r?.output, 0.87);
});

test("buildOpenRouterIndex: lowercases ids and indexes by full id", () => {
  const idx = buildOpenRouterIndex([
    { id: "Anthropic/Claude-Opus-4.5", pricing: { prompt: "0.000005", completion: "0.000025" } },
  ]);
  assert.ok(idx.has("anthropic/claude-opus-4.5"));
  assert.equal(idx.has("Anthropic/Claude-Opus-4.5"), false);
});

test("readOpenRouterCatalogSync: returns [] when cache missing", () => {
  // Tmpdir was set up with a fixture, but for this test we'll point to an
  // empty directory. The module caches the dataDir at first read though, so
  // the result is best-effort — we just verify the function never throws.
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-empty-"));
  process.env.DATA_DIR = empty;
  const result = readOpenRouterCatalogSync();
  assert.deepEqual(result, []);
  // Restore for the remaining tests.
  process.env.DATA_DIR = TEST_DATA_DIR;
});

test("integration: getPricingForModel falls back to OpenRouter for unknown models", async () => {
  // The cost row has provider="ADI_SUB" (a user-named flat-rate coding-plan
  // connection) and model="MiniMax-M3". No local pricing row exists for
  // either — the function must return the OpenRouter upstream price.
  const { getPricingForModel } = await import("../../src/lib/db/settings/pricing.ts");
  const pricing = await getPricingForModel("ADI_SUB", "MiniMax-M3");
  assert.ok(pricing, "expected OpenRouter fallback to provide a row");
  const record = pricing as unknown as { input: number; output: number; source: string };
  assert.equal(record.input, 0.3);
  assert.equal(record.output, 1.2);
  assert.equal(record.source, "openrouter");
});

test("integration: getPricingForModel uses local row when present (no OR fallback)", async () => {
  // 'kiro' is a registered OmniRoute provider with its own pricing block in
  // oauth-subscriptions.ts. The function must return THAT row, not an
  // OpenRouter lookup. We assert the local shape (which uses input/output
  // keys) and the source tag is NOT "openrouter".
  const { getPricingForModel } = await import("../../src/lib/db/settings/pricing.ts");
  const pricing = await getPricingForModel("kiro", "claude-sonnet-4.6");
  assert.ok(pricing, "kiro/claude-sonnet-4.6 should resolve locally");
  const record = pricing as unknown as Record<string, unknown>;
  // Local rows don't carry a `source` field — only the OpenRouter fallback
  // sets it. The fixture (kiro: block) has its own input/output prices.
  assert.equal(record.source, undefined, "should NOT be an OpenRouter fallback");
  assert.ok(typeof record.input === "number");
  assert.ok(typeof record.output === "number");
});

test.after(() => {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});
