// Lesson: Capstone Lesson 27: Eval Harness with Fixture Tasks (phase 19 / lesson 27)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/27-eval-harness-fixture-tasks/docs/en.md
// Run: npx tsx phases/19-capstone-projects/27-eval-harness-fixture-tasks/code/main.ts

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { performance } from "node:perf_hooks";

class PyFloat {
  constructor(readonly v: number) {}
}

function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (Number.isInteger(x) && Math.abs(x) < 1e16) return x.toFixed(1);
  const s = String(x);
  return s.replace(/e([+-])(\d)$/, "e$10$2");
}

function pyJsonDumps(value: unknown, indent: number, level: number = 0): string {
  if (value instanceof PyFloat) return pyFloatRepr(value.v);
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  const pad = " ".repeat(indent * (level + 1));
  const close = " ".repeat(indent * level);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "[\n" + value.map((v) => pad + pyJsonDumps(v, indent, level + 1)).join(",\n") + "\n" + close + "]";
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return (
    "{\n" +
    entries.map(([k, v]) => `${pad}${JSON.stringify(k)}: ${pyJsonDumps(v, indent, level + 1)}`).join(",\n") +
    "\n" + close + "}"
  );
}

function pyRound(x: number, nd: number): PyFloat {
  return new PyFloat(Number(x.toFixed(nd)));
}

function pyRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === quote) out += "\\" + ch;
    else out += ch;
  }
  return quote + out + quote;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export class FixtureTask {
  constructor(
    public id: string,
    public goal: string,
    public setupDir: string,
    public expectedDir: string,
    public verifierName: string,
    public verifierArgs: Record<string, unknown>,
    public root: string = "",
  ) {}

  toDict(): Record<string, unknown> {
    return { id: this.id, goal: this.goal, verifier: this.verifierName };
  }
}

export class SampleResult {
  constructor(
    public taskId: string,
    public sampleIndex: number,
    public latencyMs: number,
    public costUnits: number = 0.0,
    public notes: string = "",
  ) {}

  toDict(): Record<string, unknown> {
    return {
      task_id: this.taskId,
      sample_index: this.sampleIndex,
      latency_ms: pyRound(this.latencyMs, 3),
      cost_units: new PyFloat(this.costUnits),
      notes: this.notes,
    };
  }
}

export class VerificationOutcome {
  constructor(public passed: boolean, public detail: string) {}
}

type SampleRow = {
  sample_index: number;
  latency_ms: PyFloat;
  cost_units: PyFloat;
  passed: boolean;
  detail: string;
  notes: string;
};

export class TaskReport {
  constructor(
    public taskId: string,
    public k: number,
    public passes: number,
    public passRate: number,
    public passAtK: number,
    public meanLatencyMs: number,
    public p95LatencyMs: number,
    public meanCost: number,
    public samples: SampleRow[] = [],
  ) {}

  toDict(): Record<string, unknown> {
    return {
      task_id: this.taskId,
      k: this.k,
      passes: this.passes,
      pass_rate: pyRound(this.passRate, 4),
      pass_at_k: pyRound(this.passAtK, 4),
      mean_latency_ms: pyRound(this.meanLatencyMs, 3),
      p95_latency_ms: pyRound(this.p95LatencyMs, 3),
      mean_cost: pyRound(this.meanCost, 4),
      samples: this.samples,
    };
  }
}

export class EvalReport {
  constructor(
    public taskReports: TaskReport[],
    public passAt1: number,
    public passAtK: number,
    public k: number,
    public meanLatencyMs: number,
    public p95LatencyMs: number,
    public totalCost: number,
  ) {}

  toDict(): Record<string, unknown> {
    return {
      k: this.k,
      pass_at_1: pyRound(this.passAt1, 4),
      pass_at_k: pyRound(this.passAtK, 4),
      mean_latency_ms: pyRound(this.meanLatencyMs, 3),
      p95_latency_ms: pyRound(this.p95LatencyMs, 3),
      total_cost: pyRound(this.totalCost, 4),
      tasks: this.taskReports.map((t) => t.toDict()),
    };
  }
}

export function passAtK(empiricalPassRate: number, k: number): number {
  if (k <= 0) return 0.0;
  const p = Math.max(0.0, Math.min(1.0, empiricalPassRate));
  return 1.0 - (1.0 - p) ** k;
}

function pyRoundHalfEven(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export function p95(values: number[]): number {
  if (values.length === 0) return 0.0;
  const sortedValues = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, pyRoundHalfEven(0.95 * sortedValues.length) - 1);
  return sortedValues[Math.min(idx, sortedValues.length - 1)];
}

export type Verifier = (task: FixtureTask, scratchDir: string, args: Record<string, unknown>) => VerificationOutcome;

export function verifyFileEquals(task: FixtureTask, scratchDir: string, args: Record<string, unknown>): VerificationOutcome {
  const rel = args.path;
  if (typeof rel !== "string") return new VerificationOutcome(false, "verifier args missing 'path'");
  const actual = path.join(scratchDir, rel);
  const expected = path.join(task.expectedDir, rel);
  if (!isFile(actual)) return new VerificationOutcome(false, `scratch file missing: ${rel}`);
  if (!isFile(expected)) return new VerificationOutcome(false, `expected file missing: ${rel}`);
  let actualText = fs.readFileSync(actual, "utf-8");
  let expectedText = fs.readFileSync(expected, "utf-8");
  const normalize = Boolean(args.normalize_trailing_newline ?? true);
  if (normalize) {
    actualText = actualText.replace(/\n+$/, "") + "\n";
    expectedText = expectedText.replace(/\n+$/, "") + "\n";
  }
  if (actualText === expectedText) return new VerificationOutcome(true, `file ${pyRepr(rel)} matches expected`);
  return new VerificationOutcome(false, `file ${pyRepr(rel)} differs from expected`);
}

export function verifyRegexMatch(_task: FixtureTask, scratchDir: string, args: Record<string, unknown>): VerificationOutcome {
  const rel = args.path;
  const pattern = args.pattern;
  if (typeof rel !== "string" || typeof pattern !== "string") {
    return new VerificationOutcome(false, "verifier args need 'path' and 'pattern'");
  }
  const actual = path.join(scratchDir, rel);
  if (!isFile(actual)) return new VerificationOutcome(false, `scratch file missing: ${rel}`);
  const text = fs.readFileSync(actual, "utf-8");
  if (new RegExp(pattern, "m").test(text)) {
    return new VerificationOutcome(true, `file ${pyRepr(rel)} matched ${pyRepr(pattern)}`);
  }
  return new VerificationOutcome(false, `file ${pyRepr(rel)} did not match ${pyRepr(pattern)}`);
}

export function verifyShellExitZero(_task: FixtureTask, scratchDir: string, args: Record<string, unknown>): VerificationOutcome {
  const argv = args.argv;
  if (!Array.isArray(argv) || argv.length === 0) return new VerificationOutcome(false, "verifier args need 'argv' list");
  const timeout = Number(args.timeout_seconds ?? 10.0);
  const [file, ...rest] = argv.map(String);
  const proc = spawnSync(file, rest, {
    cwd: scratchDir,
    timeout: timeout * 1000,
    killSignal: "SIGKILL",
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (proc.error !== undefined) {
    const code = (proc.error as NodeJS.ErrnoException).code;
    if (code === "ETIMEDOUT") return new VerificationOutcome(false, "shell command timed out");
    if (code === "ENOENT") {
      return new VerificationOutcome(false, `shell command not found: [Errno 2] No such file or directory: ${pyRepr(file)}`);
    }
    throw proc.error;
  }
  if (proc.status === 0) return new VerificationOutcome(true, "command exited zero");
  return new VerificationOutcome(false, `command exited ${proc.status ?? -9}`);
}

export const VERIFIER_REGISTRY: Record<string, Verifier> = {
  file_equals: verifyFileEquals,
  regex_match: verifyRegexMatch,
  shell_exit_zero: verifyShellExitZero,
};

type TaskSpec = {
  id: string;
  goal: string;
  verifier: { name: string; args?: Record<string, unknown> };
};

export function loadFixture(taskDir: string): FixtureTask {
  const specPath = path.join(taskDir, "task.json");
  const spec = JSON.parse(fs.readFileSync(specPath, "utf-8")) as TaskSpec;
  const setup = path.join(taskDir, "buggy");
  const expected = path.join(taskDir, "expected");
  return new FixtureTask(spec.id, spec.goal, setup, expected, spec.verifier.name, spec.verifier.args ?? {}, taskDir);
}

export function loadAllFixtures(tasksRoot: string): FixtureTask[] {
  const tasks: FixtureTask[] = [];
  for (const name of fs.readdirSync(tasksRoot).sort()) {
    const full = path.join(tasksRoot, name);
    if (isDir(full) && isFile(path.join(full, "task.json"))) tasks.push(loadFixture(full));
  }
  return tasks;
}

export type Candidate = (task: FixtureTask, scratchDir: string) => SampleResult;

function copyTree(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) {
      const from = path.join(src, e.name);
      const to = path.join(dst, e.name);
      fs.copyFileSync(from, to);
      const st = fs.statSync(from);
      fs.utimesSync(to, st.atime, st.mtime);
    }
  }
  for (const e of entries) {
    if (e.isDirectory()) copyTree(path.join(src, e.name), path.join(dst, e.name));
  }
}

export function applyKnownFixes(task: FixtureTask, scratchDir: string): SampleResult {
  const start = performance.now();
  if (isDir(task.expectedDir)) copyTree(task.expectedDir, scratchDir);
  const elapsed = performance.now() - start;
  return new SampleResult(task.id, 0, elapsed, 1.0, "reference candidate");
}

export function noopCandidate(task: FixtureTask, _scratchDir: string): SampleResult {
  const start = performance.now();
  const elapsed = performance.now() - start;
  return new SampleResult(task.id, 0, elapsed, 0.0, "noop");
}

export class EvalHarness {
  tasks: FixtureTask[];
  k: number;
  verifierRegistry: Record<string, Verifier>;

  constructor(tasks: FixtureTask[], k: number = 1, verifierRegistry?: Record<string, Verifier>) {
    this.tasks = tasks;
    this.k = k;
    this.verifierRegistry = verifierRegistry ?? { ...VERIFIER_REGISTRY };
  }

  private verify(task: FixtureTask, scratchDir: string): VerificationOutcome {
    const verifier = this.verifierRegistry[task.verifierName];
    if (verifier === undefined) return new VerificationOutcome(false, `unknown verifier ${pyRepr(task.verifierName)}`);
    return verifier(task, scratchDir, task.verifierArgs);
  }

  private prepareScratch(task: FixtureTask): string {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `eval-${task.id}-`));
    if (isDir(task.setupDir)) copyTree(task.setupDir, scratch);
    return scratch;
  }

  run(candidate: Candidate): EvalReport {
    const taskReports: TaskReport[] = [];
    for (const task of this.tasks) {
      const samples: SampleRow[] = [];
      const latencies: number[] = [];
      const costs: number[] = [];
      let passes = 0;
      for (let sampleIndex = 0; sampleIndex < this.k; sampleIndex++) {
        const scratch = this.prepareScratch(task);
        try {
          const sample = candidate(task, scratch);
          const outcome = this.verify(task, scratch);
          latencies.push(sample.latencyMs);
          costs.push(sample.costUnits);
          if (outcome.passed) passes += 1;
          samples.push({
            sample_index: sampleIndex,
            latency_ms: pyRound(sample.latencyMs, 3),
            cost_units: new PyFloat(sample.costUnits),
            passed: outcome.passed,
            detail: outcome.detail,
            notes: sample.notes,
          });
        } finally {
          fs.rmSync(scratch, { recursive: true, force: true });
        }
      }
      const passRate = this.k ? passes / this.k : 0.0;
      taskReports.push(
        new TaskReport(
          task.id,
          this.k,
          passes,
          passRate,
          passAtK(passRate, this.k),
          latencies.length > 0 ? mean(latencies) : 0.0,
          p95(latencies),
          costs.length > 0 ? mean(costs) : 0.0,
          samples,
        ),
      );
    }

    const perSamplePassAt1 = taskReports.map((r) => {
      if (r.k === 1) return r.passes > 0 ? 1.0 : 0.0;
      return Math.min(1.0, r.passRate);
    });
    const passAt1Value = perSamplePassAt1.length > 0 ? mean(perSamplePassAt1) : 0.0;
    const passAtKValue = taskReports.length > 0 ? mean(taskReports.map((r) => r.passAtK)) : 0.0;
    const allLatencies = taskReports.flatMap((r) => r.samples.map((s) => s.latency_ms.v));
    const totalCost = taskReports.flatMap((r) => r.samples.map((s) => s.cost_units.v)).reduce((a, b) => a + b, 0);
    return new EvalReport(
      taskReports,
      passAt1Value,
      passAtKValue,
      this.k,
      allLatencies.length > 0 ? mean(allLatencies) : 0.0,
      p95(allLatencies),
      totalCost,
    );
  }
}

function tasksDir(): string {
  return path.join(path.dirname(path.resolve(__filename)), "tasks");
}

export function runDemo(): number {
  const tasks = loadAllFixtures(tasksDir());
  if (tasks.length === 0) {
    console.error("ERROR: no fixture tasks found");
    return 1;
  }

  console.log("EVAL HARNESS DEMO");
  console.log(`loaded ${tasks.length} fixture task(s)`);
  console.log("");
  for (const t of tasks) console.log(`  - ${t.id.padEnd(32)} verifier=${t.verifierName}`);
  console.log("");

  console.log("running reference candidate (apply_known_fixes), k=1 ...");
  const harness = new EvalHarness(tasks, 1);
  const report = harness.run(applyKnownFixes);
  console.log(pyJsonDumps(report.toDict(), 2));

  if (report.passAt1 < 1.0) {
    console.error(`ERROR: reference candidate should pass all fixtures, got pass@1=${pyFloatRepr(report.passAt1)}`);
    return 1;
  }

  console.log("");
  console.log("running noop candidate (should fail every fixture), k=3 ...");
  const harnessNoop = new EvalHarness(tasks, 3);
  const noopReport = harnessNoop.run(noopCandidate);
  console.log(
    pyJsonDumps(
      {
        noop_pass_at_1: pyRound(noopReport.passAt1, 4),
        noop_pass_at_k: pyRound(noopReport.passAtK, 4),
        noop_k: noopReport.k,
      },
      2,
    ),
  );

  if (noopReport.passAt1 > 0.0) {
    console.error(`ERROR: noop candidate should fail, got pass@1=${pyFloatRepr(noopReport.passAt1)}`);
    return 1;
  }

  return 0;
}

process.exitCode = runDemo();
