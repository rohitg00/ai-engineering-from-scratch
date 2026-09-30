import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

test("object survives parsing", () =>
  assert.deepEqual(m.parseJSON('{"n":2}'), { n: 2 }));
test("null is JSON", () => assert.equal(m.parseJSON("null"), null));
test("array survives parsing", () =>
  assert.deepEqual(m.parseJSON("[1,true]"), [1, true]));
test("trailing text rejected", () =>
  assert.throws(() => m.parseJSON("{} ignore me")));
test("markdown fence rejected", () =>
  assert.throws(() => m.parseJSON("```json\n{}\n```")));
test("byte budget enforced", () =>
  assert.throws(() => m.parseJSON('"' + "é".repeat(60000) + '"'), /large/));
