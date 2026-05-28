# キャップストーン 11 — LLM Observability & Eval Dashboard

> Langfuse は open-core 化し、Arize Phoenix は 2026 年版の GenAI semantic convention マッピングを公開した。Helicone と Braintrust は、ユーザー単位のコスト帰属をさらに重視する方向へ進んだ。Traceloop の OpenLLMetry は、SDK 計装の事実上の標準になった。本番構成は、trace に ClickHouse、metadata に Postgres、UI に Next.js、そして sampled trace 上で動く多数の eval job (DeepEval、RAGAS、LLM-judge) という形に収束している。少なくとも 4 つの SDK ファミリーから取り込める self-hosted 版を作り、注入した regression を 5 分未満で検知できることを示す。

**種類:** Capstone
**言語:** TypeScript (UI)、Python / TypeScript (ingest + evals)、SQL (ClickHouse)
**前提:** Phase 11 (LLM engineering)、Phase 13 (tools)、Phase 17 (infrastructure)、Phase 18 (safety)
**演習対象フェーズ:** P11 · P13 · P17 · P18
**時間:** 25 時間

## 問題

2026 年に本番 traffic を扱う AI チームは、モデルの横に observability plane を置いている。Cost attribution、hallucination detection、drift monitoring、jailbreak signal、SLO dashboard、PII leak alert。Langfuse、Phoenix、OpenLLMetry といった open-source 参照実装は、取り込み schema として OpenTelemetry GenAI semantic conventions に収束した。今では OpenAI、Anthropic、Google、LangChain、LlamaIndex、vLLM を 1 つの SDK で計装し、互換性のある span を送れる。

あなたは、少なくとも 4 つの SDK ファミリーから取り込み、sampled trace に対して小さな eval job 群を実行し、drift を検知して alert する self-hosted dashboard を構築する。測定基準は、意図的に注入した regression (PII を生成し始める prompt) を dashboard が 5 分未満で検知し alert できることだ。

## コンセプト

Ingest は OTLP HTTP で行う。SDK は GenAI-semconv span を生成する: `gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.response.id`、`llm.prompts`、`llm.completions`。Span は columnar analytics 用に ClickHouse へ、metadata (users、sessions、apps) は Postgres へ保存する。

Eval は sampled trace に対する batch job として実行する。DeepEval は faithfulness、toxicity、answer relevance を採点する。RAGAS は trace に retrieval context がある場合に retrieval metric を採点する。Custom LLM-judge は domain-specific check (PII leak、off-policy response) を実行する。Eval run は parent trace に linked された eval span として、同じ ClickHouse に書き戻す。

Drift detection は、時間方向の embedding-space distribution (prompt embedding に対する PSI または KL divergence) と eval-score trend を監視する。Alert は Prometheus Alertmanager を経由して Slack / PagerDuty へ送る。UI は Recharts を使った Next.js 15 で作る。

## アーキテクチャ

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

## スタック

- Ingest: OpenTelemetry SDK + GenAI semantic conventions、OTLP HTTP transport
- Collector: cost control 用の tail-sampling processor を備えた OpenTelemetry Collector
- Storage: span は ClickHouse、metadata は Postgres、raw event archive は S3
- Evals: DeepEval、RAGAS 0.2、Arize Phoenix evaluator pack、custom LLM-judge
- Drift: pooled prompt embedding (sentence-transformers) に対する weekly PSI / KL
- Alerting: Prometheus Alertmanager -> Slack / PagerDuty
- UI: Next.js 15 App Router + Recharts + server actions
- 最初から対応する SDK: OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM

## 実装

1. **Collector config.** OTLP HTTP receiver、error trace を 100%、成功 trace を 10% 保持する tail-sampler、ClickHouse と S3 への exporter を備えた OpenTelemetry Collector。

2. **ClickHouse schema.** GenAI semconv を反映した `spans` table: `gen_ai_system`、`gen_ai_request_model`、`input_tokens`、`output_tokens`、`latency_ms`、`prompt_hash`、`trace_id`、`parent_span_id`、長い payload 用の JSON bag。`user_id` と `app_id` に secondary index を追加する。

3. **SDK coverage test.** 各 SDK (OpenAI、Anthropic、Google、LangChain、LlamaIndex、vLLM) を使う小さな client app を書き、OpenLLMetry auto-instrument を有効にする。それぞれが canonical GenAI span を生成し、ClickHouse に届くことを確認する。

4. **Eval jobs.** Scheduled job が直近 15 分の sampled trace を読み、DeepEval faithfulness、toxicity、answer relevance を実行する。出力は parent trace に linked された eval span にする。

5. **Custom LLM-judge.** PII-leak judge: response を受け取り、guard LLM に PII leak の可能性を採点させる。高 score の response は triage queue に入れる。

6. **Drift detection.** Weekly job が、今週の pooled prompt embedding と過去 4 週間 baseline の間で PSI を計算する。PSI が threshold を超えたら alert する。

7. **Dashboard.** Next.js 15 でページを作る: overview (spans/sec、cost/user、p95 latency)、traces (search + waterfall)、evals (faithfulness trend、toxicity)、drift (PSI over time)、alerts。

8. **Alerting chain.** Prometheus exporter が eval score aggregate と latency percentile を読む。Alertmanager は warning を Slack、critical breach を PagerDuty へ routing する。

9. **Regression probe.** Bug を注入する: 評価対象 chatbot が 1% の確率で fake SSN を漏らし始める。MTTR、つまり bug deploy から Slack alert までの時間を測る。

## 使ってみる

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[collector]  accepted 1 trace, 3 spans
[clickhouse] inserted 3 spans (app=chat, user=u_42)
[eval]       DeepEval faithfulness 0.82, toxicity 0.03
[drift]      weekly PSI 0.08 (below 0.2 threshold)
[ui]         live at https://obs.example.com
```

## Ship It

`outputs/skill-llm-observability.md` が提出物である。LLM application を与えると、dashboard が trace を取り込み、eval を実行し、drift に alert を出し、Next.js 上で cost/user breakdown を表示する。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Trace-schema coverage | canonical GenAI span を生成する SDK ファミリー数 (目標: 6+) |
| 20 | Eval correctness | DeepEval / RAGAS score と hand-labeled set の比較 |
| 20 | Dashboard UX | 注入 regression の MTTR (目標 5 分未満) |
| 20 | Cost / scale | backlog なしで 1k spans/sec を継続 ingest |
| 15 | Alerting + drift detection | Prometheus/Alertmanager chain を end to end で実行 |
| **100** | | |

## 演習

1. Haystack framework 用の custom instrumentation を追加する。忠実な `gen_ai.*` attribute を持つ canonical span が ClickHouse に入ることを確認する。

2. 同じ trace 上で DeepEval を Phoenix evaluator に差し替える。2 つの eval engine 間の score drift を測る。

3. Drift detector を鋭くする: global ではなく app-id ごとに PSI を計算する。Per-app の drift trail を表示する。

4. "user impact" ページを追加する: cost-per-user と failure-rate-per-user を sparkline 付きで表示する。

5. toxicity > 0.5 の trace を 100% 保持し、残りを 10% stratified sample する tail-sampling policy を作る。導入される sampling bias を測る。

## 重要用語

| Term | よくある言い方 | 実際の意味 |
|------|-----------------|------------|
| GenAI semconv | "OTel LLM attributes" | LLM span attribute (system、model、tokens) の 2025 年 OpenTelemetry spec |
| Tail sampling | "Post-trace sample" | trace 完了後に Collector が保持・破棄を決める方式 (error を見て判断できる) |
| PSI | "Population stability index" | 2 つの distribution を比較する drift metric。通常 > 0.2 は有意な drift の signal |
| LLM-judge | "Eval as model" | rubric (faithfulness、toxicity、PII) に基づいて別の LLM の output を採点する LLM |
| Tail-sampling policy | "Keep-rule" | persist する trace と drop する trace を決める rule。error + sample-rate |
| Eval span | "Linked eval trace" | 元の LLM call span に linked された eval score を持つ child span |
| Cost per user | "Unit economics" | window 内で user_id に帰属した dollar cost。重要な product metric |

## 参考資料

- [Langfuse](https://github.com/langfuse/langfuse) — 参照となる open-core observability platform
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — drift support が強い別系統の参照実装
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) — auto-instrumentation SDK family
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — ingest schema
- [Helicone](https://www.helicone.ai) — hosted observability の別案
- [Braintrust](https://www.braintrust.dev) — eval-first platform の別案
- [ClickHouse documentation](https://clickhouse.com/docs) — columnar span store
- [DeepEval](https://github.com/confident-ai/deepeval) — evaluator library
