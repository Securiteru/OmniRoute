import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-dynamic-proxy-route-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = "test-secret";
process.env.OMNIROUTE_DYNAMIC_PROXY_POOLS_ENABLED = "true";
delete process.env.INITIAL_PASSWORD;

const core = await import("../../src/lib/db/core.ts");
const proxiesDb = await import("../../src/lib/db/proxies.ts");
const route = await import("../../src/app/api/settings/proxies/dynamic/route.ts");

function request(method: string, body?: unknown, query = "") {
  return new Request(`http://localhost/api/settings/proxies/dynamic${query}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("dynamic pool management route creates and reads a pool", async () => {
  const created = await route.POST(request("POST", { name: "route-pool" }));
  assert.equal(created.status, 201);
  const createdBody = (await created.json()) as { pool: { id: string } };
  assert.ok(createdBody.pool.id);

  const proxy = await proxiesDb.createProxy({
    name: "route proxy",
    type: "http",
    host: "10.0.2.1",
    port: 9100,
  });
  const member = await route.PUT(
    request("PUT", {
      action: "member",
      poolId: createdBody.pool.id,
      proxyId: proxy!.id,
      egressIp: "203.0.113.50",
    })
  );
  assert.equal(member.status, 200);

  const loaded = await route.GET(
    request("GET", undefined, `?poolId=${encodeURIComponent(createdBody.pool.id)}`)
  );
  assert.equal(loaded.status, 200);
  const loadedBody = (await loaded.json()) as { members: Array<{ egressIp: string }> };
  assert.equal(loadedBody.members[0].egressIp, "203.0.113.50");
});
