// Lesson: Scope Contracts and Task Boundaries (phase 14 / lesson 36)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/36-scope-contracts/docs/en.md
// Run: npx tsx phases/14-agent-engineering/36-scope-contracts/code/main.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const HERE = __dirname;

interface ScopeContract {
  task_id: string;
  goal: string;
  allowed_files: string[];
  forbidden_files: string[];
  acceptance_criteria: string[];
  rollback_plan: string;
  approvals_required: string[];
  time_budget_minutes: number | null;
  network_egress: string[] | null;
  violation_budget: number;
  docs_paths_soft: string[];
}

type ContractInput = Pick<ScopeContract, "task_id" | "goal" | "allowed_files" | "forbidden_files" | "acceptance_criteria" | "rollback_plan"> &
  Partial<ScopeContract>;

function makeContract(input: ContractInput): ScopeContract {
  return {
    task_id: input.task_id,
    goal: input.goal,
    allowed_files: input.allowed_files,
    forbidden_files: input.forbidden_files,
    acceptance_criteria: input.acceptance_criteria,
    rollback_plan: input.rollback_plan,
    approvals_required: input.approvals_required ?? [],
    time_budget_minutes: input.time_budget_minutes ?? null,
    network_egress: input.network_egress === undefined ? null : input.network_egress,
    violation_budget: input.violation_budget ?? 0,
    docs_paths_soft: input.docs_paths_soft ?? ["docs/**", "README.md", "**/*.md"],
  };
}

interface RunSummary {
  touched_files: string[];
  commands_run: string[];
  elapsed_minutes: number;
  network_hosts: string[];
}

interface Finding {
  code: string;
  severity: string;
  detail: string;
}

class ScopeReport {
  constructor(
    public task_id: string,
    public in_scope_writes: string[],
    public off_scope_writes: string[],
    public forbidden_writes: string[],
    public soft_off_scope_writes: string[],
    public missing_acceptance: string[],
    public findings: Finding[],
    public over_budget: boolean,
  ) {}

  passed(): boolean {
    return !this.over_budget && !this.findings.some((f) => f.severity === "block");
  }
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

function pyList(items: string[]): string {
  return "[" + items.map(pyStr).join(", ") + "]";
}

function pyBool(value: boolean): string {
  return value ? "True" : "False";
}

function fnmatchRegex(pattern: string): RegExp {
  let out = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    i += 1;
    if (ch === "*") {
      while (pattern[i] === "*") i += 1;
      out += "[\\s\\S]*";
    } else if (ch === "?") {
      out += "[\\s\\S]";
    } else if (ch === "[") {
      let j = i;
      if (pattern[j] === "!") j += 1;
      if (pattern[j] === "]") j += 1;
      while (j < pattern.length && pattern[j] !== "]") j += 1;
      if (j >= pattern.length) {
        out += "\\[";
      } else {
        let stuff = pattern.slice(i, j).replace(/\\/g, "\\\\");
        i = j + 1;
        if (stuff.startsWith("!")) stuff = "^" + stuff.slice(1);
        else if (stuff.startsWith("^")) stuff = "\\" + stuff;
        out += `[${stuff}]`;
      }
    } else {
      out += ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    }
  }
  return new RegExp(`^(?:${out})$`);
}

function fnmatch(path: string, pattern: string): boolean {
  return fnmatchRegex(pattern).test(path);
}

function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((p) => fnmatch(path, p));
}

function sortedSet(items: string[]): string[] {
  return [...new Set(items)].sort();
}

function intersect(a: string[], b: string[]): string[] {
  const right = new Set(b);
  return sortedSet(a.filter((x) => right.has(x)));
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

function mergeEgress(a: string[] | null, b: string[] | null): string[] | null {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return intersect(a, b);
}

function minOptional(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function mergeContracts(parent: ScopeContract, child: ScopeContract): ScopeContract {
  return {
    task_id: child.task_id,
    goal: child.goal || parent.goal,
    allowed_files: intersect(parent.allowed_files, child.allowed_files),
    forbidden_files: sortedSet([...parent.forbidden_files, ...child.forbidden_files]),
    acceptance_criteria: dedupe([...parent.acceptance_criteria, ...child.acceptance_criteria]),
    rollback_plan: child.rollback_plan || parent.rollback_plan,
    approvals_required: dedupe([...parent.approvals_required, ...child.approvals_required]),
    time_budget_minutes: minOptional(parent.time_budget_minutes, child.time_budget_minutes),
    network_egress: mergeEgress(parent.network_egress, child.network_egress),
    violation_budget: Math.min(parent.violation_budget, child.violation_budget),
    docs_paths_soft: sortedSet([...parent.docs_paths_soft, ...child.docs_paths_soft]),
  };
}

function scopeCheck(contract: ScopeContract, run: RunSummary): ScopeReport {
  const inScope: string[] = [];
  const offScope: string[] = [];
  const softOffScope: string[] = [];
  const forbidden: string[] = [];
  for (const path of run.touched_files) {
    if (matchesAny(path, contract.forbidden_files)) {
      forbidden.push(path);
    } else if (matchesAny(path, contract.allowed_files)) {
      inScope.push(path);
    } else if (matchesAny(path, contract.docs_paths_soft)) {
      softOffScope.push(path);
    } else {
      offScope.push(path);
    }
  }
  const missing = contract.acceptance_criteria.filter((c) => !run.commands_run.includes(c));

  const findings: Finding[] = [];
  if (forbidden.length > 0) {
    findings.push({ code: "scope.forbidden", severity: "block", detail: `forbidden writes: ${pyList(forbidden)}` });
  }
  if (offScope.length > 0) {
    findings.push({ code: "scope.off_scope", severity: "warn", detail: `off-scope writes: ${pyList(offScope)}` });
  }
  if (softOffScope.length > 0) {
    findings.push({ code: "scope.soft_off_scope", severity: "info", detail: `docs/markdown off-scope: ${pyList(softOffScope)}` });
  }
  if (missing.length > 0) {
    findings.push({ code: "acceptance.missing", severity: "block", detail: `acceptance not run: ${pyList(missing)}` });
  }
  if (contract.time_budget_minutes !== null && run.elapsed_minutes > contract.time_budget_minutes) {
    findings.push({
      code: "time.over_budget",
      severity: "block",
      detail: `elapsed ${run.elapsed_minutes.toFixed(1)}m > budget ${contract.time_budget_minutes}m`,
    });
  }
  if (contract.network_egress !== null && run.network_hosts.length > 0) {
    const allow = contract.network_egress;
    const badHosts = run.network_hosts.filter((h) => !allow.includes(h));
    if (badHosts.length > 0) {
      findings.push({ code: "network.unallowed_host", severity: "block", detail: `egress to non-allowlisted hosts: ${pyList(badHosts)}` });
    }
  }

  const warnCount = findings.filter((f) => f.severity === "warn").length;
  const overBudget = warnCount > contract.violation_budget;

  return new ScopeReport(contract.task_id, inScope, offScope, forbidden, softOffScope, missing, findings, overBudget);
}

function archive(report: ScopeReport): string {
  const out = join(HERE, "closed", `${report.task_id}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      {
        task_id: report.task_id,
        findings: report.findings,
        in_scope: report.in_scope_writes,
        off_scope: report.off_scope_writes,
        soft_off_scope: report.soft_off_scope_writes,
        passed: report.passed(),
        closed_at: Date.now() / 1000,
      },
      null,
      2,
    ) + "\n",
  );
  return out;
}

function main(): void {
  const projectWide = makeContract({
    task_id: "P-PROJECT",
    goal: "project-wide defaults",
    allowed_files: ["app.py", "test_app.py", "lib/**/*.py"],
    forbidden_files: ["scripts/release.sh", "config/prod.yaml"],
    acceptance_criteria: [],
    rollback_plan: "revert and redeploy",
    approvals_required: ["any new runtime dependency"],
    time_budget_minutes: 60,
    violation_budget: 1,
    network_egress: ["api.openai.com", "api.anthropic.com"],
  });
  const task = makeContract({
    task_id: "T-001",
    goal: "add input validation to /signup",
    allowed_files: ["app.py", "test_app.py"],
    forbidden_files: ["migrations/**"],
    acceptance_criteria: ["pytest -x test_app.py::test_signup_rejects_short_password"],
    rollback_plan: "revert the commit and redeploy the previous build tag",
    approvals_required: [],
    time_budget_minutes: 30,
    violation_budget: 0,
    network_egress: ["api.anthropic.com"],
  });
  const effective = mergeContracts(projectWide, task);

  const clean: RunSummary = {
    touched_files: ["app.py", "test_app.py"],
    commands_run: ["pytest -x test_app.py::test_signup_rejects_short_password"],
    elapsed_minutes: 12.4,
    network_hosts: ["api.anthropic.com"],
  };
  const creep: RunSummary = {
    touched_files: ["app.py", "README.md", "scripts/release.sh", "migrations/001_init.sql"],
    commands_run: [],
    elapsed_minutes: 42.1,
    network_hosts: ["api.anthropic.com", "evil.example"],
  };

  const cleanReport = scopeCheck(effective, clean);
  const creepReport = scopeCheck(effective, creep);

  console.log("effective contract:", JSON.stringify(effective, null, 2));
  console.log("\nclean run findings:");
  for (const f of cleanReport.findings) {
    console.log(`  [${f.severity}] ${f.code}: ${f.detail}`);
  }
  console.log(`  passed=${pyBool(cleanReport.passed())} over_budget=${pyBool(cleanReport.over_budget)}`);

  console.log("\ncreep run findings:");
  for (const f of creepReport.findings) {
    console.log(`  [${f.severity}] ${f.code}: ${f.detail}`);
  }
  console.log(`  passed=${pyBool(creepReport.passed())} over_budget=${pyBool(creepReport.over_budget)}`);

  archive(cleanReport);
  archive(creepReport);
  console.log(`\narchived under ${basename(join(HERE, "closed"))}/`);
}

main();
