// Lesson: Verification Gates (phase 14 / lesson 38)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/38-verification-gates/docs/en.md
// Run: npx tsx phases/14-agent-engineering/38-verification-gates/code/main.ts

import { createHmac, timingSafeEqual } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const HERE = __dirname;
const OVERRIDES_PATH = join(HERE, "overrides.jsonl");
const COVERAGE_FLOOR_DEFAULT = 0.8;
const COVERAGE_REGRESSION_DELTA = 0.01;

const OVERRIDE_SECRET_ENV = "VERIFY_OVERRIDE_SECRET";
const DEMO_MODE_ENV = "VERIFY_DEMO_MODE";

class RuntimeError extends Error {}

function loadOverrideSecret(): string {
  const secret = process.env[OVERRIDE_SECRET_ENV];
  if (secret) {
    return secret;
  }
  if (process.env[DEMO_MODE_ENV] === "1") {
    console.error(
      `WARNING: ${OVERRIDE_SECRET_ENV} unset and ${DEMO_MODE_ENV}=1; ` +
        "using insecure demo secret. Do not record real overrides in this mode.",
    );
    return "demo-override-secret-do-not-ship";
  }
  throw new RuntimeError(
    `refused to start: ${OVERRIDE_SECRET_ENV} is unset. ` + `Set the env var, or pass ${DEMO_MODE_ENV}=1 to run the lesson demo only.`,
  );
}

interface Finding {
  code: string;
  severity: string;
  detail: string;
}

interface Artifacts {
  task_id: string;
  acceptance_commands: string[];
  feedback: { [key: string]: Json }[];
  scope_report: { [key: string]: Json };
  rule_report: { [key: string]: Json }[];
  coverage_report: { [key: string]: number } | null;
  head_commit: string;
}

interface VerdictReport {
  task_id: string;
  passed: boolean;
  strict: boolean;
  findings: Finding[];
  coverage: { [key: string]: number } | null;
  head_commit: string;
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

function pct(x: number, digits: number): string {
  return (x * 100).toFixed(digits) + "%";
}

function isclose(a: number, b: number, relTol = 1e-9, absTol = 0.0): boolean {
  if (a === b) return true;
  const diff = Math.abs(b - a);
  return diff <= Math.abs(relTol * b) || diff <= Math.abs(relTol * a) || diff <= absTol;
}

function acceptanceFindings(art: Artifacts): Finding[] {
  const findings: Finding[] = [];
  const commandsRun = art.feedback.map((rec) => pyFormat(rec.command));
  const acceptSet = new Set(art.acceptance_commands);
  for (const cmd of art.acceptance_commands) {
    if (!commandsRun.includes(cmd)) {
      findings.push({ code: "acceptance.missing", severity: "block", detail: `never ran: ${cmd}` });
    }
  }
  for (const rec of art.feedback) {
    const cmdStr = pyFormat(rec.command);
    const exitCode = rec.exit_code;
    if (exitCode === null || exitCode === undefined) {
      findings.push({ code: "feedback.null_exit", severity: "block", detail: `missing exit for ${cmdStr}` });
    } else if (exitCode !== 0 && acceptSet.has(cmdStr)) {
      findings.push({ code: "acceptance.failed", severity: "block", detail: `acceptance exit ${pyFormat(exitCode)} on ${cmdStr}` });
    }
  }
  return findings;
}

function scopeFindings(art: Artifacts): Finding[] {
  const findings: Finding[] = [];
  if (truthy(art.scope_report.forbidden_writes)) {
    findings.push({ code: "scope.forbidden", severity: "block", detail: `forbidden writes: ${pyFormat(art.scope_report.forbidden_writes)}` });
  }
  if (truthy(art.scope_report.off_scope_writes)) {
    findings.push({ code: "scope.off_scope", severity: "warn", detail: `off-scope writes: ${pyFormat(art.scope_report.off_scope_writes)}` });
  }
  return findings;
}

function ruleFindings(art: Artifacts): Finding[] {
  return art.rule_report
    .filter((row) => !truthy(row.passed))
    .map((row) => ({ code: "rule.failed", severity: "block", detail: `rule failed: ${pyFormat(row.slug)}` }));
}

function coverageFindings(art: Artifacts, floor: number): Finding[] {
  const findings: Finding[] = [];
  if (!art.coverage_report || Object.keys(art.coverage_report).length === 0) {
    findings.push({ code: "coverage.missing", severity: "warn", detail: "no coverage_report.json; cannot enforce floor" });
    return findings;
  }
  const current = art.coverage_report.current ?? 0.0;
  const previous = art.coverage_report.previous ?? current;
  if (current < floor) {
    findings.push({ code: "coverage.below_floor", severity: "block", detail: `coverage ${pct(current, 2)} below floor ${pct(floor, 0)}` });
  }
  const delta = previous - current;
  if (delta > COVERAGE_REGRESSION_DELTA && !isclose(delta, COVERAGE_REGRESSION_DELTA, 1e-9)) {
    findings.push({
      code: "coverage.regression",
      severity: "block",
      detail: `coverage dropped ${pct(delta, 2)} (prev ${pct(previous, 2)} -> ${pct(current, 2)})`,
    });
  } else if (delta > 0 && !isclose(delta, 0.0, 1e-9, 1e-12)) {
    findings.push({ code: "coverage.minor_regression", severity: "warn", detail: `coverage dropped ${pct(delta, 2)}` });
  }
  return findings;
}

function verify(art: Artifacts, strict = false, coverageFloor = COVERAGE_FLOOR_DEFAULT): VerdictReport {
  let findings = [...acceptanceFindings(art), ...scopeFindings(art), ...ruleFindings(art), ...coverageFindings(art, coverageFloor)];
  if (strict) {
    findings = findings.map((f) => ({ code: f.code, severity: f.severity === "warn" ? "block" : f.severity, detail: f.detail }));
  }
  const blocking = findings.filter((f) => f.severity === "block");
  return {
    task_id: art.task_id,
    passed: blocking.length === 0,
    strict,
    findings,
    coverage: art.coverage_report,
    head_commit: art.head_commit,
  };
}

function escapeAscii(text: string): string {
  return text.replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function pyDumps(value: Json, sortKeys: boolean, itemSep: string, keySep: string, floatKeys: Set<string>, key = ""): string {
  if (typeof value === "number") {
    return floatKeys.has(key) && Number.isInteger(value) ? value.toFixed(1) : JSON.stringify(value);
  }
  if (value === null || typeof value !== "object") {
    return escapeAscii(JSON.stringify(value));
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => pyDumps(v, sortKeys, itemSep, keySep, floatKeys)).join(itemSep) + "]";
  }
  const keys = Object.keys(value);
  if (sortKeys) keys.sort();
  return "{" + keys.map((k) => `${escapeAscii(JSON.stringify(k))}${keySep}${pyDumps(value[k], sortKeys, itemSep, keySep, floatKeys, k)}`).join(itemSep) + "}";
}

const FLOAT_KEYS = new Set(["ts"]);

function sign(payload: { [key: string]: Json }): string {
  const canonical = pyDumps(payload, true, ",", ":", FLOAT_KEYS);
  return createHmac("sha256", loadOverrideSecret()).update(canonical).digest("hex").slice(0, 32);
}

function recordOverride(taskId: string, findingCode: string, reason: string, userId: string, headCommit: string): { [key: string]: Json } {
  if (![taskId, findingCode, reason, userId, headCommit].every((v) => Boolean(v))) {
    throw new Error("override requires task_id, finding_code, reason, user_id, head_commit");
  }
  const payload: { [key: string]: Json } = {
    task_id: taskId,
    finding_code: findingCode,
    reason,
    user_id: userId,
    head_commit: headCommit,
    ts: (performance.timeOrigin + performance.now()) / 1000,
  };
  const unsigned: { [key: string]: Json } = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k !== "signature") unsigned[k] = v;
  }
  payload.signature = sign(unsigned);
  appendFileSync(OVERRIDES_PATH, pyDumps(payload, false, ", ", ": ", FLOAT_KEYS) + "\n");
  return payload;
}

function verifySignature(entry: { [key: string]: Json }): boolean {
  const expected = pyFormat(entry.signature);
  const payload: { [key: string]: Json } = {};
  for (const [k, v] of Object.entries(entry)) {
    if (k !== "signature") payload[k] = v;
  }
  const actual = Buffer.from(sign(payload));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function parseArgs(argv: string[]): { strict: boolean; floor: number } | null {
  const usage = "usage: main.ts [-h] [--strict] [--floor FLOOR]";
  const args = { strict: false, floor: COVERAGE_FLOOR_DEFAULT };
  const unknown: string[] = [];
  const parseFloor = (raw: string | undefined): boolean => {
    if (raw === undefined) {
      console.error(`${usage}\nmain.ts: error: argument --floor: expected one argument`);
      return false;
    }
    const value = raw.trim() === "" ? NaN : Number(raw);
    if (Number.isNaN(value)) {
      console.error(`${usage}\nmain.ts: error: argument --floor: invalid float value: ${pyStr(raw)}`);
      return false;
    }
    args.floor = value;
    return true;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      console.log(`${usage}\n\noptions:\n  -h, --help     show this help message and exit\n  --strict       promote every warn to block\n  --floor FLOOR`);
      process.exit(0);
    } else if (arg === "--strict") {
      args.strict = true;
    } else if (arg === "--floor") {
      i += 1;
      if (!parseFloor(argv[i])) return null;
    } else if (arg.startsWith("--floor=")) {
      if (!parseFloor(arg.slice("--floor=".length))) return null;
    } else {
      unknown.push(arg);
    }
  }
  if (unknown.length > 0) {
    console.error(`${usage}\nmain.ts: error: unrecognized arguments: ${unknown.join(" ")}`);
    return null;
  }
  return args;
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) {
    return 2;
  }

  const accept = ["pytest -x test_app.py::test_signup_rejects_short_password"];
  const cases: Artifacts[] = [
    {
      task_id: "T-001",
      acceptance_commands: accept,
      feedback: [{ command: accept[0], exit_code: 0 }],
      scope_report: { forbidden_writes: [], off_scope_writes: [] },
      rule_report: [{ slug: "done/tests-pass", passed: true }],
      coverage_report: { current: 0.84, previous: 0.85 },
      head_commit: "a1b2c3d",
    },
    {
      task_id: "T-002",
      acceptance_commands: accept,
      feedback: [{ command: accept[0], exit_code: 0 }],
      scope_report: { forbidden_writes: ["scripts/release.sh"], off_scope_writes: ["README.md"] },
      rule_report: [{ slug: "forbidden/no-release-script-edits", passed: false }],
      coverage_report: { current: 0.62, previous: 0.8 },
      head_commit: "b2c3d4e",
    },
    {
      task_id: "T-003",
      acceptance_commands: accept,
      feedback: [],
      scope_report: { forbidden_writes: [], off_scope_writes: [] },
      rule_report: [{ slug: "done/tests-pass", passed: false }],
      coverage_report: null,
      head_commit: "c3d4e5f",
    },
  ];

  for (const art of cases) {
    const report = verify(art, args.strict, args.floor);
    const path = join(HERE, `verification_report_${art.task_id}.json`);
    writeFileSync(
      path,
      JSON.stringify(
        {
          task_id: report.task_id,
          passed: report.passed,
          strict: report.strict,
          head_commit: report.head_commit,
          coverage: report.coverage,
          findings: report.findings,
        },
        null,
        2,
      ) + "\n",
    );
    const flag = report.strict ? " (strict)" : "";
    console.log(`task ${report.task_id}${flag}: passed=${report.passed ? "True" : "False"} findings=${report.findings.length}`);
    for (const f of report.findings) {
      console.log(`  [${f.severity}] ${f.code}: ${f.detail}`);
    }
    console.log();
  }

  try {
    const entry = recordOverride("T-002", "scope.off_scope", "reviewer approved README update for the new signup contract", "rohitg00", "b2c3d4e");
    console.log(`override recorded: signature=${pyFormat(entry.signature)} verified=${verifySignature(entry) ? "True" : "False"}`);
  } catch (exc) {
    if (!(exc instanceof RuntimeError)) throw exc;
    console.log(`override demo skipped: ${exc.message}`);
  }
  return 0;
}

process.exitCode = main();
