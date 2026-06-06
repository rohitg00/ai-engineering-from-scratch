import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BUDGET_USD, MAX_TURNS, chargeTurn, checkBudget } from "../src/cost.js";
import { defaultSeed } from "../src/migrations.js";

test("checkBudget returns clean when fresh", () => {
  const m = defaultSeed()[0]!;
  const v = checkBudget(m);
  assert.equal(v.exhausted, false);
});

test("checkBudget flags turns exhausted", () => {
  const m = defaultSeed()[0]!;
  m.turns = MAX_TURNS;
  const v = checkBudget(m);
  assert.equal(v.exhausted, true);
  assert.equal(v.reason, "turns");
});

test("checkBudget flags cost exhausted", () => {
  const m = defaultSeed()[0]!;
  m.spentUsd = BUDGET_USD;
  const v = checkBudget(m);
  assert.equal(v.exhausted, true);
  assert.equal(v.reason, "cost");
});

test("chargeTurn increments turns and adds cost", () => {
  const m = defaultSeed()[0]!;
  chargeTurn(m, () => 0.5);
  assert.equal(m.turns, 1);
  assert.ok(m.spentUsd > 0);
  assert.ok(m.spentUsd < BUDGET_USD);
});

test("chargeTurn upper bound stays inside budget per turn", () => {
  const m = defaultSeed()[0]!;
  for (let i = 0; i < MAX_TURNS; i++) chargeTurn(m, () => 1);
  assert.equal(m.turns, MAX_TURNS);
  assert.ok(m.spentUsd <= BUDGET_USD, `spent ${m.spentUsd} exceeds budget ${BUDGET_USD}`);
});
