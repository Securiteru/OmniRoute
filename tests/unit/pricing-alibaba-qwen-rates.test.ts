/**
 * Alibaba / DashScope Qwen pricing — local defaults for Cost Explorer.
 *
 * Cost Explorer was showing $0.00 for alibaba/qwen3.8-max-preview (100M+
 * tokens) because no local pricing block existed and OpenRouter only lists
 * qwen3.6-max-preview. The regional defaults + nearby-version OpenRouter
 * fallback close the gap.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { getDefaultPricing, getPricingForModel } from "../../src/shared/constants/pricing.ts";

test("alibaba block exists with qwen3.8-max-preview rates", () => {
  const p = getDefaultPricing().alibaba["qwen3.8-max-preview"];
  assert.ok(p, "alibaba/qwen3.8-max-preview must exist");
  assert.equal(p.input, 1.04);
  assert.equal(p.output, 6.24);
  assert.equal(p.cached, 0.208);
});

test("alibaba block has qwen3.6-max-preview sibling", () => {
  const p = getDefaultPricing().alibaba["qwen3.6-max-preview"];
  assert.ok(p);
  assert.equal(p.input, 1.04);
  assert.equal(p.output, 6.24);
});

test("alibaba block has qwen3.7-max rates from OpenRouter", () => {
  const p = getDefaultPricing().alibaba["qwen3.7-max"];
  assert.ok(p);
  assert.equal(p.input, 1.475);
  assert.equal(p.output, 4.425);
});

test("alibaba block reuses GLM_PRICING for glm-5.2", () => {
  const p = getDefaultPricing().alibaba["glm-5.2"];
  assert.ok(p);
  assert.ok(typeof p.input === "number" && p.input > 0);
  assert.ok(typeof p.output === "number" && p.output > 0);
});

test("alibaba-cn mirrors qwen3.8-max-preview", () => {
  const p = getDefaultPricing()["alibaba-cn"]["qwen3.8-max-preview"];
  assert.ok(p);
  assert.equal(p.input, 1.04);
  assert.equal(p.output, 6.24);
});

test("getPricingForModel(alibaba, qwen3.8-max-preview) resolves locally", () => {
  const p = getPricingForModel("alibaba", "qwen3.8-max-preview");
  assert.ok(p);
  assert.equal(p.input, 1.04);
  assert.equal(p.output, 6.24);
});

test("getPricingForModel(alibaba, qwen3.6-max-preview) resolves locally", () => {
  const p = getPricingForModel("alibaba", "qwen3.6-max-preview");
  assert.ok(p);
  assert.equal(p.input, 1.04);
});
