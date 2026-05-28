---
name: llm-observability
description: OpenTelemetry GenAI span を ingest し、eval を実行し、注入 regression を 5 分未満で検知する self-hosted LLM observability dashboard を構築する。
version: 1.0.0
phase: 19
lesson: 11
tags: [capstone, observability, otel, langfuse, phoenix, evals, drift, clickhouse]
---

少なくとも 6 つの SDK ファミリー (OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM) からの production LLM traffic を対象に、OTLP GenAI-semconv span を ingest し、eval を実行し、drift を検知し、alert する self-hosted observability plane を deploy する。

Build plan:

1. OTLP HTTP receiver、tail-sampling processor (error 100%、success 10%、high-toxicity/PII 100% を保持)、ClickHouse + S3 exporter を備えた OpenTelemetry Collector。
2. GenAI semconv を反映した ClickHouse span schema: gen_ai.system、gen_ai.request.model、usage.input/output_tokens、latency_ms、user_id、app_id、prompt/completion 用 JSON bag。
3. Apps、users、sessions、annotation queue 用の Postgres metadata store。
4. SDK family ごとに client app へ OpenLLMetry auto-instrumentation を入れ、canonical span が届くことを検証する。
5. DeepEval + RAGAS + Phoenix evaluator pack を sampled trace 上で定期実行する。PII と off-policy 用に custom LLM-judge を追加する。
6. Pooled prompt embedding 上で weekly PSI / KL drift detector を実行する。Alert threshold は 0.2。
7. Eval score aggregate と latency percentile 用の Prometheus exporter。Alertmanager から Slack (warning) + PagerDuty (critical) へ送る。
8. Next.js 15 App Router dashboard: overview、trace search + waterfall、eval trends、drift chart、alerts。
9. Regression probe: fake SSN を 1% の確率で漏らす response pattern を注入し、MTTR (alert-fire time) を測る。

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Trace-schema coverage | canonical GenAI span を生成する SDK family 数 (target 6+) |
| 20 | Eval correctness | DeepEval / RAGAS score と hand-labeled set の比較 |
| 20 | Dashboard UX | 注入 regression の MTTR (target under 5 minutes) |
| 20 | Cost / scale | backlog なしで 1k spans/sec ingest を継続 |
| 15 | Alerting + drift detection | Prometheus/Alertmanager chain を end to end で実行 |

Hard rejects:

- OpenTelemetry GenAI semconv にない attribute name を勝手に作る span schema。
- Error を drop する tail-sampling policy (よく知られた anti-pattern)。
- Sampling なしで ingest rate のまま eval を走らせる構成 (cost が許容不能)。
- "latency" を p50/p95/p99 に分けずに表示する dashboard。

Refusal rules:

- PII redaction policy なしで prompt または completion を persist しない。
- SDK ごとの canonical-span regression test なしで "multi-SDK support" を主張しない。
- Baseline window なしで drift detection を ship しない。Zero-shot drift は役に立たない。

Output: collector config、ClickHouse schema、Next.js 15 dashboard、eval jobs、drift detector、alerting chain、annotated regression 付き 10k-trace demo dataset、注入した PII regression の MTTR と、iteration によって MTTR を下げた dashboard UX 改善 top 3 を記した write-up を含む repo。
