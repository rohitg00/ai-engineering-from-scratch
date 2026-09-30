import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const skill = {
  id: "x",
  description: "x",
  keywords: ["review"],
  paths: ["src/*.ts"],
  priority: 1,
  requires: [],
  permissions: [],
};
test("single wildcard", () =>
  assert.equal(m.matchPath("src/a.ts", "src/*.ts"), true));
test("star does not cross directory", () =>
  assert.equal(m.matchPath("src/deep/a.ts", "src/*.ts"), false));
test("double star crosses directory", () =>
  assert.equal(m.matchPath("src/deep/a.ts", "**/*.ts"), true));
test("traversal rejected", () =>
  assert.equal(m.matchPath("../src/a.ts", "**/*.ts"), false));
test("score exposes reasons", () => {
  const r = m.rank([skill], "review", ["src/a.ts"])[0];
  assert.equal(r.score, 5);
  assert.equal(r.reasons.length, 2);
});
test("unmatched returns empty", () =>
  assert.deepEqual(m.rank([skill], "banana", []), []));
