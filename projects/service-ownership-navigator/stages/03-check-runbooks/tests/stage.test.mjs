import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const s = {
  id: "a",
  name: "A",
  root: "a",
  owners: ["@a"],
  runbook: "docs/runbook.md",
  dependencies: [],
};
const c = (text) => ({
  services: [s],
  rules: [],
  runbooks: { "docs/runbook.md": text, "docs/help.md": "# Help" },
});
test("missing main runbook reported", () =>
  assert.equal(m.checkRunbook({ ...c("x"), runbooks: {} }, s).exists, false));
test("extracts headings", () =>
  assert.deepEqual(m.checkRunbook(c("# Start\n## Recovery"), s).headings, [
    "Start",
    "Recovery",
  ]));
test("resolves local references", () =>
  assert.deepEqual(m.checkRunbook(c("# Start\n[help](help.md)"), s).links, [
    { target: "docs/help.md", exists: true },
  ]));
test("missing relative file reported", () =>
  assert.ok(
    m
      .checkRunbook(c("# Start\n[x](missing.md)"), s)
      .issues[0].includes("missing.md"),
  ));
test("heldout above-root traversal flagged", () =>
  assert.ok(
    m
      .checkRunbook(c("# Start\n[x](../../outside.md)"), s)
      .issues[0].includes("Unsafe"),
  ));
test("remote link not claimed checked", () =>
  assert.deepEqual(
    m.checkRunbook(c("# Start\n[x](https://example.invalid)"), s).links,
    [],
  ));
