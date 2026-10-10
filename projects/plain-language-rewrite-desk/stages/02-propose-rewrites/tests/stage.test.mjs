import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const p = [
  {
    id: "p1",
    text: "In order to utilize maps prior to lunch.",
    numbers: [],
    protectedTerms: [],
  },
];
test("visible substitution creates candidate", () =>
  assert.equal(
    m.proposeParagraphs(p)[0].candidate,
    "to use maps before lunch.",
  ));
test("recorded proposal preserves exact author text", () =>
  assert.equal(
    m.proposeParagraphs(p, { p1: "Read maps before lunch." })[0].candidate,
    "Read maps before lunch.",
  ));
test("method identifies deterministic source", () =>
  assert.equal(
    m.proposeParagraphs(p)[0].method,
    "visible phrase substitutions",
  ));
test("unknown paragraph rejected", () =>
  assert.throws(() => m.proposeParagraphs(p, { p2: "x" }), /Unknown/));
test("heldout empty proposal rejected", () =>
  assert.throws(() => m.proposeParagraphs(p, { p1: " " }), /candidate/));
test("original remains unchanged", () => {
  m.proposeParagraphs(p);
  assert.equal(p[0].text, "In order to utilize maps prior to lunch.");
});
