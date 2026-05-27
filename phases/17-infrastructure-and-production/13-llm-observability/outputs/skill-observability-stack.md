---
name: observability-stack
description: Pick an LLM observability stack (development platform + gateway + optional scale layer) given stack, scale, budget, and license posture, and define the OpenTelemetry GenAI attribute set.
version: 1.0.0
phase: 17
lesson: 13
tags: [observability, langfuse, langsmith, phoenix, arize, helicone, opik, opentelemetry, genai-conventions]
---

Given stack (LangChain / DSPy / raw SDK), scale (traces/day), budget, license posture (MIT-only vs commercial OK), and self-host requirement, produce an observability plan.

Produce:

1. Development platform choice. Langfuse (OSS), LangSmith (LangChain-first commercial), Opik (Comet OSS), or none. Justify with stack and license.
2. Gateway/telemetry choice. Helicone (proxy + gateway), SigNoz (full APM), OpenLLMetry (pure OTel). If already using an AI gateway (Phase 17 · 19), name the integration.
3. Scale/lake layer. Optional; Arize AX or raw Iceberg for long-term analytics, Phoenix for RAG drift.
4. OTel GenAI conventions. Specify the minimum attribute set: `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.request.temperature`, `gen_ai.response.finish_reasons`, plus org-specific (tenant_id, user_id, task).
5. Sampling policy. 100% errors, 100% high-cost (>$0.10/call), N% success sampling rate. Raw-retention window (14d / 30d / 90d). Aggregates retained longer.
6. Alerting. Five metrics that must have alerts: error rate, P99 TTFT, cost/request, prompt-cache hit rate, refusal rate.

Hard rejects:
- Instrumenting inside framework-specific SDK without an OTel fallback. Refuse — framework lock-in.
- Keeping 100% of traces at Datadog-class pricing >$500/mo for a non-regulated workload. Refuse — recommend sampling.
- Ignoring OpenTelemetry GenAI conventions. Refuse — 2026 interop requires them.

Refusal rules:
- If traces/day > 5M and the team insists on full Datadog retention, refuse without a cost forecast.
- If the team is MIT-only and picks LangSmith, refuse — Langfuse is the MIT equivalent.
- If the team has no AI gateway and picks Helicone as gateway AND observability, accept — the proxy doubles as gateway up to ~500 RPS (Phase 17 · 19 covers gateway scale).

Output: a one-page plan naming dev platform, gateway, scale layer (if any), OTel attribute set, sampling rule, five alerts. End with the single metric that signals stack drift: percentage of LLM calls with complete OTel GenAI attributes over last 7 days.
