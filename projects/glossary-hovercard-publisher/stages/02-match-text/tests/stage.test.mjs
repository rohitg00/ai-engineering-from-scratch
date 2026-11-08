import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const terms = [
  { id: "map", term: "map", aliases: [], definition: "x" },
  { id: "scale", term: "map scale", aliases: ["ratio"], definition: "y" },
];
test("longest phrase wins", () =>
  assert.deepEqual(m.matchTerms("Map scale matters", terms), [
    { termId: "scale", start: 0, end: 9, text: "Map scale" },
  ]));
test("word substring does not match", () =>
  assert.deepEqual(m.matchTerms("mapping _map map2", terms), []));
test("alias maps to canonical identity", () =>
  assert.equal(m.matchTerms("a RATIO.", terms)[0].termId, "scale"));
test("repeated nonoverlapping matches", () =>
  assert.deepEqual(
    m.matchTerms("map; map", terms).map((x) => x.start),
    [0, 5],
  ));
test("heldout unicode boundary", () =>
  assert.deepEqual(m.matchTerms("émapping mapé", terms), []));
test("empty input returns none", () =>
  assert.deepEqual(m.matchTerms("", terms), []));
