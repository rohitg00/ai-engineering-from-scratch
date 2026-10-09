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

test("sweep endpoints reverse winner", () => {
  const r = m.sensitivity(data(), "a", 4);
  assert.equal(r[0].winner, "y");
  assert.equal(r.at(-1).winner, "x");
});
test("weights sum one", () => {
  for (const r of m.sensitivity(data(), "b", 7))
    assert.ok(
      Math.abs(Object.values(r.weights).reduce((a, b) => a + b, 0) - 1) < 1e-12,
    );
});
test("no dominance across tradeoff", () =>
  assert.deepEqual(m.dominated(data()), []));
test("dominance detects strict improvement", () => {
  const d = data();
  d.options[1].values = { a: 10, b: 1 };
  assert.deepEqual(m.dominated(d), ["x"]);
});
test("equal options do not dominate", () => {
  const d = data();
  d.options[1].values = { ...d.options[0].values };
  assert.deepEqual(m.dominated(d), []);
});
test("invalid sweep rejected", () =>
  assert.throws(() => m.sensitivity(data(), "missing", 0)));
