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
  id: "m1",
  namespace: "docs",
  text: "Memory search",
  source: "notes.md:2",
};
test("valid record", () =>
  assert.equal(m.validateMemory(r).source, "notes.md:2"));
test("missing source rejected", () =>
  assert.throws(() => m.validateMemory({ ...r, source: "" })));
test("invalid id rejected", () =>
  assert.throws(() => m.validateMemory({ ...r, id: "../x" })));
test("empty text rejected", () =>
  assert.throws(() => m.validateMemory({ ...r, text: " " })));
test("embedding deterministic", () =>
  assert.deepEqual(m.embed("Memory SEARCH"), m.embed("memory search")));
test("embedding counts terms", () =>
  assert.equal(
    m.embed("one two two").reduce((a: number, b: number) => a + b, 0),
    3,
  ));
