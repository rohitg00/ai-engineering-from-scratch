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
  id: "c",
  session: "s",
  scope: "Repo",
  rule: "  Run   TESTS ",
  source: "user correction",
};
test("normalize whitespace", () =>
  assert.equal(m.normalize(c.rule), "run tests"));
test("scope normalized", () => assert.equal(m.ingest(c).scope, "repo"));
test("source preserved", () =>
  assert.equal(m.ingest(c).source, "user correction"));
test("missing provenance rejected", () =>
  assert.throws(() => m.ingest({ ...c, source: "" })));
test("oversize rule rejected", () =>
  assert.throws(() => m.ingest({ ...c, rule: "x".repeat(501) })));
test("credential shaped source rejected", () =>
  assert.throws(() => m.ingest({ ...c, source: "sk-abcdefghijklmnop" })));
