// Lesson: Capstone Lesson 28: Observability with OTel GenAI Spans and Prometheus Metrics (phase 19 / lesson 28)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/28-observability-otel-traces/docs/en.md
// Run: npx tsx phases/19-capstone-projects/28-observability-otel-traces/code/main.ts

import { randomUUID } from "node:crypto";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const GEN_AI_SYSTEM = "gen_ai.system";
const GEN_AI_REQUEST_MODEL = "gen_ai.request.model";
const GEN_AI_REQUEST_MAX_TOKENS = "gen_ai.request.max_tokens";
const GEN_AI_REQUEST_TEMPERATURE = "gen_ai.request.temperature";
const GEN_AI_USAGE_INPUT_TOKENS = "gen_ai.usage.input_tokens";
const GEN_AI_USAGE_OUTPUT_TOKENS = "gen_ai.usage.output_tokens";
const GEN_AI_RESPONSE_MODEL = "gen_ai.response.model";
const GEN_AI_RESPONSE_ID = "gen_ai.response.id";
const GEN_AI_OPERATION_NAME = "gen_ai.operation.name";
const GEN_AI_TOOL_NAME = "gen_ai.tool.name";
const GEN_AI_TOOL_CALL_ID = "gen_ai.tool.call.id";
const GEN_AI_TOOL_RESULT_BYTES = "gen_ai.tool.result.bytes";

const HARNESS_GATE_DECISION = "agent.harness.gate.decision";
const HARNESS_GATE_REASON = "agent.harness.gate.reason";

const STATUS_UNSET = "UNSET";
const STATUS_OK = "OK";
const STATUS_ERROR = "ERROR";

type AttrValue = string | number | boolean | bigint;
type Attrs = Record<string, AttrValue>;

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

function pyStrRepr(s: string): string {
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

const sleepCell = new Int32Array(new SharedArrayBuffer(4));
function sleep(seconds: number): void {
  Atomics.wait(sleepCell, 0, 0, seconds * 1000);
}

class SpanEvent {
  constructor(
    public name: string,
    public timestampUnixNano: bigint,
    public attributes: Attrs = {},
  ) {}

  toDict(): Record<string, unknown> {
    return {
      name: this.name,
      timestamp_unix_nano: this.timestampUnixNano,
      attributes: { ...this.attributes },
    };
  }
}

class GenAISpan {
  endUnixNano = 0n;
  parentSpanId = "";
  attributes: Attrs = {};
  events: SpanEvent[] = [];
  status = STATUS_UNSET;
  statusMessage = "";
  kind = "INTERNAL";

  constructor(
    public traceId: string,
    public spanId: string,
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
      kind: this.kind,
      start_unix_nano: this.startUnixNano,
      end_unix_nano: this.endUnixNano,
      duration_ms: Math.round(this.durationMs * 1e4) / 1e4,
      attributes: { ...this.attributes },
      events: this.events.map((e) => e.toDict()),
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
function nowUnixNano(): bigint {
  return wallBase + process.hrtime.bigint();
}

interface Exporter {
  export(span: GenAISpan): void;
  close(): void;
}

class JSONLExporter implements Exporter {
  fd: number | null = null;
  closed = false;

  constructor(public path: string) {}

  ensureOpen(): number {
    if (this.fd === null) {
      mkdirSync(dirname(this.path) || ".", { recursive: true });
      this.fd = openSync(this.path, "a");
    }
    return this.fd;
  }

  export(span: GenAISpan): void {
    const fd = this.ensureOpen();
    writeSync(fd, jsonDumps(span.toDict()) + "\n");
  }

  close(): void {
    if (this.fd !== null && !this.closed) {
      closeSync(this.fd);
      this.closed = true;
    }
  }
}

class InMemoryExporter implements Exporter {
  spans: GenAISpan[] = [];

  export(span: GenAISpan): void {
    this.spans.push(span);
  }

  close(): void {
    return;
  }
}

type LabelKey = [string, string][];

function labelKey(labels: Record<string, string>): LabelKey {
  return Object.entries(labels).sort((a, b) => cmpTuple(a, b));
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function cmpTuple(a: [string, string], b: [string, string]): number {
  return cmpStr(a[0], b[0]) || cmpStr(a[1], b[1]);
}

function cmpKey(a: LabelKey, b: LabelKey): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const c = cmpTuple(a[i], b[i]);
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

function keyStr(k: LabelKey): string {
  return JSON.stringify(k);
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  const parts: string[] = [];
  for (const [k, v] of entries.sort((a, b) => cmpTuple(a, b))) {
    const escaped = String(v).replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
    parts.push(`${k}="${escaped}"`);
  }
  return "{" + parts.join(",") + "}";
}

class Counter {
  values = new Map<string, { key: LabelKey; value: number }>();

  constructor(
    public name: string,
    public help = "",
  ) {}

  inc(labels: Record<string, string> = {}, by = 1.0): void {
    const key = labelKey(labels);
    const ks = keyStr(key);
    const entry = this.values.get(ks);
    if (entry) entry.value += by;
    else this.values.set(ks, { key, value: by });
  }

  get(labels: Record<string, string> = {}): number {
    return this.values.get(keyStr(labelKey(labels)))?.value ?? 0.0;
  }
}

class Histogram {
  buckets: number[] = [5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0, 2500.0, 5000.0, 10000.0];
  samples = new Map<string, { key: LabelKey; values: number[] }>();

  constructor(
    public name: string,
    public help = "",
  ) {}

  observe(value: number, labels: Record<string, string> = {}): void {
    const key = labelKey(labels);
    const ks = keyStr(key);
    const entry = this.samples.get(ks);
    if (entry) entry.values.push(value);
    else this.samples.set(ks, { key, values: [value] });
  }

  private valuesFor(labels: Record<string, string>): number[] {
    return this.samples.get(keyStr(labelKey(labels)))?.values ?? [];
  }

  bucketCounts(labels: Record<string, string> = {}): Map<number, number> {
    const values = this.valuesFor(labels);
    const counts = new Map<number, number>();
    for (const bound of this.buckets) counts.set(bound, values.filter((v) => v <= bound).length);
    counts.set(Infinity, values.length);
    return counts;
  }

  totalCount(labels: Record<string, string> = {}): number {
    return this.valuesFor(labels).length;
  }

  totalSum(labels: Record<string, string> = {}): number {
    let s = 0;
    for (const v of this.valuesFor(labels)) s += v;
    return s;
  }
}

class MetricsRegistry {
  counters = new Map<string, Counter>();
  histograms = new Map<string, Histogram>();

  counter(name: string, help = ""): Counter {
    let c = this.counters.get(name);
    if (!c) {
      c = new Counter(name, help);
      this.counters.set(name, c);
    }
    return c;
  }

  histogram(name: string, help = ""): Histogram {
    let h = this.histograms.get(name);
    if (!h) {
      h = new Histogram(name, help);
      this.histograms.set(name, h);
    }
    return h;
  }
}

function prometheusExposition(registry: MetricsRegistry): string {
  const lines: string[] = [];
  for (const name of [...registry.counters.keys()].sort(cmpStr)) {
    const counter = registry.counters.get(name) as Counter;
    if (counter.help) lines.push(`# HELP ${counter.name} ${counter.help}`);
    lines.push(`# TYPE ${counter.name} counter`);
    if (counter.values.size === 0) lines.push(`${counter.name} 0`);
    const entries = [...counter.values.values()].sort((a, b) => cmpKey(a.key, b.key));
    for (const { key, value } of entries) {
      lines.push(`${counter.name}${formatLabels(Object.fromEntries(key))} ${pyFloat(value)}`);
    }
  }
  for (const name of [...registry.histograms.keys()].sort(cmpStr)) {
    const hist = registry.histograms.get(name) as Histogram;
    if (hist.help) lines.push(`# HELP ${hist.name} ${hist.help}`);
    lines.push(`# TYPE ${hist.name} histogram`);
    const keys: LabelKey[] = [...hist.samples.values()].map((e) => e.key);
    if (keys.length === 0) keys.push([]);
    for (const key of keys.sort(cmpKey)) {
      const labelDict = Object.fromEntries(key);
      const counts = hist.bucketCounts(labelDict);
      for (const bound of hist.buckets) {
        const bucketLabels = { ...labelDict, le: formatLe(bound) };
        lines.push(`${hist.name}_bucket${formatLabels(bucketLabels)} ${counts.get(bound)}`);
      }
      const infLabels = { ...labelDict, le: "+Inf" };
      lines.push(`${hist.name}_bucket${formatLabels(infLabels)} ${counts.get(Infinity)}`);
      lines.push(`${hist.name}_sum${formatLabels(labelDict)} ${pyFloat(hist.totalSum(labelDict))}`);
      lines.push(`${hist.name}_count${formatLabels(labelDict)} ${hist.totalCount(labelDict)}`);
    }
  }
  return lines.join("\n") + "\n";
}

function formatLe(bound: number): string {
  if (bound === Math.trunc(bound)) return String(Math.trunc(bound));
  return pyFloat(bound);
}

function errorTypeName(exc: unknown): string {
  if (exc instanceof Error) return exc.name;
  return "Exception";
}

function errorMessage(exc: unknown): string {
  if (exc instanceof Error) return exc.message;
  return String(exc);
}

interface SpanOptions {
  attributes?: Attrs;
  parent?: GenAISpan;
  kind?: string;
}

class SpanBuilder {
  traceId: string = newTraceId();
  exporters: Exporter[];
  metrics: MetricsRegistry | null;

  constructor(opts: { exporters?: Exporter[]; metrics?: MetricsRegistry | null } = {}) {
    this.exporters = opts.exporters ?? [];
    this.metrics = opts.metrics ?? null;
  }

  span<T>(name: string, opts: SpanOptions, body: (span: GenAISpan) => T): T {
    const span = new GenAISpan(this.traceId, newSpanId(), name, nowUnixNano());
    span.parentSpanId = opts.parent ? opts.parent.spanId : "";
    span.kind = opts.kind ?? "INTERNAL";
    span.attributes = { ...(opts.attributes ?? {}) };
    try {
      const result = body(span);
      span.status = STATUS_OK;
      return result;
    } catch (exc) {
      span.status = STATUS_ERROR;
      span.statusMessage = `${errorTypeName(exc)}: ${errorMessage(exc)}`;
      span.events.push(
        new SpanEvent("exception", nowUnixNano(), {
          "exception.type": errorTypeName(exc),
          "exception.message": errorMessage(exc),
        }),
      );
      throw exc;
    } finally {
      span.endUnixNano = nowUnixNano();
      for (const exporter of this.exporters) exporter.export(span);
      if (this.metrics !== null) {
        const tool = span.attributes[GEN_AI_TOOL_NAME];
        if (tool !== undefined) {
          this.metrics.counter("tools_called_total", "Total tool calls").inc({ tool: String(tool) });
          this.metrics
            .histogram("tool_latency_ms", "Tool call latency in milliseconds")
            .observe(span.durationMs, { tool: String(tool) });
        }
      }
    }
  }
}

class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

function runDemo(): number {
  const tmpDir = mkdtempSync(join(tmpdir(), "otel-demo-"));
  const tracePath = join(tmpDir, "traces.jsonl");

  const jsonl = new JSONLExporter(tracePath);
  const metrics = new MetricsRegistry();
  const inMem = new InMemoryExporter();
  const builder = new SpanBuilder({ exporters: [jsonl, inMem], metrics });

  console.log("OBSERVABILITY DEMO");
  console.log(`trace_id=${builder.traceId}`);
  console.log(`writing traces to ${tracePath}`);

  builder.span(
    "gen_ai.chat",
    {
      attributes: {
        [GEN_AI_SYSTEM]: "anthropic",
        [GEN_AI_REQUEST_MODEL]: "claude-track-a",
        [GEN_AI_REQUEST_MAX_TOKENS]: 1024,
        [GEN_AI_REQUEST_TEMPERATURE]: 0.0,
        [GEN_AI_OPERATION_NAME]: "chat",
      },
      kind: "CLIENT",
    },
    (chatSpan) => {
      sleep(0.01);
      chatSpan.attributes[GEN_AI_USAGE_INPUT_TOKENS] = 412;
      chatSpan.attributes[GEN_AI_USAGE_OUTPUT_TOKENS] = 96;
      chatSpan.attributes[GEN_AI_RESPONSE_MODEL] = "claude-track-a-2026-05-25";
      chatSpan.attributes[GEN_AI_RESPONSE_ID] = "msg_" + hex32().slice(0, 8);

      builder.span(
        "gen_ai.tool.execution",
        {
          parent: chatSpan,
          attributes: { [GEN_AI_TOOL_NAME]: "read_file", [GEN_AI_TOOL_CALL_ID]: "call_001" },
        },
        (tool1) => {
          sleep(0.005);
          tool1.attributes[GEN_AI_TOOL_RESULT_BYTES] = 1024;
          tool1.events.push(
            new SpanEvent("agent.harness.gate.decision", nowUnixNano(), {
              [HARNESS_GATE_DECISION]: "ALLOW",
              [HARNESS_GATE_REASON]: "passed gate chain",
            }),
          );
        },
      );

      builder.span(
        "gen_ai.tool.execution",
        {
          parent: chatSpan,
          attributes: { [GEN_AI_TOOL_NAME]: "run_tests", [GEN_AI_TOOL_CALL_ID]: "call_002" },
        },
        (tool2) => {
          sleep(0.003);
          tool2.attributes[GEN_AI_TOOL_RESULT_BYTES] = 256;
        },
      );
    },
  );

  try {
    builder.span(
      "gen_ai.tool.execution",
      { attributes: { [GEN_AI_TOOL_NAME]: "shell", [GEN_AI_TOOL_CALL_ID]: "call_003" } },
      (badTool) => {
        badTool.events.push(
          new SpanEvent("agent.harness.gate.decision", nowUnixNano(), {
            [HARNESS_GATE_DECISION]: "DENY",
            [HARNESS_GATE_REASON]: "tool not in allow-set",
          }),
        );
        throw new PermissionError("tool 'shell' not in allow-set");
      },
    );
  } catch (exc) {
    if (!(exc instanceof PermissionError)) throw exc;
  }

  console.log("");
  console.log(`emitted ${inMem.spans.length} span(s):`);
  for (const span of inMem.spans) {
    const keys = Object.keys(span.attributes)
      .filter((k) => k.startsWith("gen_ai."))
      .sort(cmpStr)
      .slice(0, 3);
    console.log(
      `  - ${span.name.padEnd(32)} dur=${span.durationMs.toFixed(2).padStart(7)}ms ` +
        `status=${span.status} keys=[${keys.map(pyStrRepr).join(", ")}]`,
    );
  }

  console.log("");
  console.log("--- prometheus exposition ---");
  console.log(prometheusExposition(metrics));

  jsonl.close();

  const lines = readFileSync(tracePath, "utf-8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as unknown);
  console.log(`roundtrip parsed ${lines.length} spans from ${tracePath}`);

  return 0;
}

process.exitCode = runDemo();
