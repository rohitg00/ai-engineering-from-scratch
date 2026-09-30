import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

test("minimum", () => assert.equal(m.validate(-1, { minimum: 0 }).length, 1));
test("maximum", () => assert.equal(m.validate(3, { maximum: 2 }).length, 1));
test("enum", () =>
  assert.equal(m.validate("c", { enum: ["a", "b"] }).length, 1));
test("unicode counts code points", () =>
  assert.equal(m.validate("😀", { minLength: 2 }).length, 1));
test("unknown key and escaped path", () =>
  assert.equal(
    m.validate({ "a/b": 1 }, { type: "object", additionalProperties: false })[0]
      .path,
    "$/a~1b",
  ));
test("unsupported schema cannot silently pass", () =>
  assert.throws(() => m.validate("x", { pattern: "x" }), /unsupported/));
test("array bounds", () =>
  assert.equal(m.validate([], { type: "array", minItems: 1 }).length, 1));

test("object enum ignores property insertion order", () =>
  assert.deepEqual(m.validate({ b: 2, a: 1 }, { enum: [{ a: 1, b: 2 }] }), []));
