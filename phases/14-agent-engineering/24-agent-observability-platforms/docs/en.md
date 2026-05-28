# Agent Observability: Langfuse, Phoenix, Opik

> 2026年は3つのopen-source agent observability platformが中心です。Langfuse (MIT) — 月間6M+ installs、tracing + prompt management + evals + session replay。Arize Phoenix (Elastic 2.0) — deep agent-specific evals、RAG relevancy、OpenInference auto-instrumentation。Comet Opik (Apache 2.0) — automated prompt optimization、guardrails、LLM-judge hallucination detection。

**種別:** 学習
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 23 (OTel GenAI)
**所要時間:** 約45分

## Learning Objectives

- 上位3つのopen-source agent observability platformとlicenseを挙げる。
- それぞれの強みを区別する: Langfuse (prompt mgmt + sessions)、Phoenix (RAG + auto-instrumentation)、Opik (optimization + guardrails)。
- 2026年までに89%のorganizationがagent observabilityを導入済みと報告している理由を説明する。
- LLM-judge evaluation付きのstdlib trace-to-dashboard pipelineを実装する。

## 問題

OTel GenAI (Lesson 23) はschemaを提供します。それでも、spanをingestし、evaluationを実行し、prompt versionを保存し、regressionをsurfaceするplatformが必要です。3つの候補はそれぞれlifecycleの異なる部分を重視しています。

## The Concept

### Langfuse (MIT)

- 月間6M+ SDK installs、19k+ GitHub stars。
- Features: tracing、versioning + playground付きprompt management、evaluations (LLM-as-judge、user feedback、custom)、session replays。
- 2025年6月: 以前はcommercialだったmodules (LLM-as-a-judge、annotation queues、prompt experiments、Playground) がMITでopen-source化。
- 最も強い領域: tightなprompt-management loopを持つend-to-end observability。

### Arize Phoenix (Elastic License 2.0)

- より深いagent-specific evaluation: trace clustering、anomaly detection、RAG向けretrieval relevancy。
- Native OpenInference auto-instrumentation。
- productionではmanaged Arize AXと組み合わせる。
- prompt versioningはない。より広いplatformと併用するdrift/behavioral-regression toolとして位置づけられる。
- 最も強い領域: RAG relevancy、behavioral drift、anomaly detection。

### Comet Opik (Apache 2.0)

- A/B experimentsによるautomated prompt optimization。
- Guardrails (PII redaction、topical constraints)。
- LLM-judge hallucination detection。
- Comet自身のmeasurementによるbenchmark: Opikはlogs + evalsを23.44sで完了、Langfuseは327.15s (約14x gap)。vendor benchmarkはdirectionalとして受け取ってください。
- 最も強い領域: optimization loop、automated experimentation、guardrail enforcement。

### Industry data

Maxim (2026 field analysis) によると、89%のorganizationがagent observabilityを導入済みです。quality issuesが最上位のproduction barrierで、回答者の32%が挙げています。

### Picking one

| Need | Pick |
|------|------|
| prompt management付きall-in-one | Langfuse |
| deep RAG evaluation + drift | Phoenix |
| automated optimization + guardrails | Opik |
| open licensing、ELv2なし | Langfuse (MIT) またはOpik (Apache 2.0) |
| Datadog / New Relic integration | どれでもよい。すべてOTelをexportする |

### Where this pattern goes wrong

- **No eval strategy。** evaluationなしのtracingは、高価なloggingにすぎません。
- **Self-rolled LLM-judge without grounding。** CRITIC pattern (Lesson 05) が当てはまります。judgeにはfactual verification用のexternal toolが必要です。
- **Prompt versions not tied to traces。** prodがregressしたとき、原因になったpromptまでbisectできません。

## 実装

`code/main.py`はstdlib trace collector + LLM-judge evaluatorを実装しています。

- GenAI-shaped spansをingestする。
- sessionでgroupし、failed runをtagする (guardrail trips、low-confidence evals)。
- rubricに基づいてagent responseをscoreするscripted LLM-judge。
- dashboard-like summary: failure rate、top failure reasons、eval score distribution。

実行:

```
python3 code/main.py
```

Output: Langfuse/Phoenix/Opikが表示するものに近い、session別eval scoreとfailure categorization。

## Use It

- **Langfuse** self-hostedまたはcloud。OTelまたはSDK経由でwireする。
- **Arize Phoenix** self-hosted。OpenInferenceをauto-instrumentする。
- **Comet Opik** self-hostedまたはcloud。automated optimization loop。
- **Datadog LLM Observability** は、すでにDatadogを運用しているmixed ops+ML team向け。

## Ship It

`outputs/skill-obs-platform-wiring.md`は、platformを選び、traces + evals + prompt versionsを既存agentへwireします。

## Exercises

1. 1週間分のOTel tracesをLangfuse cloud (free tier) にexportする。どのsessionが失敗したか。なぜか。
2. 自分のdomain向けLLM-judge rubricを書く (factual correctness、tone、scope adherence)。50 tracesでtestする。
3. Langfuseのprompt versioningとPhoenixのtrace clusteringを比較する。何が壊れたかをより速く教えるのはどちらか。
4. Opikのguardrail docsを読む。agent runの1つにPII redaction guardrailをwireする。
5. 自分のcorpusで3つをbenchmarkする。vendor-published numbersは無視し、自分で測る。

## Key Terms

| Term | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| Tracing | "Spans collector" | OTel / SDK spansをingestし、sessionでindexする |
| Prompt management | "Prompt CMS" | traceに紐づくversioned prompts |
| LLM-as-judge | "Automated eval" | 別のLLMがrubricに対してagent outputをscoreする |
| Session replay | "Trace playback" | debugのために過去runをstep throughする |
| RAG relevancy | "Retrieval quality" | retrieved contextがqueryに合っているか |
| Trace clustering | "Behavioral grouping" | drift detectionのためにsimilar runsをclusterする |
| Guardrail enforcement | "Policy at log time" | logged contentに対するPII/toxicity/scope checks |

## 参考文献

- [Langfuse docs](https://langfuse.com/) — tracing, evals, prompt mgmt
- [Arize Phoenix docs](https://docs.arize.com/phoenix) — auto-instrumentation, drift
- [Comet Opik](https://www.comet.com/site/products/opik/) — optimization + guardrails
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — schema all three consume
