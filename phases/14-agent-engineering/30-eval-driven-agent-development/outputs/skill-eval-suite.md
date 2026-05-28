---
name: eval-suite
description: evaluator-optimizer loop と CI gates を備えた three-layer eval suite (static benchmarks, custom offline, online production) を構築する。
version: 1.0.0
phase: 14
lesson: 30
tags: [evaluation, ci, regression, benchmarks, llm-judge]
---

agent product が与えられたら、CI に接続された three-layer eval suite を構築する。

生成するもの:

1. **Static benchmark layer** — 少なくとも 1 つの関連 benchmark (code には SWE-bench Verified、tool use には BFCL V4、web には WebArena、desktop には OSWorld、generalist には GAIA)。常に +-audited score を併記する。
2. **Custom offline layer** — domain-specific dimensions (factual, tone, scope, refusal quality) で採点する LLM-judge rubric を少なくとも 1 つ。agent 実行後に実際の state を probe する execution-based case を少なくとも 1 つ。gold path を持つ trajectory-based case を少なくとも 1 つ。
3. **Online eval layer** — session replays、guardrail-triggered alerts、OTel GenAI spans (Lesson 23) を通じた step ごとの cost/latency tracking。
4. **Evaluator-optimizer runner** — agent を propose / judge / refine で包み、round cap を設ける。
5. **CI gate** — baseline に対して >=5% regression で build を失敗させる。baseline を経時的に追跡する。
6. **Case mapping** — Phase 14 lessons からのすべての guardrail と learned rule が、少なくとも 1 つの case を持つ。

強い却下条件:

- baseline のない eval suite。reference なしでは regression を検出できない。
- factual tasks で external grounding のない LLM-judge。CRITIC pattern (Lesson 05) が必要。
- pinned seeds または snapshot state のない flaky cases。false alarms は team の evals への信頼を損なう。

拒否ルール:

- user が「just the happy path」を望むなら拒否する。すべての failure mode (Lesson 26) は case を持つべき。
- user が「no CI gate」を望むなら、paying users に届く products では拒否する。そうしないと eval drift が見えない。
- user が「all LLM-judges」を望むなら、factual tasks と compliance tasks では拒否する。そこでは execution-based または programmatic evaluators が必要。

出力: `cases/benchmarks/`, `cases/custom/`, `cases/online/`, `runner.py`, `ci_gate.py`, `README.md`。rubrics、baselines、Phase 14 mapping table を説明する。最後に substrate として Lesson 24 (observability)、Lesson 26 (failure modes)、または Lesson 23 (OTel) を指す "what to read next" で締める。
