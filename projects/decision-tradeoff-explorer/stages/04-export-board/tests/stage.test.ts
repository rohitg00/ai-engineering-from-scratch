import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);
const data = () => ({
  criteria: [
    {
      id: "a",
      label: "Quality",
      weight: 1,
      direction: "benefit",
      min: 0,
      max: 10,
    },
    { id: "b", label: "Cost", weight: 1, direction: "cost", min: 0, max: 10 },
  ],
  options: [
    {
      id: "x",
      label: "X",
      values: { a: 9, b: 8 },
      notes: { a: "audit x", b: "quote x" },
    },
    {
      id: "y",
      label: "Y",
      values: { a: 6, b: 2 },
      notes: { a: "audit y", b: "quote y" },
    },
  ],
});

test("record recomputes", () => {
  const d = data(),
    r = m.record(d, { a: 9, b: 1 });
  assert.deepEqual(
    r.scores,
    m.score({ criteria: r.criteria, options: r.options }, r.weights),
  );
  assert.equal(r.schemaVersion, 1);
});
test("chosen scenario retained", () => {
  const r = m.record(data(), {}, "x");
  assert.equal(r.chosen, "x");
  assert.equal(r.winner, "y");
});
test("ineligible choice rejected", () => {
  const d = data();
  d.options[0].values.a = null;
  assert.throws(() => m.record(d, {}, "x"));
});
test("CSV quoted and formula escaped", () => {
  const d = data();
  d.options[0].notes.a = "=SUM(1,2)";
  assert.ok(m.csv(d).includes('"\'=SUM(1,2)"'));
});
test("HTML script injection escaped", () => {
  const d = data();
  d.options[0].label = "</script><script>alert(1)</script>";
  const h = m.html(d);
  assert.ok(!h.includes(d.options[0].label));
  assert.ok(h.includes("Download decision record"));
});
test("record evidence retained", () =>
  assert.equal(m.record(data()).options[1].notes.b, "quote y"));
