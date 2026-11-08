import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const g = {
  nodes: [
    { id: "a", label: "A", explanation: "Start" },
    { id: "b", label: "B", explanation: "End" },
  ],
  edges: [{ from: "a", to: "b", label: "next" }],
};
test("default remains unreviewed", () =>
  assert.equal(m.reviewGraph(g).reviewed, false));
test("accepts changed order", () =>
  assert.deepEqual(
    m.reviewGraph(g, { schemaVersion: 1, order: ["b", "a"], reviewed: true })
      .order,
    ["b", "a"],
  ));
test("revises known explanation", () =>
  assert.equal(
    m.reviewGraph(g, {
      schemaVersion: 1,
      order: ["a", "b"],
      reviewed: true,
      explanations: { a: "Revised" },
    }).graph.nodes[0].explanation,
    "Revised",
  ));
test("duplicate order rejected", () =>
  assert.throws(
    () =>
      m.reviewGraph(g, { schemaVersion: 1, order: ["a", "a"], reviewed: true }),
    /order/,
  ));
test("heldout unknown explanation rejected", () =>
  assert.throws(
    () =>
      m.reviewGraph(g, {
        schemaVersion: 1,
        order: ["a", "b"],
        reviewed: true,
        explanations: { z: "Oops" },
      }),
    /Unknown/,
  ));
test("input graph retained", () => {
  const r = m.reviewGraph(g);
  r.graph.edges[0].label = "changed";
  assert.equal(g.edges[0].label, "next");
});
