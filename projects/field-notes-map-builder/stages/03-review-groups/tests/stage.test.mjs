import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const g = {
  radiusMeters: 20,
  groups: [
    { id: "a", members: ["a", "b"] },
    { id: "c", members: ["c"] },
  ],
  edges: [{ from: "a", to: "b", meters: 10 }],
};
test("default review is pending", () =>
  assert.equal(m.reviewGroups(g).decisions.a, "pending"));
test("split keeps each observation", () =>
  assert.deepEqual(
    m.reviewGroups(g, { schemaVersion: 1, decisions: { a: "keep-separate" } })
      .groups,
    [
      { id: "a", members: ["a"] },
      { id: "b", members: ["b"] },
      { id: "c", members: ["c"] },
    ],
  ));
test("keep-group retains component", () =>
  assert.deepEqual(
    m.reviewGroups(g, { schemaVersion: 1, decisions: { a: "keep-group" } })
      .groups,
    g.groups,
  ));
test("unknown group rejected", () =>
  assert.throws(
    () =>
      m.reviewGroups(g, { schemaVersion: 1, decisions: { z: "keep-group" } }),
    /Invalid/,
  ));
test("heldout arbitrary decision rejected", () =>
  assert.throws(
    () => m.reviewGroups(g, { schemaVersion: 1, decisions: { a: "delete" } }),
    /decision/,
  ));
test("source remains unchanged", () => {
  m.reviewGroups(g).groups[0].members.push("z");
  assert.deepEqual(g.groups[0].members, ["a", "b"]);
});
