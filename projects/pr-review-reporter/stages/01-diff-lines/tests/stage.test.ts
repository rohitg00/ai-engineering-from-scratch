import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const patch = (h: string, body: string) =>
  "--- a/a.ts\n+++ b/a.ts\n" + h + "\n" + body + "\n";
test("addition line", () =>
  assert.equal(m.parseDiff(patch("@@ -0,0 +1,1 @@", "+hello"))[0].line, 1));
test("deletion does not advance new line", () =>
  assert.equal(m.parseDiff(patch("@@ -1,1 +1,1 @@", "-old\n+new"))[0].line, 1));
test("context advances new line", () =>
  assert.equal(
    m.parseDiff(patch("@@ -4,1 +4,2 @@", " same\n+new"))[0].line,
    5,
  ));
test("truncated hunk rejected", () =>
  assert.throws(() => m.parseDiff(patch("@@ -0,0 +1,2 @@", "+one"))));
test("unsafe path rejected", () =>
  assert.throws(() => m.parseDiff("+++ b/../x\n@@ -0,0 +1,1 @@\n+bad")));
test("empty diff yields no findings", () =>
  assert.deepEqual(m.parseDiff(""), []));
