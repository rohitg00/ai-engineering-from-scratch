// Lesson: Reviewer Agent: Separate Builder from Marker (phase 14 / lesson 39)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/39-reviewer-agent/docs/en.md
// Run: npx tsx phases/14-agent-engineering/39-reviewer-agent/code/main.ts

import { writeFileSync } from "node:fs";
import { join } from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const HERE = __dirname;

interface ReviewerInputs {
  task_id: string;
  goal: string;
  diff_summary: { [key: string]: string[] };
  state: JsonObject;
  feedback: JsonObject[];
  verdict: JsonObject;
}

interface DimensionScore {
  name: string;
  score: number;
  note: string;
}

interface ReviewReport {
  task_id: string;
  total: number;
  verdict: string;
  dimensions: DimensionScore[];
}

function truthy(value: Json | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

function scoreProblemFit(inputs: ReviewerInputs): DimensionScore {
  const files = inputs.diff_summary.touched ?? [];
  const goal = inputs.goal.toLowerCase();
  const keywords = goal.split(/\s+/).filter((w) => w.length > 4);
  const hits = keywords.filter((k) => files.some((f) => f.toLowerCase().includes(k))).length;
  const score = Math.min(2, hits);
  return { name: "problem_fit", score, note: `keyword hits across touched files: ${hits}` };
}

function scoreScopeDiscipline(inputs: ReviewerInputs): DimensionScore {
  const off = (inputs.verdict.findings ?? []) as JsonObject[];
  const blockScope = off.filter((f) => f.code === "scope.forbidden");
  if (blockScope.length > 0) {
    return { name: "scope_discipline", score: 0, note: "forbidden writes present" };
  }
  const warnScope = off.filter((f) => f.code === "scope.off_scope");
  return { name: "scope_discipline", score: warnScope.length > 0 ? 1 : 2, note: `off-scope warnings: ${warnScope.length}` };
}

function scoreAssumptions(inputs: ReviewerInputs): DimensionScore {
  const raw = inputs.state.assumptions;
  const assumptions = truthy(raw) ? (raw as Json[]) : [];
  if (assumptions.length === 0) {
    return { name: "assumptions", score: 1, note: "no assumptions recorded; either work was trivial or undocumented" };
  }
  return { name: "assumptions", score: 2, note: `${assumptions.length} assumptions recorded` };
}

function scoreVerification(inputs: ReviewerInputs): DimensionScore {
  const exits = inputs.feedback.map((rec) => rec.exit_code);
  if (exits.some((code) => code === null || code === undefined)) {
    return { name: "verification_quality", score: 0, note: "feedback log has missing exit codes" };
  }
  if (exits.every((code) => code === 0) && exits.length > 0) {
    return { name: "verification_quality", score: 2, note: "all feedback exit zero" };
  }
  return { name: "verification_quality", score: 1, note: "mixed exit codes in feedback" };
}

function scoreHandoff(inputs: ReviewerInputs): DimensionScore {
  if (truthy(inputs.state.active_task_id)) {
    return { name: "handoff_readiness", score: 1, note: "active task not closed in state" };
  }
  if (truthy(inputs.state.next_action)) {
    return { name: "handoff_readiness", score: 2, note: "next_action set, task closed" };
  }
  return { name: "handoff_readiness", score: 0, note: "no next_action recorded" };
}

const SCORERS = [scoreProblemFit, scoreScopeDiscipline, scoreAssumptions, scoreVerification, scoreHandoff];

function review(inputs: ReviewerInputs): ReviewReport {
  const dims = SCORERS.map((fn) => fn(inputs));
  const total = dims.reduce((acc, d) => acc + d.score, 0);
  const hasZero = dims.some((d) => d.score === 0);
  let verdict: string;
  if (hasZero || total < 5) {
    verdict = "hard_fail";
  } else if (total >= 7) {
    verdict = "pass";
  } else {
    verdict = "soft_fail";
  }
  return { task_id: inputs.task_id, total, verdict, dimensions: dims };
}

function main(): void {
  const clean: ReviewerInputs = {
    task_id: "T-001",
    goal: "add input validation to signup",
    diff_summary: { touched: ["app/signup.py", "tests/test_signup.py"] },
    state: {
      active_task_id: null,
      assumptions: ["users sign up with email + password only"],
      next_action: "pick next task from board",
    },
    feedback: [{ command: "pytest", exit_code: 0 }],
    verdict: { passed: true, findings: [] },
  };
  const wrong: ReviewerInputs = {
    task_id: "T-002",
    goal: "add input validation to signup",
    diff_summary: { touched: ["docs/api.md"] },
    state: { active_task_id: "T-002", assumptions: [], next_action: "" },
    feedback: [{ command: "pytest", exit_code: 0 }],
    verdict: { passed: true, findings: [{ code: "scope.off_scope", severity: "warn" }] },
  };

  for (const kase of [clean, wrong]) {
    const report = review(kase);
    const out = join(HERE, `review_report_${kase.task_id}.json`);
    writeFileSync(
      out,
      JSON.stringify({ task_id: report.task_id, total: report.total, verdict: report.verdict, dimensions: report.dimensions }, null, 2) + "\n",
    );
    console.log(`task ${report.task_id}: total=${report.total}/10 verdict=${report.verdict}`);
    for (const d of report.dimensions) {
      console.log(`  ${d.name.padEnd(22)} ${d.score}  ${d.note}`);
    }
    console.log();
  }
}

main();
