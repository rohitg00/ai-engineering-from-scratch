import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  COMMAND_DENYLIST,
  hasShellMetachars,
  launchWorktree,
  refuseReason,
} from "../src/runtime.js";

test("denylist refuses rm", () => {
  const reason = refuseReason({ branch: "x", command: "rm", argv: ["-rf", "/"] });
  assert.match(String(reason), /denylisted/);
});

test("denylist refuses sudo", () => {
  const reason = refuseReason({ branch: "x", command: "sudo", argv: ["ls"] });
  assert.match(String(reason), /denylisted/);
});

test("denylist refuses curl", () => {
  const reason = refuseReason({ branch: "x", command: "curl", argv: [] });
  assert.match(String(reason), /denylisted/);
});

test("shell metachars are refused", () => {
  assert.equal(hasShellMetachars("foo;bar"), true);
  assert.equal(hasShellMetachars("foo && bar"), true);
  assert.equal(hasShellMetachars("foo|bar"), true);
  assert.equal(hasShellMetachars("foo$(whoami)"), true);
  assert.equal(hasShellMetachars("plain.arg"), false);
});

test("metachar in argv refuses launch", () => {
  const reason = refuseReason({
    branch: "x",
    command: "node",
    argv: ["-e", "1", ";", "echo", "pwned"],
  });
  assert.match(String(reason), /shell metacharacters/);
});

test("non-denylisted clean command passes refuseReason gate", () => {
  const reason = refuseReason({
    branch: "x",
    command: "node",
    argv: ["-e", "console.log(1)"],
  });
  assert.equal(reason, null);
});

test("launchWorktree refuses denylisted command without running it", async () => {
  const result = await launchWorktree({
    branch: "x",
    command: "rm",
    argv: ["-rf", "/"],
  });
  assert.match(String(result.refused), /denylisted/);
  assert.equal(result.stdout, "");
});

test("denylist is non-empty and contains expected commands", () => {
  assert.ok(COMMAND_DENYLIST.has("rm"));
  assert.ok(COMMAND_DENYLIST.has("sudo"));
  assert.ok(COMMAND_DENYLIST.has("dd"));
});

test("path-qualified denylisted command is refused via basename", () => {
  const reason = refuseReason({ branch: "x", command: "/bin/rm", argv: ["-rf", "/"] });
  assert.match(String(reason), /denylisted/);
});

test("interpreter -lc invoking denylisted command is refused", () => {
  const reason = refuseReason({
    branch: "x",
    command: "bash",
    argv: ["-lc", "rm -rf /"],
  });
  assert.match(String(reason), /denylisted|metacharacters/);
});
