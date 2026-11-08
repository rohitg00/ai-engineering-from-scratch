import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const svg =
  '<svg viewBox="0 0 10 10"><rect id="a" width="10" height="10"/></svg>';
const g = { nodes: [{ id: "a", label: "A", explanation: "Start" }], edges: [] };
test("loads a real authored element", () =>
  assert.equal(m.loadDiagram(svg, g).graph.nodes[0].id, "a"));
test("missing node rejected", () =>
  assert.throws(
    () =>
      m.loadDiagram(svg, {
        nodes: [{ id: "b", label: "B", explanation: "x" }],
        edges: [],
      }),
    /missing/,
  ));
test("unknown edge rejected", () =>
  assert.throws(
    () =>
      m.loadDiagram(svg, {
        ...g,
        edges: [{ from: "a", to: "z", label: "next" }],
      }),
    /endpoint/,
  ));
test("active SVG rejected", () =>
  assert.throws(
    () => m.loadDiagram("<svg><script>evil()</script></svg>", g),
    /Unsupported/,
  ));
test("heldout external paint rejected", () =>
  assert.throws(
    () =>
      m.loadDiagram(
        '<svg><rect id="a" fill="url(https://x.invalid)"/></svg>',
        g,
      ),
    /Unsafe/,
  ));
test("duplicate SVG IDs rejected", () =>
  assert.throws(
    () => m.loadDiagram('<svg><rect id="a"/><circle id="a"/></svg>', g),
    /Duplicate/,
  ));

test("empty manifest rejected before UI navigation", () =>
  assert.throws(
    () => m.loadDiagram("<svg/>", { nodes: [], edges: [] }),
    /at least one/,
  ));
