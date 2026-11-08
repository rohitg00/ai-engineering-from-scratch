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

test("accept held-out table", () =>
  assert.equal(m.parse(JSON.stringify(data())).options.length, 2));
test("reject duplicate IDs", () => {
  const d = data();
  d.options[1].id = "x";
  assert.throws(() => m.parse(JSON.stringify(d)));
});
test("unknown stays null", () => {
  const d = data();
  d.options[0].values.a = null;
  assert.equal(m.parse(JSON.stringify(d)).options[0].values.a, null);
});
test("missing note", () => {
  const d = data();
  delete d.options[0].notes.a;
  assert.throws(() => m.parse(JSON.stringify(d)));
});
test("outside range", () => {
  const d = data();
  d.options[0].values.a = 11;
  assert.throws(() => m.parse(JSON.stringify(d)));
});
test("zero total weight", () => {
  const d = data();
  d.criteria.forEach((c) => (c.weight = 0));
  assert.throws(() => m.parse(JSON.stringify(d)));
});

test("overflowed total weights rejected", () => {
  const d = data();
  d.criteria.forEach((c) => (c.weight = 1e308));
  assert.throws(() => m.parse(JSON.stringify(d)));
});
test("overflowed range rejected", () => {
  const d = data();
  d.criteria[0].min = -1e308;
  d.criteria[0].max = 1e308;
  assert.throws(() => m.parse(JSON.stringify(d)));
});
