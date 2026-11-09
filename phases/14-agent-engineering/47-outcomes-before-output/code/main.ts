// Lesson: Define the Outcome Before You Choose the Output (phase 14 / lesson 47)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/47-outcomes-before-output/docs/en.md
// Run: npx tsx phases/14-agent-engineering/47-outcomes-before-output/code/main.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface OutcomeFrame {
  user: string;
  situation: string;
  current_behavior: string;
  desired_outcome: string;
  constraints: string[];
  non_goals: string[];
  proposed_output: string;
}

type TextField = "user" | "situation" | "current_behavior" | "desired_outcome";

function validate(frame: OutcomeFrame): string[] {
  const issues: string[] = [];
  const names: TextField[] = ["user", "situation", "current_behavior", "desired_outcome"];
  for (const name of names) {
    if (frame[name].trim() === "") issues.push(`${name} is empty`);
  }
  if (frame.constraints.length === 0) issues.push("constraints are empty");
  if (frame.non_goals.length === 0) issues.push("non-goals are empty");
  if (frame.proposed_output && frame.desired_outcome.toLowerCase().includes(frame.proposed_output.toLowerCase())) {
    issues.push("desired outcome names the proposed output");
  }
  return issues;
}

function decision(frame: OutcomeFrame): Record<string, unknown> {
  const issues = validate(frame);
  return {
    status: issues.length === 0 ? "ready-to-discover" : "needs-framing",
    issues,
    frame: { ...frame },
    next_question: `What evidence would show that the desired outcome was achieved for the ${frame.user}?`,
  };
}

function example(): OutcomeFrame {
  return {
    user: "on-call engineer",
    situation: "a production alert arrives during an incident",
    current_behavior: "searches three dashboards before finding the affected service",
    desired_outcome: "identifies the failing service and safe next action within two minutes",
    constraints: ["read-only during diagnosis", "must preserve the audit trail"],
    non_goals: ["automatic remediation", "replacing the incident commander"],
    proposed_output: "incident assistant",
  };
}

function main(): void {
  const output = join(resolve(__dirname, ".."), "outputs", "outcome-frame.json");
  writeFileSync(output, JSON.stringify(decision(example()), null, 2) + "\n", "utf-8");
  console.log(readFileSync(output, "utf-8"));
}

main();
