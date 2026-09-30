import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const r = {
  key: "k",
  scope: "repo",
  text: "run tests",
  sourceIds: ["a", "b"],
  sessions: ["s1", "s2"],
  state: "candidate",
};
test("approval works with support", () =>
  assert.equal(m.transition(r, "approve").state, "approved"));
test("one session fails approval", () =>
  assert.throws(
    () => m.transition({ ...r, sessions: ["s1"] }, "approve"),
    /insufficient/,
  ));
test("candidate not injected", () =>
  assert.deepEqual(m.hook([r], "repo").rules, []));
test("wrong scope not injected", () =>
  assert.deepEqual(m.hook([{ ...r, state: "approved" }], "other").rules, []));
test("global approved included", () =>
  assert.deepEqual(
    m.hook([{ ...r, state: "approved", scope: "global" }], "other").rules,
    ["run tests"],
  ));
test("retired cannot resurrect", () =>
  assert.throws(
    () => m.transition({ ...r, state: "retired" }, "approve"),
    /retired/,
  ));
