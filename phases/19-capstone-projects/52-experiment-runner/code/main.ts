// Lesson: Experiment Runner (phase 19 / lesson 52)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/52-experiment-runner/docs/en.md
// Run: npx tsx phases/19-capstone-projects/52-experiment-runner/code/main.ts

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { constants, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { performance } from "node:perf_hooks";

class PyFloat {
  constructor(readonly v: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const fl = (v: number): PyFloat => new PyFloat(v);

function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expStr] = x.toExponential().split("e");
  const exp = Number(expStr);
  const neg = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  let body: string;
  if (exp < -4 || exp >= 16) {
    const frac = digits.length > 1 ? "." + digits.slice(1) : "";
    body = digits[0] + frac + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  } else if (exp < 0) {
    body = "0." + "0".repeat(-exp - 1) + digits;
  } else if (digits.length <= exp + 1) {
    body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
  } else {
    body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  }
  return (neg ? "-" : "") + body;
}

function fmtFixed(x: number, n: number): string {
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  const wide = a.toFixed(Math.min(100, n + 30));
  const dot = wide.indexOf(".");
  const tail = wide.slice(dot + 1 + n);
  let out = a.toFixed(n);
  if (/^50*$/.test(tail)) {
    const head = wide.slice(0, dot + 1 + n);
    const trimmed = n === 0 ? head.slice(0, -1) : head;
    if (Number(trimmed[trimmed.length - 1]) % 2 === 0) out = trimmed;
  }
  return (neg ? "-" : "") + out;
}

function pyRound(x: number, n: number): number {
  return Number(fmtFixed(x, n));
}

function jsonStr(s: string): string {
  return (
    '"' +
    s.replace(/[\\"\u0000-\u001f\u007f-￿]/g, (c) => {
      if (c === '"') return '\\"';
      if (c === "\\") return "\\\\";
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      if (c === "\b") return "\\b";
      if (c === "\f") return "\\f";
      return "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    }) +
    '"'
  );
}

function pyDumps(v: Json, indent: number | null = null, level = 0): string {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (v instanceof PyFloat) return pyFloatRepr(v.v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (typeof v === "string") return jsonStr(v);
  let open: string;
  let close: string;
  let items: string[];
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    open = "[";
    close = "]";
    items = v.map((x) => pyDumps(x, indent, level + 1));
  } else {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    open = "{";
    close = "}";
    items = keys.map((k) => jsonStr(k) + ": " + pyDumps(v[k], indent, level + 1));
  }
  if (indent === null) return open + items.join(", ") + close;
  const pad = "\n" + " ".repeat(indent * (level + 1));
  return open + pad + items.join("," + pad) + "\n" + " ".repeat(indent * level) + close;
}

let memoryPollerUnsupportedWarned = false;

class ExperimentSpec {
  seed = 0;
  wall_timeout_s = 30.0;
  memory_cap_mb = 512;
  metric_keys: string[] = [];

  constructor(
    public spec_id: string,
    public hypothesis_id: number,
    public script_path: string,
    public config: Obj,
    init: Partial<Pick<ExperimentSpec, "seed" | "wall_timeout_s" | "memory_cap_mb" | "metric_keys">> = {},
  ) {
    Object.assign(this, init);
  }

  toDict(): Obj {
    return {
      spec_id: this.spec_id,
      hypothesis_id: this.hypothesis_id,
      script_path: this.script_path,
      config: { ...this.config },
      seed: this.seed,
      wall_timeout_s: fl(this.wall_timeout_s),
      memory_cap_mb: this.memory_cap_mb,
      metric_keys: [...this.metric_keys],
    };
  }
}

class ExperimentResult {
  constructor(
    public spec_id: string,
    public hypothesis_id: number,
    public exit_code: number,
    public terminal: string,
    public wall_time_s: number,
    public peak_rss_mb: number | null,
    public metrics: Obj,
    public intermediate_metrics: Obj[],
    public stdout_tail: string,
    public stderr_tail: string,
  ) {}

  toDict(): Obj {
    return {
      spec_id: this.spec_id,
      hypothesis_id: this.hypothesis_id,
      exit_code: this.exit_code,
      terminal: this.terminal,
      wall_time_s: fl(pyRound(this.wall_time_s, 4)),
      peak_rss_mb: this.peak_rss_mb === null ? null : fl(pyRound(this.peak_rss_mb, 2)),
      metrics: { ...this.metrics },
      intermediate_metrics: this.intermediate_metrics.map((m) => ({ ...m })),
      stdout_tail: this.stdout_tail.slice(-400),
      stderr_tail: this.stderr_tail.slice(-400),
    };
  }
}

function which(cmd: string): boolean {
  return (process.env["PATH"] ?? "").split(delimiter).some((dir) => dir && existsSync(join(dir, cmd)));
}

function rssMb(pid: number): number | null {
  const procStatus = `/proc/${pid}/status`;
  if (existsSync(procStatus)) {
    try {
      for (const line of readFileSync(procStatus, "utf-8").split("\n")) {
        if (line.startsWith("VmRSS:")) {
          const parts = line.split(/\s+/).filter(Boolean);
          if (parts.length >= 2) return Number(parts[1]) / 1024.0;
        }
      }
    } catch {
      return null;
    }
    return 0.0;
  }
  if (which("ps")) {
    const out = spawnSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf-8", timeout: 2000 });
    if (out.error) return null;
    const value = (out.stdout ?? "").trim();
    if (value) {
      const n = Number(value);
      return Number.isNaN(n) ? null : n / 1024.0;
    }
  }
  return null;
}

function procAlive(proc: ChildProcess): boolean {
  return proc.exitCode === null && proc.signalCode === null;
}

class MemoryPoller {
  peak_rss_mb: number | null = null;
  killed_for_oom = false;
  unsupported = false;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private proc: ChildProcess,
    private cap: number,
    private interval = 0.05,
  ) {}

  start(): void {
    this.tick();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) clearTimeout(this.timer);
  }

  private tick(): void {
    if (this.stopped || !procAlive(this.proc) || this.proc.pid === undefined) return;
    const rss = rssMb(this.proc.pid);
    if (rss === null) {
      this.unsupported = true;
      if (!memoryPollerUnsupportedWarned) {
        memoryPollerUnsupportedWarned = true;
        console.error(
          "memory poller disabled: platform does not expose RSS via /proc or ps; wall clock timeout still applies",
        );
      }
      return;
    }
    this.peak_rss_mb = this.peak_rss_mb === null ? rss : Math.max(this.peak_rss_mb, rss);
    if (rss > this.cap) {
      this.killed_for_oom = true;
      this.proc.kill("SIGKILL");
      return;
    }
    this.timer = setTimeout(() => this.tick(), this.interval * 1000);
  }
}

function isPlainObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function scanIntermediates(stdout: string, metricKeys: string[]): [Obj, Obj[]] {
  const intermediates: Obj[] = [];
  let final: Obj = {};
  const required = new Set(metricKeys);
  for (const rawLine of stdout.split(/\r\n|[\n\r\x0b\x0c\x1c-\x1e\x85\u2028\u2029]/)) {
    const line = rawLine.trim();
    if (!line.startsWith("{")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isPlainObj(parsed)) continue;
    if (required.size && ![...required].every((k) => k in parsed)) continue;
    if (Object.keys(final).length) intermediates.push(final);
    final = parsed;
  }
  return [final, intermediates];
}

interface ChildOutcome {
  code: number | null;
  stdout: string;
  stderr: string;
  error: Error | null;
}

function signalExitCode(signal: NodeJS.Signals | null): number | null {
  if (signal === null) return null;
  const num = (constants.signals as Record<string, number>)[signal];
  return num === undefined ? null : -num;
}

class ExperimentRunner {
  private runtime: string[];

  constructor(
    runtimePath: string[] | null = null,
    private pollInterval = 0.05,
  ) {
    this.runtime = runtimePath ?? [process.execPath, ...process.execArgv];
  }

  async run(spec: ExperimentSpec): Promise<ExperimentResult> {
    const workdir = mkdtempSync(join(tmpdir(), "exp_"));
    try {
      const configPath = join(workdir, "config.json");
      const mergedConfig: Obj = { ...spec.config, __seed: spec.seed };
      writeFileSync(configPath, pyDumps(mergedConfig), "utf-8");
      return await this.runSubprocess(spec, configPath);
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  }

  private runSubprocess(spec: ExperimentSpec, configPath: string): Promise<ExperimentResult> {
    const start = performance.now();
    return new Promise((resolve) => {
      const [cmd, ...rest] = this.runtime;
      const proc = spawn(cmd, [...rest, spec.script_path, configPath], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      proc.stdout?.setEncoding("utf-8").on("data", (d: string) => (stdout += d));
      proc.stderr?.setEncoding("utf-8").on("data", (d: string) => (stderr += d));
      let killedForTimeout = false;
      let settled = false;
      const poller = new MemoryPoller(proc, spec.memory_cap_mb, this.pollInterval);
      const timer = setTimeout(() => {
        killedForTimeout = true;
        proc.kill("SIGKILL");
      }, spec.wall_timeout_s * 1000);
      const finish = (outcome: ChildOutcome): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        poller.stop();
        const wall = (performance.now() - start) / 1000;
        if (outcome.error !== null) {
          resolve(
            new ExperimentResult(spec.spec_id, spec.hypothesis_id, -1, "crash", wall, null, {}, [], "", outcome.error.message),
          );
          return;
        }
        const [metrics, intermediates] = scanIntermediates(outcome.stdout, spec.metric_keys);
        const terminal = ExperimentRunner.terminalLabel(
          outcome.code,
          killedForTimeout,
          poller.killed_for_oom,
          Object.keys(metrics).length > 0,
        );
        resolve(
          new ExperimentResult(
            spec.spec_id,
            spec.hypothesis_id,
            outcome.code ?? -1,
            terminal,
            wall,
            poller.peak_rss_mb,
            metrics,
            intermediates,
            outcome.stdout,
            outcome.stderr,
          ),
        );
      };
      proc.on("error", (err) => finish({ code: null, stdout: "", stderr: "", error: err }));
      proc.on("close", (code, signal) =>
        finish({ code: code ?? signalExitCode(signal), stdout, stderr, error: null }),
      );
      poller.start();
    });
  }

  static terminalLabel(exitCode: number | null, timedOut: boolean, oomed: boolean, haveMetrics: boolean): string {
    if (oomed) return "oom";
    if (timedOut) return "timeout";
    if (exitCode === 0 && haveMetrics) return "ok";
    if (exitCode === 0 && !haveMetrics) return "crash";
    return "crash";
  }
}

function valueStr(value: Json): string {
  return typeof value === "string" ? value : pyDumps(value);
}

function ablate(base: ExperimentSpec, knob: string, values: Json[]): ExperimentSpec[] {
  const specs: ExperimentSpec[] = [];
  for (const value of values) {
    const derivedConfig: Obj = { ...base.config, [knob]: value };
    specs.push(
      new ExperimentSpec(`${base.spec_id}_${knob}_${valueStr(value)}`, base.hypothesis_id, base.script_path, derivedConfig, {
        seed: base.seed,
        wall_timeout_s: base.wall_timeout_s,
        memory_cap_mb: base.memory_cap_mb,
        metric_keys: [...base.metric_keys],
      }),
    );
  }
  return specs;
}

class AblationTable {
  constructor(
    public knob: string,
    public rows: [Json, ExperimentResult][],
  ) {}

  toDict(): Obj {
    return {
      knob: this.knob,
      rows: this.rows.map(([v, r]) => ({ value: v, result: r.toDict() })),
    };
  }
}

class AblationRunner {
  constructor(private runner: ExperimentRunner) {}

  async sweep(base: ExperimentSpec, knob: string, values: Json[]): Promise<AblationTable> {
    const valueList = [...values];
    const rows: [Json, ExperimentResult][] = [];
    const specs = ablate(base, knob, valueList);
    for (let i = 0; i < valueList.length; i++) {
      const result = await this.runner.run(specs[i]);
      rows.push([valueList[i], result]);
    }
    return new AblationTable(knob, rows);
  }
}

async function demo(): Promise<void> {
  const here = __dirname;
  const script = join(here, "experiments", "sparsity_experiment.ts");
  const base = new ExperimentSpec("demo_base", 1, script, { k: 16, steps: 4, sleep_s: fl(0.0) }, {
    seed: 7,
    wall_timeout_s: 15.0,
    memory_cap_mb: 256,
    metric_keys: ["perplexity", "final_loss"],
  });
  const runner = new ExperimentRunner();
  const baseResult = await runner.run(base);
  const sweep = await new AblationRunner(runner).sweep(base, "k", [4, 8, 16, 32]);
  console.log(
    pyDumps(
      {
        base: baseResult.toDict(),
        ablation: sweep.toDict(),
      },
      2,
    ),
  );
}

demo().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
