// Lesson: Choose Prototype, Pilot, or Production Deliberately (phase 14 / lesson 53)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/53-prototype-pilot-or-production/docs/en.md
// Run: npx tsx phases/14-agent-engineering/53-prototype-pilot-or-production/code/main.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface BuildDecision {
  unknown: string;
  real_users_required: boolean;
  real_data_required: boolean;
  consequence: number;
  reversible: boolean;
  operational_readiness: boolean;
}

function buildDecision(
  unknown: string,
  real_users_required: boolean,
  real_data_required: boolean,
  consequence: number,
  reversible: boolean,
  operational_readiness: boolean,
): BuildDecision {
  return { unknown, real_users_required, real_data_required, consequence, reversible, operational_readiness };
}

function chooseStage(decision: BuildDecision): string {
  if (!(decision.consequence >= 1 && decision.consequence <= 5)) throw new Error("consequence must be from one to five");
  if (!decision.real_users_required && !decision.real_data_required) return "prototype";
  if (!decision.operational_readiness || decision.consequence >= 4 || !decision.reversible) return "pilot";
  return "production";
}

function requiredControls(stage: string): string[] {
  const controls: Record<string, string[]> = {
    prototype: ["synthetic or recorded inputs", "discardable implementation", "learning question"],
    pilot: ["limited audience", "rollback", "human owner", "audit trail", "exit criteria"],
    production: [
      "service level objective",
      "on-call owner",
      "security review",
      "cost and capacity controls",
      "rollback",
      "recovery",
      "continuous monitoring",
      "retirement path",
    ],
  };
  if (!(stage in controls)) throw new Error("unknown stage");
  return controls[stage];
}

function plan(decision: BuildDecision): Record<string, unknown> {
  const stage = chooseStage(decision);
  return { stage, decision, required_controls: requiredControls(stage) };
}

function examples(): BuildDecision[] {
  return [
    buildDecision("Can the service be identified from an alert?", false, false, 2, true, false),
    buildDecision("Will engineers trust the recommendation?", true, true, 4, true, false),
    buildDecision("Can the workflow meet its SLO?", true, true, 2, true, true),
  ];
}

function main(): void {
  const output = join(resolve(__dirname, ".."), "outputs", "stage-decisions.json");
  writeFileSync(output, JSON.stringify(examples().map(plan), null, 2) + "\n", "utf-8");
  console.log(readFileSync(output, "utf-8"));
}

main();
