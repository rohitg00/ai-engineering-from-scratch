import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

test("perfect set", () =>
  assert.deepEqual(m.evaluate(["a", "b"], ["a", "b"]), {
    precision: 1,
    recall: 1,
    hits: 2,
  }));
test("false positive reduces precision", () =>
  assert.equal(m.evaluate(["a", "x"], ["a"]).precision, 0.5));
test("miss reduces recall", () =>
  assert.equal(m.evaluate(["a"], ["a", "b"]).recall, 0.5));
test("duplicate votes do not inflate", () =>
  assert.equal(m.evaluate(["a", "a"], ["a", "b"]).recall, 0.5));
test("empty prediction scores zero", () =>
  assert.equal(m.evaluate([], ["a"]).precision, 0));
test("no expected items recall zero", () =>
  assert.equal(m.evaluate(["x"], []).recall, 0));
