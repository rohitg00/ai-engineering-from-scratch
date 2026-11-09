// Lesson: Build an Evidence-Backed Execution Plan (phase 14 / lesson 44)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/44-plan-from-evidence/docs/en.md
// Run: npx tsx phases/14-agent-engineering/44-plan-from-evidence/code/main.ts

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

class WorkItem {
  constructor(
    readonly id: string,
    readonly change: string,
    readonly evidence: readonly string[],
    readonly depends_on: readonly string[],
    readonly proof: string,
  ) {
    Object.freeze(this);
  }
}

interface PlanDocument {
  status: string;
  issues: string[];
  waves: string[][];
  items: { id: string; change: string; evidence: string[]; depends_on: string[]; proof: string }[];
}

function missingDeps(item: WorkItem, known: Set<string>): string[] {
  return [...new Set(item.depends_on.filter((dep) => !known.has(dep)))].sort();
}

function validate(items: WorkItem[]): string[] {
  const issues: string[] = [];
  const ids = items.map((item) => item.id);
  if (ids.length !== new Set(ids).size) {
    issues.push("work item ids must be unique");
  }
  const known = new Set(ids);
  let hasUnknownDependency = false;
  for (const item of items) {
    if (item.evidence.length === 0) {
      issues.push(`${item.id} has no repository evidence`);
    }
    if (!item.proof.trim()) {
      issues.push(`${item.id} has no proof command`);
    }
    const missing = missingDeps(item, known);
    if (missing.length > 0) {
      hasUnknownDependency = true;
      issues.push(`${item.id} depends on unknown items: ${missing.join(", ")}`);
    }
  }
  if (!hasUnknownDependency) {
    try {
      executionWaves(items);
    } catch (error) {
      issues.push((error as Error).message);
    }
  }
  return issues;
}

function executionWaves(items: WorkItem[]): string[][] {
  const known = new Set(items.map((item) => item.id));
  for (const item of items) {
    const missing = missingDeps(item, known);
    if (missing.length > 0) {
      throw new Error(`${item.id} depends on unknown items: ${missing.join(", ")}`);
    }
  }
  const remaining = new Map<string, Set<string>>();
  for (const item of items) {
    remaining.set(item.id, new Set(item.depends_on));
  }
  const waves: string[][] = [];
  const completed = new Set<string>();
  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, deps]) => [...deps].every((dep) => completed.has(dep)))
      .map(([itemId]) => itemId)
      .sort();
    if (ready.length === 0) {
      const cycle = [...remaining.keys()].sort().join(", ");
      throw new Error(`dependency cycle among: ${cycle}`);
    }
    waves.push(ready);
    for (const itemId of ready) {
      completed.add(itemId);
      remaining.delete(itemId);
    }
  }
  return waves;
}

function planDocument(items: WorkItem[]): PlanDocument {
  const issues = validate(items);
  return {
    status: issues.length === 0 ? "ready" : "blocked",
    issues,
    waves: issues.length === 0 ? executionWaves(items) : [],
    items: items.map((item) => ({
      id: item.id,
      change: item.change,
      evidence: [...item.evidence],
      depends_on: [...item.depends_on],
      proof: item.proof,
    })),
  };
}

function example(): WorkItem[] {
  return [
    new WorkItem("contract", "Define duplicate-email behavior", ["tests/test_accounts.py:44"], [], "review contract"),
    new WorkItem("implementation", "Reject normalized duplicates", ["app/accounts.py:18"], ["contract"], "python3 -m unittest tests.test_accounts"),
    new WorkItem("docs", "Document the 409 response", ["docs/api.md:72"], ["contract"], "python3 scripts/check_links.py"),
    new WorkItem("integration", "Run the complete acceptance gate", ["pyproject.toml:31"], ["implementation", "docs"], "python3 -m unittest"),
  ];
}

function main(): void {
  const output = join(dirname(realpathSync(__dirname)), "outputs", "evidence-plan.json");
  writeFileSync(output, JSON.stringify(planDocument(example()), null, 2) + "\n", "utf8");
  console.log(readFileSync(output, "utf8"));
}

main();
