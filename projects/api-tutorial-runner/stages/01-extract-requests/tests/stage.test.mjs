import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const block = (x) => "Intro\n\n```request\n" + JSON.stringify(x) + "\n```";
const valid = { id: "read", method: "GET", path: "/x", status: 200 };
test("explicit request gets source line", () =>
  assert.equal(m.extractRequests(block(valid))[0].line, 3));
test("ordinary JSON block is not executable", () =>
  assert.throws(() => m.extractRequests("```json\n{}\n```"), /No explicit/));
test("protocol relative path rejected", () =>
  assert.throws(
    () => m.extractRequests(block({ ...valid, path: "//evil.invalid" })),
    /origin/,
  ));
test("unclosed explicit block rejected", () =>
  assert.throws(() => m.extractRequests("```request\n{}"), /Unclosed/));
test("heldout duplicate id rejected", () =>
  assert.throws(
    () => m.extractRequests(block(valid) + "\n" + block(valid)),
    /Duplicate/,
  ));
test("malformed expected status rejected", () =>
  assert.throws(
    () => m.extractRequests(block({ ...valid, status: "200" })),
    /status/,
  ));
