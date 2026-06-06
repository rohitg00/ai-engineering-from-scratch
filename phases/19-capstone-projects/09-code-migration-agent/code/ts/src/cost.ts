import type { Migration } from "./types.js";

export const MAX_TURNS = 20;
export const BUDGET_USD = 8;

export function turnCostUsd(rng: () => number = Math.random): number {
  return Number((0.06 + rng() * 0.18).toFixed(3));
}

export type BudgetVerdict = {
  exhausted: boolean;
  reason?: "turns" | "cost";
};

export function checkBudget(m: Migration): BudgetVerdict {
  if (m.turns >= m.maxTurns) {
    return { exhausted: true, reason: "turns" };
  }
  if (m.spentUsd >= m.budgetUsd) {
    return { exhausted: true, reason: "cost" };
  }
  return { exhausted: false };
}

export function chargeTurn(m: Migration, rng: () => number = Math.random): void {
  m.turns += 1;
  m.spentUsd = Number((m.spentUsd + turnCostUsd(rng)).toFixed(3));
}
