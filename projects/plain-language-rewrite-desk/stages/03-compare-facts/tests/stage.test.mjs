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
    text: "A projection uses 15%.",
    numbers: ["15%"],
    protectedTerms: ["projection"],
  },
];
test("changed number flagged", () =>
  assert.ok(
    m
      .compareParagraphs(p, [
        { id: "p1", candidate: "A projection uses 10%." },
      ])[0]
      .issues.includes("Numeric facts changed"),
  ));
test("missing term flagged", () =>
  assert.ok(
    m
      .compareParagraphs(p, [{ id: "p1", candidate: "A map uses 15%." }])[0]
      .issues.some((x) => x.includes("protected")),
  ));
test("missing definition flagged", () =>
  assert.ok(
    m
      .compareParagraphs(p, [{ id: "p1", candidate: p[0].text }], {
        projection: "flat representation",
      })[0]
      .issues.some((x) => x.includes("definition")),
  ));
test("measures sentence average", () =>
  assert.deepEqual(m.measures("One two. Three four."), {
    words: 4,
    sentences: 2,
    averageWords: 2,
    longWords: 0,
  }));
test("heldout missing proposal rejected", () =>
  assert.throws(() => m.compareParagraphs(p, []), /exactly/));
test("unchanged facts pass lexical checks", () =>
  assert.deepEqual(
    m.compareParagraphs(p, [
      { id: "p1", candidate: "This projection uses 15%." },
    ])[0].issues,
    [],
  ));
