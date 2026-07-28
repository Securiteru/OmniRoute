-- 124_free_proxy_credentials.sql
-- Add username/password columns to free_proxies so authenticated proxies
-- (e.g. Webshare direct proxies) can be stored and promoted to proxy_registry
-- with their credentials intact. Without this, Webshare proxies get promoted
-- with empty credentials → 407 Proxy Authentication Required at runtime.

ALTER TABLE free_proxies ADD COLUMN username TEXT DEFAULT '';
ALTER TABLE free_proxies ADD COLUMN password TEXT DEFAULT '';
