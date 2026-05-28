import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server.js";
import { parseSseStream } from "../src/stream.js";

describe("server", () => {
  it("GET / は HTML client を返す", async () => {
    const { app } = buildApp();
    const res = await Promise.resolve(app.request("/"));
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  });

  it("GET /health は ok と session count を返す", async () => {
    const { app } = buildApp();
    const res = await Promise.resolve(app.request("/health"));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; sessions: number };
    assert.equal(body.ok, true);
    assert.equal(body.sessions, 0);
  });

  it("GET /chat/stream は q 不足で 400 を返す", async () => {
    const { app } = buildApp();
    const res = await Promise.resolve(app.request("/chat/stream"));
    assert.equal(res.status, 400);
  });

  it("GET /chat/stream は session、citations、token、done event を emit する", async () => {
    const { app } = buildApp();
    const res = await Promise.resolve(
      app.request(
        "/chat/stream?sessionId=t-1&role=analyst&jurisdiction=GDPR&q=erasure%20right",
      ),
    );
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);
    const events = parseSseStream(await res.text());
    const names = events.map((e) => e.event);
    assert.ok(names.includes("session"));
    assert.ok(names.includes("citations"));
    assert.ok(names.includes("done"));
    assert.ok(events.filter((e) => e.event === "token").length > 0);
  });

  it("session は 2 turn にまたがって persist する", async () => {
    const { app, sessions } = buildApp();
    const url = "/chat/stream?sessionId=p-1&role=analyst&jurisdiction=GDPR&q=";
    const r1 = await Promise.resolve(app.request(url + "first"));
    await r1.text();
    const r2 = await Promise.resolve(app.request(url + "second"));
    await r2.text();
    const s = sessions.get("p-1");
    assert.ok(s);
    assert.equal(s.turns.length, 4);
    assert.equal(s.turns[0]?.role, "user");
    assert.equal(s.turns[1]?.role, "assistant");
    assert.equal(s.turns[2]?.role, "user");
    assert.equal(s.turns[3]?.role, "assistant");
  });

  it("GET /sessions は stored session を report する", async () => {
    const { app } = buildApp();
    const r = await Promise.resolve(
      app.request("/chat/stream?sessionId=u-1&role=r&jurisdiction=GDPR&q=hi"),
    );
    await r.text();
    const sres = await Promise.resolve(app.request("/sessions"));
    const data = (await sres.json()) as {
      sessions: Array<{ id: string; turnCount: number }>;
    };
    const found = data.sessions.find((s) => s.id === "u-1");
    assert.ok(found);
    assert.equal(found.turnCount, 2);
  });
});
