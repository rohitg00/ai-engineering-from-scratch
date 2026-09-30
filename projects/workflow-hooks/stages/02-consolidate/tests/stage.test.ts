import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const c = {
  id: "a",
  session: "s1",
  scope: "repo",
  rule: "run tests",
  source: "correction",
};
test("duplicate event once", () =>
  assert.equal(m.consolidate([c, c])[0].sourceIds.length, 1));
test("same session not extra support", () =>
  assert.equal(m.consolidate([c, { ...c, id: "b" }])[0].sessions.length, 1));
test("second session counts", () =>
  assert.equal(
    m.consolidate([c, { ...c, id: "b", session: "s2" }])[0].sessions.length,
    2,
  ));
test("different scopes stay separate", () =>
  assert.equal(
    m.consolidate([c, { ...c, id: "b", scope: "other" }]).length,
    2,
  ));
test("conflicting id rejected", () =>
  assert.throws(
    () => m.consolidate([c, { ...c, rule: "skip tests" }]),
    /conflicting/,
  ));
test("new rule is candidate", () =>
  assert.equal(m.consolidate([c])[0].state, "candidate"));
