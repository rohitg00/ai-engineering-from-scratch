---
name: obs-platform-wiring
description: observability platform (Langfuse、Phoenix、Opik、Datadog) を選び、traces + evals + prompt versionsを既存agentにwireする。
version: 1.0.0
phase: 14
lesson: 24
tags: [observability, langfuse, phoenix, opik, datadog, tracing]
---

agent runtimeとproduct requirementsを受け取り、observability platformを選んでwiringをscaffoldする。

Decision:

1. prompt management + session replayを1か所で必要とする -> **Langfuse**。
2. deep RAG relevancy + drift/anomaly detectionが必要 -> **Phoenix**。
3. automated prompt optimization + PII guardrailsが必要 -> **Opik**。
4. すでにDatadogを運用している -> **Datadog LLM Observability** (v1.37+からGenAIをnativeにmap)。
5. ELv2-free licenseが必要 -> **Langfuse** (MIT) または **Opik** (Apache 2.0)。pure OSS distributionではPhoenixを避ける。

生成するもの:

1. OTel GenAI instrumentation (Lesson 23)。これがcommon substrateです。
2. platform-specific SDKまたはOTel exporter configuration。
3. domain向けLLM-judge rubric (factual correctness、scope、tone、refusal quality)。
4. traceにwireされたprompt versioning (Langfuse)、またはtrace clustering config (Phoenix)、またはexperiment definitions (Opik)。
5. logged content上のguardrails: PII redaction、secret scrubbing。
6. Dashboards: session health、failure taxonomy、latency distribution、cost per session。

Hard rejects:

- evalなしでshipすること。tracingだけでは高価なloggingです。
- external verificationなしのself-written LLM-judgeを使うこと。CRITIC pattern (Lesson 05): judgeにはfactual grounding用のexternal toolが必要です。
- span bodyにPIIを保存すること。常にexternal store + reference IDsを使う。

Refusal rules:

- userが「one platform for everything」を求めた場合は拒否し、上記のdecisionを提示する。3つすべてのaxisで単独dominantなplatformはありません。
- productに各agent taskのacceptance criteriaがない場合、evalsのshipを拒否する。LLM-judgeにはrubricが必要で、rubricにはproduct decisionが必要です。
- userが「no sampling, capture everything」を望む場合は拒否する。trace volumeはtrafficに比例してscalesします。scale時にはsampling (head-basedまたはtail-based) が必要です。

Output: `instrumentation.py`, `judge.py`, `dashboards.md`, `README.md`。platform choice、rubric、sampling strategy、incident responseを説明する。最後に"what to read next"としてLesson 30 (eval-driven development) またはLesson 26 (failure-mode taxonomy) を示す。
