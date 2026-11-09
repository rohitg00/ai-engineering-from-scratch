// Lesson: Agent Workbench Engineering: Why Capable Models Still Fail (phase 14 / lesson 31)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/31-agent-workbench-why-models-fail/docs/en.md
// Run: npx tsx phases/14-agent-engineering/31-agent-workbench-why-models-fail/code/main.ts

import { writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const WORKBENCH_SURFACES = ["instructions", "state", "scope", "feedback", "verification", "review", "handoff"];

type Report = Record<string, string | boolean | string[]>;

function pyStr(s: string): string {
  if (s.includes("'") && !s.includes('"')) return `"${s}"`;
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function pyValue(v: string | boolean | string[]): string {
  if (typeof v === "boolean") return v ? "True" : "False";
  if (Array.isArray(v)) return "[" + v.map(pyStr).join(", ") + "]";
  return v;
}

interface RepoTask {
  description: string;
  allowedFiles: string[];
  forbiddenFiles: string[];
  acceptance: string[];
}

class RunResult {
  surfacesPresent: string[] = [];
  filesTouched: string[] = [];
  testsRun = false;
  declaredSuccess = false;
  actuallyPassing = false;
  notes: string[] = [];

  constructor(public label: string) {}

  missingSurfaces(): string[] {
    return WORKBENCH_SURFACES.filter((s) => !this.surfacesPresent.includes(s));
  }
}

function stubAgent(task: RepoTask, surfaces: string[]): RunResult {
  const result = new RunResult(surfaces.length === 0 ? "prompt-only" : "workbench");
  result.surfacesPresent = [...surfaces];

  const hasScope = surfaces.includes("scope");
  const hasState = surfaces.includes("state");
  const hasVerification = surfaces.includes("verification");
  const hasFeedback = surfaces.includes("feedback");

  if (hasScope) {
    result.filesTouched = [...task.allowedFiles];
  } else {
    result.filesTouched = [...task.allowedFiles, "README.md", "scripts/release.sh"];
    result.notes.push("touched unrelated files because scope was missing");
  }

  if (hasFeedback) {
    result.testsRun = true;
    result.notes.push("captured stdout/stderr/exit code from the test run");
  } else {
    result.notes.push("never ran the test command, guessed at output");
  }

  if (hasVerification) {
    result.actuallyPassing = true;
    result.declaredSuccess = true;
    result.notes.push("verification gate proved acceptance criteria met");
  } else {
    result.declaredSuccess = true;
    result.actuallyPassing = false;
    result.notes.push("declared success without running acceptance checks");
  }

  if (!hasState) result.notes.push("no state file written, next session restarts from zero");

  return result;
}

function failureReport(result: RunResult): Report {
  const allowed = new Set(["app.py", "test_app.py"]);
  return {
    label: result.label,
    missing_surfaces: result.missingSurfaces(),
    off_scope_writes: result.filesTouched.filter((f) => !allowed.has(f)),
    tests_run: result.testsRun,
    declared_success: result.declaredSuccess,
    actually_passing: result.actuallyPassing,
    notes: result.notes,
  };
}

function main(): void {
  const task: RepoTask = {
    description: "add input validation to /signup and a passing test",
    allowedFiles: ["app.py", "test_app.py"],
    forbiddenFiles: ["README.md", "scripts/release.sh"],
    acceptance: ["test_app.py::test_signup_rejects_short_password passes"],
  };

  const promptOnly = stubAgent(task, []);
  const workbench = stubAgent(task, WORKBENCH_SURFACES);

  console.log("=== prompt only ===");
  for (const [k, v] of Object.entries(failureReport(promptOnly))) console.log(`  ${k}: ${pyValue(v)}`);
  console.log();
  console.log("=== workbench ===");
  for (const [k, v] of Object.entries(failureReport(workbench))) console.log(`  ${k}: ${pyValue(v)}`);

  const out = join(__dirname, "..", "outputs", "failure_modes.json");
  writeFileSync(out, JSON.stringify(failureReport(promptOnly), null, 2) + "\n");
  const root = dirname(dirname(dirname(dirname(dirname(out)))));
  console.log(`\nwrote ${relative(root, out)}`);
}

main();
