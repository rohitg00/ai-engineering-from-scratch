// Lesson: OpenTelemetry GenAI: Tracing Tool Calls End-to-End (phase 13 / lesson 20)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/20-opentelemetry-genai/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/20-opentelemetry-genai/code/main.ts

import { randomUUID } from "node:crypto";

type Dict = { [key: string]: any };

class PyFloat {
  constructor(public readonly value: number) {}
}

function pyFloatRepr(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function pyJsonString(s: string): string {
  return JSON.stringify(s).replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function pyDumps(value: any): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof PyFloat) return pyFloatRepr(value.value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyJsonString(value);
  if (Array.isArray(value)) return "[" + value.map(pyDumps).join(", ") + "]";
  return "{" + Object.keys(value).map((k) => pyJsonString(k) + ": " + pyDumps(value[k])).join(", ") + "}";
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

function randint(low: number, high: number): number {
  return low + Math.floor(rng() * (high - low + 1));
}

const SLEEP_CELL = new Int32Array(new SharedArrayBuffer(4));

function sleep(seconds: number): void {
  Atomics.wait(SLEEP_CELL, 0, 0, seconds * 1000);
}

const WALL_OFFSET_NS = BigInt(Date.now()) * 1_000_000n - process.hrtime.bigint();

function time_ns(): bigint {
  return process.hrtime.bigint() + WALL_OFFSET_NS;
}

function uuidHex(): string {
  return randomUUID().replace(/-/g, "");
}

const CAPTURE_CONTENT = (process.env["OTEL_CAPTURE_CONTENT"] ?? "0") === "1";

function _hex(n_bytes: number): string {
  return uuidHex().slice(0, n_bytes * 2);
}

class Span {
  name: string;
  kind: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  start_ns: bigint;
  end_ns: bigint;
  attrs: Dict;
  events: Dict[];

  constructor(options: {
    name: string;
    kind: string;
    trace_id: string;
    span_id: string;
    parent_span_id?: string | null;
    start_ns?: bigint;
    end_ns?: bigint;
    attrs?: Dict;
    events?: Dict[];
  }) {
    this.name = options.name;
    this.kind = options.kind;
    this.trace_id = options.trace_id;
    this.span_id = options.span_id;
    this.parent_span_id = options.parent_span_id ?? null;
    this.start_ns = options.start_ns ?? 0n;
    this.end_ns = options.end_ns ?? 0n;
    this.attrs = options.attrs ?? {};
    this.events = options.events ?? [];
  }

  finish(): void {
    this.end_ns = time_ns();
  }

  add_event(name: string, attrs: Dict): void {
    this.events.push({ time: time_ns(), name, attrs });
  }

  to_otlp(): Dict {
    return {
      name: this.name,
      kind: this.kind,
      traceId: this.trace_id,
      spanId: this.span_id,
      parentSpanId: this.parent_span_id,
      startTimeUnixNano: this.start_ns,
      endTimeUnixNano: this.end_ns,
      attributes: this.attrs,
      events: this.events,
    };
  }
}

const SPANS: Span[] = [];

function start_span(name: string, kind: string, parent: Span | null = null, attrs: Dict | null = null): Span {
  const trace_id = parent ? parent.trace_id : _hex(16);
  const span = new Span({
    name,
    kind,
    trace_id,
    span_id: _hex(8),
    parent_span_id: parent ? parent.span_id : null,
    start_ns: time_ns(),
    attrs: attrs ?? {},
  });
  SPANS.push(span);
  return span;
}

function fake_llm_call(span: Span, prompt: string): string {
  sleep(0.05);
  const resp_id = `resp_${uuidHex().slice(0, 8)}`;
  Object.assign(span.attrs, {
    "gen_ai.response.id": resp_id,
    "gen_ai.response.model": "gpt-4o-2024-08-06",
    "gen_ai.usage.input_tokens": Math.floor(prompt.length / 4),
    "gen_ai.usage.output_tokens": randint(20, 80),
  });
  if (CAPTURE_CONTENT) {
    span.add_event("gen_ai.content.prompt", { content: [...prompt].slice(0, 200).join("") });
    span.add_event("gen_ai.content.completion", { content: "sample completion" });
  }
  return "sample completion";
}

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const c of s) {
    if (c === "\\") out += "\\\\";
    else if (c === quote) out += "\\" + c;
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else if (c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f) out += "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0");
    else out += c;
  }
  return quote + out + quote;
}

function pyReprArgs(args: { [key: string]: string }): string {
  return "{" + Object.keys(args).map((k) => pyStrRepr(k) + ": " + pyStrRepr(args[k])).join(", ") + "}";
}

function fake_tool_execute(span: Span, tool: string, args: { [key: string]: string }): Dict {
  sleep(0.03);
  Object.assign(span.attrs, {
    "gen_ai.tool.name": tool,
    "gen_ai.tool.call.id": `call_${uuidHex().slice(0, 8)}`,
  });
  return { content: [{ type: "text", text: `${tool} ran with ${pyReprArgs(args)}` }] };
}

function fake_mcp_call(parent: Span, tool: string): Dict {
  const mcp_span = start_span("mcp.call", "CLIENT", parent, {
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.tool.name": tool,
    "mcp.server": "notes",
    "mcp.transport": "stdio",
    "net.peer.name": "child_process",
  });
  const traceparent = `00-${mcp_span.trace_id}-${mcp_span.span_id}-01`;
  mcp_span.attrs["traceparent"] = traceparent;
  sleep(0.04);
  mcp_span.finish();
  return { tool, result: "ok" };
}

function agent_loop(): void {
  const root = start_span("agent.invoke_agent", "INTERNAL", null, {
    "gen_ai.operation.name": "invoke_agent",
    "gen_ai.agent.name": "research-agent",
    "gen_ai.agent.id": "agent_42",
  });

  const llm1 = start_span("llm.chat", "CLIENT", root, {
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": "openai",
    "gen_ai.request.model": "gpt-4o",
  });
  fake_llm_call(llm1, "user wants weather in three cities");
  llm1.finish();

  for (const city of ["Bengaluru", "Tokyo", "Zurich"]) {
    const tool_span = start_span("tool.execute", "INTERNAL", root, {
      "gen_ai.operation.name": "execute_tool",
    });
    fake_tool_execute(tool_span, "get_weather", { city });
    fake_mcp_call(tool_span, "get_weather");
    tool_span.finish();
  }

  const llm2 = start_span("llm.chat", "CLIENT", root, {
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": "openai",
    "gen_ai.request.model": "gpt-4o",
  });
  fake_llm_call(llm2, "synthesize three weather results");
  llm2.finish();

  root.finish();
}

function main(): void {
  console.log("=".repeat(72));
  console.log("PHASE 13 LESSON 19 - OTEL GENAI SPAN EMITTER");
  console.log(`  content capture : ${CAPTURE_CONTENT ? "ON" : "off (set OTEL_CAPTURE_CONTENT=1)"}`);
  console.log("=".repeat(72));

  agent_loop();

  console.log(`\nemitted ${SPANS.length} spans across 1 trace`);
  console.log(`\nOTLP-JSON-shaped spans:\n`);
  for (const span of SPANS) {
    const attrs: Dict = {};
    for (const [k, v] of Object.entries(span.attrs)) {
      if (k.startsWith("gen_ai")) attrs[k] = v;
    }
    const summary = {
      name: span.name,
      kind: span.kind,
      trace: span.trace_id.slice(0, 8) + "...",
      id: span.span_id.slice(0, 6) + "...",
      parent: (span.parent_span_id || "ROOT").slice(0, 6),
      duration_ms: new PyFloat(Number((Number(span.end_ns - span.start_ns) / 1_000_000).toFixed(2))),
      attrs,
      events: span.events.length,
    };
    console.log(pyDumps(summary));
  }

  console.log("\ntry: OTEL_CAPTURE_CONTENT=1 python code/main.py");
}

main();
