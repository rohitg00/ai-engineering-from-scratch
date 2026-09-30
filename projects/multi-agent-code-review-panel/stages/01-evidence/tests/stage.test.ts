import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const files = { "a.ts": ["eval(x)"] };
const f = {
  file: "a.ts",
  line: 1,
  quote: "eval(x)",
  rule: "eval",
  severity: 3,
};
test("valid finding accepted", () =>
  assert.deepEqual(m.validateFinding(f, files), f));
test("wrong file rejected", () =>
  assert.equal(m.validateFinding({ ...f, file: "b.ts" }, files), null));
test("line zero rejected", () =>
  assert.equal(m.validateFinding({ ...f, line: 0 }, files), null));
test("invented quote rejected", () =>
  assert.equal(m.validateFinding({ ...f, quote: "exec(x)" }, files), null));
test("empty quote rejected", () =>
  assert.equal(m.validateFinding({ ...f, quote: "" }, files), null));
test("out of range severity rejected", () =>
  assert.equal(m.validateFinding({ ...f, severity: 9 }, files), null));
