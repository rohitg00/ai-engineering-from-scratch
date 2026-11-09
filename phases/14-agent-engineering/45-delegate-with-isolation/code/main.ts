// Lesson: Delegate Agent Work with Isolation and Merge Contracts (phase 14 / lesson 45)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/45-delegate-with-isolation/docs/en.md
// Run: npx tsx phases/14-agent-engineering/45-delegate-with-isolation/code/main.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface WorkUnit {
  id: string;
  owner: string;
  paths: string[];
  depends_on: string[];
  proof: string;
}

function workUnit(id: string, owner: string, paths: string[], depends_on: string[], proof: string): WorkUnit {
  return { id, owner, paths, depends_on, proof };
}

function pathParts(path: string): string[] {
  const parts: string[] = path.startsWith("/") ? ["/"] : [];
  for (const piece of path.split("/")) {
    if (piece !== "" && piece !== ".") parts.push(piece);
  }
  return parts;
}

function isPrefix(shorter: string[], longer: string[]): boolean {
  if (shorter.length > longer.length) return false;
  return shorter.every((part, index) => part === longer[index]);
}

function pathsOverlap(left: string, right: string): boolean {
  const a = pathParts(left);
  const b = pathParts(right);
  return isPrefix(a, b) || isPrefix(b, a);
}

function conflicts(units: WorkUnit[]): string[] {
  const found: string[] = [];
  units.forEach((left, index) => {
    for (const right of units.slice(index + 1)) {
      for (const leftPath of left.paths) {
        for (const rightPath of right.paths) {
          if (pathsOverlap(leftPath, rightPath)) {
            found.push(`${left.id} and ${right.id} overlap at ${leftPath} / ${rightPath}`);
          }
        }
      }
    }
  });
  return found;
}

function waves(units: WorkUnit[]): string[][] {
  const remaining = new Map<string, Set<string>>();
  for (const unit of units) remaining.set(unit.id, new Set(unit.depends_on));
  const known = new Set(remaining.keys());
  for (const deps of remaining.values()) {
    if ([...deps].some((dep) => !known.has(dep))) throw new Error("unknown dependency");
  }
  const done = new Set<string>();
  const result: string[][] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, deps]) => [...deps].every((dep) => done.has(dep)))
      .map(([key]) => key)
      .sort();
    if (ready.length === 0) throw new Error("dependency cycle");
    result.push(ready);
    for (const key of ready) {
      done.add(key);
      remaining.delete(key);
    }
  }
  return result;
}

function delegationPlan(units: WorkUnit[]): Record<string, unknown> {
  const ids = units.map((unit) => unit.id);
  const duplicateIds = [...new Set(ids.filter((id) => ids.filter((other) => other === id).length > 1))].sort();
  const overlap = conflicts(units);
  const missingProof = units.filter((unit) => unit.proof.trim() === "").map((unit) => unit.id);
  return {
    status: duplicateIds.length === 0 && overlap.length === 0 && missingProof.length === 0 ? "ready" : "blocked",
    duplicate_ids: duplicateIds,
    conflicts: overlap,
    missing_proof: missingProof,
    waves: duplicateIds.length === 0 ? waves(units) : [],
    units: units.map((unit) => ({ ...unit, paths: [...unit.paths], depends_on: [...unit.depends_on] })),
  };
}

function example(): WorkUnit[] {
  return [
    workUnit("api", "worker-api", ["app/api", "tests/test_api.py"], [], "python3 -m unittest tests.test_api"),
    workUnit("docs", "worker-docs", ["docs/api.md"], [], "python3 scripts/check_links.py"),
    workUnit("integration", "reviewer", ["tests/test_integration.py"], ["api", "docs"], "python3 -m unittest"),
  ];
}

function main(): void {
  const output = join(resolve(__dirname, ".."), "outputs", "delegation-plan.json");
  writeFileSync(output, JSON.stringify(delegationPlan(example()), null, 2) + "\n", "utf-8");
  console.log(readFileSync(output, "utf-8"));
}

main();
