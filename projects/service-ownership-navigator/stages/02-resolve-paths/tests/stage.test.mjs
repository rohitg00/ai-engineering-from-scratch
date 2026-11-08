import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const c = {
  services: [
    {
      id: "api",
      name: "API",
      root: "src",
      owners: ["@catalog"],
      runbook: "r.md",
      dependencies: [],
    },
  ],
  rules: [
    { pattern: "/src/", owners: ["@base"], line: 1, source: "CODEOWNERS" },
    {
      pattern: "/src/special/**",
      owners: ["@special"],
      line: 2,
      source: "CODEOWNERS",
    },
  ],
  runbooks: {},
};
test("last matching rule wins", () =>
  assert.deepEqual(m.resolveOwnership(c, "src/special/a.ts").owners, [
    "@special",
  ]));
test("conflicting evidence retained", () =>
  assert.equal(m.resolveOwnership(c, "src/special/a.ts").conflicts.length, 2));
test("single star stays within segment", () =>
  assert.equal(m.matchesRule("/src/*.ts", "src/deep/a.ts"), false));
test("double star permits zero directories", () =>
  assert.equal(m.matchesRule("/src/**/a.ts", "src/a.ts"), true));
test("heldout traversal rejected", () =>
  assert.throws(() => m.resolveOwnership(c, "src/../secret"), /path/));
test("no evidence returns unresolved", () =>
  assert.deepEqual(m.resolveOwnership(c, "other/a.ts").owners, []));
