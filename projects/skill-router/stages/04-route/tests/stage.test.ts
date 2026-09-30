import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

test("known route is ready", () =>
  assert.equal(m.route(m.catalog, "review", [], ["read"]).status, "ready"));
test("unknown route abstains", () =>
  assert.equal(m.route(m.catalog, "banana", [], ["read"]).status, "no-match"));
test("permission blocked", () =>
  assert.equal(m.route(m.catalog, "publish", [], ["read"]).status, "blocked"));
test("equal score ambiguous", () =>
  assert.equal(
    m.route(m.catalog, "review test", [], ["read"]).status,
    "ambiguous",
  ));
test("ready plan includes prerequisite", () =>
  assert.deepEqual(m.route(m.catalog, "review", [], ["read"]).plan, [
    "tests",
    "review",
  ]));
test("file evidence changes winner", () =>
  assert.equal(
    m.route(m.catalog, "review test", ["src/main.ts"], ["read"]).ranked[0].skill
      .id,
    "review",
  ));
