import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
test("normalizes unicode case and internal apostrophes", () =>
  assert.deepEqual(m.tokenize("CAFÉ gardener's 12"), [
    "café",
    "gardener's",
    "12",
  ]));
test("learns two-word history", () =>
  assert.equal(
    m.train([{ id: "a", text: "garden club shares seeds" }]).histories[
      '["garden","club"]'
    ].shares,
    1,
  ));
test("does not cross sentence boundary", () =>
  assert.equal(
    m.train([{ id: "a", text: "seeds. Garden grows" }]).histories['["seeds"]'],
    undefined,
  ));
test("source evidence deduplicated", () =>
  assert.deepEqual(m.train([{ id: "a", text: "seed seed" }]).sources.seed, [
    "a",
  ]));
test("heldout prototype names are ordinary tokens", () =>
  assert.equal(
    m.train([{ id: "a", text: "constructor constructor" }]).words.constructor,
    2,
  ));
test("duplicate source rejected", () =>
  assert.throws(
    () =>
      m.train([
        { id: "a", text: "x" },
        { id: "a", text: "y" },
      ]),
    /Duplicate/,
  ));
