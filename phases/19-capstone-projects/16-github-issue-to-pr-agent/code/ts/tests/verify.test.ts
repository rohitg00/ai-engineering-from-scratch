import { test } from "node:test";
import { strict as assert } from "node:assert";
import { expectedSig, verifySignature } from "../src/verify.js";
import { AuditLog } from "../src/agent.js";
import { route } from "../src/router.js";

const SECRET = "test-secret";

test("expectedSig は deterministic", () => {
  const body = Buffer.from('{"a":1}', "utf8");
  const s1 = expectedSig(body, SECRET);
  const s2 = expectedSig(body, SECRET);
  assert.equal(s1, s2);
  assert.ok(s1.startsWith("sha256="));
});

test("verifySignature は matching signature を受け付ける", () => {
  const body = Buffer.from('{"action":"opened"}', "utf8");
  const sig = expectedSig(body, SECRET);
  assert.equal(verifySignature(body, sig, SECRET), true);
});

test("verifySignature は tampered body を reject する", () => {
  const body = Buffer.from('{"action":"opened"}', "utf8");
  const sig = expectedSig(body, SECRET);
  const tampered = Buffer.from('{"action":"closed"}', "utf8");
  assert.equal(verifySignature(tampered, sig, SECRET), false);
});

test("verifySignature は異なる secret を reject する", () => {
  const body = Buffer.from('{"a":1}', "utf8");
  const sig = expectedSig(body, "wrong");
  assert.equal(verifySignature(body, sig, SECRET), false);
});

test("verifySignature は missing header を reject する", () => {
  const body = Buffer.from("{}", "utf8");
  assert.equal(verifySignature(body, undefined, SECRET), false);
});

test("router ping は zen を echo する", () => {
  const audit = new AuditLog();
  const r = route(audit, "ping", { zen: "Hello", hook_id: 1 });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body, { pong: "Hello", hook_id: 1 });
});

test("router は issues.opened で dispatch する", () => {
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

test("router は opened 以外の action を skip する", () => {
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

test("router は missing issue object で 422 を返す", () => {
  const audit = new AuditLog();
  const r = route(audit, "issues", { action: "opened" });
  assert.equal(r.code, 422);
});
