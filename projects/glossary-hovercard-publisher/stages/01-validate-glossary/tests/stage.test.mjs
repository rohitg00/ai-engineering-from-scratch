import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
test("aliases default to empty", () =>
  assert.deepEqual(
    m.validateGlossary([{ id: "map", term: "Map", definition: "A drawing" }])[0]
      .aliases,
    [],
  ));
test("empty glossary allowed", () =>
  assert.deepEqual(m.validateGlossary([]), []));
test("duplicate alias rejected", () =>
  assert.throws(
    () =>
      m.validateGlossary([
        { id: "a", term: "Map", aliases: ["map"], definition: "x" },
      ]),
    /Ambiguous/,
  ));
test("invalid identity rejected", () =>
  assert.throws(
    () => m.validateGlossary([{ id: "bad id", term: "Map", definition: "x" }]),
    /id/,
  ));
test("heldout empty definition rejected", () =>
  assert.throws(
    () => m.validateGlossary([{ id: "a", term: "Map", definition: " " }]),
    /definition/,
  ));
test("copies alias list", () => {
  const v = [{ id: "a", term: "Map", aliases: ["chart"], definition: "x" }];
  m.validateGlossary(v)[0].aliases.push("new");
  assert.equal(v[0].aliases.length, 1);
});
