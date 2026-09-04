import { test } from "node:test";
import { strict as assert } from "node:assert";
import { expectedSig, verifySignature } from "../src/verify.js";
import { AuditLog } from "../src/agent.js";
import { route } from "../src/router.js";

const SECRET = "test-secret";

test("expectedSig is deterministic", () => {
  const body = Buffer.from('{"a":1}', "utf8");
  const s1 = expectedSig(body, SECRET);
  const s2 = expectedSig(body, SECRET);
  assert.equal(s1, s2);
  assert.ok(s1.startsWith("sha256="));
});

test("verifySignature accepts matching signature", () => {
  const body = Buffer.from('{"action":"opened"}', "utf8");
  const sig = expectedSig(body, SECRET);
  assert.equal(verifySignature(body, sig, SECRET), true);
});

test("verifySignature rejects tampered body", () => {
  const body = Buffer.from('{"action":"opened"}', "utf8");
  const sig = expectedSig(body, SECRET);
  const tampered = Buffer.from('{"action":"closed"}', "utf8");
  assert.equal(verifySignature(tampered, sig, SECRET), false);
});

test("verifySignature rejects different secret", () => {
  const body = Buffer.from('{"a":1}', "utf8");
  const sig = expectedSig(body, "wrong");
  assert.equal(verifySignature(body, sig, SECRET), false);
});

test("verifySignature rejects missing header", () => {
  const body = Buffer.from("{}", "utf8");
  assert.equal(verifySignature(body, undefined, SECRET), false);
});

test("router ping echoes zen", () => {
  const audit = new AuditLog();
  const r = route(audit, "ping", { zen: "Hello", hook_id: 1 });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body, { pong: "Hello", hook_id: 1 });
});

test("router dispatches on issues.opened", () => {
  const audit = new AuditLog();
  const r = route(audit, "issues", {
    action: "opened",
    issue: { number: 7, title: "x" },
    repository: { full_name: "r/o" },
  });
  assert.equal(r.code, 202);
  const body = r.body as { dispatched: boolean; branch: string };
  assert.equal(body.dispatched, true);
  assert.equal(body.branch, "agent/issue-7");
  assert.equal(audit.count(), 2);
});

test("router skips non-opened actions", () => {
  const audit = new AuditLog();
  const r = route(audit, "issues", {
    action: "closed",
    issue: { number: 1, title: "x" },
    repository: { full_name: "r/o" },
  });
  assert.equal(r.code, 200);
  assert.equal((r.body as { skipped: boolean }).skipped, true);
  assert.equal(audit.count(), 0);
});

test("router 422 on missing issue object", () => {
  const audit = new AuditLog();
  const r = route(audit, "issues", { action: "opened" });
  assert.equal(r.code, 422);
});
