import { randomUUID } from "node:crypto";
import { getDbInstance } from "./core";
import { backupDbFile } from "./backup";

export type DynamicProxyScope = "global" | "provider" | "account";
export type DynamicProxyMemberState = "untested" | "healthy" | "suspect" | "cooldown";

export interface DynamicProxyPool {
  id: string;
  name: string;
  enabled: boolean;
  desiredReadyCount: number;
  minReadyCount: number;
  maxCandidates: number;
  cooldownSeconds: number;
  failClosed: boolean;
  sources: string[];
  scanConcurrency: number;
  lastReconciledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DynamicProxyPoolMember {
  id: string;
  poolId: string;
  proxyId: string;
  egressIp: string | null;
  position: number;
  state: DynamicProxyMemberState;
  lastProbeAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DynamicProxyTargetHealth {
  poolId: string;
  proxyId: string;
  target: string;
  state: DynamicProxyMemberState;
  consecutiveFailures: number;
  cooldownUntil: string | null;
  lastLatencyMs: number | null;
  lastStatus: number | null;
  lastError: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  updatedAt: string;
}

export interface DynamicProxySelection {
  bindingId: string;
  poolId: string;
  proxyId: string;
  egressIp: string | null;
  leaseGeneration: number;
  proxy: {
    type: string;
    host: string;
    port: number;
    username: string;
    password: string;
    family: string;
  };
}

export function isDynamicProxyPoolEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.OMNIROUTE_DYNAMIC_PROXY_POOLS_ENABLED?.trim() || "");
}

export interface DynamicProxyResolution {
  poolId: string;
  pool: DynamicProxyPool;
  selection: DynamicProxySelection | null;
}

export interface DynamicProxySelectionOptions {
  /** Override the production backoff schedule in focused tests. */
  retryDelaysMs?: number[];
}

const DEFAULT_EXCLUSIVE_LEASE_RETRY_DELAYS_MS = [10_000, 20_000, 30_000];

type PoolRow = Record<string, unknown>;

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function mapPool(row: PoolRow): DynamicProxyPool {
  let sources: string[] = [];
  try {
    const parsed = JSON.parse(String(row.sources ?? "[]"));
    if (Array.isArray(parsed)) sources = parsed.map(String);
  } catch {
    sources = [];
  }
  return {
    id: String(row.id),
    name: String(row.name),
    enabled: asBoolean(row.enabled),
    desiredReadyCount: Number(row.desired_ready_count) || 5,
    minReadyCount: Number(row.min_ready_count) || 1,
    maxCandidates: Number(row.max_candidates) || 100,
    cooldownSeconds: Number(row.cooldown_seconds) || 300,
    failClosed: asBoolean(row.fail_closed),
    sources,
    scanConcurrency: Number(row.scan_concurrency) || 5,
    lastReconciledAt: typeof row.last_reconciled_at === "string" ? row.last_reconciled_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapMember(row: PoolRow): DynamicProxyPoolMember {
  return {
    id: String(row.id),
    poolId: String(row.pool_id),
    proxyId: String(row.proxy_id),
    egressIp: typeof row.egress_ip === "string" ? row.egress_ip : null,
    position: Number(row.position) || 0,
    state: (row.state as DynamicProxyMemberState) || "untested",
    lastProbeAt: typeof row.last_probe_at === "string" ? row.last_probe_at : null,
    lastSuccessAt: typeof row.last_success_at === "string" ? row.last_success_at : null,
    lastFailureAt: typeof row.last_failure_at === "string" ? row.last_failure_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapHealth(row: PoolRow): DynamicProxyTargetHealth {
  return {
    poolId: String(row.pool_id),
    proxyId: String(row.proxy_id),
    target: String(row.target),
    state: (row.state as DynamicProxyMemberState) || "untested",
    consecutiveFailures: Number(row.consecutive_failures) || 0,
    cooldownUntil: typeof row.cooldown_until === "string" ? row.cooldown_until : null,
    lastLatencyMs: row.last_latency_ms == null ? null : Number(row.last_latency_ms),
    lastStatus: row.last_status == null ? null : Number(row.last_status),
    lastError: typeof row.last_error === "string" ? row.last_error : null,
    lastSuccessAt: typeof row.last_success_at === "string" ? row.last_success_at : null,
    lastFailureAt: typeof row.last_failure_at === "string" ? row.last_failure_at : null,
    updatedAt: String(row.updated_at),
  };
}

function normalizeScope(scope: string): DynamicProxyScope {
  if (scope === "key") return "account";
  if (scope === "global" || scope === "provider" || scope === "account") return scope;
  throw new Error(`Unsupported dynamic proxy scope: ${scope}`);
}

function normalizeScopeId(scope: DynamicProxyScope, scopeId?: string | null): string {
  if (scope === "global") return "__global__";
  if (!scopeId?.trim()) throw new Error(`scopeId is required for ${scope} dynamic proxy bindings`);
  return scopeId.trim();
}

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

function targetKey(provider: string): string {
  return `provider:${normalizeProvider(provider)}`;
}

function getPoolById(id: string): DynamicProxyPool | null {
  const row = getDbInstance().prepare("SELECT * FROM dynamic_proxy_pools WHERE id = ?").get(id) as
    PoolRow | undefined;
  return row ? mapPool(row) : null;
}

function getBinding(
  scope: DynamicProxyScope,
  scopeId: string
): { bindingId: string; poolId: string } | null {
  const row = getDbInstance()
    .prepare(
      `SELECT b.id AS binding_id, b.pool_id AS pool_id
       FROM dynamic_proxy_pool_bindings b
       JOIN dynamic_proxy_pools p ON p.id = b.pool_id
       WHERE b.scope = ? AND b.scope_id = ? AND b.enabled = 1 AND p.enabled = 1`
    )
    .get(scope, scopeId) as { binding_id?: string; pool_id?: string } | undefined;
  return row?.binding_id && row.pool_id ? { bindingId: row.binding_id, poolId: row.pool_id } : null;
}

function findEffectiveBinding(
  connectionId: string,
  provider: string
): { bindingId: string; poolId: string } | null {
  return (
    getBinding("account", connectionId) ||
    getBinding("provider", provider) ||
    getBinding("global", "__global__")
  );
}

export async function resolveDynamicProxyForConnection(
  connectionId: string,
  provider: string
): Promise<DynamicProxyResolution | null> {
  const binding = findEffectiveBinding(connectionId, provider);
  if (!binding) return null;
  const pool = getPoolById(binding.poolId);
  if (!pool) return null;
  return {
    poolId: pool.id,
    pool,
    selection: await selectDynamicProxyForConnection(connectionId, provider),
  };
}

function proxySelectionFromRow(row: PoolRow): DynamicProxySelection {
  return {
    bindingId: typeof row.binding_id === "string" ? row.binding_id : "",
    poolId: String(row.pool_id),
    proxyId: String(row.proxy_id),
    egressIp: typeof row.egress_ip === "string" ? row.egress_ip : null,
    leaseGeneration: Number(row.lease_generation) || 0,
    proxy: {
      type: String(row.type),
      host: String(row.host),
      port: Number(row.port),
      username: typeof row.username === "string" ? row.username : "",
      password: typeof row.password === "string" ? row.password : "",
      family: typeof row.family === "string" ? row.family : "auto",
    },
  };
}

export async function createDynamicProxyPool(input: {
  name: string;
  enabled?: boolean;
  desiredReadyCount?: number;
  minReadyCount?: number;
  maxCandidates?: number;
  cooldownSeconds?: number;
  failClosed?: boolean;
}): Promise<DynamicProxyPool> {
  const name = input.name.trim();
  if (!name) throw new Error("Dynamic proxy pool name is required");
  const now = new Date().toISOString();
  const id = randomUUID();
  getDbInstance()
    .prepare(
      `INSERT INTO dynamic_proxy_pools
       (id, name, enabled, desired_ready_count, min_ready_count, max_candidates, cooldown_seconds, fail_closed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      name,
      input.enabled === false ? 0 : 1,
      Math.max(1, Math.floor(input.desiredReadyCount ?? 5)),
      Math.max(0, Math.floor(input.minReadyCount ?? 1)),
      Math.max(1, Math.floor(input.maxCandidates ?? 100)),
      Math.max(1, Math.floor(input.cooldownSeconds ?? 300)),
      input.failClosed === false ? 0 : 1,
      now,
      now
    );
  backupDbFile("pre-write");
  return getPoolById(id)!;
}

export async function listDynamicProxyPools(): Promise<DynamicProxyPool[]> {
  return (
    getDbInstance()
      .prepare("SELECT * FROM dynamic_proxy_pools ORDER BY name ASC")
      .all() as PoolRow[]
  ).map(mapPool);
}

export async function getDynamicProxyPool(id: string): Promise<DynamicProxyPool | null> {
  return getPoolById(id);
}

export async function bindDynamicProxyPool(
  poolId: string,
  scope: string,
  scopeId?: string | null,
  enabled = true
) {
  if (!getPoolById(poolId)) throw new Error(`Dynamic proxy pool not found: ${poolId}`);
  const normalizedScope = normalizeScope(scope);
  const normalizedScopeId = normalizeScopeId(normalizedScope, scopeId);
  const now = new Date().toISOString();
  const db = getDbInstance();
  db.prepare(
    `INSERT INTO dynamic_proxy_pool_bindings
       (id, pool_id, scope, scope_id, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(scope, scope_id) DO UPDATE SET
         pool_id = excluded.pool_id,
         enabled = excluded.enabled,
         current_proxy_id = NULL,
         current_egress_ip = NULL,
         lease_generation = lease_generation + 1,
         updated_at = excluded.updated_at`
  ).run(randomUUID(), poolId, normalizedScope, normalizedScopeId, enabled ? 1 : 0, now);
  // A rebinding invalidates the active lease, but deliberately retains the
  // account/provider history so a later failover cannot reuse a prior egress.
  db.prepare(
    `UPDATE dynamic_proxy_pool_leases
     SET current_proxy_id = NULL, current_egress_ip = NULL, updated_at = ?
     WHERE binding_id = (SELECT id FROM dynamic_proxy_pool_bindings WHERE scope = ? AND scope_id = ?)`
  ).run(now, normalizedScope, normalizedScopeId);
  backupDbFile("pre-write");
  const binding = getBinding(normalizedScope, normalizedScopeId);
  return {
    bindingId: binding?.bindingId ?? null,
    poolId,
    scope: normalizedScope,
    scopeId: normalizedScopeId,
    enabled,
  };
}

export async function listDynamicProxyPoolBindings(poolId?: string) {
  const rows = poolId
    ? getDbInstance()
        .prepare(
          "SELECT * FROM dynamic_proxy_pool_bindings WHERE pool_id = ? ORDER BY scope, scope_id"
        )
        .all(poolId)
    : getDbInstance()
        .prepare("SELECT * FROM dynamic_proxy_pool_bindings ORDER BY scope, scope_id")
        .all();
  return rows as PoolRow[];
}

export async function addDynamicProxyPoolMember(
  poolId: string,
  proxyId: string,
  egressIp?: string | null
): Promise<DynamicProxyPoolMember> {
  if (!getPoolById(poolId)) throw new Error(`Dynamic proxy pool not found: ${poolId}`);
  const proxy = getDbInstance().prepare("SELECT id FROM proxy_registry WHERE id = ?").get(proxyId);
  if (!proxy) throw new Error(`Proxy not found: ${proxyId}`);
  const existing = getDbInstance()
    .prepare("SELECT * FROM dynamic_proxy_pool_members WHERE pool_id = ? AND proxy_id = ?")
    .get(poolId, proxyId) as PoolRow | undefined;
  if (existing) return mapMember(existing);
  const positionRow = getDbInstance()
    .prepare(
      "SELECT COALESCE(MAX(position), -1) AS position FROM dynamic_proxy_pool_members WHERE pool_id = ?"
    )
    .get(poolId) as { position?: number };
  const now = new Date().toISOString();
  const id = randomUUID();
  getDbInstance()
    .prepare(
      `INSERT INTO dynamic_proxy_pool_members
       (id, pool_id, proxy_id, egress_ip, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      poolId,
      proxyId,
      egressIp?.trim() || null,
      Number(positionRow.position ?? -1) + 1,
      now
    );
  backupDbFile("pre-write");
  return mapMember(
    getDbInstance()
      .prepare("SELECT * FROM dynamic_proxy_pool_members WHERE id = ?")
      .get(id) as PoolRow
  );
}

export async function listDynamicProxyPoolMembers(
  poolId: string
): Promise<DynamicProxyPoolMember[]> {
  return (
    getDbInstance()
      .prepare(
        "SELECT * FROM dynamic_proxy_pool_members WHERE pool_id = ? ORDER BY position ASC, id ASC"
      )
      .all(poolId) as PoolRow[]
  ).map(mapMember);
}

export async function listDynamicProxyTargetHealth(
  poolId: string,
  provider?: string
): Promise<DynamicProxyTargetHealth[]> {
  const rows = provider
    ? getDbInstance()
        .prepare(
          "SELECT * FROM dynamic_proxy_target_health WHERE pool_id = ? AND target = ? ORDER BY proxy_id"
        )
        .all(poolId, targetKey(provider))
    : getDbInstance()
        .prepare(
          "SELECT * FROM dynamic_proxy_target_health WHERE pool_id = ? ORDER BY target, proxy_id"
        )
        .all(poolId);
  return (rows as PoolRow[]).map(mapHealth);
}

function selectCandidate(
  poolId: string,
  provider: string,
  leaseKey: string,
  currentProxyId?: string | null
): PoolRow | undefined {
  const normalizedProvider = normalizeProvider(provider);
  const target = targetKey(provider);
  const now = new Date().toISOString();
  const rows = getDbInstance()
    .prepare(
      `SELECT m.pool_id, m.proxy_id, m.egress_ip, p.type, p.host, p.port, p.username, p.password, p.family,
               h.state AS health_state, h.cooldown_until
       FROM dynamic_proxy_pool_members m
       JOIN proxy_registry p ON p.id = m.proxy_id AND p.status = 'active'
       LEFT JOIN dynamic_proxy_target_health h
         ON h.pool_id = m.pool_id AND h.proxy_id = m.proxy_id AND h.target = ?
       WHERE m.pool_id = ?
         AND m.egress_ip IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM dynamic_proxy_pool_leases l
           WHERE lower(l.provider) = ?
             AND l.current_egress_ip = m.egress_ip
             AND l.lease_key <> ?
         )
         AND NOT EXISTS (
           SELECT 1 FROM dynamic_proxy_pool_lease_history hst
           WHERE hst.lease_key = ? AND lower(hst.provider) = ?
             AND hst.egress_ip = m.egress_ip
         )
       ORDER BY m.position ASC, m.id ASC`
    )
    .all(target, poolId, normalizedProvider, leaseKey, leaseKey, normalizedProvider) as PoolRow[];
  return rows.find((row) => {
    if (currentProxyId && row.proxy_id === currentProxyId) return false;
    if (row.health_state !== "cooldown") return true;
    return typeof row.cooldown_until === "string" && row.cooldown_until <= now;
  });
}

function selectDynamicProxyForConnectionOnce(
  connectionId: string,
  provider: string
): DynamicProxySelection | null {
  const binding = findEffectiveBinding(connectionId, provider);
  if (!binding) return null;
  const db = getDbInstance();
  const target = targetKey(provider);
  const normalizedProvider = normalizeProvider(provider);
  const selectLease = db.transaction(() => {
    const bindingRow = db
      .prepare(
        `SELECT b.id AS binding_id, b.pool_id,
                l.current_proxy_id AS proxy_id,
                COALESCE(l.lease_generation, b.lease_generation) AS lease_generation,
                COALESCE(l.current_egress_ip, b.current_egress_ip) AS current_egress_ip,
                m.egress_ip, p.type, p.host, p.port, p.username, p.password, p.family,
                h.state AS health_state, h.cooldown_until,
                l.provider AS lease_provider
         FROM dynamic_proxy_pool_bindings b
         LEFT JOIN dynamic_proxy_pool_leases l
           ON l.lease_key = ? AND lower(l.provider) = ? AND l.binding_id = b.id
          AND l.pool_id = b.pool_id
         LEFT JOIN dynamic_proxy_pool_members m
           ON m.pool_id = l.pool_id AND m.proxy_id = l.current_proxy_id
         LEFT JOIN proxy_registry p ON p.id = m.proxy_id AND p.status = 'active'
         LEFT JOIN dynamic_proxy_target_health h
           ON h.pool_id = b.pool_id AND h.proxy_id = l.current_proxy_id AND h.target = ?
         WHERE b.id = ? AND b.enabled = 1`
      )
      .get(connectionId, normalizedProvider, target, binding.bindingId) as PoolRow | undefined;
    const now = new Date().toISOString();
    const currentHealthy =
      bindingRow?.proxy_id &&
      bindingRow.type &&
      (bindingRow.health_state !== "cooldown" ||
        (typeof bindingRow.cooldown_until === "string" && bindingRow.cooldown_until <= now));
    if (currentHealthy) return proxySelectionFromRow(bindingRow);

    const candidate = selectCandidate(
      binding.poolId,
      provider,
      connectionId,
      typeof bindingRow?.proxy_id === "string" ? bindingRow.proxy_id : null
    );
    if (!candidate) return null;
    const previousGeneration = Number(bindingRow?.lease_generation || 0);
    const nextGeneration = previousGeneration + 1;
    const updated = db
      .prepare(
        `INSERT INTO dynamic_proxy_pool_leases
           (lease_key, binding_id, pool_id, provider, current_proxy_id, current_egress_ip,
            lease_generation, last_selected_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(lease_key, provider) DO UPDATE SET
           current_proxy_id = excluded.current_proxy_id,
           current_egress_ip = excluded.current_egress_ip,
           lease_generation = excluded.lease_generation,
           last_selected_at = excluded.last_selected_at,
           updated_at = excluded.updated_at`
      )
      .run(
        connectionId,
        binding.bindingId,
        binding.poolId,
        normalizedProvider,
        candidate.proxy_id,
        candidate.egress_ip || null,
        nextGeneration,
        now,
        now
      );
    if (updated.changes !== 1) return null;
    db.prepare(
      `UPDATE dynamic_proxy_pool_bindings
       SET current_proxy_id = ?, current_egress_ip = ?, lease_generation = ?,
           last_selected_at = ?, updated_at = ?
       WHERE id = ? AND enabled = 1`
    ).run(
      candidate.proxy_id,
      candidate.egress_ip || null,
      nextGeneration,
      now,
      now,
      binding.bindingId
    );
    db.prepare(
      `INSERT OR IGNORE INTO dynamic_proxy_pool_lease_history
       (id, lease_key, binding_id, pool_id, provider, proxy_id, egress_ip, reason, selected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'selected', ?)`
    ).run(
      randomUUID(),
      connectionId,
      binding.bindingId,
      binding.poolId,
      normalizedProvider,
      candidate.proxy_id,
      candidate.egress_ip,
      now
    );
    return proxySelectionFromRow({
      ...candidate,
      binding_id: binding.bindingId,
      lease_generation: nextGeneration,
    });
  });
  try {
    return selectLease();
  } catch (error) {
    // Another process may have reserved the same provider/IP between the
    // candidate query and the insert. Let bounded retries choose a free IP.
    if (
      error instanceof Error &&
      /idx_dynamic_proxy_leases_unique_provider_egress|UNIQUE constraint failed/i.test(
        error.message
      )
    ) {
      return null;
    }
    throw error;
  }
}

export async function selectDynamicProxyForConnection(
  connectionId: string,
  provider: string,
  options: DynamicProxySelectionOptions = {}
): Promise<DynamicProxySelection | null> {
  const first = selectDynamicProxyForConnectionOnce(connectionId, provider);
  if (first || options.retryDelaysMs?.length === 0) return first;

  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_EXCLUSIVE_LEASE_RETRY_DELAYS_MS;
  for (const delayMs of retryDelaysMs) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const selection = selectDynamicProxyForConnectionOnce(connectionId, provider);
    if (selection) return selection;
  }
  return null;
}

export async function recordDynamicProxySuccess(
  connectionId: string,
  provider: string,
  proxyId: string,
  latencyMs?: number
): Promise<void> {
  const binding = findEffectiveBinding(connectionId, provider);
  if (!binding) return;
  const db = getDbInstance();
  const now = new Date().toISOString();
  const normalizedProvider = normalizeProvider(provider);
  const target = targetKey(provider);
  db.prepare(
    `INSERT INTO dynamic_proxy_target_health
     (pool_id, proxy_id, target, state, consecutive_failures, last_latency_ms, last_success_at, updated_at)
     VALUES (?, ?, ?, 'healthy', 0, ?, ?, ?)
     ON CONFLICT(pool_id, proxy_id, target) DO UPDATE SET
       state = 'healthy', consecutive_failures = 0, cooldown_until = NULL,
       last_latency_ms = excluded.last_latency_ms, last_success_at = excluded.last_success_at, updated_at = excluded.updated_at`
  ).run(binding.poolId, proxyId, target, latencyMs ?? null, now, now);
  db.prepare(
    "UPDATE dynamic_proxy_pool_members SET state = 'healthy', last_success_at = ?, updated_at = ? WHERE pool_id = ? AND proxy_id = ?"
  ).run(now, now, binding.poolId, proxyId);
  db.prepare(
    "UPDATE dynamic_proxy_pool_bindings SET last_success_at = ?, updated_at = ? WHERE id = ? AND current_proxy_id = ?"
  ).run(now, now, binding.bindingId, proxyId);
  db.prepare(
    "UPDATE dynamic_proxy_pool_leases SET last_success_at = ?, updated_at = ? WHERE lease_key = ? AND lower(provider) = ? AND current_proxy_id = ?"
  ).run(now, now, connectionId, normalizedProvider, proxyId);
}

export async function recordDynamicProxyFailure(
  connectionId: string,
  provider: string,
  proxyId: string,
  reason: string,
  cooldownSeconds?: number,
  options: DynamicProxySelectionOptions = {}
): Promise<DynamicProxySelection | null> {
  const binding = findEffectiveBinding(connectionId, provider);
  if (!binding) return null;
  const db = getDbInstance();
  const pool = getPoolById(binding.poolId);
  if (!pool) return null;
  const normalizedProvider = normalizeProvider(provider);
  const now = new Date();
  const nowIso = now.toISOString();
  const cooldownUntil = new Date(
    now.getTime() + 1000 * Math.max(1, cooldownSeconds ?? pool.cooldownSeconds)
  ).toISOString();
  const target = targetKey(provider);
  db.prepare(
    `INSERT INTO dynamic_proxy_target_health
     (pool_id, proxy_id, target, state, consecutive_failures, cooldown_until, last_error, last_failure_at, updated_at)
     VALUES (?, ?, ?, 'cooldown', 1, ?, ?, ?, ?)
     ON CONFLICT(pool_id, proxy_id, target) DO UPDATE SET
       state = 'cooldown', consecutive_failures = consecutive_failures + 1,
       cooldown_until = excluded.cooldown_until, last_error = excluded.last_error,
       last_failure_at = excluded.last_failure_at, updated_at = excluded.updated_at`
  ).run(binding.poolId, proxyId, target, cooldownUntil, reason.slice(0, 500), nowIso, nowIso);
  db.prepare(
    "UPDATE dynamic_proxy_pool_members SET state = 'cooldown', last_failure_at = ?, updated_at = ? WHERE pool_id = ? AND proxy_id = ?"
  ).run(nowIso, nowIso, binding.poolId, proxyId);
  db.prepare(
    `UPDATE dynamic_proxy_pool_bindings
     SET current_proxy_id = NULL, current_egress_ip = NULL, last_failure_at = ?, last_failure_reason = ?, updated_at = ?
      WHERE id = ? AND current_proxy_id = ?`
  ).run(nowIso, reason.slice(0, 500), nowIso, binding.bindingId, proxyId);
  db.prepare(
    `UPDATE dynamic_proxy_pool_leases
     SET current_proxy_id = NULL, current_egress_ip = NULL, last_failure_at = ?,
         last_failure_reason = ?, updated_at = ?
     WHERE lease_key = ? AND lower(provider) = ? AND current_proxy_id = ?`
  ).run(nowIso, reason.slice(0, 500), nowIso, connectionId, normalizedProvider, proxyId);
  db.prepare(
    `UPDATE dynamic_proxy_pool_lease_history
     SET reason = ?
     WHERE lease_key = ? AND lower(provider) = ? AND proxy_id = ? AND egress_ip IN (
       SELECT egress_ip FROM dynamic_proxy_pool_members WHERE pool_id = ? AND proxy_id = ?
     )`
  ).run(reason.slice(0, 500), connectionId, normalizedProvider, proxyId, binding.poolId, proxyId);
  return selectDynamicProxyForConnection(connectionId, provider, options);
}

export async function updateDynamicProxyPool(
  id: string,
  updates: {
    name?: string;
    enabled?: boolean;
    desiredReadyCount?: number;
    minReadyCount?: number;
    maxCandidates?: number;
    cooldownSeconds?: number;
    failClosed?: boolean;
  }
): Promise<DynamicProxyPool | null> {
  const pool = getPoolById(id);
  if (!pool) throw new Error(`Dynamic proxy pool not found: ${id}`);
  const db = getDbInstance();
  const now = new Date().toISOString();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.name != null) {
    sets.push("name = ?");
    params.push(updates.name.trim());
  }
  if (updates.enabled != null) {
    sets.push("enabled = ?");
    params.push(updates.enabled ? 1 : 0);
  }
  if (updates.desiredReadyCount != null) {
    sets.push("desired_ready_count = ?");
    params.push(Math.max(1, Math.floor(updates.desiredReadyCount)));
  }
  if (updates.minReadyCount != null) {
    sets.push("min_ready_count = ?");
    params.push(Math.max(0, Math.floor(updates.minReadyCount)));
  }
  if (updates.maxCandidates != null) {
    sets.push("max_candidates = ?");
    params.push(Math.max(1, Math.floor(updates.maxCandidates)));
  }
  if (updates.cooldownSeconds != null) {
    sets.push("cooldown_seconds = ?");
    params.push(Math.max(1, Math.floor(updates.cooldownSeconds)));
  }
  if (updates.failClosed != null) {
    sets.push("fail_closed = ?");
    params.push(updates.failClosed ? 1 : 0);
  }

  if (sets.length === 0) return pool;
  sets.push("updated_at = ?");
  params.push(now, id);
  db.prepare(`UPDATE dynamic_proxy_pools SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  backupDbFile("pre-write");
  return getPoolById(id);
}

export async function deleteDynamicProxyPool(id: string): Promise<boolean> {
  const db = getDbInstance();
  const result = db.prepare("DELETE FROM dynamic_proxy_pools WHERE id = ?").run(id);
  if (result.changes > 0) backupDbFile("pre-write");
  return result.changes > 0;
}

export async function removeDynamicProxyPoolBinding(
  scope: string,
  scopeId: string
): Promise<boolean> {
  const normalizedScope = normalizeScope(scope);
  const normalizedScopeId = normalizeScopeId(normalizedScope, scopeId);
  const db = getDbInstance();
  const result = db
    .prepare("DELETE FROM dynamic_proxy_pool_bindings WHERE scope = ? AND scope_id = ?")
    .run(normalizedScope, normalizedScopeId);
  if (result.changes > 0) backupDbFile("pre-write");
  return result.changes > 0;
}

export async function removeDynamicProxyPoolMember(
  poolId: string,
  proxyId: string
): Promise<boolean> {
  const db = getDbInstance();
  const result = db
    .prepare("DELETE FROM dynamic_proxy_pool_members WHERE pool_id = ? AND proxy_id = ?")
    .run(poolId, proxyId);
  if (result.changes > 0) {
    db.prepare(
      `UPDATE dynamic_proxy_pool_leases
       SET current_proxy_id = NULL, current_egress_ip = NULL, updated_at = ?
       WHERE pool_id = ? AND current_proxy_id = ?`
    ).run(new Date().toISOString(), poolId, proxyId);
  }
  if (result.changes > 0) backupDbFile("pre-write");
  return result.changes > 0;
}

export function getPoolReadyEgressCount(poolId: string): number {
  const row = getDbInstance()
    .prepare(
      `SELECT COUNT(DISTINCT egress_ip) AS cnt
       FROM dynamic_proxy_pool_members
       WHERE pool_id = ? AND egress_ip IS NOT NULL AND state != 'cooldown'`
    )
    .get(poolId) as { cnt?: number } | undefined;
  return Number(row?.cnt ?? 0);
}
