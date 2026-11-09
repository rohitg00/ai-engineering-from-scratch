// Lesson: Design Success Metrics Before the Result Exists (phase 14 / lesson 52)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/52-design-success-metrics/docs/en.md
// Run: npx tsx phases/14-agent-engineering/52-design-success-metrics/code/main.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface Metric {
  name: string;
  direction: string;
  threshold: number;
  window: string;
  source: string;
  kind: string;
}

interface MeasurementPlan {
  goal: string;
  questions: string[];
  metrics: Metric[];
}

const DIRECTIONS = new Set(["at-most", "at-least"]);

function metric(name: string, direction: string, threshold: number, window: string, source: string, kind: string): Metric {
  return { name, direction, threshold, window, source, kind };
}

function validate(plan: MeasurementPlan): string[] {
  const issues: string[] = [];
  if (plan.goal.trim() === "") issues.push("goal is empty");
  if (plan.questions.length === 0) issues.push("questions are empty");
  if (plan.metrics.length === 0) issues.push("metrics are empty");
  const kinds = new Set(plan.metrics.map((item) => item.kind));
  if (!kinds.has("outcome")) issues.push("outcome metric is missing");
  if (!kinds.has("guardrail")) issues.push("guardrail metric is missing");
  for (const item of plan.metrics) {
    if (!DIRECTIONS.has(item.direction)) issues.push(`${item.name} has invalid direction`);
    if (item.source.trim() === "" || item.window.trim() === "") issues.push(`${item.name} lacks source or window`);
  }
  return issues;
}

function evaluate(item: Metric, value: number): boolean {
  if (item.direction === "at-most") return value <= item.threshold;
  if (item.direction === "at-least") return value >= item.threshold;
  throw new Error("invalid direction");
}

function report(plan: MeasurementPlan, values: Map<string, number>): Record<string, unknown> {
  const issues = validate(plan);
  const results: Record<string, unknown>[] = [];
  for (const item of plan.metrics) {
    const value = values.get(item.name);
    if (!DIRECTIONS.has(item.direction)) {
      const result: Record<string, unknown> = { name: item.name, status: "invalid" };
      if (value !== undefined) result.value = value;
      results.push(result);
    } else if (value === undefined) {
      results.push({ name: item.name, status: "missing" });
    } else {
      results.push({ name: item.name, value, passed: evaluate(item, value) });
    }
  }
  return { status: issues.length === 0 ? "valid" : "invalid", issues, plan, results };
}

function example(): MeasurementPlan {
  return {
    goal: "Reduce time to identify the affected service without increasing unsafe actions",
    questions: ["How quickly is the correct service identified?", "Does diagnosis remain read-only?"],
    metrics: [
      metric("median_identification_seconds", "at-most", 120, "ten incident replays", "replay log", "outcome"),
      metric("correct_service_rate", "at-least", 0.9, "ten incident replays", "incident record", "outcome"),
      metric("production_writes", "at-most", 0, "entire pilot", "audit log", "guardrail"),
    ],
  };
}

function main(): void {
  const values = new Map<string, number>([
    ["median_identification_seconds", 94],
    ["correct_service_rate", 0.9],
    ["production_writes", 0],
  ]);
  const output = join(resolve(__dirname, ".."), "outputs", "measurement-report.json");
  writeFileSync(output, JSON.stringify(report(example(), values), null, 2) + "\n", "utf-8");
  console.log(readFileSync(output, "utf-8"));
}

main();
