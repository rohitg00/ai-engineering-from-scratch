// Lesson: Discover the Workflow People Actually Perform (phase 14 / lesson 48)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/48-discover-the-real-workflow/docs/en.md
// Run: npx tsx phases/14-agent-engineering/48-discover-the-real-workflow/code/main.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface Evidence {
  source: string;
  observation: string;
  direct: boolean;
  confidence: number;
}

interface WorkflowStep {
  order: number;
  actor: string;
  action: string;
  evidence: Evidence[];
  friction: string;
}

function evidence(source: string, observation: string, direct: boolean, confidence: number): Evidence {
  return { source, observation, direct, confidence };
}

function workflowStep(order: number, actor: string, action: string, items: Evidence[], friction = ""): WorkflowStep {
  return { order, actor, action, evidence: items, friction };
}

function pyRound(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function audit(steps: WorkflowStep[]): Record<string, unknown> {
  const orders = steps.map((step) => step.order);
  const issues: string[] = [];
  if (orders.length !== steps.length || orders.some((order, index) => order !== index + 1)) {
    issues.push("workflow order must be contiguous from one");
  }
  for (const step of steps) {
    if (step.evidence.length === 0) issues.push(`step ${step.order} has no evidence`);
    for (const item of step.evidence) {
      if (!(item.confidence >= 0 && item.confidence <= 1)) {
        issues.push(`step ${step.order} has confidence outside zero to one`);
      }
    }
  }
  let direct = 0;
  let total = 0;
  for (const step of steps) {
    for (const item of step.evidence) {
      if (item.direct) direct += 1;
    }
    total += step.evidence.length;
  }
  return {
    status: issues.length === 0 && direct > 0 ? "grounded" : "needs-evidence",
    issues,
    direct_evidence_ratio: total ? pyRound(direct / total, 2) : 0,
    friction_points: steps.filter((step) => step.friction).map((step) => step.friction),
    steps,
  };
}

function example(): WorkflowStep[] {
  return [
    workflowStep(1, "on-call engineer", "opens the alert", [evidence("screen recording 01", "alert lacks service owner", true, 0.95)], "owner lookup"),
    workflowStep(2, "on-call engineer", "searches dashboards", [evidence("incident 184", "three dashboards opened", true, 0.9)], "context switching"),
    workflowStep(3, "incident commander", "approves mitigation", [evidence("runbook", "production writes require approval", false, 0.8)]),
  ];
}

function main(): void {
  const output = join(resolve(__dirname, ".."), "outputs", "workflow-evidence.json");
  writeFileSync(output, JSON.stringify(audit(example()), null, 2) + "\n", "utf-8");
  console.log(readFileSync(output, "utf-8"));
}

main();
