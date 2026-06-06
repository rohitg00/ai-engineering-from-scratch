# Capstone 11 — LLM Observability & Eval Dashboard

> Langfuse went open-core. Arize Phoenix published the 2026 GenAI semconv mappings. Helicone and Braintrust both doubled down on per-user cost attribution. Traceloop's OpenLLMetry became the de-facto SDK instrumentation. The production shape is ClickHouse for traces, Postgres for metadata, Next.js for UI, and a small army of eval jobs (DeepEval, RAGAS, LLM-judge) running over sampled traces. Build one self-hosted, ingest from at least four SDK families, and demonstrate catching an injected regression in under five minutes.

**Type:** Capstone
**Languages:** TypeScript (UI), Python / TypeScript (ingest + evals), SQL (ClickHouse)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P11 · P13 · P17 · P18
**Time:** 25 hours

## Problem

Every AI team running production traffic in 2026 keeps an observability plane alongside the model. Cost attribution. Hallucination detection. Drift monitoring. Jailbreak signal. SLO dashboards. PII leak alerts. The open-source references — Langfuse, Phoenix, OpenLLMetry — converged on OpenTelemetry GenAI semantic conventions as the ingest schema. You can now instrument OpenAI, Anthropic, Google, LangChain, LlamaIndex, and vLLM with one SDK and ship compatible spans.

You will build a self-hosted dashboard that ingests from at least four SDK families, runs a small set of eval jobs over sampled traces, detects drift, and alerts. The measurement bar: given a deliberately injected regression (a prompt that starts producing PII), the dashboard catches it and fires an alert in under five minutes.

## Concept

Ingest is OTLP HTTP. The SDK produces GenAI-semconv spans: `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.response.id`, `llm.prompts`, `llm.completions`. Spans land in ClickHouse for columnar analytics; metadata (users, sessions, apps) lands in Postgres.

Evals run as batch jobs over sampled traces. DeepEval scores faithfulness, toxicity, and answer relevance. RAGAS scores retrieval metrics when the trace carries retrieval context. Custom LLM-judges run domain-specific checks (PII leak, off-policy response). Eval runs write back to the same ClickHouse as eval spans linked to the parent trace.

Drift detection watches embedding-space distributions over time (PSI or KL divergence on prompt embeddings) plus eval-score trends. Alerts feed Prometheus Alertmanager and then Slack / PagerDuty. The UI is Next.js 15 with Recharts.

## Architecture

```
production apps:
  OpenAI SDK  +  Anthropic SDK  +  Google GenAI SDK
  LangChain + LlamaIndex + vLLM
       |
       v
  OpenTelemetry SDK with GenAI semconv
       |
       v  OTLP HTTP
  collector (ingest, sample, fan-out)
       |
       +-------------+-----------+
       v             v           v
   ClickHouse    Postgres    S3 archive
   (spans)       (metadata)  (raw events)
       |
       +---> eval jobs (DeepEval, RAGAS, LLM-judge)
       |     sampled or all-trace
       |     write eval spans back
       |
       +---> drift detector (PSI / KL on prompt embeddings)
       |
       +---> Prometheus metrics -> Alertmanager -> Slack / PagerDuty
       |
       v
   Next.js 15 dashboard (Recharts)
```

## Stack

- Ingest: OpenTelemetry SDKs + GenAI semantic conventions; OTLP HTTP transport
- Collector: OpenTelemetry Collector with tail-sampling processor (for cost control)
- Storage: ClickHouse for spans, Postgres for metadata, S3 for raw event archive
- Evals: DeepEval, RAGAS 0.2, Arize Phoenix evaluator pack, custom LLM-judge
- Drift: PSI / KL on pooled prompt embeddings (sentence-transformers) weekly
- Alerting: Prometheus Alertmanager -> Slack / PagerDuty
- UI: Next.js 15 App Router + Recharts + server actions
- SDKs supported out of the box: OpenAI, Anthropic, Google GenAI, LangChain, LlamaIndex, vLLM

## Build It

1. **Collector config.** OpenTelemetry Collector with the OTLP HTTP receiver, a tail-sampler keeping 100% of errored traces and 10% of successes, and exporters to ClickHouse and S3.

2. **ClickHouse schema.** Table `spans` with columns mirroring GenAI semconv: `gen_ai_system`, `gen_ai_request_model`, `input_tokens`, `output_tokens`, `latency_ms`, `prompt_hash`, `trace_id`, `parent_span_id`, plus JSON bag for long payloads. Add secondary indexes by user_id and app_id.

3. **SDK coverage test.** Write a small client app using each SDK (OpenAI, Anthropic, Google, LangChain, LlamaIndex, vLLM) with OpenLLMetry auto-instrument. Verify each produces canonical GenAI spans that land in ClickHouse.

4. **Eval jobs.** A scheduled job reads last-15-min sampled traces and runs DeepEval faithfulness, toxicity, and answer relevance. Outputs are eval spans linked to the parent trace.

5. **Custom LLM-judge.** A PII-leak judge: given a response, call a guard LLM to score likelihood of PII leak. High-score responses land in a triage queue.

6. **Drift detection.** Weekly job computes PSI between this week's pooled prompt embeddings and the trailing 4-week baseline. If PSI above threshold, alert.

7. **Dashboard.** Next.js 15 with pages: overview (spans/sec, cost/user, p95 latency), traces (search + waterfall), evals (faithfulness trend, toxicity), drift (PSI over time), alerts.

8. **Alerting chain.** Prometheus exporter reads eval score aggregates and latency percentiles; Alertmanager routes to Slack for warnings and PagerDuty for critical breaches.

9. **Regression probe.** Inject a bug: the evaluated chatbot starts leaking fake SSNs 1% of the time. Measure MTTR: from bug deployed to Slack alert.

## Use It

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[collector]  accepted 1 trace, 3 spans
[clickhouse] inserted 3 spans (app=chat, user=u_42)
[eval]       DeepEval faithfulness 0.82, toxicity 0.03
[drift]      weekly PSI 0.08 (below 0.2 threshold)
[ui]         live at https://obs.example.com
```

## Ship It

`outputs/skill-llm-observability.md` is the deliverable. Given an LLM application, the dashboard ingests its traces, runs evals, alerts on drift, and surfaces cost/user breakdown in Next.js.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Trace-schema coverage | Number of SDK families producing canonical GenAI spans (target: 6+) |
| 20 | Eval correctness | DeepEval / RAGAS scores vs hand-labeled set |
| 20 | Dashboard UX | MTTR on injected regression (under 5 minutes target) |
| 20 | Cost / scale | Sustained ingest at 1k spans/sec without backlog |
| 15 | Alerting + drift detection | Prometheus/Alertmanager chain exercised end to end |
| **100** | | |

## Exercises

1. Add custom instrumentation for the Haystack framework. Verify canonical spans land in ClickHouse with faithful `gen_ai.*` attributes.

2. Swap DeepEval for Phoenix evaluators on the same traces. Measure score drift between the two eval engines.

3. Sharpen the drift detector: compute PSI per app-id rather than globally. Show per-app drift trails.

4. Add a "user impact" page: cost-per-user and failure-rate-per-user with sparklines.

5. Build a tail-sampling policy that keeps 100% of traces with toxicity > 0.5 plus a 10% stratified sample of the rest. Measure sampling bias introduced.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GenAI semconv | "OTel LLM attributes" | 2025 OpenTelemetry spec for LLM span attributes (system, model, tokens) |
| Tail sampling | "Post-trace sample" | Collector decides to keep or drop a trace after it completes (can peek errors) |
| PSI | "Population stability index" | Drift metric comparing two distributions; > 0.2 typically signals meaningful drift |
| LLM-judge | "Eval as model" | An LLM scoring another LLM's output on a rubric (faithfulness, toxicity, PII) |
| Tail-sampling policy | "Keep-rule" | Rule that decides which traces to persist vs drop; errored + sample-rate |
| Eval span | "Linked eval trace" | Child span carrying an eval score linked to the original LLM call span |
| Cost per user | "Unit economics" | Dollar cost attributed to a user_id over a window; key product metric |

## Further Reading

- [Langfuse](https://github.com/langfuse/langfuse) — the reference open-core observability platform
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — alternate reference with strong drift support
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) — auto-instrumentation SDK family
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — the ingest schema
- [Helicone](https://www.helicone.ai) — alternate hosted observability
- [Braintrust](https://www.braintrust.dev) — alternate eval-first platform
- [ClickHouse documentation](https://clickhouse.com/docs) — columnar span store
- [DeepEval](https://github.com/confident-ai/deepeval) — evaluator library
