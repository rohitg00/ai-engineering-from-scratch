import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const group = (id, title, notes = "") => ({
  url: "https://x.invalid/" + id,
  items: [{ id, title, notes, url: "https://x.invalid/" + id, folders: [] }],
  reason: "unique",
});
test("title and note evidence sum", () => {
  const r = m.readingPath([group("a", "Map guide", "map")], { Maps: ["map"] });
  assert.equal(r[0].score, 4);
  assert.deepEqual(r[0].topics, ["Maps"]);
});
test("notes only has one point", () =>
  assert.equal(
    m.readingPath([group("a", "Guide", "map")], { Maps: ["map"] })[0].score,
    1,
  ));
test("unmatched word boundaries stay zero", () =>
  assert.equal(
    m.readingPath([group("a", "Mapping", "")], { Maps: ["map"] })[0].score,
    0,
  ));
test("stable identity breaks ties", () =>
  assert.deepEqual(
    m
      .readingPath([group("z", "Map"), group("a", "Map")], { Maps: ["map"] })
      .map((x) => x.id),
    ["a", "z"],
  ));
test("heldout repeated keywords do not inflate rank", () =>
  assert.equal(
    m.readingPath([group("a", "Map")], { Maps: ["MAP", "map"] })[0].score,
    3,
  ));
test("invalid topic rejected", () =>
  assert.throws(() => m.readingPath([], { Maps: [] }), /keywords/));
