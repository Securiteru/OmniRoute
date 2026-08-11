import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-dyn-proxy-reconciler-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = "test-secret";
delete process.env.INITIAL_PASSWORD;

const core = await import("../../src/lib/db/core.ts");
const proxiesDb = await import("../../src/lib/db/proxies.ts");
const dynamicPools = await import("../../src/lib/db/dynamicProxyPools.ts");
const reconciler = await import("../../src/lib/dynamicProxyPool/reconciler.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

async function makeProxyInRegistry(seq: number, egressIp?: string) {
  const proxy = await proxiesDb.createProxy({
    name: `Reconciler proxy ${seq}`,
    type: "http",
    host: `10.10.0.${seq}`,
    port: 9000 + seq,
    status: "active",
  });
  assert.ok(proxy?.id);
  return { id: proxy!.id, host: proxy!.host, port: proxy!.port, type: proxy!.type };
}

interface FakeCandidate {
  host: string;
  port: number;
  type: string;
  source: string;
  username?: string | null;
  password?: string | null;
  egressIp: string | null;
  latencyMs: number;
}

function makeCandidate(seq: number, egressIp: string | null, latencyMs = 100): FakeCandidate {
  return {
    host: `192.168.${Math.floor(seq / 256)}.${seq % 256}`,
    port: 8080 + seq,
    type: "http",
    source: "test-source",
    egressIp,
    latencyMs,
  };
}

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("refills pool toward desiredReadyCount using candidates with unique egress IPs", async () => {
  await resetStorage();
  const pool = await dynamicPools.createDynamicProxyPool({ name: "refill", desiredReadyCount: 3 });

  const candidates: FakeCandidate[] = [
    makeCandidate(1, "203.0.113.1"),
    makeCandidate(2, "203.0.113.2"),
    makeCandidate(3, "203.0.113.3"),
    makeCandidate(4, "203.0.113.1"),
    makeCandidate(5, null),
  ];

  const result = await reconciler.reconcileDynamicProxyPool(pool.id, {
    listCandidates: async () => candidates,
    probeEgress: async (_url: string) => {
      const idx = candidates.findIndex((c) => _url.includes(c.host));
      const c = idx >= 0 ? candidates[idx] : null;
      return {
        ip: c?.egressIp ?? null,
        latencyMs: c?.latencyMs ?? 999,
        error: c ? undefined : "no candidate",
      };
    },
  });

  assert.equal(result.added, 3);
  assert.equal(result.skippedDuplicate, 1);
  assert.equal(result.skippedDead, 1);

  const members = await dynamicPools.listDynamicProxyPoolMembers(pool.id);
  assert.equal(members.length, 3);
  const egressIps = new Set(members.map((m) => m.egressIp));
  assert.ok(egressIps.has("203.0.113.1"));
  assert.ok(egressIps.has("203.0.113.2"));
  assert.ok(egressIps.has("203.0.113.3"));
});

test("does not add members beyond desiredReadyCount", async () => {
  await resetStorage();
  const pool = await dynamicPools.createDynamicProxyPool({
    name: "cap-test",
    desiredReadyCount: 2,
  });

  const candidates: FakeCandidate[] = [
    makeCandidate(10, "203.0.113.10"),
    makeCandidate(11, "203.0.113.11"),
    makeCandidate(12, "203.0.113.12"),
    makeCandidate(13, "203.0.113.13"),
  ];

  const result = await reconciler.reconcileDynamicProxyPool(pool.id, {
    listCandidates: async () => candidates,
    probeEgress: async (url: string) => {
      const c = candidates.find((c) => url.includes(c.host));
      return { ip: c?.egressIp ?? null, latencyMs: 100, error: c ? undefined : "missing" };
    },
  });

  assert.equal(result.added, 2);
  const members = await dynamicPools.listDynamicProxyPoolMembers(pool.id);
  assert.equal(members.length, 2);
});

test("skips candidates whose egress IP already exists in the pool", async () => {
  await resetStorage();
  const pool = await dynamicPools.createDynamicProxyPool({ name: "dedup", desiredReadyCount: 5 });

  const existing = await makeProxyInRegistry(1);
  await dynamicPools.addDynamicProxyPoolMember(pool.id, existing.id, "203.0.113.50");

  const candidates: FakeCandidate[] = [
    makeCandidate(20, "203.0.113.50"),
    makeCandidate(21, "203.0.113.51"),
  ];

  const result = await reconciler.reconcileDynamicProxyPool(pool.id, {
    listCandidates: async () => candidates,
    probeEgress: async (url: string) => {
      const c = candidates.find((c) => url.includes(c.host));
      return { ip: c?.egressIp ?? null, latencyMs: 100, error: c ? undefined : "missing" };
    },
  });

  assert.equal(result.added, 1);
  assert.equal(result.skippedDuplicate, 1);

  const members = await dynamicPools.listDynamicProxyPoolMembers(pool.id);
  const egressSet = new Set(members.map((m) => m.egressIp));
  assert.equal(egressSet.size, 2);
  assert.ok(egressSet.has("203.0.113.50"));
  assert.ok(egressSet.has("203.0.113.51"));
});

test("skips candidates whose egress probe fails (null IP or error)", async () => {
  await resetStorage();
  const pool = await dynamicPools.createDynamicProxyPool({
    name: "dead-test",
    desiredReadyCount: 3,
  });

  const candidates: FakeCandidate[] = [
    makeCandidate(30, null),
    makeCandidate(31, null),
    makeCandidate(32, "203.0.113.32"),
  ];

  const result = await reconciler.reconcileDynamicProxyPool(pool.id, {
    listCandidates: async () => candidates,
    probeEgress: async (url: string) => {
      const c = candidates.find((c) => url.includes(c.host));
      if (!c || !c.egressIp) return { ip: null, latencyMs: 999, error: "timeout" };
      return { ip: c.egressIp, latencyMs: 100 };
    },
  });

  assert.equal(result.added, 1);
  assert.equal(result.skippedDead, 2);
});

test("expires stale members that have not been probed within the stale threshold", async () => {
  await resetStorage();
  const pool = await dynamicPools.createDynamicProxyPool({
    name: "stale-test",
    desiredReadyCount: 5,
  });

  const oldProxy = await makeProxyInRegistry(40);
  await dynamicPools.addDynamicProxyPoolMember(pool.id, oldProxy.id, "203.0.113.40");

  const db = core.getDbInstance();
  const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  db.prepare(
    "UPDATE dynamic_proxy_pool_members SET last_probe_at = ?, updated_at = ? WHERE pool_id = ? AND proxy_id = ?"
  ).run(oldDate, oldDate, pool.id, oldProxy.id);

  const result = await reconciler.reconcileDynamicProxyPool(pool.id, {
    listCandidates: async () => [],
    probeEgress: async () => ({ ip: null, latencyMs: 0, error: "noop" }),
    staleThresholdMs: 24 * 60 * 60 * 1000,
  });

  assert.equal(result.removedStale, 1);
  const members = await dynamicPools.listDynamicProxyPoolMembers(pool.id);
  assert.equal(members.length, 0);
});

test("clears expired cooldowns so cooled-down members become available again", async () => {
  await resetStorage();
  const pool = await dynamicPools.createDynamicProxyPool({
    name: "cooldown-test",
    desiredReadyCount: 5,
  });

  const proxy = await makeProxyInRegistry(50);
  await dynamicPools.addDynamicProxyPoolMember(pool.id, proxy.id, "203.0.113.50");
  await dynamicPools.bindDynamicProxyPool(pool.id, "account", "conn-expired");
  await dynamicPools.selectDynamicProxyForConnection("conn-expired", "openai");

  await dynamicPools.recordDynamicProxyFailure(
    "conn-expired",
    "openai",
    proxy.id,
    "transport_error",
    60
  );

  const pastCooldown = new Date(Date.now() - 60 * 1000).toISOString();
  const db = core.getDbInstance();
  db.prepare(
    "UPDATE dynamic_proxy_target_health SET cooldown_until = ? WHERE pool_id = ? AND proxy_id = ?"
  ).run(pastCooldown, pool.id, proxy.id);

  const result = await reconciler.reconcileDynamicProxyPool(pool.id, {
    listCandidates: async () => [],
    probeEgress: async () => ({ ip: null, latencyMs: 0, error: "noop" }),
  });

  assert.ok(result.cooldownsCleared >= 1);
  const health = await dynamicPools.listDynamicProxyTargetHealth(pool.id);
  const entry = health.find((h) => h.proxyId === proxy.id);
  assert.notEqual(entry?.state, "cooldown");
});

test("prevents concurrent reconciliation via advisory lock", async () => {
  await resetStorage();
  const pool = await dynamicPools.createDynamicProxyPool({
    name: "lock-test",
    desiredReadyCount: 5,
  });

  let callCount = 0;
  const slowListCandidates = async () => {
    callCount++;
    await new Promise((r) => setTimeout(r, 100));
    return [];
  };

  const [first, second] = await Promise.all([
    reconciler.reconcileDynamicProxyPool(pool.id, {
      listCandidates: slowListCandidates,
      probeEgress: async () => ({ ip: null, latencyMs: 0, error: "noop" }),
    }),
    reconciler.reconcileDynamicProxyPool(pool.id, {
      listCandidates: slowListCandidates,
      probeEgress: async () => ({ ip: null, latencyMs: 0, error: "noop" }),
    }),
  ]);

  assert.equal(callCount, 1);
  assert.equal(second.skipped, true);
  assert.equal(first.skipped, false);
});

test("reconcileAllDynamicProxyPools processes all enabled pools", async () => {
  await resetStorage();
  const poolA = await dynamicPools.createDynamicProxyPool({ name: "all-a", desiredReadyCount: 2 });
  const poolB = await dynamicPools.createDynamicProxyPool({ name: "all-b", desiredReadyCount: 2 });
  await dynamicPools.createDynamicProxyPool({ name: "disabled", enabled: false });

  const candidatesByPool: Record<string, FakeCandidate[]> = {
    [poolA.id]: [makeCandidate(60, "203.0.113.60"), makeCandidate(61, "203.0.113.61")],
    [poolB.id]: [makeCandidate(62, "203.0.113.62"), makeCandidate(63, "203.0.113.63")],
  };

  const results = await reconciler.reconcileAllDynamicProxyPools({
    listCandidates: async (poolId: string) => candidatesByPool[poolId] ?? [],
    probeEgress: async (url: string) => {
      const allCandidates = Object.values(candidatesByPool).flat();
      const c = allCandidates.find((c) => url.includes(c.host));
      return { ip: c?.egressIp ?? null, latencyMs: 100, error: c ? undefined : "missing" };
    },
  });

  assert.equal(results.length, 2);
  for (const r of results) {
    assert.equal(r.added, 2);
    assert.equal(r.skipped, false);
  }
});

test("updates lastReconciledAt on the pool after reconciliation", async () => {
  await resetStorage();
  const pool = await dynamicPools.createDynamicProxyPool({
    name: "timestamp-test",
    desiredReadyCount: 1,
  });

  await reconciler.reconcileDynamicProxyPool(pool.id, {
    listCandidates: async () => [makeCandidate(70, "203.0.113.70")],
    probeEgress: async (url: string) => {
      if (url.includes("192.168.0.70")) return { ip: "203.0.113.70", latencyMs: 50 };
      return { ip: null, latencyMs: 0, error: "miss" };
    },
  });

  const updated = await dynamicPools.getDynamicProxyPool(pool.id);
  assert.ok(updated);
  const dbPool = core
    .getDbInstance()
    .prepare("SELECT last_reconciled_at FROM dynamic_proxy_pools WHERE id = ?")
    .get(pool.id) as { last_reconciled_at?: string };
  assert.ok(dbPool.last_reconciled_at);
  const reconciledAt = new Date(dbPool.last_reconciled_at);
  assert.ok(Date.now() - reconciledAt.getTime() < 60_000);
});
