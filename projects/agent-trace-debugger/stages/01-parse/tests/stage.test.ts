import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const s = { id: "a", name: "tool", start: 0, end: 10, status: "ok", tokens: 2 };
test("valid span", () =>
  assert.equal(m.parseTrace(JSON.stringify(s))[0].end, 10));
test("blank lines ignored", () =>
  assert.equal(m.parseTrace("\n" + JSON.stringify(s) + "\n").length, 1));
test("malformed JSON cites line", () =>
  assert.throws(() => m.parseTrace("{}\nbad"), /line 1/));
test("negative duration rejected", () =>
  assert.throws(() => m.parseTrace(JSON.stringify({ ...s, end: -1 }))));
test("negative tokens rejected", () =>
  assert.throws(() => m.parseTrace(JSON.stringify({ ...s, tokens: -1 }))));
test("unknown status rejected", () =>
  assert.throws(() =>
    m.parseTrace(JSON.stringify({ ...s, status: "waiting" })),
  ));
