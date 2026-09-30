import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const line = { file: "a.ts", line: 1, text: "eval(x)" };
const finding = {
  file: "a.ts",
  line: 1,
  quote: "eval(x)",
  rule: "eval",
  severity: "high",
  message: "unsafe",
};
test("valid quote accepted", () =>
  assert.equal(m.verify([finding], [line]).accepted.length, 1));
test("fabricated line rejected", () =>
  assert.equal(m.verify([{ ...finding, line: 2 }], [line]).rejected.length, 1));
test("invented quote rejected", () =>
  assert.equal(
    m.verify([{ ...finding, quote: "exec(x)" }], [line]).rejected.length,
    1,
  ));
test("empty quote rejected", () =>
  assert.equal(
    m.verify([{ ...finding, quote: "" }], [line]).rejected.length,
    1,
  ));
test("duplicates merge", () =>
  assert.equal(m.merge([finding, finding]).length, 1));
test("stronger severity wins", () =>
  assert.equal(
    m.merge([{ ...finding, severity: "low" }, finding])[0].severity,
    "high",
  ));
