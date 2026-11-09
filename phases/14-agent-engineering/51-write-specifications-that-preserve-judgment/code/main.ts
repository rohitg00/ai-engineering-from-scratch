// Lesson: Write Specifications That Preserve Judgment (phase 14 / lesson 51)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/docs/en.md
// Run: npx tsx phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/code/main.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface Decision {
  question: string;
  mode: string;
  rationale: string;
}

interface Specification {
  outcome: string;
  invariants: string[];
  examples: string[];
  non_goals: string[];
  decisions: Decision[];
  proof: string[];
}

const VALID_MODES = new Set(["locked", "bounded", "delegated"]);

function decision(question: string, mode: string, rationale: string): Decision {
  return { question, mode, rationale };
}

function validate(specification: Specification): string[] {
  const issues: string[] = [];
  const fields: (keyof Specification)[] = ["outcome", "invariants", "examples", "non_goals", "decisions", "proof"];
  for (const fieldName of fields) {
    if (specification[fieldName].length === 0) issues.push(`${fieldName} is empty`);
  }
  for (const item of specification.decisions) {
    if (!VALID_MODES.has(item.mode)) issues.push(`invalid decision mode: ${item.mode}`);
    if (item.mode !== "delegated" && item.rationale.trim() === "") {
      issues.push(`constrained decision lacks rationale: ${item.question}`);
    }
  }
  return issues;
}

function compileContract(specification: Specification): Record<string, unknown> {
  const issues = validate(specification);
  return {
    status: issues.length === 0 ? "executable" : "incomplete",
    issues,
    contract: specification,
    agent_may_decide: specification.decisions.filter((item) => item.mode === "delegated").map((item) => item.question),
    bounded_decisions: specification.decisions
      .filter((item) => item.mode === "bounded")
      .map((item) => ({ question: item.question, boundary: item.rationale })),
    human_checkpoint: specification.decisions.filter((item) => item.mode === "locked").map((item) => item.question),
  };
}

function example(): Specification {
  return {
    outcome: "Identify the affected service from an incident alert in under two minutes",
    invariants: ["diagnosis is read-only", "every source is included in the audit record"],
    examples: ["an alert with a deployment id resolves to its service owner"],
    non_goals: ["automatic remediation", "changing alert routing"],
    decisions: [
      decision("Which read-only data source should be queried first?", "delegated", ""),
      decision("May the system write to production?", "locked", "Production authority stays with the incident commander"),
      decision("How many sources may be queried?", "bounded", "Stop after five sources or two minutes"),
    ],
    proof: ["ten recorded incident replays", "zero production writes"],
  };
}

function main(): void {
  const output = join(resolve(__dirname, ".."), "outputs", "executable-specification.json");
  writeFileSync(output, JSON.stringify(compileContract(example()), null, 2) + "\n", "utf-8");
  console.log(readFileSync(output, "utf-8"));
}

main();
