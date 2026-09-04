---
name: llm-observability
description: Build a self-hosted LLM observability dashboard that ingests OpenTelemetry GenAI spans, runs evals, and catches injected regressions in under five minutes.
version: 1.0.0
phase: 19
lesson: 11
tags: [capstone, observability, otel, langfuse, phoenix, evals, drift, clickhouse]
---

Given production LLM traffic across at least six SDK families (OpenAI, Anthropic, Google GenAI, LangChain, LlamaIndex, vLLM), deploy a self-hosted observability plane that ingests OTLP GenAI-semconv spans, runs evals, detects drift, and alerts.

Build plan:

1. OpenTelemetry Collector with OTLP HTTP receiver, tail-sampling processor (keep 100% errors, 10% success, 100% high-toxicity/PII), exporters to ClickHouse + S3.
2. ClickHouse span schema mirroring GenAI semconv: gen_ai.system, gen_ai.request.model, usage.input/output_tokens, latency_ms, user_id, app_id, plus JSON bag for prompts/completions.
3. Postgres metadata store for apps, users, sessions, annotation queue.
4. OpenLLMetry auto-instrumentation on a client app per SDK family; verify canonical spans land.
5. DeepEval + RAGAS + Phoenix evaluator pack scheduled over sampled traces; custom LLM-judge for PII and off-policy.
6. Weekly PSI / KL drift detector on pooled prompt embeddings; alert threshold 0.2.
7. Prometheus exporter for eval score aggregates and latency percentiles; Alertmanager to Slack (warning) + PagerDuty (critical).
8. Next.js 15 App Router dashboard: overview, trace search + waterfall, eval trends, drift chart, alerts.
9. Regression probe: inject a response pattern that leaks fake SSNs 1% of the time; measure MTTR (alert-fire time).

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Trace-schema coverage | Number of SDK families producing canonical GenAI spans (target 6+) |
| 20 | Eval correctness | DeepEval / RAGAS scores vs hand-labeled set |
| 20 | Dashboard UX | MTTR on injected regression (target under 5 minutes) |
| 20 | Cost / scale | Sustained 1k spans/sec ingest without backlog |
| 15 | Alerting + drift detection | Prometheus/Alertmanager chain exercised end to end |

Hard rejects:

- Span schemas that invent attribute names not in the OpenTelemetry GenAI semconv.
- Tail-sampling policies that drop errors (a well-known anti-pattern).
- Evals that run at ingest rate without sampling (unacceptable cost).
- Dashboards that show "latency" without p50/p95/p99 separation.

Refusal rules:

- Refuse to persist prompts or completions without a PII redaction policy.
- Refuse to claim "multi-SDK support" without a per-SDK canonical-span regression test.
- Refuse to ship drift detection without a baseline window; zero-shot drift is useless.

Output: a repo containing the collector config, the ClickHouse schema, the Next.js 15 dashboard, the eval jobs, the drift detector, the alerting chain, the 10k-trace demo dataset with annotated regressions, and a write-up documenting MTTR for the injected PII regression plus the top three dashboard UX improvements that dropped MTTR over iteration.
