import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildApp } from "../src/server.ts";
import { buildIndices } from "../src/retrieval.ts";
import type { QueryResponse } from "../src/types.ts";

function app() {
  const { dense, bm25 } = buildIndices();
  return buildApp(dense, bm25);
}

test("GET /healthz: ok=true と corpus size を返す", async () => {
  const res = await app().fetch(new Request("http://x/healthz"));
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; corpus: number };
  assert.equal(body.ok, true);
  assert.ok(body.corpus > 0);
});

test("GET /query: q 不足を 400 で拒否する", async () => {
  const res = await app().fetch(new Request("http://x/query"));
  assert.equal(res.status, 400);
});

test("GET /query?q=...: citation を返す", async () => {
  const res = await app().fetch(
    new Request("http://x/query?q=" + encodeURIComponent("rank fusion")),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as QueryResponse;
  assert.ok(body.citations.length > 0);
});

test("POST /query: topK の上限を検証する", async () => {
  const res = await app().fetch(
    new Request("http://x/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: "auth", topK: 9999 }),
    }),
  );
  assert.equal(res.status, 400);
});

test("POST /query: valid body で parsed response を返す", async () => {
  const res = await app().fetch(
    new Request("http://x/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: "authorization", topK: 3 }),
    }),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as QueryResponse;
  assert.ok(body.citations.length <= 3);
});

test("GET /query?q=%20: whitespace-only query を 400 で拒否する", async () => {
  const res = await app().fetch(
    new Request("http://x/query?q=" + encodeURIComponent("   ")),
  );
  assert.equal(res.status, 400);
});

test("POST /query: whitespace-only q を 400 で拒否する", async () => {
  const res = await app().fetch(
    new Request("http://x/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: "   " }),
    }),
  );
  assert.equal(res.status, 400);
});

test("unknown path: 404 json を返す", async () => {
  const res = await app().fetch(new Request("http://x/missing"));
  assert.equal(res.status, 404);
});
