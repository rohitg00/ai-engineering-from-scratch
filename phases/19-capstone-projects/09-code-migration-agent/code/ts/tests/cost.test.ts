import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BUDGET_USD, MAX_TURNS, chargeTurn, checkBudget } from "../src/cost.js";
import { defaultSeed } from "../src/migrations.js";

test("checkBudget は fresh な状態で clean を返す", () => {
  const m = defaultSeed()[0]!;
  const v = checkBudget(m);
  assert.equal(v.exhausted, false);
});

test("checkBudget は turns exhausted を flag する", () => {
  const m = defaultSeed()[0]!;
  m.turns = MAX_TURNS;
  const v = checkBudget(m);
  assert.equal(v.exhausted, true);
  assert.equal(v.reason, "turns");
});

test("checkBudget は cost exhausted を flag する", () => {
  const m = defaultSeed()[0]!;
  m.spentUsd = BUDGET_USD;
  const v = checkBudget(m);
  assert.equal(v.exhausted, true);
  assert.equal(v.reason, "cost");
});

test("chargeTurn は turns を increment し cost を加算する", () => {
  const m = defaultSeed()[0]!;
  chargeTurn(m, () => 0.5);
  assert.equal(m.turns, 1);
  assert.ok(m.spentUsd > 0);
  assert.ok(m.spentUsd < BUDGET_USD);
});

test("chargeTurn の upper bound は turn ごとの budget 内に収まる", () => {
  const m = defaultSeed()[0]!;
  for (let i = 0; i < MAX_TURNS; i++) chargeTurn(m, () => 1);
  assert.equal(m.turns, MAX_TURNS);
  assert.ok(m.spentUsd <= BUDGET_USD, `spent ${m.spentUsd} が budget ${BUDGET_USD} を超えています`);
});
