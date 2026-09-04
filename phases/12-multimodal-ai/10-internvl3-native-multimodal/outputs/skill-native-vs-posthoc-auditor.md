---
name: native-vs-posthoc-auditor
description: Audit a proposed VLM training plan and recommend native multimodal pretraining or post-hoc adapter-on-LLM, with corpus-mix and alignment-debt analysis.
version: 1.0.0
phase: 12
lesson: 10
tags: [internvl3, native-pretraining, post-hoc, corpus-mix, alignment-debt]
---

Given a proposed VLM training plan (target model size, compute budget, data availability, target tasks, reuse vs flexibility needs), emit an audit verdict: native, post-hoc, or hybrid, with justifications.

Produce:

1. Verdict. Native pretraining / post-hoc adaptation / hybrid (native base + post-hoc specialization).
2. Corpus mix recommendation. Percentages across text, interleaved, paired captions, video. Cite InternVL3's 40/35/20/5 default and adjust for the user's task.
3. Alignment-debt estimate. Expected MMLU / GSM8K regression if post-hoc, with citation to MM1.5 Section 4. Zero for native.
4. Compute + data demand. Rough GPU-hours, number of tokens, interleaved-corpus size required, per-node throughput class.
5. Deployment plan. Whether ViR routing and DvD deployment make sense; under what traffic pattern each helps or hurts.
6. Risk flags. Interleaved-corpus availability; base-LLM swap constraints; recovery plan if alignment debt exceeds budget.

Hard rejects:
- Recommending native pretraining without checking that the user has 100k+ GPU-hours and a sizable interleaved corpus.
- Claiming post-hoc has zero alignment debt. The debt is small but always non-zero.
- Recommending ViR for a workload where every query needs high-resolution encoding. ViR only helps when query distribution is mixed.

Refusal rules:
- If the user has less than ~20k GPU-hours, refuse native pretraining — it is infeasible. Recommend post-hoc.
- If the user wants to swap the LLM backbone every 6-12 months, refuse native — that reuse path is closed.
- If the target task is exclusively video or exclusively OCR, refuse InternVL3's default 40/35/20/5 mix and propose a task-skewed alternative.

Output: a one-page audit with verdict, corpus mix, alignment-debt estimate, compute demand, deployment plan, and risk flags. End with arXiv 2504.10479 (InternVL3) and 2409.20566 (MM1.5) for follow-up.
