-- Dynamic shared proxy pools. Static proxy assignments remain independent.

CREATE TABLE IF NOT EXISTS dynamic_proxy_pools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  desired_ready_count INTEGER NOT NULL DEFAULT 5,
  min_ready_count INTEGER NOT NULL DEFAULT 1,
  max_candidates INTEGER NOT NULL DEFAULT 100,
  cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  fail_closed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dynamic_proxy_pool_bindings (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  current_proxy_id TEXT,
  current_egress_ip TEXT,
  lease_generation INTEGER NOT NULL DEFAULT 0,
  last_selected_at TEXT,
  last_success_at TEXT,
  last_failure_at TEXT,
  last_failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scope, scope_id),
  FOREIGN KEY (pool_id) REFERENCES dynamic_proxy_pools(id) ON DELETE CASCADE,
  FOREIGN KEY (current_proxy_id) REFERENCES proxy_registry(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dynamic_proxy_pool_members (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  proxy_id TEXT NOT NULL,
  egress_ip TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'untested',
  last_probe_at TEXT,
  last_success_at TEXT,
  last_failure_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pool_id, proxy_id),
  FOREIGN KEY (pool_id) REFERENCES dynamic_proxy_pools(id) ON DELETE CASCADE,
  FOREIGN KEY (proxy_id) REFERENCES proxy_registry(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dynamic_proxy_target_health (
  pool_id TEXT NOT NULL,
  proxy_id TEXT NOT NULL,
  target TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'untested',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  cooldown_until TEXT,
  last_latency_ms INTEGER,
  last_status INTEGER,
  last_error TEXT,
  last_success_at TEXT,
  last_failure_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pool_id, proxy_id, target),
  FOREIGN KEY (pool_id) REFERENCES dynamic_proxy_pools(id) ON DELETE CASCADE,
  FOREIGN KEY (proxy_id) REFERENCES proxy_registry(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dynamic_proxy_bindings_scope
  ON dynamic_proxy_pool_bindings(scope, scope_id, enabled);
CREATE INDEX IF NOT EXISTS idx_dynamic_proxy_members_pool
  ON dynamic_proxy_pool_members(pool_id, position);
CREATE INDEX IF NOT EXISTS idx_dynamic_proxy_health_cooldown
  ON dynamic_proxy_target_health(pool_id, target, cooldown_until);
