import { strict as assert } from "node:assert";
import { test } from "node:test";
import { percentile, rollUpByModel } from "../src/rollup.js";
import type { GenAISpan } from "../src/types.js";

function span(model: string, latencyMs: number, status: "OK" | "ERROR" = "OK"): GenAISpan {
  return {
    trace_id: `t-${model}-${latencyMs}`,
    span_id: `s-${model}-${latencyMs}`,
    name: "chat.completion",
    start_time_unix_nano: 0,
    end_time_unix_nano: latencyMs * 1e6,
    status,
    attributes: {
      "gen_ai.system": "openai",
      "gen_ai.request.model": model,
      "gen_ai.operation.name": "chat",
      "gen_ai.usage.input_tokens": 100,
      "gen_ai.usage.output_tokens": status === "OK" ? 50 : 0,
    },
  };
}

test("空 list の percentile は zero", () => {
  assert.equal(percentile([], 0.5), 0);
});

test("1..100 の percentile p50 はおよそ 50", () => {
  const arr = Array.from({ length: 100 }, (_, i) => i + 1);
  const p50 = percentile(arr, 0.5);
  assert.ok(p50 >= 49 && p50 <= 51);
});

test("1..100 の percentile p95 はおよそ 95", () => {
  const arr = Array.from({ length: 100 }, (_, i) => i + 1);
  const p95 = percentile(arr, 0.95);
  assert.ok(p95 >= 94 && p95 <= 96);
});

test("1..100 の percentile p99 はおよそ 99", () => {
  const arr = Array.from({ length: 100 }, (_, i) => i + 1);
  const p99 = percentile(arr, 0.99);
  assert.ok(p99 >= 98 && p99 <= 100);
});

test("p が増えると percentile は単調非減少になる", () => {
  const arr = Array.from({ length: 50 }, (_, i) => i + 1);
  let prev = -Infinity;
  for (const p of [0, 0.25, 0.5, 0.75, 0.95, 0.99, 1]) {
    const v = percentile(arr, p);
    assert.ok(v >= prev);
    prev = v;
  }
});

test("rollUpByModel は model ごとに span を group 化する", () => {
  const spans: GenAISpan[] = [
    span("gpt-4o-mini", 100),
    span("gpt-4o-mini", 200),
    span("claude-opus-4-7", 500),
  ];
  const rollups = rollUpByModel(spans);
  assert.equal(rollups.length, 2);
  const gpt = rollups.find((r) => r.model === "gpt-4o-mini");
  assert.equal(gpt?.count, 2);
});

test("rollUpByModel は model ごとに error を数える", () => {
  const spans: GenAISpan[] = [
    span("gpt-4o-mini", 100, "OK"),
    span("gpt-4o-mini", 200, "ERROR"),
    span("gpt-4o-mini", 300, "ERROR"),
  ];
  const rollups = rollUpByModel(spans);
  assert.equal(rollups[0]?.errors, 2);
});

test("rollUpByModel は既知 model に non-zero cost を出す", () => {
  const spans: GenAISpan[] = [
    span("gpt-4o-mini", 100),
    span("gpt-4o-mini", 200),
  ];
  const rollups = rollUpByModel(spans);
  assert.ok(rollups[0]!.costUsd > 0);
});
