import { randomBytes } from "node:crypto";
import type { Counters, GenAISpan } from "./types.js";

const TRACE_ID_RE = /^[0-9a-f]{32}$/;
const SPAN_ID_RE = /^[0-9a-f]{16}$/;

function canonicalTraceId(s: unknown): string {
  if (typeof s === "string") {
    const norm = s.replace(/-/g, "").toLowerCase();
    if (TRACE_ID_RE.test(norm)) return norm;
  }
  return randomBytes(16).toString("hex");
}

function canonicalSpanId(s: unknown): string {
  if (typeof s === "string") {
    const norm = s.replace(/-/g, "").toLowerCase();
    if (SPAN_ID_RE.test(norm)) return norm;
  }
  return randomBytes(8).toString("hex");
}

function validTokenField(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
}

const TOKEN_KEYS = [
  "gen_ai.request.prompt_tokens",
  "gen_ai.usage.input_tokens",
  "gen_ai.request.completion_tokens",
  "gen_ai.usage.output_tokens",
  "gen_ai.usage.total_tokens",
];

export class RingBuffer<T> {
  private readonly capacity: number;
  private readonly slots: (T | undefined)[];
  private writeIdx = 0;
  private filled = false;

  constructor(capacity: number) {
    if (capacity <= 0) throw new Error("capacity は 0 より大きい必要があります");
    this.capacity = capacity;
    this.slots = new Array<T | undefined>(capacity);
  }

  push(item: T): void {
    this.slots[this.writeIdx] = item;
    this.writeIdx = (this.writeIdx + 1) % this.capacity;
    if (this.writeIdx === 0) this.filled = true;
  }

  size(): number {
    return this.filled ? this.capacity : this.writeIdx;
  }

  isFull(): boolean {
    return this.filled;
  }

  snapshot(): T[] {
    if (!this.filled) return this.slots.slice(0, this.writeIdx) as T[];
    return [
      ...(this.slots.slice(this.writeIdx) as T[]),
      ...(this.slots.slice(0, this.writeIdx) as T[]),
    ];
  }
}

export function normaliseSpan(raw: unknown): GenAISpan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const attrs = (r["attributes"] ?? {}) as Record<string, unknown>;
  if (typeof attrs["gen_ai.system"] !== "string") return null;
  if (typeof attrs["gen_ai.request.model"] !== "string") return null;
  const start = Number(r["start_time_unix_nano"] ?? 0);
  const end = Number(r["end_time_unix_nano"] ?? start);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end < start) return null;
  for (const key of TOKEN_KEYS) {
    if (!validTokenField(attrs[key])) return null;
  }
  const span: GenAISpan = {
    trace_id: canonicalTraceId(r["trace_id"]),
    span_id: canonicalSpanId(r["span_id"]),
    name: typeof r["name"] === "string" ? r["name"] : "chat.completion",
    start_time_unix_nano: start,
    end_time_unix_nano: end,
    status: r["status"] === "ERROR" ? "ERROR" : "OK",
    attributes: attrs as GenAISpan["attributes"],
  };
  if (typeof r["parent_span_id"] === "string") {
    const pid = canonicalSpanId(r["parent_span_id"]);
    span.parent_span_id = pid;
  }
  return span;
}

export class ObservabilityStore {
  private readonly spans: RingBuffer<GenAISpan>;
  private accepted = 0;
  private rejected = 0;

  constructor(capacity = 10_000) {
    this.spans = new RingBuffer<GenAISpan>(capacity);
  }

  ingest(raw: unknown): Counters {
    const items = Array.isArray(raw) ? raw : [raw];
    for (const item of items) {
      const span = normaliseSpan(item);
      if (!span) {
        this.rejected += 1;
        continue;
      }
      this.spans.push(span);
      this.accepted += 1;
    }
    return this.counters();
  }

  snapshot(): GenAISpan[] {
    return this.spans.snapshot();
  }

  counters(): Counters {
    return {
      accepted: this.accepted,
      rejected: this.rejected,
      held: this.spans.size(),
    };
  }
}
