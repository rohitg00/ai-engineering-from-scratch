import { spanCostUsd, spanLatencyMs, spanModel } from "./pricing.js";
import type { GenAISpan, ModelRollup } from "./types.js";

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = (sorted.length - 1) * p;
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const frac = rank - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

export function rollUpByModel(spans: GenAISpan[]): ModelRollup[] {
  const groups = new Map<string, GenAISpan[]>();
  for (const s of spans) {
    const model = spanModel(s);
    if (!groups.has(model)) groups.set(model, []);
    groups.get(model)!.push(s);
  }
  const rollups: ModelRollup[] = [];
  for (const [model, list] of groups) {
    const latencies = list.map(spanLatencyMs).sort((a, b) => a - b);
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let errors = 0;
    for (const s of list) {
      inputTokens += Number(s.attributes["gen_ai.usage.input_tokens"] ?? 0);
      outputTokens += Number(s.attributes["gen_ai.usage.output_tokens"] ?? 0);
      costUsd += spanCostUsd(s);
      if (s.status === "ERROR") errors += 1;
    }
    rollups.push({
      model,
      count: list.length,
      errors,
      inputTokens,
      outputTokens,
      costUsd: Number(costUsd.toFixed(4)),
      p50LatencyMs: Number(percentile(latencies, 0.5).toFixed(2)),
      p95LatencyMs: Number(percentile(latencies, 0.95).toFixed(2)),
      p99LatencyMs: Number(percentile(latencies, 0.99).toFixed(2)),
    });
  }
  rollups.sort((a, b) => b.count - a.count);
  return rollups;
}
