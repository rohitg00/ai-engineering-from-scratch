import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  COMMAND_DENYLIST,
  hasShellMetachars,
  launchWorktree,
  refuseReason,
} from "../src/runtime.js";

test("denylist は rm を拒否する", () => {
  const reason = refuseReason({ branch: "x", command: "rm", argv: ["-rf", "/"] });
  assert.match(String(reason), /denylist/);
});

test("denylist は sudo を拒否する", () => {
  const reason = refuseReason({ branch: "x", command: "sudo", argv: ["ls"] });
  assert.match(String(reason), /denylist/);
});

test("denylist は curl を拒否する", () => {
  const reason = refuseReason({ branch: "x", command: "curl", argv: [] });
  assert.match(String(reason), /denylist/);
});

test("shell metachar は拒否される", () => {
  assert.equal(hasShellMetachars("foo;bar"), true);
  assert.equal(hasShellMetachars("foo && bar"), true);
  assert.equal(hasShellMetachars("foo|bar"), true);
  assert.equal(hasShellMetachars("foo$(whoami)"), true);
  assert.equal(hasShellMetachars("plain.arg"), false);
});

test("argv 内の metachar は launch を拒否する", () => {
  const reason = refuseReason({
    branch: "x",
    command: "node",
    argv: ["-e", "1", ";", "echo", "pwned"],
  });
  assert.match(String(reason), /shell metacharacter/);
});

test("denylist 外の clean command は refuseReason gate を通る", () => {
  const reason = refuseReason({
    branch: "x",
    command: "node",
    argv: ["-e", "console.log(1)"],
  });
  assert.equal(reason, null);
});

test("launchWorktree は denylisted command を実行せず拒否する", async () => {
  const result = await launchWorktree({
    branch: "x",
    command: "rm",
    argv: ["-rf", "/"],
  });
  assert.match(String(result.refused), /denylist/);
  assert.equal(result.stdout, "");
});

test("denylist は non-empty で expected command を含む", () => {
  assert.ok(COMMAND_DENYLIST.has("rm"));
  assert.ok(COMMAND_DENYLIST.has("sudo"));
  assert.ok(COMMAND_DENYLIST.has("dd"));
});

test("path-qualified denylisted command は basename 経由で拒否される", () => {
  const reason = refuseReason({ branch: "x", command: "/bin/rm", argv: ["-rf", "/"] });
  assert.match(String(reason), /denylist/);
});

test("denylisted command を呼ぶ interpreter -lc は拒否される", () => {
  const reason = refuseReason({
    branch: "x",
    command: "bash",
    argv: ["-lc", "rm -rf /"],
  });
  assert.match(String(reason), /denylist|metacharacter/);
});
