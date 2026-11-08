import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const g = { nodes: [{ id: "a", label: "A", explanation: "Start" }], edges: [] };
const r = { schemaVersion: 1, graph: g, order: ["a"], reviewed: false };
test("embeds the authored SVG", () =>
  assert.ok(
    m
      .renderWalkthrough('<svg><rect id="a"/></svg>', r)
      .includes('<rect id="a"/>'),
  ));
test("includes real navigation", () =>
  assert.ok(m.renderWalkthrough("<svg/>", r).includes("Next node")));
test("review export named and versioned", () => {
  const h = m.renderWalkthrough("<svg/>", r);
  assert.ok(h.includes("graph-review.json"));
  assert.ok(h.includes("schemaVersion:1"));
});
test("has explanation editing", () =>
  assert.ok(
    m.renderWalkthrough("<svg/>", r).includes('textarea id="dc-explanation"'),
  ));
test("heldout explanation script escaped", () =>
  assert.ok(
    !m
      .renderWalkthrough("<svg/>", {
        ...r,
        graph: {
          ...g,
          nodes: [
            { ...g.nodes[0], explanation: "</script><script>evil()</script>" },
          ],
        },
      })
      .includes("</script><script>evil"),
  ));
test("exports standalone document", () =>
  assert.ok(m.renderWalkthrough("<svg/>", r).startsWith("<!doctype html>")));
