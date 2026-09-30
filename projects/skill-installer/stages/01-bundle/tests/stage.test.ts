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
  description: "review code",
  files: { "SKILL.md": "# Review" },
};
test("valid bundle accepted", () => assert.equal(m.validate(b).name, "review"));
test("traversal rejected", () => assert.equal(m.safePath("../x"), false));
test("windows absolute rejected", () =>
  assert.equal(m.safePath("C:/x"), false));
test("nested reference accepted", () =>
  assert.equal(m.safePath("references/checks.md"), true));
test("missing skill file rejected", () =>
  assert.throws(() => m.validate({ ...b, files: {} })));
test("reserved metadata rejected", () =>
  assert.throws(() =>
    m.validate({ ...b, files: { ...b.files, ".installed.json": "x" } }),
  ));
