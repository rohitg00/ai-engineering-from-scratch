// Lesson: The Workbench on a Real Repo (phase 14 / lesson 41)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/41-workbench-for-real-repos/docs/en.md
// Run: npx tsx phases/14-agent-engineering/41-workbench-for-real-repos/code/main.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HERE = __dirname;
const SAMPLE = join(HERE, "sample_app");

const SAMPLE_APP_PY = `"""Minimal signup handler. Treat as production-ish for this exercise."""

USERS: dict[str, str] = {}


def signup(email: str, password: str) -> dict[str, object]:
    USERS[email] = password
    return {"status": 200, "email": email}
`;

const SAMPLE_TEST_PY = `from sample_app.app import signup


def test_signup_happy_path():
    out = signup("a@b.co", "longenough")
    assert out["status"] == 200
`;

interface TaskOutcome {
  pipeline: string;
  tests_actually_run: boolean;
  acceptance_met: boolean;
  files_outside_scope: string[];
  handoff_quality: string;
  reviewer_total: number;
}

const ALLOWED = new Set(["sample_app/app.py", "sample_app/test_app.py"]);
const FORBIDDEN = new Set(["sample_app/scripts/release.sh"]);

function pyFormat(value: string | number | boolean | string[]): string {
  if (typeof value === "boolean") return value ? "True" : "False";
  if (Array.isArray(value)) return "[" + value.map((s) => `'${s}'`).join(", ") + "]";
  return String(value);
}

function runPromptOnly(): TaskOutcome {
  const touched = ["sample_app/app.py", "README.md", "sample_app/scripts/release.sh"];
  return {
    pipeline: "prompt-only",
    tests_actually_run: false,
    acceptance_met: false,
    files_outside_scope: touched.filter((p) => !ALLOWED.has(p)),
    handoff_quality: "missing",
    reviewer_total: 3,
  };
}

function runWorkbench(): TaskOutcome {
  const touched = ["sample_app/app.py", "sample_app/test_app.py"];
  return {
    pipeline: "workbench-guided",
    tests_actually_run: true,
    acceptance_met: true,
    files_outside_scope: touched.filter((p) => !ALLOWED.has(p)),
    handoff_quality: "full packet",
    reviewer_total: 9,
  };
}

function writeReport(po: TaskOutcome, wb: TaskOutcome): void {
  const lines = [
    "# Before / After: Agent Workbench on a Real Repo",
    "",
    "Same task. Same sample app. Two pipelines.",
    "",
    "| Outcome | Prompt only | Workbench |",
    "|---------|-------------|-----------|",
    `| tests_actually_run | ${pyFormat(po.tests_actually_run)} | ${pyFormat(wb.tests_actually_run)} |`,
    `| acceptance_met | ${pyFormat(po.acceptance_met)} | ${pyFormat(wb.acceptance_met)} |`,
    `| files_outside_scope | ${po.files_outside_scope.length} | ${wb.files_outside_scope.length} |`,
    `| handoff_quality | ${po.handoff_quality} | ${wb.handoff_quality} |`,
    `| reviewer_total (/10) | ${po.reviewer_total} | ${wb.reviewer_total} |`,
    "",
    "## Read",
    "",
    "Prompt only writes outside scope, claims done without running the acceptance command, " +
      "leaves no handoff, and scores low on review. Workbench keeps writes in scope, runs the " +
      "acceptance command through the feedback runner, passes the verification gate, and ships " +
      "a handoff packet the next session loads on startup.",
  ];
  writeFileSync(join(HERE, "before-after-report.md"), lines.join("\n") + "\n");
}

function writeSample(): void {
  mkdirSync(SAMPLE, { recursive: true });
  writeFileSync(join(SAMPLE, "app.py"), SAMPLE_APP_PY);
  writeFileSync(join(SAMPLE, "test_app.py"), SAMPLE_TEST_PY);
  writeFileSync(join(SAMPLE, "README.md"), "# sample app\n\nForbidden zone for agent tasks.\n");
  mkdirSync(join(SAMPLE, "scripts"), { recursive: true });
  writeFileSync(join(SAMPLE, "scripts", "release.sh"), "#!/usr/bin/env bash\necho release\n");
}

function main(): void {
  writeSample();
  const po = runPromptOnly();
  const wb = runWorkbench();

  for (const outcome of [po, wb]) {
    console.log(`=== ${outcome.pipeline} ===`);
    for (const [k, v] of Object.entries(outcome)) {
      console.log(`  ${k}: ${pyFormat(v as string | number | boolean | string[])}`);
    }
    console.log();
  }

  writeReport(po, wb);
  writeFileSync(join(HERE, "comparison.json"), JSON.stringify({ prompt_only: po, workbench: wb }, null, 2) + "\n");
}

main();
