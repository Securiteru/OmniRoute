import test from "node:test";
import assert from "node:assert/strict";

const { isDynamicProxyRetryableResult, isDynamicProxyFailClosedResult } =
  await import("../../src/sse/handlers/chatHelpers.ts");

test("classifies only proxy transport and pre-output readiness failures as retryable", () => {
  const retryable = [
    { success: false, status: 502, errorCode: "PROXY_UNREACHABLE" },
    { success: false, status: 502, errorCode: "PROXY_FAMILY_UNAVAILABLE" },
    { success: false, status: 502, errorCode: "ECONNRESET" },
    { success: false, status: 502, errorCode: "UND_ERR_PRX_CONN" },
    { success: false, status: 502, errorCode: "UND_ERR_SOCKET" },
    { success: false, status: 502, errorType: "proxy_tls_error" },
    { success: false, status: 504, errorCode: "STREAM_READINESS_TIMEOUT" },
    { success: false, status: 502, errorCode: "STREAM_EARLY_EOF" },
  ];

  for (const result of retryable) {
    assert.equal(isDynamicProxyRetryableResult(result), true);
  }
});

test("classifies fail-closed transport exhaustion separately from stream fallback", () => {
  assert.equal(
    isDynamicProxyFailClosedResult({ success: false, status: 502, errorCode: "UND_ERR_PRX_CONN" }),
    true
  );
  assert.equal(
    isDynamicProxyFailClosedResult({ success: false, status: 502, errorCode: "STREAM_EARLY_EOF" }),
    false
  );
  assert.equal(
    isDynamicProxyFailClosedResult({ success: true, status: 200, errorCode: "UND_ERR_PRX_CONN" }),
    false
  );
});

test("does not retry provider, auth, quota, abort, or unknown failures", () => {
  const nonRetryable = [
    { success: false, status: 401, errorCode: "ECONNRESET" },
    { success: false, status: 402, errorCode: "PROXY_UNREACHABLE" },
    { success: false, status: 429, errorType: "upstream_timeout" },
    { success: false, status: 499, errorType: "AbortError" },
    { success: false, status: 500, errorType: "unknown_error" },
    { success: true, status: 200, errorCode: "PROXY_UNREACHABLE" },
  ];

  for (const result of nonRetryable) {
    assert.equal(isDynamicProxyRetryableResult(result), false);
  }
});
