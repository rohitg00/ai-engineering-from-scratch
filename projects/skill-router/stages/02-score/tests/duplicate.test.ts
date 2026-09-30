import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);
const skill = {
  id: "review",
  description: "Inspect",
  keywords: ["review"],
  paths: ["src/*.ts"],
  requires: [],
  permissions: [],
  priority: 1,
};
test("duplicate keyword does not amplify evidence", () =>
  assert.equal(
    m.rank([{ ...skill, keywords: ["review", "review", "REVIEW"] }], "review", [
      "src/a.ts",
    ])[0].score,
    5,
  ));
test("duplicate normalized paths contribute once", () =>
  assert.equal(
    m.rank([skill], "review", ["src/a.ts", "src/a.ts", "src\\a.ts"])[0].score,
    5,
  ));
