// Lesson: Frame the Task Before the Agent Writes Code (phase 14 / lesson 43)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/43-frame-the-task-before-code/docs/en.md
// Run: npx tsx phases/14-agent-engineering/43-frame-the-task-before-code/code/main.ts

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

class RepositoryFact {
  constructor(
    readonly claim: string,
    readonly evidence: string,
  ) {
    Object.freeze(this);
  }
}

interface TaskFrame {
  goal: string;
  allowed_paths: string[];
  forbidden_paths: string[];
  acceptance: string[];
  facts: RepositoryFact[];
  unknowns: string[];
}

function validate(frame: TaskFrame): string[] {
  const issues: string[] = [];
  if (!frame.goal.trim()) {
    issues.push("goal is empty");
  }
  if (frame.allowed_paths.length === 0) {
    issues.push("allowed paths are empty");
  }
  if (frame.forbidden_paths.length === 0) {
    issues.push("forbidden paths are empty");
  }
  if (frame.acceptance.length === 0) {
    issues.push("acceptance evidence is empty");
  }
  for (const fact of frame.facts) {
    if (!fact.evidence.trim()) {
      issues.push(`unsupported fact: ${fact.claim}`);
    }
  }
  const forbidden = new Set(frame.forbidden_paths);
  const overlap = [...new Set(frame.allowed_paths.filter((p) => forbidden.has(p)))].sort();
  if (overlap.length > 0) {
    issues.push(`paths are both allowed and forbidden: ${overlap.join(", ")}`);
  }
  return issues;
}

function render(frame: TaskFrame): string {
  const issues = validate(frame);
  const status = issues.length === 0 ? "READY" : "BLOCKED";
  const lines = [`# Task Frame: ${frame.goal}`, "", `Status: ${status}`, "", "## Repository facts"];
  lines.push(...frame.facts.map((fact) => `- ${fact.claim} (\`${fact.evidence}\`)`));
  lines.push("", "## Allowed paths");
  lines.push(...frame.allowed_paths.map((path) => `- \`${path}\``));
  lines.push("", "## Forbidden paths");
  lines.push(...frame.forbidden_paths.map((path) => `- \`${path}\``));
  lines.push("", "## Acceptance evidence");
  lines.push(...frame.acceptance.map((item) => `- \`${item}\``));
  lines.push("", "## Unknowns");
  lines.push(...frame.unknowns.map((item) => `- ${item}`));
  if (issues.length > 0) {
    lines.push("", "## Blocking issues");
    lines.push(...issues.map((item) => `- ${item}`));
  }
  return lines.join("\n") + "\n";
}

function example(): TaskFrame {
  return {
    goal: "Prevent duplicate email addresses during signup",
    allowed_paths: ["app/accounts.py", "tests/test_accounts.py"],
    forbidden_paths: ["migrations/**", "deploy/**"],
    acceptance: ["python3 -m unittest tests.test_accounts"],
    facts: [
      new RepositoryFact("Account writes use AccountStore", "app/accounts.py:18"),
      new RepositoryFact("Duplicate errors use status 409", "tests/test_accounts.py:44"),
    ],
    unknowns: ["Whether email comparison is case-insensitive"],
  };
}

function main(): void {
  const output = join(dirname(realpathSync(__dirname)), "outputs", "task-frame.md");
  writeFileSync(output, render(example()), "utf8");
  console.log(readFileSync(output, "utf8"));
}

main();
