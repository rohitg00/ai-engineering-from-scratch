// Lesson: Map Assumptions and Resolve the Riskiest One First (phase 14 / lesson 49)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/49-map-assumptions-and-risk/docs/en.md
// Run: npx tsx phases/14-agent-engineering/49-map-assumptions-and-risk/code/main.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface Assumption {
  statement: string;
  impact: number;
  uncertainty: number;
  irreversibility: number;
  test: string;
  evidence: string;
}

function assumption(statement: string, impact: number, uncertainty: number, irreversibility: number, test: string, evidence = ""): Assumption {
  return { statement, impact, uncertainty, irreversibility, test, evidence };
}

function riskScore(item: Assumption): number {
  for (const value of [item.impact, item.uncertainty, item.irreversibility]) {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error("risk dimensions must be integers from one to five");
    }
  }
  return item.impact * item.uncertainty + item.irreversibility;
}

function prioritize(items: Assumption[]): Record<string, unknown>[] {
  const ranked = [...items].sort((a, b) => riskScore(b) - riskScore(a) || (a.statement < b.statement ? -1 : a.statement > b.statement ? 1 : 0));
  return ranked.map((item) => ({ ...item, risk_score: riskScore(item), status: item.evidence ? "tested" : "open" }));
}

function nextExperiment(items: Assumption[]): Assumption | null {
  let best: Assumption | null = null;
  for (const item of items) {
    if (item.evidence) continue;
    if (best === null || riskScore(item) > riskScore(best)) best = item;
  }
  return best;
}

function example(): Assumption[] {
  return [
    assumption("Engineers can identify the right service from alert context", 5, 5, 2, "Replay ten incidents with a read-only prototype"),
    assumption("Two-minute diagnosis matters", 4, 2, 1, "Interview five incident commanders", "four of five confirmed"),
    assumption("Automatic remediation is acceptable", 5, 4, 5, "Do not automate; test approval workflow first"),
  ];
}

function main(): void {
  const output = join(resolve(__dirname, ".."), "outputs", "assumption-map.json");
  writeFileSync(output, JSON.stringify(prioritize(example()), null, 2) + "\n", "utf-8");
  console.log(readFileSync(output, "utf-8"));
}

main();
