---
name: observability-stack
description: Stack、scale、budget、license posture に基づいて LLM observability stack（development platform + gateway + optional scale layer）を選び、OpenTelemetry GenAI attribute set を定義します。
version: 1.0.0
phase: 17
lesson: 13
tags: [observability, langfuse, langsmith, phoenix, arize, helicone, opik, opentelemetry, genai-conventions]
---

Stack（LangChain / DSPy / raw SDK）、scale（traces/day）、budget、license posture（MIT-only vs commercial OK）、self-host requirement を受け取り、observability plan を作成します。

作成するもの:

1. Development platform choice。Langfuse（OSS）、LangSmith（LangChain-first commercial）、Opik（Comet OSS）、または none。Stack と license で正当化する。
2. Gateway/telemetry choice。Helicone（proxy + gateway）、SigNoz（full APM）、OpenLLMetry（pure OTel）。すでに AI gateway（Phase 17 · 19）を使っている場合は integration を挙げる。
3. Scale/lake layer。Optional。Long-term analytics 用に Arize AX または raw Iceberg、RAG drift 用に Phoenix。
4. OTel GenAI conventions。Minimum attribute set を指定する: `gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.usage.output_tokens`、`gen_ai.request.temperature`、`gen_ai.response.finish_reasons`、さらに org-specific（tenant_id、user_id、task）。
5. Sampling policy。100% errors、100% high-cost（>$0.10/call）、N% success sampling rate。Raw-retention window（14d / 30d / 90d）。Aggregates は長く保持する。
6. Alerting。必ず alerts を持つ 5 metrics: error rate、P99 TTFT、cost/request、prompt-cache hit rate、refusal rate。

Hard rejects:
- OTel fallback なしで framework-specific SDK 内に instrument すること。拒否する。Framework lock-in。
- Non-regulated workload で Datadog-class pricing が >$500/mo なのに 100% traces を保持すること。拒否し、sampling を推奨する。
- OpenTelemetry GenAI conventions を無視すること。拒否する。2026 年の interop には必須。

Refusal rules:
- traces/day > 5M で team が full Datadog retention に固執する場合、cost forecast なしでは拒否する。
- team が MIT-only なのに LangSmith を選ぶ場合は拒否する。Langfuse が MIT equivalent。
- team が AI gateway を持たず、Helicone を gateway 兼 observability として選ぶ場合は受け入れる。Proxy は約 500 RPS まで gateway としても機能する（Phase 17 · 19 が gateway scale を扱う）。

Output: dev platform、gateway、scale layer（あれば）、OTel attribute set、sampling rule、5 alerts を示す 1-page plan。最後に stack drift を示す単一 metric、直近 7 日間で complete OTel GenAI attributes を持つ LLM calls の割合、で締めます。
