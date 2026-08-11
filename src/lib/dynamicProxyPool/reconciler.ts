/**
 * Dynamic Proxy Pool Reconciler
 *
 * Background control plane that keeps each dynamic pool populated with the
 * desired number of unique egress-IP identities. Periodically:
 *   1. Syncs candidates from configured free-proxy sources
 *   2. Probes each candidate's real egress IP (benign CONNECT/echo)
 *   3. Deduplicates by canonical egress IP (not endpoint)
 *   4. Refills the pool toward desiredReadyCount unique identities
 *   5. Expires stale members not seen within the stale threshold
 *   6. Clears expired cooldowns so members become available again
 *
 * Single-process safety: an in-memory Set prevents concurrent reconciliation
 * of the same pool. For multi-process deployments, move this to Postgres
 * advisory locks or Redis.
 */

import { randomUUID } from "node:crypto";
import { getDbInstance } from "@/lib/db/core";
import { backupDbFile } from "@/lib/db/backup";
import {
  getDynamicProxyPool,
  listDynamicProxyPoolMembers,
  addDynamicProxyPoolMember,
  listDynamicProxyPools,
  type DynamicProxyPool,
} from "@/lib/db/dynamicProxyPools";
import { createProxy } from "@/lib/db/proxies";

export interface ReconcilerCandidate {
  host: string;
  port: number;
  type: string;
  source: string;
  username?: string | null;
  password?: string | null;
}

export interface EgressProbeCallResult {
  ip: string | null;
  latencyMs: number;
  error?: string;
}

export interface ReconcilerDeps {
  listCandidates?: (poolId: string) => Promise<ReconcilerCandidate[]>;
  probeEgress?: (proxyUrl: string) => Promise<EgressProbeCallResult>;
  staleThresholdMs?: number;
}

export interface ReconcileResult {
  poolId: string;
  skipped: boolean;
  added: number;
  skippedDuplicate: number;
  skippedDead: number;
  removedStale: number;
  cooldownsCleared: number;
  error?: string;
}

const DEFAULT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const reconcilingPools = new Set<string>();

function buildProxyUrl(candidate: ReconcilerCandidate): string {
  const auth =
    candidate.username || candidate.password
      ? `${encodeURIComponent(candidate.username ?? "")}:${encodeURIComponent(candidate.password ?? "")}@`
      : "";
  return `${candidate.type}://${auth}${candidate.host}:${candidate.port}`;
}

async function defaultListCandidates(pool: DynamicProxyPool): Promise<ReconcilerCandidate[]> {
  try {
    const { listFreeProxies } = await import("@/lib/db/freeProxies");
    const records = await listFreeProxies({
      onlyNotInPool: true,
      sortBy: "quality",
      limit: pool.maxCandidates,
    });
    return records.map((r) => ({
      host: r.host,
      port: r.port,
      type: r.type,
      source: r.source,
      username: r.username,
      password: r.password,
    }));
  } catch {
    return [];
  }
}

async function defaultProbeEgress(proxyUrl: string): Promise<EgressProbeCallResult> {
  try {
    const { resolveEgressIp } = await import("@/lib/proxyEgress");
    const result = await resolveEgressIp(proxyUrl, { force: true });
    return { ip: result.ip, latencyMs: result.latencyMs, error: result.error };
  } catch (err) {
    return { ip: null, latencyMs: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function reconcileDynamicProxyPool(
  poolId: string,
  deps?: ReconcilerDeps
): Promise<ReconcileResult> {
  if (reconcilingPools.has(poolId)) {
    return {
      poolId,
      skipped: true,
      added: 0,
      skippedDuplicate: 0,
      skippedDead: 0,
      removedStale: 0,
      cooldownsCleared: 0,
    };
  }
  reconcilingPools.add(poolId);

  try {
    const pool = await getDynamicProxyPool(poolId);
    if (!pool || !pool.enabled) {
      return {
        poolId,
        skipped: true,
        added: 0,
        skippedDuplicate: 0,
        skippedDead: 0,
        removedStale: 0,
        cooldownsCleared: 0,
      };
    }

    const listCandidates = deps?.listCandidates ?? (() => defaultListCandidates(pool));
    const probeEgress = deps?.probeEgress ?? defaultProbeEgress;
    const staleThresholdMs = deps?.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;

    const db = getDbInstance();
    const now = new Date().toISOString();

    const members = await listDynamicProxyPoolMembers(poolId);
    const existingEgressIps = new Set<string>();
    for (const m of members) {
      if (m.egressIp) existingEgressIps.add(m.egressIp);
    }

    let added = 0;
    let skippedDuplicate = 0;
    let skippedDead = 0;

    const deficit = pool.desiredReadyCount - existingEgressIps.size;

    if (deficit > 0) {
      const candidates = await listCandidates(poolId);
      for (const candidate of candidates) {
        if (pool.maxCandidates > 0 && added + skippedDuplicate + skippedDead >= pool.maxCandidates)
          break;

        const proxyUrl = buildProxyUrl(candidate);
        const probe = await probeEgress(proxyUrl);

        if (!probe.ip || probe.error) {
          skippedDead++;
          continue;
        }

        if (existingEgressIps.has(probe.ip)) {
          skippedDuplicate++;
          continue;
        }

        if (added >= deficit) {
          continue;
        }

        const proxyId = randomUUID();
        db.prepare(
          `INSERT INTO proxy_registry
           (id, name, type, host, port, username, password, region, notes, status, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'active', ?, ?, ?)`
        ).run(
          proxyId,
          `dynamic-${candidate.host}:${candidate.port}`,
          candidate.type,
          candidate.host,
          candidate.port,
          candidate.username || "",
          candidate.password || "",
          candidate.source,
          now,
          now
        );

        await addDynamicProxyPoolMember(poolId, proxyId, probe.ip);
        existingEgressIps.add(probe.ip);
        added++;
      }
    }

    const staleCutoff = new Date(Date.now() - staleThresholdMs).toISOString();
    const staleResult = db
      .prepare(
        `DELETE FROM dynamic_proxy_pool_members
         WHERE pool_id = ?
           AND last_probe_at IS NOT NULL
           AND last_probe_at < ?
           AND state NOT IN ('healthy')`
      )
      .run(poolId, staleCutoff);
    const removedStale = staleResult.changes;

    const cooldownResult = db
      .prepare(
        `UPDATE dynamic_proxy_target_health
         SET state = 'healthy', cooldown_until = NULL, updated_at = ?
         WHERE pool_id = ? AND state = 'cooldown'
           AND cooldown_until IS NOT NULL AND cooldown_until <= ?`
      )
      .run(now, poolId, now);
    const cooldownsCleared = cooldownResult.changes;

    if (cooldownsCleared > 0) {
      db.prepare(
        `UPDATE dynamic_proxy_pool_members
         SET state = 'healthy', updated_at = ?
         WHERE pool_id = ? AND state = 'cooldown'
           AND proxy_id IN (
             SELECT proxy_id FROM dynamic_proxy_target_health
             WHERE pool_id = ? AND state = 'healthy'
               AND cooldown_until IS NULL
           )`
      ).run(now, poolId, poolId);
    }

    db.prepare(
      "UPDATE dynamic_proxy_pools SET last_reconciled_at = ?, updated_at = ? WHERE id = ?"
    ).run(now, now, poolId);
    backupDbFile("pre-write");

    return {
      poolId,
      skipped: false,
      added,
      skippedDuplicate,
      skippedDead,
      removedStale,
      cooldownsCleared,
    };
  } catch (err) {
    return {
      poolId,
      skipped: false,
      added: 0,
      skippedDuplicate: 0,
      skippedDead: 0,
      removedStale: 0,
      cooldownsCleared: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    reconcilingPools.delete(poolId);
  }
}

export async function reconcileAllDynamicProxyPools(
  deps?: ReconcilerDeps
): Promise<ReconcileResult[]> {
  const pools = await listDynamicProxyPools();
  const results: ReconcileResult[] = [];

  for (const pool of pools) {
    if (!pool.enabled) continue;
    const result = await reconcileDynamicProxyPool(pool.id, deps);
    results.push(result);
  }

  return results;
}

const DEFAULT_RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 90_000;

declare global {
  var __dynamicProxyPoolReconcilerInterval: ReturnType<typeof setInterval> | undefined;
}

export function initDynamicProxyPoolReconciler(): void {
  const enabled = /^(1|true|yes|on)$/i.test(
    process.env.OMNIROUTE_DYNAMIC_PROXY_POOLS_ENABLED?.trim() || ""
  );
  if (!enabled) return;

  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const raw = process.env.OMNIROUTE_DISABLE_BACKGROUND_SERVICES;
  if (raw && ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase())) return;

  if (globalThis.__dynamicProxyPoolReconcilerInterval) return;

  const intervalMs = Number.parseInt(process.env.DYNAMIC_PROXY_RECONCILE_INTERVAL_MS ?? "", 10);
  const resolvedInterval =
    Number.isFinite(intervalMs) && intervalMs >= 60_000
      ? intervalMs
      : DEFAULT_RECONCILE_INTERVAL_MS;

  setTimeout(() => {
    console.log(`[DynamicProxyReconciler] Starting (interval: ${resolvedInterval}ms)`);
    void reconcileAllDynamicProxyPools().catch((err) => {
      console.error("[DynamicProxyReconciler] Initial sweep error:", err);
    });

    globalThis.__dynamicProxyPoolReconcilerInterval = setInterval(() => {
      void reconcileAllDynamicProxyPools().catch((err) => {
        console.error("[DynamicProxyReconciler] Sweep error:", err);
      });
    }, resolvedInterval);
  }, INITIAL_DELAY_MS);
}

export function stopDynamicProxyPoolReconciler(): void {
  if (globalThis.__dynamicProxyPoolReconcilerInterval) {
    clearInterval(globalThis.__dynamicProxyPoolReconcilerInterval);
    globalThis.__dynamicProxyPoolReconcilerInterval = undefined;
  }
}
