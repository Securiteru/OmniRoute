import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-dynamic-proxy-pools-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = "test-secret";
delete process.env.INITIAL_PASSWORD;

const core = await import("../../src/lib/db/core.ts");
const proxiesDb = await import("../../src/lib/db/proxies.ts");
const dynamicPools = await import("../../src/lib/db/dynamicProxyPools.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

async function makeProxy(seq: number) {
  const proxy = await proxiesDb.createProxy({
    name: `Dynamic proxy ${seq}`,
    type: "http",
    host: `10.0.1.${seq}`,
    port: 9000 + seq,
    status: "active",
  });
  assert.ok(proxy?.id);
  return proxy!.id;
}

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("creates a shared pool, attaches an account, and keeps a healthy lease sticky", async () => {
  await resetStorage();
  const firstProxy = await makeProxy(1);
  const secondProxy = await makeProxy(2);
  const pool = await dynamicPools.createDynamicProxyPool({
    name: "shared-five",
    desiredReadyCount: 5,
  });

  await dynamicPools.addDynamicProxyPoolMember(pool.id, firstProxy, "203.0.113.10");
  await dynamicPools.addDynamicProxyPoolMember(pool.id, secondProxy, "203.0.113.11");
  await dynamicPools.bindDynamicProxyPool(pool.id, "account", "connection-1");

  const first = await dynamicPools.selectDynamicProxyForConnection("connection-1", "openai");
  const second = await dynamicPools.selectDynamicProxyForConnection("connection-1", "openai");

  assert.equal(first?.proxyId, firstProxy);
  assert.equal(second?.proxyId, firstProxy);
  assert.equal(second?.egressIp, "203.0.113.10");
});

test("quarantines a failed lease and promotes the next healthy member", async () => {
  await resetStorage();
  const firstProxy = await makeProxy(1);
  const secondProxy = await makeProxy(2);
  const pool = await dynamicPools.createDynamicProxyPool({ name: "failover" });
  await dynamicPools.addDynamicProxyPoolMember(pool.id, firstProxy, "203.0.113.20");
  await dynamicPools.addDynamicProxyPoolMember(pool.id, secondProxy, "203.0.113.21");
  await dynamicPools.bindDynamicProxyPool(pool.id, "account", "connection-2");

  const selected = await dynamicPools.selectDynamicProxyForConnection("connection-2", "ollama");
  assert.equal(selected?.proxyId, firstProxy);

  const switched = await dynamicPools.recordDynamicProxyFailure(
    "connection-2",
    "ollama",
    firstProxy,
    "transport_error",
    60
  );
  assert.equal(switched?.proxyId, secondProxy);

  await dynamicPools.recordDynamicProxySuccess("connection-2", "ollama", secondProxy, 120);
  const stickyAfterSuccess = await dynamicPools.selectDynamicProxyForConnection(
    "connection-2",
    "ollama"
  );
  assert.equal(stickyAfterSuccess?.proxyId, secondProxy);

  const health = await dynamicPools.listDynamicProxyTargetHealth(pool.id, "ollama");
  assert.equal(health.find((entry) => entry.proxyId === firstProxy)?.state, "cooldown");
});

test("account binding overrides provider binding while leases remain account-specific", async () => {
  await resetStorage();
  const providerProxy = await makeProxy(1);
  const accountProxy = await makeProxy(2);
  const providerPool = await dynamicPools.createDynamicProxyPool({ name: "provider-pool" });
  const accountPool = await dynamicPools.createDynamicProxyPool({ name: "account-pool" });

  await dynamicPools.addDynamicProxyPoolMember(providerPool.id, providerProxy, "203.0.113.30");
  await dynamicPools.addDynamicProxyPoolMember(accountPool.id, accountProxy, "203.0.113.31");
  await dynamicPools.bindDynamicProxyPool(providerPool.id, "provider", "opencode");
  await dynamicPools.bindDynamicProxyPool(accountPool.id, "account", "connection-3");

  const selected = await dynamicPools.selectDynamicProxyForConnection("connection-3", "opencode");
  assert.equal(selected?.proxyId, accountProxy);
});

test("keeps leases isolated when two accounts share one pool", async () => {
  await resetStorage();
  const firstProxy = await makeProxy(1);
  const secondProxy = await makeProxy(2);
  const pool = await dynamicPools.createDynamicProxyPool({ name: "shared-account-leases" });
  await dynamicPools.addDynamicProxyPoolMember(pool.id, firstProxy, "203.0.113.40");
  await dynamicPools.addDynamicProxyPoolMember(pool.id, secondProxy, "203.0.113.41");
  await dynamicPools.bindDynamicProxyPool(pool.id, "account", "connection-a");
  await dynamicPools.bindDynamicProxyPool(pool.id, "account", "connection-b");

  const [firstLease, secondLease] = await Promise.all([
    dynamicPools.selectDynamicProxyForConnection("connection-a", "openai"),
    dynamicPools.selectDynamicProxyForConnection("connection-b", "openai"),
  ]);
  assert.equal(firstLease?.proxyId, firstProxy);
  assert.equal(secondLease?.proxyId, secondProxy);
  assert.notEqual(firstLease?.egressIp, secondLease?.egressIp);

  const promoted = await dynamicPools.recordDynamicProxyFailure(
    "connection-a",
    "openai",
    firstProxy,
    "connect_failed",
    60,
    { retryDelaysMs: [] }
  );
  assert.equal(promoted, null, "must not share connection-b's active egress IP");

  const bindings = await dynamicPools.listDynamicProxyPoolBindings(pool.id);
  const accountA = bindings.find((binding) => binding.scope_id === "connection-a");
  const accountB = bindings.find((binding) => binding.scope_id === "connection-b");
  assert.equal(accountA?.current_proxy_id, null);
  assert.equal(accountB?.current_proxy_id, secondProxy);

  const firstAfterFailure = await dynamicPools.selectDynamicProxyForConnection(
    "connection-a",
    "openai",
    { retryDelaysMs: [] }
  );
  const secondAfterFirstFailure = await dynamicPools.selectDynamicProxyForConnection(
    "connection-b",
    "openai",
    { retryDelaysMs: [] }
  );
  assert.equal(firstAfterFailure, null);
  assert.equal(secondAfterFirstFailure?.proxyId, secondProxy);
});

test("does not reuse an egress IP after an account fails over", async () => {
  await resetStorage();
  const firstProxy = await makeProxy(1);
  const secondProxy = await makeProxy(2);
  const pool = await dynamicPools.createDynamicProxyPool({ name: "no-history-reuse" });
  await dynamicPools.addDynamicProxyPoolMember(pool.id, firstProxy, "203.0.113.60");
  await dynamicPools.addDynamicProxyPoolMember(pool.id, secondProxy, "203.0.113.61");
  await dynamicPools.bindDynamicProxyPool(pool.id, "account", "connection-history");

  const first = await dynamicPools.selectDynamicProxyForConnection("connection-history", "ollama");
  assert.equal(first?.egressIp, "203.0.113.60");

  const second = await dynamicPools.recordDynamicProxyFailure(
    "connection-history",
    "ollama",
    firstProxy,
    "connect_failed",
    0,
    { retryDelaysMs: [] }
  );
  assert.equal(second?.egressIp, "203.0.113.61");

  const exhausted = await dynamicPools.recordDynamicProxyFailure(
    "connection-history",
    "ollama",
    secondProxy,
    "connect_failed",
    0,
    { retryDelaysMs: [] }
  );
  assert.equal(exhausted, null, "the first egress IP must not be reused");
});

test("does not let one account failure clear another account lease", async () => {
  await resetStorage();
  const firstProxy = await makeProxy(1);
  const secondProxy = await makeProxy(2);
  const pool = await dynamicPools.createDynamicProxyPool({ name: "shared-failure-state" });
  await dynamicPools.addDynamicProxyPoolMember(pool.id, firstProxy, "203.0.113.42");
  await dynamicPools.addDynamicProxyPoolMember(pool.id, secondProxy, "203.0.113.43");
  await dynamicPools.bindDynamicProxyPool(pool.id, "account", "connection-c");
  await dynamicPools.bindDynamicProxyPool(pool.id, "account", "connection-d");

  await dynamicPools.selectDynamicProxyForConnection("connection-c", "ollama");
  await dynamicPools.selectDynamicProxyForConnection("connection-d", "ollama");
  await dynamicPools.recordDynamicProxySuccess("connection-d", "ollama", secondProxy, 100);
  await dynamicPools.recordDynamicProxyFailure(
    "connection-c",
    "ollama",
    firstProxy,
    "tls_error",
    60,
    { retryDelaysMs: [] }
  );

  const bindings = await dynamicPools.listDynamicProxyPoolBindings(pool.id);
  assert.equal(
    bindings.find((binding) => binding.scope_id === "connection-c")?.current_proxy_id,
    null
  );
  assert.equal(
    bindings.find((binding) => binding.scope_id === "connection-d")?.current_proxy_id,
    secondProxy
  );
});
