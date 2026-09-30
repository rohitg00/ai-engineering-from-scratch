import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const a = { id: "a", name: "a", start: 0, end: 10, status: "ok", tokens: 0 };
test("one root accepted", () => assert.equal(m.validateTree([a]).size, 1));
test("nested span accepted", () =>
  assert.equal(
    m.validateTree([a, { ...a, id: "b", parent: "a", start: 1, end: 9 }]).size,
    2,
  ));
test("missing parent rejected", () =>
  assert.throws(() => m.validateTree([{ ...a, parent: "x" }]), /missing/));
test("duplicate id rejected", () =>
  assert.throws(() => m.validateTree([a, a]), /duplicate/));
test("cycle rejected", () =>
  assert.throws(
    () =>
      m.validateTree([
        { ...a, parent: "b" },
        { ...a, id: "b", parent: "a" },
      ]),
    /cycle/,
  ));
test("child outside parent rejected", () =>
  assert.throws(
    () => m.validateTree([a, { ...a, id: "b", parent: "a", end: 11 }]),
    /outside/,
  ));
