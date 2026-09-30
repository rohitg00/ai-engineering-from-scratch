import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

test("valid nested object", () =>
  assert.deepEqual(
    m.validate(
      { a: [1, 2] },
      {
        type: "object",
        properties: { a: { type: "array", items: { type: "integer" } } },
        required: ["a"],
      },
    ),
    [],
  ));
test("wrong type has path", () =>
  assert.equal(
    m.validate(
      { a: "x" },
      { type: "object", properties: { a: { type: "number" } } },
    )[0].path,
    "$/a",
  ));
test("fraction not integer", () =>
  assert.equal(m.validate(1.5, { type: "integer" }).length, 1));
test("inherited required missing", () =>
  assert.equal(
    m.validate(Object.create({ a: 1 }), { type: "object", required: ["a"] })
      .length,
    1,
  ));
test("null not object", () =>
  assert.equal(m.validate(null, { type: "object" }).length, 1));
test("NaN rejected", () =>
  assert.equal(m.validate(NaN, { type: "number" }).length, 1));
