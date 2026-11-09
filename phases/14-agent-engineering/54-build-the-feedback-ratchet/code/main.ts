// Lesson: Build a Feedback Ratchet with Ownership and Retirement (phase 14 / lesson 54)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/54-build-the-feedback-ratchet/docs/en.md
// Run: npx tsx phases/14-agent-engineering/54-build-the-feedback-ratchet/code/main.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface Signal {
  source: string;
  observation: string;
  severity: number;
  frequency: number;
  owner: string;
  expires_after_days: number;
}

interface RatchetAction {
  priority: number;
  destination: string;
  change: string;
  owner: string;
  durable_artifact: string;
  verification_evidence: string;
  retirement_check: string;
}

function signal(source: string, observation: string, severity: number, frequency: number, owner: string, expires_after_days: number): Signal {
  return { source, observation, severity, frequency, owner, expires_after_days };
}

function destination(item: Signal): string {
  const text = item.observation.toLowerCase();
  if (["regression", "wrong result", "false positive"].some((word) => text.includes(word))) return "evaluation";
  if (["permission", "unsafe", "production write"].some((word) => text.includes(word))) return "policy";
  if (["missing context", "could not find", "duplicate"].some((word) => text.includes(word))) return "context";
  if (["timeout", "retry", "unavailable"].some((word) => text.includes(word))) return "runtime";
  return "backlog";
}

const DURABLE_ARTIFACT: Record<string, string> = {
  evaluation: "evaluations/regression-suite.json",
  policy: "policies/authority-boundaries.json",
  context: "context/retrieval-guidance.md",
  runtime: "runtime/reliability-controls.json",
  backlog: "backlog/shaped-work.json",
};

const VERIFICATION_EVIDENCE: Record<string, string> = {
  evaluation: "Record a passing regression evaluation",
  policy: "Record a passing authority-boundary scenario",
  context: "Record a replay with the required context present",
  runtime: "Record a timeout and retry scenario within budget",
  backlog: "Record review against the outcome frame",
};

function promote(item: Signal): RatchetAction {
  if (!Number.isInteger(item.severity) || item.severity < 1 || item.severity > 5 || item.frequency < 1) {
    throw new Error("severity must be one to five and frequency positive");
  }
  const target = destination(item);
  return {
    priority: item.severity * item.frequency,
    destination: target,
    change: `Prevent recurrence of: ${item.observation}`,
    owner: item.owner,
    durable_artifact: DURABLE_ARTIFACT[target],
    verification_evidence: VERIFICATION_EVIDENCE[target],
    retirement_check: `Remove or revise after ${item.expires_after_days} days without recurrence`,
  };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function backlog(signals: Signal[]): RatchetAction[] {
  const actions = signals.map(promote);
  return actions.sort((a, b) => b.priority - a.priority || compare(a.destination, b.destination) || compare(a.change, b.change));
}

function example(): Signal[] {
  return [
    signal("incident 184", "missing context caused duplicate service lookup", 4, 3, "platform", 90),
    signal("pilot audit", "production write was attempted", 5, 1, "security", 180),
    signal("evaluation run", "false positive on a stale deployment", 3, 4, "evaluation", 60),
  ];
}

function main(): void {
  const output = join(resolve(__dirname, ".."), "outputs", "feedback-backlog.json");
  writeFileSync(output, JSON.stringify(backlog(example()), null, 2) + "\n", "utf-8");
  console.log(readFileSync(output, "utf-8"));
}

main();
