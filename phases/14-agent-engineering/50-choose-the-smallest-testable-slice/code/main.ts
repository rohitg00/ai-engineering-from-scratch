// Lesson: Choose the Smallest Slice That Can Change the Decision (phase 14 / lesson 50)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/50-choose-the-smallest-testable-slice/docs/en.md
// Run: npx tsx phases/14-agent-engineering/50-choose-the-smallest-testable-slice/code/main.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface Slice {
  name: string;
  outcome_value: number;
  uncertainty_reduced: number;
  effort: number;
  consequence: number;
  reversible: boolean;
  proves: string[];
}

function slice(name: string, outcome_value: number, uncertainty_reduced: number, effort: number, consequence: number, reversible: boolean, proves: string[]): Slice {
  return { name, outcome_value, uncertainty_reduced, effort, consequence, reversible, proves };
}

function pyRound(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function score(item: Slice): number {
  if (item.effort < 1) throw new Error("effort must be positive");
  const riskPenalty = item.consequence * (!item.reversible ? 2 : 0.5);
  return pyRound((item.outcome_value + item.uncertainty_reduced) / (item.effort + riskPenalty), 3);
}

function keyGreater(a: Slice, b: Slice): boolean {
  if (score(a) !== score(b)) return score(a) > score(b);
  if (a.effort !== b.effort) return -a.effort > -b.effort;
  return a.name > b.name;
}

function choose(items: Slice[], requiredProof: Set<string>): Slice {
  const candidates = items.filter((item) => [...requiredProof].every((proof) => item.proves.includes(proof)));
  if (candidates.length === 0) throw new Error("no slice proves the required assumptions");
  let best = candidates[0];
  for (const item of candidates.slice(1)) {
    if (keyGreater(item, best)) best = item;
  }
  return best;
}

function decision(items: Slice[], requiredProof: Set<string>): Record<string, unknown> {
  const selected = choose(items, requiredProof);
  return {
    required_proof: [...requiredProof].sort(),
    selected: { ...selected, score: score(selected) },
    alternatives: items.filter((item) => JSON.stringify(item) !== JSON.stringify(selected)).map((item) => ({ ...item, score: score(item) })),
  };
}

function example(): Slice[] {
  return [
    slice("read-only incident replay", 4, 5, 2, 1, true, ["service-identification", "operator-trust"]),
    slice("production auto-remediation", 5, 4, 10, 5, false, ["service-identification", "operator-trust"]),
    slice("dashboard mockup", 2, 2, 1, 1, true, ["operator-trust"]),
  ];
}

function main(): void {
  const output = join(resolve(__dirname, ".."), "outputs", "slice-decision.json");
  const report = decision(example(), new Set(["service-identification", "operator-trust"]));
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", "utf-8");
  console.log(readFileSync(output, "utf-8"));
}

main();
