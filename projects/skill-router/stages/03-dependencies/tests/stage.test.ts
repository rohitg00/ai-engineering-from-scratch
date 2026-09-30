import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const s = (
  id: string,
  requires: string[] = [],
  permissions: string[] = [],
) => ({
  id,
  description: id,
  keywords: [],
  paths: [],
  priority: 0,
  requires,
  permissions,
});
test("dependency ordered first", () =>
  assert.deepEqual(m.plan([s("a", ["b"]), s("b")], ["a"], []), ["b", "a"]));
test("shared dependency once", () =>
  assert.deepEqual(
    m.plan([s("a", ["c"]), s("b", ["c"]), s("c")], ["a", "b"], []),
    ["c", "a", "b"],
  ));
test("cycle rejected", () =>
  assert.throws(
    () => m.plan([s("a", ["b"]), s("b", ["a"])], ["a"], []),
    /cycle/,
  ));
test("missing dependency rejected", () =>
  assert.throws(() => m.plan([s("a", ["b"])], ["a"], []), /missing/));
test("dependency permission enforced", () =>
  assert.throws(
    () => m.plan([s("a", ["b"]), s("b", [], ["write"])], ["a"], []),
    /permission/,
  ));
test("duplicate ids rejected", () =>
  assert.throws(() => m.plan([s("a"), s("a")], ["a"], []), /duplicate/));
