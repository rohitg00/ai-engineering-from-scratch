import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const graph = (ids, edges) => ({
  nodes: ids.map((id) => ({ id, label: id, explanation: id })),
  edges: edges.map(([from, to]) => ({ from, to, label: "next" })),
});
test("linear reading order", () =>
  assert.deepEqual(
    m.analyzeGraph(
      graph(
        ["a", "b", "c"],
        [
          ["a", "b"],
          ["b", "c"],
        ],
      ),
    ).order,
    ["a", "b", "c"],
  ));
test("branch targets explicit", () =>
  assert.deepEqual(
    m.analyzeGraph(
      graph(
        ["a", "b", "c"],
        [
          ["a", "b"],
          ["a", "c"],
        ],
      ),
    ).branches,
    [{ id: "a", targets: ["b", "c"] }],
  ));
test("cycle is closed evidence path", () =>
  assert.deepEqual(
    m.analyzeGraph(
      graph(
        ["a", "b"],
        [
          ["a", "b"],
          ["b", "a"],
        ],
      ),
    ).cycles,
    [["a", "b", "a"]],
  ));
test("cycle only component remains ordered", () =>
  assert.deepEqual(
    m.analyzeGraph(
      graph(
        ["a", "b"],
        [
          ["a", "b"],
          ["b", "a"],
        ],
      ),
    ).unreachable,
    ["a", "b"],
  ));
test("heldout self loop terminates", () =>
  assert.deepEqual(m.analyzeGraph(graph(["x"], [["x", "x"]])).cycles, [
    ["x", "x"],
  ]));
test("disconnected roots included", () =>
  assert.deepEqual(m.analyzeGraph(graph(["a", "b"], [])).order, ["a", "b"]));
