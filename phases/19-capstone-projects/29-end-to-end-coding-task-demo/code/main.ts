// Lesson: Capstone Lesson 29: End-to-End Coding Agent on the Harness (phase 19 / lesson 29)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/29-end-to-end-coding-task-demo/docs/en.md
// Run: npx tsx phases/19-capstone-projects/29-end-to-end-coding-task-demo/code/main.ts

import { spawnSync } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  utimesSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { constants, tmpdir } from "node:os";
import { basename, dirname, delimiter, isAbsolute, join, sep } from "node:path";
import { performance } from "node:perf_hooks";

function pyFloat(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  const abs = Math.abs(x);
  if (Number.isInteger(x) && abs < 1e16) return x.toFixed(1);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e16)) {
    const m = /^(-?[\d.]+)e([+-])(\d+)$/.exec(x.toExponential());
    if (m) return `${m[1]}e${m[2]}${m[3].padStart(2, "0")}`;
  }
  return String(x);
}

function pyRepr(s: string): string {
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

function pyList(items: readonly string[]): string {
  return "[" + items.map(pyRepr).join(", ") + "]";
}

function pyLen(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

function jsonDumps(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : pyFloat(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(jsonDumps).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return "{" + Object.keys(obj).map((k) => JSON.stringify(k) + ":" + jsonDumps(obj[k])).join(",") + "}";
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pyRealpath(p: string): string {
  const parts = p.split(sep).filter((c) => c !== "");
  let resolved = isAbsolute(p) ? sep : realpathSync(".");
  for (const comp of parts) {
    if (comp === ".") continue;
    if (comp === "..") {
      resolved = dirname(resolved);
      continue;
    }
    const candidate = join(resolved, comp);
    let isLink = false;
    try {
      isLink = lstatSync(candidate).isSymbolicLink();
    } catch {
      isLink = false;
    }
    resolved = isLink ? realpathSync(candidate) : candidate;
  }
  return resolved;
}

function findPython(): string {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, "python3");
    if (existsSync(candidate)) return candidate;
  }
  return "python3";
}

const PYTHON_EXECUTABLE = findPython();

class Observation {
  constructor(
    public turn: number,
    public tool: string,
    public text: string,
    public tokens: number,
  ) {}
}

class ObservationLedger {
  rows: Observation[] = [];

  record(obs: Observation): void {
    this.rows.push(obs);
  }

  cumulative(): number {
    return this.rows.reduce((acc, r) => acc + r.tokens, 0);
  }
}

function estimateTokens(text: string): number {
  return !text ? 0 : Math.max(1, Math.floor(pyLen(text) / 4));
}

class ToolCall {
  constructor(
    public readonly turn: number,
    public readonly tool: string,
    public readonly argv: readonly string[],
    public readonly payload: string = "",
  ) {}
}

class GateDecision {
  constructor(
    public readonly allow: boolean,
    public readonly gate: string,
    public readonly reason: string,
  ) {}
}

class GateContext {
  constructor(
    public ledger: ObservationLedger,
    public currentTurn: number,
  ) {}
}

interface Gate {
  name: string;
  evaluate(call: ToolCall, ctx: GateContext): GateDecision;
}

class WhitelistGate implements Gate {
  constructor(
    public allowed: ReadonlySet<string>,
    public name = "whitelist",
  ) {}

  evaluate(call: ToolCall, _ctx: GateContext): GateDecision {
    if (this.allowed.has(call.tool)) return new GateDecision(true, this.name, "tool in allow-set");
    return new GateDecision(false, this.name, `tool ${pyRepr(call.tool)} not in allow-set`);
  }
}

class RegexGate implements Gate {
  constructor(
    public patterns: { source: string; re: RegExp }[],
    public name = "regex",
  ) {}

  static fromStrings(items: readonly string[]): RegexGate {
    return new RegexGate(items.map((p) => ({ source: p, re: new RegExp(p) })));
  }

  evaluate(call: ToolCall, _ctx: GateContext): GateDecision {
    const haystack = call.argv.join(" ") + " " + call.payload;
    for (const pat of this.patterns) {
      if (pat.re.test(haystack)) {
        return new GateDecision(false, this.name, `refused pattern ${pyRepr(pat.source)}`);
      }
    }
    return new GateDecision(true, this.name, "clean");
  }
}

class BudgetGate implements Gate {
  constructor(
    public maxTokens: number,
    public name = "budget",
  ) {}

  evaluate(_call: ToolCall, ctx: GateContext): GateDecision {
    const used = ctx.ledger.cumulative();
    if (used >= this.maxTokens) {
      return new GateDecision(false, this.name, `observation budget exhausted: ${used}/${this.maxTokens}`);
    }
    return new GateDecision(true, this.name, `${this.maxTokens - used} remaining`);
  }
}

class ChainOutcome {
  constructor(public decisions: GateDecision[]) {}

  get allow(): boolean {
    return this.decisions.every((d) => d.allow);
  }

  get denyReason(): string | null {
    for (const d of this.decisions) {
      if (!d.allow) return `[${d.gate}] ${d.reason}`;
    }
    return null;
  }
}

class GateChain {
  constructor(public gates: readonly Gate[]) {}

  evaluate(call: ToolCall, ctx: GateContext): ChainOutcome {
    const decisions: GateDecision[] = [];
    for (const gate of this.gates) {
      const decision = gate.evaluate(call, ctx);
      decisions.push(decision);
      if (!decision.allow) return new ChainOutcome(decisions);
    }
    return new ChainOutcome(decisions);
  }
}

const DENIED_EXIT = -100;
const TIMED_OUT_EXIT = -101;

class SandboxResult {
  stdout: Buffer = Buffer.alloc(0);
  stderr: Buffer = Buffer.alloc(0);
  denied = false;
  timedOut = false;
  reason = "";
  durationMs = 0.0;

  constructor(
    public argv: string[],
    public exitCode: number,
    extra: Partial<Pick<SandboxResult, "stdout" | "stderr" | "denied" | "timedOut" | "reason" | "durationMs">> = {},
  ) {
    Object.assign(this, extra);
  }

  get ok(): boolean {
    return this.exitCode === 0 && !this.denied && !this.timedOut;
  }
}

class Sandbox {
  projectRoot: string;
  timeoutSeconds: number;
  maxOutputBytes: number;
  denylist: ReadonlySet<string>;

  constructor(opts: { projectRoot: string; timeoutSeconds?: number; maxOutputBytes?: number; denylist?: ReadonlySet<string> }) {
    this.projectRoot = pyRealpath(opts.projectRoot);
    this.timeoutSeconds = opts.timeoutSeconds ?? 10.0;
    this.maxOutputBytes = opts.maxOutputBytes ?? 32 * 1024;
    this.denylist = opts.denylist ?? new Set(["rm", "sudo", "mkfs", "dd", "curl", "wget", "chmod", "kill"]);
  }

  private pathJail(argv: string[]): string | null {
    for (const arg of argv.slice(1)) {
      if (!arg || arg.startsWith("-")) continue;
      if (!arg.includes("/") && !arg.includes("..")) continue;
      const candidate = isAbsolute(arg) ? arg : join(this.projectRoot, arg);
      const resolved = pyRealpath(candidate);
      if (resolved !== this.projectRoot && !resolved.startsWith(this.projectRoot + sep)) {
        return `path ${pyRepr(arg)} resolves outside root`;
      }
    }
    return null;
  }

  run(argv: string[]): SandboxResult {
    if (argv.length === 0) {
      return new SandboxResult(argv, DENIED_EXIT, { denied: true, reason: "empty argv" });
    }
    const name = basename(argv[0]);
    if (this.denylist.has(name)) {
      return new SandboxResult(argv, DENIED_EXIT, { denied: true, reason: `executable ${pyRepr(name)} on denylist` });
    }
    const jail = this.pathJail(argv);
    if (jail !== null) {
      return new SandboxResult(argv, DENIED_EXIT, { denied: true, reason: jail });
    }
    const started = performance.now();
    const proc = spawnSync(argv[0], argv.slice(1), {
      cwd: this.projectRoot,
      timeout: this.timeoutSeconds * 1000,
      maxBuffer: 64 * 1024 * 1024,
    });
    const err = proc.error as NodeJS.ErrnoException | undefined;
    if (err && err.code === "ETIMEDOUT") {
      return new SandboxResult(argv, TIMED_OUT_EXIT, {
        timedOut: true,
        reason: `wall-clock timeout after ${pyFloat(this.timeoutSeconds)}s`,
        durationMs: performance.now() - started,
      });
    }
    if (err && err.code === "ENOENT") {
      return new SandboxResult(argv, DENIED_EXIT, {
        denied: true,
        reason: `not found: [Errno 2] No such file or directory: ${pyRepr(argv[0])}`,
        durationMs: performance.now() - started,
      });
    }
    if (err) throw err;
    const elapsed = performance.now() - started;
    const out = (proc.stdout ?? Buffer.alloc(0)).subarray(0, this.maxOutputBytes);
    const errOut = (proc.stderr ?? Buffer.alloc(0)).subarray(0, this.maxOutputBytes);
    const code = proc.status ?? (proc.signal ? -constants.signals[proc.signal] : 0);
    return new SandboxResult(argv, code, { stdout: out, stderr: errOut, durationMs: elapsed });
  }
}

const STATUS_OK = "OK";
const STATUS_ERROR = "ERROR";
const STATUS_UNSET = "UNSET";

type Attrs = Record<string, string | number | boolean>;

class GenAISpan {
  endUnixNano = 0n;
  attributes: Attrs = {};
  status = STATUS_UNSET;
  statusMessage = "";

  constructor(
    public traceId: string,
    public spanId: string,
    public parentSpanId: string,
    public name: string,
    public startUnixNano: bigint,
  ) {}

  get durationMs(): number {
    if (this.endUnixNano <= 0n) return 0.0;
    return Number(this.endUnixNano - this.startUnixNano) / 1_000_000.0;
  }

  toDict(): Record<string, unknown> {
    return {
      trace_id: this.traceId,
      span_id: this.spanId,
      parent_span_id: this.parentSpanId,
      name: this.name,
      start_unix_nano: this.startUnixNano,
      end_unix_nano: this.endUnixNano,
      duration_ms: Math.round(this.durationMs * 1e4) / 1e4,
      attributes: { ...this.attributes },
      status: { code: this.status, message: this.statusMessage },
    };
  }
}

function hex32(): string {
  return randomUUID().replaceAll("-", "");
}

function newTraceId(): string {
  return hex32();
}

function newSpanId(): string {
  return hex32().slice(0, 16);
}

const wallBase = BigInt(Date.now()) * 1_000_000n - process.hrtime.bigint();
function timeNs(): bigint {
  return wallBase + process.hrtime.bigint();
}

interface Exporter {
  export(span: GenAISpan): void;
}

class InMemoryExporter implements Exporter {
  spans: GenAISpan[] = [];

  export(span: GenAISpan): void {
    this.spans.push(span);
  }
}

class JSONLExporter implements Exporter {
  fd: number | null = null;

  constructor(public path: string) {}

  export(span: GenAISpan): void {
    if (this.fd === null) {
      mkdirSync(dirname(this.path) || ".", { recursive: true });
      this.fd = openSync(this.path, "a");
    }
    writeSync(this.fd, jsonDumps(span.toDict()) + "\n");
  }

  close(): void {
    if (this.fd !== null) {
      closeSync(this.fd);
      this.fd = null;
    }
  }
}

type LabelKey = [string, string][];

function labelKey(labels: Record<string, string>): LabelKey {
  return Object.entries(labels).sort((a, b) => cmpStr(a[0], b[0]) || cmpStr(a[1], b[1]));
}

function cmpKey(a: LabelKey, b: LabelKey): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const c = cmpStr(a[i][0], b[i][0]) || cmpStr(a[i][1], b[i][1]);
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

class Counter {
  values = new Map<string, { key: LabelKey; value: number }>();

  constructor(public name: string) {}

  inc(labels: Record<string, string>): void {
    const key = labelKey(labels);
    const ks = JSON.stringify(key);
    const entry = this.values.get(ks);
    if (entry) entry.value += 1.0;
    else this.values.set(ks, { key, value: 1.0 });
  }

  get(labels: Record<string, string>): number {
    return this.values.get(JSON.stringify(labelKey(labels)))?.value ?? 0.0;
  }
}

class Histogram {
  buckets: number[] = [5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0, 5000.0];
  samples = new Map<string, { key: LabelKey; values: number[] }>();

  constructor(public name: string) {}

  observe(value: number, labels: Record<string, string>): void {
    const key = labelKey(labels);
    const ks = JSON.stringify(key);
    const entry = this.samples.get(ks);
    if (entry) entry.values.push(value);
    else this.samples.set(ks, { key, values: [value] });
  }

  totalCount(labels: Record<string, string>): number {
    return this.samples.get(JSON.stringify(labelKey(labels)))?.values.length ?? 0;
  }
}

class MetricsRegistry {
  counters = new Map<string, Counter>();
  histograms = new Map<string, Histogram>();

  counter(name: string): Counter {
    let c = this.counters.get(name);
    if (!c) {
      c = new Counter(name);
      this.counters.set(name, c);
    }
    return c;
  }

  histogram(name: string): Histogram {
    let h = this.histograms.get(name);
    if (!h) {
      h = new Histogram(name);
      this.histograms.set(name, h);
    }
    return h;
  }
}

function labelStr(entries: [string, string][]): string {
  return "{" + entries.map(([k, v]) => `${k}="${v}"`).join(",") + "}";
}

function prometheusText(reg: MetricsRegistry): string {
  const lines: string[] = [];
  for (const cname of [...reg.counters.keys()].sort(cmpStr)) {
    const c = reg.counters.get(cname) as Counter;
    lines.push(`# TYPE ${c.name} counter`);
    for (const { key, value } of [...c.values.values()].sort((a, b) => cmpKey(a.key, b.key))) {
      const lbl = key.length ? labelStr(key) : "";
      lines.push(`${c.name}${lbl} ${pyFloat(value)}`);
    }
  }
  for (const hname of [...reg.histograms.keys()].sort(cmpStr)) {
    const h = reg.histograms.get(hname) as Histogram;
    lines.push(`# TYPE ${h.name} histogram`);
    for (const { key, values: sampleList } of [...h.samples.values()].sort((a, b) => cmpKey(a.key, b.key))) {
      const labelDict = Object.fromEntries(key);
      for (const bound of h.buckets) {
        const count = sampleList.filter((v) => v <= bound).length;
        const inner = { ...labelDict, le: bound === Math.trunc(bound) ? String(Math.trunc(bound)) : pyFloat(bound) };
        lines.push(`${h.name}_bucket${labelStr(labelKey(inner))} ${count}`);
      }
      const infInner = { ...labelDict, le: "+Inf" };
      lines.push(`${h.name}_bucket${labelStr(labelKey(infInner))} ${sampleList.length}`);
      const baseLbl = Object.keys(labelDict).length ? labelStr(labelKey(labelDict)) : "";
      lines.push(`${h.name}_count${baseLbl} ${sampleList.length}`);
      lines.push(`${h.name}_sum${baseLbl} ${pyFloat(sampleList.reduce((a, b) => a + b, 0))}`);
    }
  }
  return lines.join("\n") + "\n";
}

function errorTypeName(exc: unknown): string {
  return exc instanceof Error ? exc.name : "Exception";
}

function errorMessage(exc: unknown): string {
  return exc instanceof Error ? exc.message : String(exc);
}

class SpanBuilder {
  traceId: string = newTraceId();
  exporters: Exporter[];
  metrics: MetricsRegistry | null;

  constructor(opts: { exporters?: Exporter[]; metrics?: MetricsRegistry | null } = {}) {
    this.exporters = opts.exporters ?? [];
    this.metrics = opts.metrics ?? null;
  }

  span<T>(name: string, opts: { attributes?: Attrs; parent?: GenAISpan }, body: (span: GenAISpan) => T): T {
    const span = new GenAISpan(this.traceId, newSpanId(), opts.parent ? opts.parent.spanId : "", name, timeNs());
    span.attributes = { ...(opts.attributes ?? {}) };
    try {
      const result = body(span);
      span.status = STATUS_OK;
      return result;
    } catch (exc) {
      span.status = STATUS_ERROR;
      span.statusMessage = `${errorTypeName(exc)}: ${errorMessage(exc)}`;
      throw exc;
    } finally {
      span.endUnixNano = timeNs();
      for (const exp of this.exporters) exp.export(span);
      if (this.metrics !== null) {
        const tool = span.attributes["gen_ai.tool.name"];
        if (tool !== undefined) {
          this.metrics.counter("tools_called_total").inc({ tool: String(tool) });
          this.metrics.histogram("tool_latency_ms").observe(span.durationMs, { tool: String(tool) });
        }
      }
    }
  }
}

class AgentStep {
  constructor(
    public index: number,
    public state: string,
    public tool: string,
    public argv: readonly string[],
    public allow: boolean,
    public denyReason: string,
    public exitCode: number,
    public notes: string = "",
  ) {}

  toDict(): Record<string, unknown> {
    return {
      index: this.index,
      state: this.state,
      tool: this.tool,
      argv: [...this.argv],
      allow: this.allow,
      deny_reason: this.denyReason,
      exit_code: this.exitCode,
      notes: this.notes,
    };
  }
}

class AgentRunReport {
  constructor(
    public steps: AgentStep[],
    public solved: boolean,
    public haltedReason: string,
    public observationTokens: number,
    public maxObservationBudget: number,
    public refusedLegalToolCalls: number,
  ) {}

  toDict(): Record<string, unknown> {
    return {
      solved: this.solved,
      halted_reason: this.haltedReason,
      step_count: this.steps.length,
      observation_tokens: this.observationTokens,
      max_observation_budget: this.maxObservationBudget,
      refused_legal_tool_calls: this.refusedLegalToolCalls,
      steps: this.steps.map((s) => s.toDict()),
    };
  }
}

type Action = [string, readonly string[], string];

const FIZZ_FIX = "def fizz(n):\n" + "    return [i if i % 3 else 'fizz' for i in range(1, n + 1)]\n";

class CodingAgentPolicy {
  static STATES = ["SURVEY", "RUN_TESTS", "INSPECT", "FIX", "VERIFY", "HALT"] as const;

  state = "SURVEY";
  lastTestStderr = "";
  identifiedBugFile: string | null = null;
  identifiedFix: string | null = null;
  testsPassed = false;

  constructor(public repoRoot: string) {}

  nextAction(_lastObs: Observation | null): Action {
    if (this.state === "SURVEY") return ["read_file", ["src/fizz.py"], ""];
    if (this.state === "RUN_TESTS") {
      return ["run_tests", [PYTHON_EXECUTABLE, "-m", "unittest", "tests/test_fizz.py"], ""];
    }
    if (this.state === "INSPECT") return ["read_file", ["tests/test_fizz.py"], ""];
    if (this.state === "FIX") {
      if (this.identifiedBugFile === null || this.identifiedFix === null) throw new Error("AssertionError");
      return ["write_file", [this.identifiedBugFile], this.identifiedFix];
    }
    if (this.state === "VERIFY") {
      return ["run_tests", [PYTHON_EXECUTABLE, "-m", "unittest", "tests/test_fizz.py"], ""];
    }
    return ["noop", [], ""];
  }

  observe(tool: string, exitCode: number, text: string): void {
    if (this.state === "SURVEY" && tool === "read_file") {
      this.state = "RUN_TESTS";
      return;
    }
    if (this.state === "RUN_TESTS" && tool === "run_tests") {
      if (exitCode === 0) {
        this.testsPassed = true;
        this.state = "HALT";
        return;
      }
      this.lastTestStderr = text;
      this.state = "INSPECT";
      return;
    }
    if (this.state === "INSPECT" && tool === "read_file") {
      if (this.lastTestStderr.includes("expected") && this.lastTestStderr.toLowerCase().includes("fizz")) {
        this.identifiedBugFile = "src/fizz.py";
        this.identifiedFix = FIZZ_FIX;
      } else {
        this.identifiedBugFile = "src/fizz.py";
        this.identifiedFix = FIZZ_FIX;
      }
      this.state = "FIX";
      return;
    }
    if (this.state === "FIX" && tool === "write_file") {
      this.state = "VERIFY";
      return;
    }
    if (this.state === "VERIFY" && tool === "run_tests") {
      this.testsPassed = exitCode === 0;
      this.state = "HALT";
      return;
    }
    return;
  }
}

function toolReadFile(sandbox: Sandbox, argv: readonly string[]): [number, string] {
  const path = argv[0];
  const full = join(sandbox.projectRoot, path);
  const real = pyRealpath(full);
  if (!(real === sandbox.projectRoot || real.startsWith(sandbox.projectRoot + sep))) {
    return [DENIED_EXIT, `path ${pyRepr(path)} outside root`];
  }
  if (!existsSync(real) || !statSync(real).isFile()) return [1, `file not found: ${path}`];
  return [0, readFileSync(real, "utf-8")];
}

function toolWriteFile(sandbox: Sandbox, argv: readonly string[], payload: string): [number, string] {
  const path = argv[0];
  const full = join(sandbox.projectRoot, path);
  const real = dirname(full) ? pyRealpath(dirname(full)) : sandbox.projectRoot;
  if (!(real === sandbox.projectRoot || real.startsWith(sandbox.projectRoot + sep))) {
    return [DENIED_EXIT, `dir ${pyRepr(path)} outside root`];
  }
  mkdirSync(dirname(full) || sandbox.projectRoot, { recursive: true });
  writeFileSync(full, payload, "utf-8");
  return [0, `wrote ${pyLen(payload)} bytes to ${path}`];
}

function toolRunTests(sandbox: Sandbox, argv: readonly string[]): [number, string] {
  const result = sandbox.run([...argv]);
  if (result.denied) return [DENIED_EXIT, result.reason];
  if (result.timedOut) return [TIMED_OUT_EXIT, result.reason];
  const out = result.stdout.toString("utf-8") + result.stderr.toString("utf-8");
  return [result.exitCode, out];
}

function fixtureRoot(): string {
  return join(__dirname, "fixture_repo");
}

function mkdtemp(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789_";
  for (;;) {
    let suffix = "";
    for (let i = 0; i < 8; i++) suffix += chars[randomInt(chars.length)];
    const candidate = join(tmpdir(), prefix + suffix);
    try {
      mkdirSync(candidate, { mode: 0o700 });
      return candidate;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
}

function copyTree(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    const from = join(src, entry.name);
    const to = join(dst, entry.name);
    copyFileSync(from, to);
    const st = statSync(from);
    utimesSync(to, st.atime, st.mtime);
  }
  for (const entry of entries) {
    if (entry.isDirectory()) copyTree(join(src, entry.name), join(dst, entry.name));
  }
}

function prepareScratchRepo(): string {
  const scratch = mkdtemp("agent-e2e-");
  copyTree(fixtureRoot(), scratch);
  return scratch;
}

class AgentRun {
  repoRoot: string;
  chain: GateChain;
  sandbox: Sandbox;
  builder: SpanBuilder;
  observationBudget: number;
  stepBudget: number;

  constructor(opts: {
    repoRoot: string;
    chain: GateChain;
    sandbox: Sandbox;
    builder: SpanBuilder;
    observationBudget?: number;
    stepBudget?: number;
  }) {
    this.repoRoot = opts.repoRoot;
    this.chain = opts.chain;
    this.sandbox = opts.sandbox;
    this.builder = opts.builder;
    this.observationBudget = opts.observationBudget ?? 4000;
    this.stepBudget = opts.stepBudget ?? 12;
  }

  run(): AgentRunReport {
    const policy = new CodingAgentPolicy(this.repoRoot);
    const ledger = new ObservationLedger();
    const steps: AgentStep[] = [];
    let refusedLegal = 0;
    let haltedReason = "";
    let solved = false;
    let lastObs: Observation | null = null;

    this.builder.span(
      "gen_ai.chat",
      {
        attributes: {
          "gen_ai.system": "track-a-harness",
          "gen_ai.request.model": "deterministic-policy",
          "gen_ai.operation.name": "chat",
        },
      },
      (chatSpan) => {
        let broke = false;
        for (let stepIndex = 0; stepIndex < this.stepBudget; stepIndex++) {
          if (policy.state === "HALT") {
            haltedReason = "policy reached HALT";
            solved = policy.testsPassed;
            broke = true;
            break;
          }
          const [tool, argv, payload] = policy.nextAction(lastObs);
          if (tool === "noop") {
            haltedReason = "policy emitted noop";
            broke = true;
            break;
          }
          const turn = stepIndex + 1;
          const call = new ToolCall(turn, tool, argv, payload);
          const ctx = new GateContext(ledger, turn);
          const outcome = this.chain.evaluate(call, ctx);
          if (!outcome.allow) {
            refusedLegal += 1;
            steps.push(new AgentStep(stepIndex, policy.state, tool, argv, false, outcome.denyReason ?? "", DENIED_EXIT, "gate refused"));
            haltedReason = `gate refused: ${outcome.denyReason}`;
            broke = true;
            break;
          }

          const [exitCode, text] = this.builder.span(
            "gen_ai.tool.execution",
            {
              parent: chatSpan,
              attributes: {
                "gen_ai.tool.name": tool,
                "gen_ai.tool.call.id": `call_${String(stepIndex).padStart(3, "0")}`,
              },
            },
            (toolSpan): [number, string] => {
              let res: [number, string];
              if (tool === "read_file") res = toolReadFile(this.sandbox, argv);
              else if (tool === "write_file") res = toolWriteFile(this.sandbox, argv, payload);
              else if (tool === "run_tests") res = toolRunTests(this.sandbox, argv);
              else res = [DENIED_EXIT, `unknown tool ${pyRepr(tool)}`];
              toolSpan.attributes["gen_ai.tool.result.bytes"] = pyLen(res[1]);
              toolSpan.attributes["exit_code"] = res[0];
              return res;
            },
          );

          const obs = new Observation(turn, tool, text, estimateTokens(text));
          ledger.record(obs);
          lastObs = obs;

          steps.push(new AgentStep(stepIndex, policy.state, tool, argv, true, "", exitCode, `obs_tokens=${obs.tokens}`));

          if (ledger.cumulative() > this.observationBudget) {
            haltedReason = `observation budget ${this.observationBudget} exceeded`;
            broke = true;
            break;
          }

          policy.observe(tool, exitCode, text);
        }
        if (!broke) haltedReason = haltedReason || "step budget exhausted";
      },
    );

    return new AgentRunReport(steps, solved, haltedReason, ledger.cumulative(), this.observationBudget, refusedLegal);
  }
}

function buildDefaultChain(budget = 4000): GateChain {
  return new GateChain([
    new WhitelistGate(new Set(["read_file", "write_file", "run_tests"])),
    RegexGate.fromStrings(["\\brm\\s+-rf\\b", "\\bsudo\\b", "^/etc/"]),
    new BudgetGate(budget),
  ]);
}

function runDemo(): number {
  const repo = prepareScratchRepo();
  console.log("END-TO-END CODING AGENT DEMO");
  console.log(`scratch repo: ${repo}`);
  console.log("");

  const chain = buildDefaultChain(8000);
  const sandbox = new Sandbox({ projectRoot: repo, timeoutSeconds: 10.0 });
  const metrics = new MetricsRegistry();
  const inMem = new InMemoryExporter();
  const tracesPath = join(repo, "traces.jsonl");
  const jsonl = new JSONLExporter(tracesPath);
  const builder = new SpanBuilder({ exporters: [inMem, jsonl], metrics });

  const runner = new AgentRun({
    repoRoot: repo,
    chain,
    sandbox,
    builder,
    observationBudget: 8000,
    stepBudget: 12,
  });
  const report = runner.run();
  jsonl.close();

  const pyBool = (b: boolean): string => (b ? "True" : "False");
  console.log(`solved=${pyBool(report.solved)} halted=${report.haltedReason}`);
  console.log(
    `steps=${report.steps.length} obs_tokens=${report.observationTokens}/` +
      `${report.maxObservationBudget} refused_legal=${report.refusedLegalToolCalls}`,
  );
  console.log("");
  console.log("steps:");
  for (const step of report.steps) {
    const verdict = step.allow && step.exitCode === 0 ? "ok" : `exit=${step.exitCode}`;
    console.log(`  [${step.index}] ${step.state.padEnd(10)} ${step.tool.padEnd(11)} argv=${pyList(step.argv)} -> ${verdict}`);
  }

  console.log("");
  console.log(`spans emitted: ${inMem.spans.length} (jsonl at ${tracesPath})`);
  console.log("");
  console.log("--- prometheus exposition (excerpt) ---");
  const text = prometheusText(metrics);
  const excerpt: string[] = [];
  for (const line of text.split("\n")) {
    if (
      line.startsWith("tools_called_total") ||
      line.startsWith("# TYPE tools_called_total") ||
      line.startsWith("# TYPE tool_latency_ms") ||
      line.includes("tool_latency_ms_count") ||
      line.includes("tool_latency_ms_sum")
    ) {
      excerpt.push(line);
    }
  }
  console.log(excerpt.join("\n"));

  if (!report.solved) {
    console.error(`ERROR: agent did not solve fixture: ${report.haltedReason}`);
    return 1;
  }
  if (report.steps.length >= 12) {
    console.error(`ERROR: agent used too many steps: ${report.steps.length}`);
    return 1;
  }
  if (report.observationTokens > report.maxObservationBudget) {
    console.error("ERROR: observation budget exceeded");
    return 1;
  }
  if (report.refusedLegalToolCalls !== 0) {
    console.error("ERROR: agent fired denied tool calls");
    return 1;
  }
  return 0;
}

process.exitCode = runDemo();
