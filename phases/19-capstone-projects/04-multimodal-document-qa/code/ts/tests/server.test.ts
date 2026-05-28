import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server.js";

describe("server", () => {
  const app = buildApp();

  it("GET /health は ok を返す", async () => {
    const res = await app.request("/health");
    assert.equal(res.status, 200);
    const body = await res.json() as { ok: boolean };
    assert.equal(body.ok, true);
  });

  it("GET / は HTML index を返す", async () => {
    const res = await app.request("/");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  });

  it("GET /document/:id は accept header が json を要求した場合 JSON を返す", async () => {
    const res = await app.request("/document/10k-acme-2025", {
      headers: { accept: "application/json" },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { id: string; evidence: unknown[] };
    assert.equal(body.id, "10k-acme-2025");
    assert.ok(Array.isArray(body.evidence) && body.evidence.length >= 1);
  });

  it("GET /document/:id は default で HTML を返す", async () => {
    const res = await app.request("/document/10k-acme-2025");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  });

  it("GET /document/missing は 404 を返す", async () => {
    const res = await app.request("/document/missing", {
      headers: { accept: "application/json" },
    });
    assert.equal(res.status, 404);
  });

  it("GET /document/bad.id は hostile char を 400 で拒否する", async () => {
    const res = await app.request("/document/has.dot", {
      headers: { accept: "application/json" },
    });
    assert.equal(res.status, 400);
  });
});
