import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const terms = [
  { id: "map", term: "map", aliases: [], definition: "A <drawing>" },
];
test("annotates eligible text and counts", () => {
  const r = m.annotateLesson("<p>Map and map</p>", terms);
  assert.equal(r.coverage[0].count, 2);
  assert.ok(r.html.includes(">Map</button>"));
});
test("preserves code and links", () => {
  const h =
    '<pre><code>map</code></pre><a href="https://x.invalid/map">map</a>';
  assert.equal(m.annotateLesson(h, terms).html, h);
});
test("rejects active attributes", () =>
  assert.throws(
    () => m.annotateLesson('<p onclick="evil()">map</p>', terms),
    /attribute/,
  ));
test("rejects unbalanced fragments", () =>
  assert.throws(() => m.annotateLesson("<p><em>map</p>", terms), /Unbalanced/));
test("heldout unsafe URL rejected", () =>
  assert.throws(
    () => m.annotateLesson('<a href="javascript:evil()">map</a>', terms),
    /Unsafe/,
  ));
test("definition escaped", () =>
  assert.ok(
    m.annotateLesson("<p>map</p>", terms).html.includes("A &lt;drawing&gt;"),
  ));

test("inline annotation preserves paragraph and emphasis structure", () => {
  const result = m.annotateLesson(
    "<p>Read the <em>map</em> carefully.</p>",
    terms,
  );
  assert.ok(result.html.startsWith("<p>Read the <em><span"));
  assert.ok(result.html.endsWith("</span></em> carefully.</p>"));
  assert.ok(!result.html.includes("<details"));
  assert.ok(result.html.includes('aria-expanded="false"'));
  assert.ok(result.html.includes('role="note" hidden'));
});
