import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildApp } from "../src/server.ts";
import { buildIndices } from "../src/retrieval.ts";
import type { QueryResponse } from "../src/types.ts";

function app() {
  const { dense, bm25 } = buildIndices();
  return buildApp(dense, bm25);
}

test("GET /healthz: returns ok=true with corpus size", async () => {
  const res = await app().fetch(new Request("http://x/healthz"));
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; corpus: number };
  assert.equal(body.ok, true);
  assert.ok(body.corpus > 0);
});

test("GET /query: rejects missing q with 400", async () => {
  const res = await app().fetch(new Request("http://x/query"));
  assert.equal(res.status, 400);
});

test("GET /query?q=...: returns citations", async () => {
  const res = await app().fetch(
    new Request("http://x/query?q=" + encodeURIComponent("rank fusion")),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as QueryResponse;
  assert.ok(body.citations.length > 0);
});

test("POST /query: validates topK bound", async () => {
  const res = await app().fetch(
    new Request("http://x/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: "auth", topK: 9999 }),
    }),
  );
  assert.equal(res.status, 400);
});

test("POST /query: returns parsed response on valid body", async () => {
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

test("GET /query?q=%20: rejects whitespace-only query with 400", async () => {
  const res = await app().fetch(
    new Request("http://x/query?q=" + encodeURIComponent("   ")),
  );
  assert.equal(res.status, 400);
});

test("POST /query: rejects whitespace-only q with 400", async () => {
  const res = await app().fetch(
    new Request("http://x/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: "   " }),
    }),
  );
  assert.equal(res.status, 400);
});

test("unknown path: returns 404 json", async () => {
  const res = await app().fetch(new Request("http://x/missing"));
  assert.equal(res.status, 404);
});
