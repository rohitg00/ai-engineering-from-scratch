import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const a = { id: "a", name: "a", start: 0, end: 10, status: "ok", tokens: 1 };
test("overlap merged", () =>
  assert.equal(
    m.unionDuration([
      [0, 5],
      [3, 8],
    ]),
    8,
  ));
test("disjoint intervals summed", () =>
  assert.equal(
    m.unionDuration([
      [0, 2],
      [4, 6],
    ]),
    4,
  ));
test("empty intervals zero", () => assert.equal(m.unionDuration([]), 0));
test("exclusive uses union", () =>
  assert.equal(
    m.analyze([
      a,
      { ...a, id: "b", parent: "a", start: 1, end: 6 },
      { ...a, id: "c", parent: "a", start: 4, end: 8 },
    ]).rows[0].exclusive,
    3,
  ));
test("tokens summed once", () =>
  assert.equal(
    m.analyze([a, { ...a, id: "b", parent: "a", start: 1, end: 2 }])
      .totalTokens,
    2,
  ));
test("failure ids retained", () =>
  assert.deepEqual(m.analyze([{ ...a, status: "error" }]).errors, ["a"]));
