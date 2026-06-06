/**
 * LLM Observability Dashboard: capstone skeleton entry point (TypeScript).
 *
 * Implements the ingest plane from docs/en.md: a Hono server accepts OTel
 * GenAI-shaped spans on /trace, holds them in a 10k ring buffer, and renders
 * /dashboard plus /dashboard.json with p50/p95/p99 latency and cost per model.
 * Stands in for a real Langfuse/Phoenix backend, with the same span schema
 * so a real OTLP exporter could be pointed at it.
 *
 * Source: phases/19-capstone-projects/11-llm-observability-dashboard/docs/en.md
 * Schema: OpenTelemetry GenAI semantic conventions
 *   https://opentelemetry.io/docs/specs/semconv/gen-ai/
 */

import { serve } from "@hono/node-server";
import { rollUpByModel } from "./rollup.js";
import { buildApp } from "./server.js";
import { ObservabilityStore } from "./spans.js";
import type { GenAISpan, ModelRollup } from "./types.js";

type SyntheticConfig = {
  spans: number;
  errorRate: number;
  models: string[];
};

export function generateSyntheticSpans(cfg: SyntheticConfig): GenAISpan[] {
  if (cfg.models.length === 0) {
    throw new Error("generateSyntheticSpans: cfg.models must not be empty");
  }
  const now = Date.now() * 1e6;
  const out: GenAISpan[] = [];
  for (let i = 0; i < cfg.spans; i++) {
    const model = cfg.models[i % cfg.models.length]!;
    if (!model) continue;
    const baseLatencyMs = 400 + ((i * 31) % 1800);
    const inputTokens = 200 + ((i * 17) % 4000);
    const outputTokens = 120 + ((i * 23) % 800);
    const isError =
      i % Math.max(1, Math.round(1 / cfg.errorRate)) === 0 && i > 0;
    out.push({
      trace_id: `trace-${i.toString(16).padStart(8, "0")}`,
      span_id: `span-${i.toString(16).padStart(8, "0")}`,
      name: "chat.completion",
      start_time_unix_nano: now + i * 1_000_000,
      end_time_unix_nano: now + i * 1_000_000 + baseLatencyMs * 1e6,
      status: isError ? "ERROR" : "OK",
      attributes: {
        "gen_ai.system": model.startsWith("gpt")
          ? "openai"
          : model.startsWith("claude")
            ? "anthropic"
            : "google",
        "gen_ai.request.model": model,
        "gen_ai.response.model": model,
        "gen_ai.operation.name": "chat",
        "gen_ai.usage.input_tokens": inputTokens,
        "gen_ai.usage.output_tokens": isError ? 0 : outputTokens,
        "gen_ai.response.finish_reasons": [isError ? "error" : "stop"],
      },
    });
  }
  return out;
}

function reportRollups(rollups: ModelRollup[]): void {
  console.log("[obs] model roll-ups:");
  console.log(
    "  " +
      ["model", "n", "err", "p50", "p95", "p99", "cost($)"]
        .map((s) => s.padEnd(20))
        .join(""),
  );
  for (const r of rollups) {
    console.log(
      "  " +
        [
          r.model,
          String(r.count),
          String(r.errors),
          r.p50LatencyMs.toFixed(1),
          r.p95LatencyMs.toFixed(1),
          r.p99LatencyMs.toFixed(1),
          r.costUsd.toFixed(4),
        ]
          .map((s) => s.padEnd(20))
          .join(""),
    );
  }
}

function main(): void {
  console.log("[obs] generating 1200 synthetic OTel-GenAI spans...");
  const store = new ObservabilityStore();
  const synthetic = generateSyntheticSpans({
    spans: 1200,
    errorRate: 0.03,
    models: [
      "gpt-4o-mini",
      "gpt-5.4",
      "claude-3-5-sonnet",
      "claude-opus-4-7",
      "gemini-2-5-pro",
    ],
  });
  store.ingest(synthetic);
  reportRollups(rollUpByModel(store.snapshot()));
  console.log("[obs] counters:", store.counters());
  if (process.env["SERVE"] === "1") {
    const port = Number(process.env["PORT"] ?? 8011);
    const app = buildApp(store);
    serve({ fetch: app.fetch, port }, (info) => {
      console.log(`[obs] ingest + dashboard on http://localhost:${info.port}`);
    });
  } else {
    console.log(
      "[obs] set SERVE=1 to start the HTTP server on PORT (default 8011)",
    );
  }
}

main();
