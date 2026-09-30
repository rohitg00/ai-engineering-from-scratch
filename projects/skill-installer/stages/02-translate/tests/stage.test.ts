import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const b = {
  name: "review",
  description: "quoted: value",
  files: { "SKILL.md": "# Review", "references/a.md": "A" },
};
test("digest independent of order", () =>
  assert.equal(m.digest({ a: "1", b: "2" }), m.digest({ b: "2", a: "1" })));
test("content mutation changes digest", () =>
  assert.notEqual(m.digest({ a: "1" }), m.digest({ a: "2" })));
test("metadata quoted", () =>
  assert.match(
    m.translate(b, "codex")["SKILL.md"],
    /description: "quoted: value"/,
  ));
test("references preserved", () =>
  assert.equal(m.translate(b, "claude")["references/a.md"], "A"));
test("old header replaced", () =>
  assert.equal(
    (
      m
        .translate(
          { ...b, files: { "SKILL.md": "---\nname: old\n---\n# Body" } },
          "cursor",
        )
        ["SKILL.md"].match(/name:/g) || []
    ).length,
    1,
  ));
test("unknown adapter rejected", () =>
  assert.throws(() => m.translate(b, "other")));
