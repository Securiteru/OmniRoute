-- Provider-local exclusive dynamic proxy leases.
-- A pool may be shared by providers, but two accounts of the same provider
-- must never hold the same observed egress IP at the same time. Lease history
-- also prevents a failed account from being assigned an IP it already used.

CREATE TABLE IF NOT EXISTS dynamic_proxy_pool_leases (
  lease_key TEXT NOT NULL,
  binding_id TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  current_proxy_id TEXT,
  current_egress_ip TEXT,
  lease_generation INTEGER NOT NULL DEFAULT 0,
  last_selected_at TEXT,
  last_success_at TEXT,
  last_failure_at TEXT,
  last_failure_reason TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (lease_key, provider),
  FOREIGN KEY (binding_id) REFERENCES dynamic_proxy_pool_bindings(id) ON DELETE CASCADE,
  FOREIGN KEY (pool_id) REFERENCES dynamic_proxy_pools(id) ON DELETE CASCADE,
  FOREIGN KEY (current_proxy_id) REFERENCES proxy_registry(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dynamic_proxy_leases_pool_provider
  ON dynamic_proxy_pool_leases(pool_id, provider, current_egress_ip);

CREATE TABLE IF NOT EXISTS dynamic_proxy_pool_lease_history (
  id TEXT PRIMARY KEY,
  lease_key TEXT NOT NULL,
  binding_id TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  proxy_id TEXT NOT NULL,
  egress_ip TEXT NOT NULL,
  reason TEXT,
  selected_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(lease_key, provider, egress_ip),
  FOREIGN KEY (binding_id) REFERENCES dynamic_proxy_pool_bindings(id) ON DELETE CASCADE,
  FOREIGN KEY (pool_id) REFERENCES dynamic_proxy_pools(id) ON DELETE CASCADE,
  FOREIGN KEY (proxy_id) REFERENCES proxy_registry(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dynamic_proxy_history_pool_provider_ip
  ON dynamic_proxy_pool_lease_history(pool_id, provider, egress_ip);

CREATE INDEX IF NOT EXISTS idx_dynamic_proxy_history_provider_ip
  ON dynamic_proxy_pool_lease_history(provider, egress_ip);

-- Preserve existing account-scoped leases when upgrading from the original
-- shared-lease implementation. Provider/global bindings are not backfilled
-- because their provider identity is ambiguous at this layer.
INSERT OR IGNORE INTO dynamic_proxy_pool_leases (
  lease_key, binding_id, pool_id, provider, current_proxy_id, current_egress_ip,
  lease_generation, last_selected_at, last_success_at, last_failure_at,
  last_failure_reason, updated_at
)
SELECT b.scope_id, b.id, b.pool_id, lower(pc.provider), b.current_proxy_id, b.current_egress_ip,
       b.lease_generation, b.last_selected_at, b.last_success_at, b.last_failure_at,
       b.last_failure_reason, b.updated_at
FROM dynamic_proxy_pool_bindings b
JOIN provider_connections pc ON b.scope = 'account' AND pc.id = b.scope_id
WHERE b.current_proxy_id IS NOT NULL
  AND b.id = (
    SELECT MIN(existing_binding.id)
    FROM dynamic_proxy_pool_bindings existing_binding
    JOIN provider_connections existing_connection
      ON existing_binding.scope = 'account'
     AND existing_connection.id = existing_binding.scope_id
    WHERE lower(existing_connection.provider) = lower(pc.provider)
      AND existing_binding.current_egress_ip = b.current_egress_ip
      AND existing_binding.current_proxy_id IS NOT NULL
  );

-- Existing installations could have shared one provider/IP before exclusivity
-- was introduced. Keep the first migrated lease and leave duplicates unleased;
-- the request path will wait for a genuinely free replacement.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dynamic_proxy_leases_unique_provider_egress
  ON dynamic_proxy_pool_leases(provider, current_egress_ip)
  WHERE current_egress_ip IS NOT NULL;

INSERT OR IGNORE INTO dynamic_proxy_pool_lease_history (
  id, lease_key, binding_id, pool_id, provider, proxy_id, egress_ip, reason, selected_at
)
SELECT lower(hex(randomblob(16))), l.lease_key, l.binding_id, l.pool_id, l.provider,
       l.current_proxy_id, l.current_egress_ip, 'migrated_existing_lease',
       COALESCE(l.last_selected_at, l.updated_at)
FROM dynamic_proxy_pool_leases l
WHERE l.current_proxy_id IS NOT NULL AND l.current_egress_ip IS NOT NULL;
