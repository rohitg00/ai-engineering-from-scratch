import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SessionStore } from "../src/session.js";

describe("SessionStore", () => {
  it("creates a fresh session on first lookup", () => {
    const store = new SessionStore();
    const s = store.getOrCreate("s-1", "analyst", "GDPR");
    assert.equal(s.id, "s-1");
    assert.equal(s.role, "analyst");
    assert.equal(s.jurisdiction, "GDPR");
    assert.deepEqual(s.turns, []);
    assert.equal(store.size(), 1);
  });

  it("returns the same session on subsequent lookups", () => {
    const store = new SessionStore();
    const a = store.getOrCreate("s-2", "analyst", "GDPR");
    a.turns.push({ role: "user", content: "hi", ts: 1 });
    const b = store.getOrCreate("s-2", "ignored", "ignored");
    assert.equal(b, a);
    assert.equal(b.turns.length, 1);
  });

  it("appendTurn extends the turn list", () => {
    const store = new SessionStore();
    store.getOrCreate("s-3", "analyst", "GDPR");
    store.appendTurn("s-3", { role: "user", content: "q", ts: 1 });
    store.appendTurn("s-3", { role: "assistant", content: "a", ts: 2 });
    const s = store.get("s-3");
    assert.ok(s);
    assert.equal(s.turns.length, 2);
    assert.equal(s.turns[0]?.role, "user");
    assert.equal(s.turns[1]?.role, "assistant");
  });

  it("list returns every session", () => {
    const store = new SessionStore();
    store.getOrCreate("a", "r", "j");
    store.getOrCreate("b", "r", "j");
    const ids = store.list().map((s) => s.id).sort();
    assert.deepEqual(ids, ["a", "b"]);
  });

  it("appendTurn on unknown id is a no-op", () => {
    const store = new SessionStore();
    store.appendTurn("missing", { role: "user", content: "x", ts: 1 });
    assert.equal(store.size(), 0);
  });
});
