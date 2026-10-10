import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
test("segments blank lines with stable identity", () =>
  assert.deepEqual(
    m.segmentProse("A.\n\nB.").map((x) => x.id),
    ["p1", "p2"],
  ));
test("records protected terms present only", () =>
  assert.deepEqual(
    m.segmentProse("Map scale.", ["Map scale", "projection"])[0].protectedTerms,
    ["Map scale"],
  ));
test("records unit-bearing facts", () =>
  assert.deepEqual(m.segmentProse("Use 2 cm and 100 m.")[0].numbers, [
    "100 m",
    "2 cm",
  ]));
test("empty prose has no paragraphs", () =>
  assert.deepEqual(m.segmentProse("  \n\n"), []));
test("heldout repeated number stays repeated", () =>
  assert.deepEqual(m.segmentProse("10% plus 10%")[0].numbers, ["10%", "10%"]));
test("invalid protected list rejected", () =>
  assert.throws(() => m.segmentProse("x", [""]), /Protected/));
