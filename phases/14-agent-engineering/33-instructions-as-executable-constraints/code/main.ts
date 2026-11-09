// Lesson: Agent Instructions as Executable Constraints (phase 14 / lesson 33)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/33-instructions-as-executable-constraints/docs/en.md
// Run: npx tsx phases/14-agent-engineering/33-instructions-as-executable-constraints/code/main.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const HERE = __dirname;
const RULES_PATH = join(HERE, "agent-rules.md");
const REPORT_PATH = join(HERE, "rule_report.json");

const SEED_RULES = `# Agent Rules

## startup/state-file-fresh
- category: startup
- check: state_file_fresh
Agent must read agent_state.json before any tool call.

## forbidden/no-release-script-edits
- category: forbidden
- check: no_release_script_edits
Never edit scripts/release.sh outside an approved release task.

## done/tests-pass
- category: definition_of_done
- check: tests_pass
A task is done only when its acceptance command exits zero.

## uncertainty/open-question-note
- category: uncertainty
- check: opened_question_when_unsure
When confidence is below threshold, write a question note instead of guessing.

## approval/new-dependency
- category: approval
- check: new_dependency_approved
Adding a runtime dependency requires explicit human approval.
`;

interface Rule {
  slug: string;
  category: string;
  check: string;
  description: string;
}

interface TurnTrace {
  read_state_file: boolean;
  edited_files: string[];
  confidence: number;
  asked_for_help: boolean;
  tests_exit_code: number | null;
  added_dependencies: string[];
  approvals: string[];
}

interface RuleResult {
  slug: string;
  category: string;
  passed: boolean;
}

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return quote + out + quote;
}

function pyList(items: string[]): string {
  return "[" + items.map(pyStr).join(", ") + "]";
}

function writeSeedRules(): void {
  if (!existsSync(RULES_PATH)) {
    writeFileSync(RULES_PATH, SEED_RULES);
  }
}

function parseRules(): Rule[] {
  const text = readFileSync(RULES_PATH, "utf8");
  const rules: Rule[] = [];
  for (const block of text.split(/\n## /).slice(1)) {
    const nl = block.indexOf("\n");
    const head = nl === -1 ? block : block.slice(0, nl);
    const slug = head.trim();
    const body = nl === -1 ? "" : block.slice(nl + 1);
    const catMatch = /-\s*category:\s*(\S+)/.exec(body);
    const checkMatch = /-\s*check:\s*(\S+)/.exec(body);
    const nonEmpty = body.split(/\r\n|\r|\n/).map((ln) => ln.trim()).filter((ln) => ln.length > 0);
    const desc = nonEmpty.length > 0 ? nonEmpty[nonEmpty.length - 1] : "";
    if (!catMatch || !checkMatch) {
      continue;
    }
    rules.push({ slug, category: catMatch[1], check: checkMatch[1], description: desc });
  }
  return rules;
}

class RuleChecker {
  state_file_fresh(trace: TurnTrace): boolean {
    return trace.read_state_file;
  }

  no_release_script_edits(trace: TurnTrace): boolean {
    return !trace.edited_files.includes("scripts/release.sh");
  }

  tests_pass(trace: TurnTrace): boolean {
    return trace.tests_exit_code === 0;
  }

  opened_question_when_unsure(trace: TurnTrace): boolean {
    return trace.confidence >= 0.7 || trace.asked_for_help;
  }

  new_dependency_approved(trace: TurnTrace): boolean {
    if (trace.added_dependencies.length === 0) {
      return true;
    }
    return trace.added_dependencies.every((dep) => trace.approvals.includes(dep));
  }
}

type CheckName = "state_file_fresh" | "no_release_script_edits" | "tests_pass" | "opened_question_when_unsure" | "new_dependency_approved";

const CHECK_NAMES: string[] = ["state_file_fresh", "no_release_script_edits", "tests_pass", "opened_question_when_unsure", "new_dependency_approved"];

function score(rules: Rule[], checker: RuleChecker, trace: TurnTrace): RuleResult[] {
  const results: RuleResult[] = [];
  for (const rule of rules) {
    let passed = false;
    if (CHECK_NAMES.includes(rule.check)) {
      passed = Boolean(checker[rule.check as CheckName](trace));
    }
    results.push({ slug: rule.slug, category: rule.category, passed });
  }
  return results;
}

function main(): void {
  writeSeedRules();
  const rules = parseRules();

  const badTrace: TurnTrace = {
    read_state_file: false,
    edited_files: ["app.py", "scripts/release.sh"],
    confidence: 0.4,
    asked_for_help: false,
    tests_exit_code: 1,
    added_dependencies: ["fastapi"],
    approvals: [],
  };

  const goodTrace: TurnTrace = {
    read_state_file: true,
    edited_files: ["app.py", "test_app.py"],
    confidence: 0.9,
    asked_for_help: false,
    tests_exit_code: 0,
    added_dependencies: [],
    approvals: [],
  };

  const checker = new RuleChecker();
  const bad = score(rules, checker, badTrace);
  const good = score(rules, checker, goodTrace);

  console.log("rules parsed:", pyList(rules.map((r) => r.slug)));
  console.log();
  console.log("bad trace:");
  for (const r of bad) {
    console.log(`  ${r.slug.padEnd(42)} ${r.passed ? "PASS" : "FAIL"}`);
  }
  console.log("\ngood trace:");
  for (const r of good) {
    console.log(`  ${r.slug.padEnd(42)} ${r.passed ? "PASS" : "FAIL"}`);
  }

  writeFileSync(
    REPORT_PATH,
    JSON.stringify({ bad, good, trace_bad: badTrace, trace_good: goodTrace }, null, 2) + "\n",
  );
  console.log(`\nwrote ${basename(REPORT_PATH)}`);
}

main();
