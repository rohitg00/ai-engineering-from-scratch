// Lesson: Multi-Session Handoff (phase 14 / lesson 40)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/40-multi-session-handoff/docs/en.md
// Run: npx tsx phases/14-agent-engineering/40-multi-session-handoff/code/main.ts

import { writeFileSync } from "node:fs";
import { join } from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const HERE = __dirname;
const TAIL_K = 5;

interface WorkbenchSnapshot {
  task_id: string;
  state: JsonObject;
  verdict: JsonObject;
  review: JsonObject;
  feedback: JsonObject[];
  diff_summary: { [key: string]: string[] };
}

interface HandoffPayload {
  task_id: string;
  summary: string;
  changed_files: string[];
  commands_run: string[];
  failed_attempts: string[];
  open_risks: { [key: string]: string }[];
  next_action: string;
  verdict_pointer: { [key: string]: string };
  feedback_tail: JsonObject[];
}

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else out += ch;
  }
  return quote + out + quote;
}

function pyRepr(value: Json | undefined): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyStr(value);
  if (Array.isArray(value)) return "[" + value.map(pyRepr).join(", ") + "]";
  return "{" + Object.entries(value).map(([k, v]) => `${pyStr(k)}: ${pyRepr(v)}`).join(", ") + "}";
}

function pyFormat(value: Json | undefined): string {
  return typeof value === "string" ? value : pyRepr(value);
}

function truthy(value: Json | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

function isNonZeroExit(code: Json | undefined): boolean {
  return !(code === 0 || code === false || code === null || code === undefined);
}

function pyInt(value: Json | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && /^\s*[+-]?\d+(_\d+)*\s*$/.test(value)) return parseInt(value.replace(/_/g, ""), 10);
  return null;
}

function trimFeedback(records: JsonObject[]): JsonObject[] {
  const tail = records.slice(-TAIL_K);
  const nonzero = records.filter((r) => isNonZeroExit(r.exit_code));
  const out: JsonObject[] = [];
  const seen = new Set<JsonObject>();
  for (const r of [...tail, ...nonzero]) {
    if (seen.has(r)) {
      continue;
    }
    seen.add(r);
    out.push(r);
  }
  return out;
}

function deriveRisks(snapshot: WorkbenchSnapshot): { [key: string]: string }[] {
  const risks: { [key: string]: string }[] = [];
  const findings = snapshot.verdict.findings;
  for (const f of truthy(findings) ? (findings as Json[]) : []) {
    if (typeof f === "object" && f !== null && !Array.isArray(f) && (f.severity === "warn" || f.severity === "block")) {
      risks.push({ severity: pyFormat(f.severity), detail: pyFormat(f.detail) });
    }
  }
  const blockers = snapshot.state.blockers;
  for (const blocker of truthy(blockers) ? (blockers as Json[]) : []) {
    risks.push({ severity: "warn", detail: `open blocker: ${pyFormat(blocker)}` });
  }
  const rawTotal = "total" in snapshot.review ? snapshot.review.total : 10;
  const safeTotal = pyInt(rawTotal) ?? 10;
  if (safeTotal < 7) {
    risks.push({ severity: "warn", detail: `review total ${pyFormat(rawTotal)} below 7` });
  }
  return risks;
}

function generateHandoff(snapshot: WorkbenchSnapshot): [string, HandoffPayload] {
  const nextAction = truthy(snapshot.state.next_action) ? pyFormat(snapshot.state.next_action) : "no next_action recorded; needs human";
  const payload: HandoffPayload = {
    task_id: snapshot.task_id,
    summary: `task ${snapshot.task_id}: review=${pyFormat(snapshot.review.verdict)}, gate=${pyFormat(snapshot.verdict.passed)}`,
    changed_files: snapshot.diff_summary.touched ?? [],
    commands_run: snapshot.feedback.map((r) => pyFormat(r.command)),
    failed_attempts: snapshot.feedback
      .filter((r) => isNonZeroExit(r.exit_code))
      .map((r) => `${pyFormat(r.command)} -> exit ${pyFormat(r.exit_code)}`),
    open_risks: deriveRisks(snapshot),
    next_action: nextAction,
    verdict_pointer: {
      verdict: `outputs/verification/${snapshot.task_id}.json`,
      review: `outputs/review/${snapshot.task_id}.json`,
    },
    feedback_tail: trimFeedback(snapshot.feedback),
  };

  const bullets = (items: string[]): string[] => (items.length > 0 ? items : ["- none"]);

  const mdLines = [
    `# Handoff: ${payload.task_id}`,
    "",
    `**Summary.** ${payload.summary}`,
    "",
    "## Changed files",
    ...bullets(payload.changed_files.map((f) => `- \`${f}\``)),
    "",
    "## Commands run",
    ...bullets(payload.commands_run.map((c) => `- \`${c}\``)),
    "",
    "## Failed attempts",
    ...bullets(payload.failed_attempts.map((f) => `- ${f}`)),
    "",
    "## Open risks",
    ...bullets(payload.open_risks.map((r) => `- [${r.severity}] ${r.detail}`)),
    "",
    "## Next action",
    `${payload.next_action}`,
    "",
    "## Receipts",
    `- verdict: \`${payload.verdict_pointer.verdict}\``,
    `- review:  \`${payload.verdict_pointer.review}\``,
  ];
  return [mdLines.join("\n") + "\n", payload];
}

function main(): void {
  const snapshot: WorkbenchSnapshot = {
    task_id: "T-001",
    state: {
      active_task_id: null,
      blockers: ["awaiting decision on rate-limit window"],
      next_action: "open PR with current diff and request review",
    },
    verdict: { passed: true, findings: [{ severity: "warn", detail: "off-scope: README.md" }] },
    review: { verdict: "pass", total: 8 },
    feedback: [
      { command: "pytest", exit_code: 0 },
      { command: "ruff check .", exit_code: 0 },
      { command: "pytest test_signup.py", exit_code: 1 },
      { command: "pytest test_signup.py", exit_code: 0 },
    ],
    diff_summary: { touched: ["app/signup.py", "tests/test_signup.py", "README.md"] },
  };

  const [md, payload] = generateHandoff(snapshot);
  writeFileSync(join(HERE, "handoff.md"), md);
  writeFileSync(join(HERE, "handoff.json"), JSON.stringify(payload, null, 2) + "\n");
  console.log(md);
}

main();
