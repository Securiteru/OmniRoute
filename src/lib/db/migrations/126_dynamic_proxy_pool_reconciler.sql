-- Dynamic proxy pool reconciler control-plane columns.
-- Adds source filters, scan concurrency, and reconciliation tracking
-- so the background reconciler knows which sources to sync, how many
-- candidates to probe in parallel, and when the pool was last reconciled.

ALTER TABLE dynamic_proxy_pools ADD COLUMN sources TEXT NOT NULL DEFAULT '[]';
ALTER TABLE dynamic_proxy_pools ADD COLUMN scan_concurrency INTEGER NOT NULL DEFAULT 5;
ALTER TABLE dynamic_proxy_pools ADD COLUMN last_reconciled_at TEXT;
