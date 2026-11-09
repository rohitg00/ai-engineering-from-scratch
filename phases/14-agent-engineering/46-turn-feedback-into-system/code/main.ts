// Lesson: Turn Every Agent Correction into a System Improvement (phase 14 / lesson 46)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/46-turn-feedback-into-system/docs/en.md
// Run: npx tsx phases/14-agent-engineering/46-turn-feedback-into-system/code/main.ts

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface Correction {
  symptom: string;
  cause: string;
  recurrence: number;
  consequence: string;
}

interface Control {
  target: string;
  rule: string;
  verification: string;
  fingerprint: string;
  symptom: string;
  cause: string;
  recurrence: number;
  consequence: string;
}

function correction(symptom: string, cause: string, recurrence: number, consequence: string): Correction {
  return { symptom, cause, recurrence, consequence };
}

function chooseTarget(item: Correction): string {
  const text = `${item.symptom} ${item.cause}`.toLowerCase();
  if (["incorrect output", "regression", "edge case", "bug"].some((word) => text.includes(word))) return "test";
  if (["scope", "unrelated file", "permission"].some((word) => text.includes(word))) return "scope";
  if (["command", "setup", "environment", "tool"].some((word) => text.includes(word))) return "automation";
  if (["format", "pattern", "example"].some((word) => text.includes(word))) return "example";
  return "instruction";
}

function normalizeCause(cause: string): string {
  const text = cause.trim().replace(/\.+$/, "").toLowerCase();
  const implicit = /^(.+?) (?:was|were) implicit$/.exec(text);
  if (implicit) return `implicit ${implicit[1]}`;
  const unchecked = /^(.+?) was described but not checked$/.exec(text);
  if (unchecked) return `unchecked ${unchecked[1]} description`;
  const missing = /^(.+?) had no (.+)$/.exec(text);
  if (missing) return `missing ${missing[2]} for ${missing[1]}`;
  return text;
}

const VERIFICATION: Record<string, string> = {
  test: "Run the new regression test",
  scope: "Run the scope checker",
  automation: "Run the setup or tool preflight",
  example: "Compare the output with the canonical example",
  instruction: "Run the instruction linter and scenario check",
};

function promote(item: Correction): Control {
  const target = chooseTarget(item);
  const rule = `Prevent ${normalizeCause(item.cause)}`;
  const verification = VERIFICATION[target];
  const digest = createHash("sha256").update(`${target}|${rule}`).digest("hex").slice(0, 12);
  return {
    target,
    rule,
    verification,
    fingerprint: digest,
    symptom: item.symptom,
    cause: item.cause,
    recurrence: item.recurrence,
    consequence: item.consequence,
  };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function ratchet(corrections: Correction[]): Control[] {
  const promoted = new Map<string, Control>();
  for (const item of corrections) {
    if (item.recurrence < 1) continue;
    const control = promote(item);
    promoted.set(control.fingerprint, control);
  }
  return [...promoted.values()].sort((a, b) => compare(a.target, b.target) || compare(a.fingerprint, b.fingerprint));
}

function example(): Correction[] {
  return [
    correction("Agent edited an unrelated file", "scope was described but not checked", 2, "review churn"),
    correction("A regression escaped", "edge case had no executable example", 1, "user-visible failure"),
    correction("Setup command failed", "environment assumptions were implicit", 3, "lost session"),
  ];
}

function main(): void {
  const output = join(resolve(__dirname, ".."), "outputs", "feedback-ratchet.json");
  writeFileSync(output, JSON.stringify(ratchet(example()), null, 2) + "\n", "utf-8");
  console.log(readFileSync(output, "utf-8"));
}

main();
