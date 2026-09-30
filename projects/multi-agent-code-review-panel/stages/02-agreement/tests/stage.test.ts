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
test("two independent votes consensus", () =>
  assert.equal(
    m.aggregate(
      [
        { reviewer: "a", findings: [f] },
        { reviewer: "b", findings: [f] },
      ],
      files,
    ).findings[0].status,
    "consensus",
  ));
test("duplicate finding not extra vote", () =>
  assert.equal(
    m.aggregate([{ reviewer: "a", findings: [f, f] }], files).findings[0]
      .supporters.length,
    1,
  ));
test("singleton retained", () =>
  assert.equal(
    m.aggregate([{ reviewer: "a", findings: [f] }], files).findings[0].status,
    "needs-review",
  ));
test("duplicate identity rejected", () =>
  assert.throws(
    () =>
      m.aggregate(
        [
          { reviewer: "a", findings: [] },
          { reviewer: "a", findings: [] },
        ],
        files,
      ),
    /duplicate/,
  ));
test("severity disagreement visible", () =>
  assert.equal(
    m.aggregate(
      [
        { reviewer: "a", findings: [f] },
        { reviewer: "b", findings: [{ ...f, severity: 2 }] },
      ],
      files,
    ).findings[0].disagreement,
    true,
  ));
test("unsupported findings counted", () =>
  assert.equal(
    m.aggregate([{ reviewer: "a", findings: [{ ...f, line: 9 }] }], files)
      .rejected,
    1,
  ));
