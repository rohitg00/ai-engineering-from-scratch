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

test("direction normalization", () => {
  const d = data();
  assert.equal(m.normalize(d.criteria[0], 5), 0.5);
  assert.equal(m.normalize(d.criteria[1], 2), 0.8);
});
test("ranking", () => {
  const rows = m.score(data());
  assert.equal(rows[0].id, "y");
  assert.ok(Math.abs(rows[0].score - 0.7) < 1e-9);
});
test("unknown excluded", () => {
  const d = data();
  d.options[0].values.b = null;
  assert.equal(m.score(d).find((x) => x.id === "x").score, null);
});
test("constraint excluded", () => {
  const d = data();
  d.criteria[1].limit = 5;
  assert.deepEqual(m.score(d).find((x) => x.id === "x").violations, ["b"]);
});
test("zero weight rejected", () =>
  assert.throws(() => m.score(data(), { a: 0, b: 0 })));
test("scale invariant", () =>
  assert.deepEqual(
    m.score(data(), { a: 2, b: 2 }),
    m.score(data(), { a: 20, b: 20 }),
  ));

test("overflowed overrides rejected", () =>
  assert.throws(() => m.score(data(), { a: 1e308, b: 1e308 })));
test("prototype-like criterion IDs are data", () => {
  const d = data();
  for (const c of d.criteria) {
    if (c.id === "a") c.id = "constructor";
  }
  for (const o of d.options) {
    o.values.constructor = o.values.a;
    delete o.values.a;
    o.notes.constructor = o.notes.a;
    delete o.notes.a;
  }
  const accepted = m.parse(JSON.stringify(d));
  assert.equal(m.score(accepted)[0].id, "y");
  assert.equal(m.record(accepted).weights.constructor, 1);
});
