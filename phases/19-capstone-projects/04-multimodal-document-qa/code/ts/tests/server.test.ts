import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server.js";

describe("server", () => {
  const app = buildApp();

  it("GET /health returns ok", async () => {
    const res = await app.request("/health");
    assert.equal(res.status, 200);
    const body = await res.json() as { ok: boolean };
    assert.equal(body.ok, true);
  });

  it("GET / returns an HTML index", async () => {
    const res = await app.request("/");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  });

  it("GET /document/:id returns JSON when accept header asks for json", async () => {
    const res = await app.request("/document/10k-acme-2025", {
      headers: { accept: "application/json" },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { id: string; evidence: unknown[] };
    assert.equal(body.id, "10k-acme-2025");
    assert.ok(Array.isArray(body.evidence) && body.evidence.length >= 1);
  });

  it("GET /document/:id returns HTML by default", async () => {
    const res = await app.request("/document/10k-acme-2025");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  });

  it("GET /document/missing returns 404", async () => {
    const res = await app.request("/document/missing", {
      headers: { accept: "application/json" },
    });
    assert.equal(res.status, 404);
  });

  it("GET /document/bad.id rejects with 400 on hostile chars", async () => {
    const res = await app.request("/document/has.dot", {
      headers: { accept: "application/json" },
    });
    assert.equal(res.status, 400);
  });
});
