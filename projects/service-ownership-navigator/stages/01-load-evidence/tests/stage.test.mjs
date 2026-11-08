import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
test("rule source positions retained", () =>
  assert.deepEqual(m.parseOwnershipRules("# note\n/src/ @team/core")[0], {
    pattern: "/src/",
    owners: ["@team/core"],
    line: 2,
    source: "CODEOWNERS",
  }));
test("multiple owners retained", () =>
  assert.deepEqual(m.parseOwnershipRules("* @a @b")[0].owners, ["@a", "@b"]));
test("trailing comment excluded", () =>
  assert.deepEqual(m.parseOwnershipRules("*.ts @a # review")[0].owners, [
    "@a",
  ]));
test("unsupported negation rejected", () =>
  assert.throws(() => m.parseOwnershipRules("!secret @a"), /Unsupported/));
test("heldout missing owners rejected", () =>
  assert.throws(() => m.parseOwnershipRules("/src/"), /Unsupported/));
test("empty comment-only rule file allowed", () =>
  assert.deepEqual(m.parseOwnershipRules("# only"), []));
