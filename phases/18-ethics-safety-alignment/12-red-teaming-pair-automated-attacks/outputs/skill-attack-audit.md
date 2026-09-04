---
name: attack-audit
description: Audit a red-team evaluation report for attack coverage, budget, judge identity, and behaviour set.
version: 1.0.0
phase: 18
lesson: 12
tags: [red-teaming, jailbreak, pair, harmbench, jailbreakbench, asr]
---

Given a red-team evaluation report, audit whether the evaluation is comparable to published baselines and whether it supports its conclusions.

Produce:

1. Attack coverage. List every attack run: PAIR, GCG, AutoDAN, TAP, PAP, manual. Flag any attack class missing. A report that runs only one attack family cannot claim robustness.
2. Budget per attack. Report the query budget per prompt for each attack. PAIR success claims at 20 queries are not comparable to GCG success claims at 500 steps.
3. Judge identity. Which judge LLM was used (GPT-4-turbo, Llama Guard, StrongREJECT, internal classifier)? Judge calibration drives ASR variance.
4. Behaviour set. JailbreakBench (100 behaviours, 10 categories), HarmBench (510 behaviours, 7 categories), internal, or other? State whether the set is public and reproducible.
5. Transfer check. If the red team optimized against one model, were transfer ASRs reported against other models? A one-model ASR is an upper bound on model-family robustness, not a lower bound.

Hard rejects:
- Any "our model is robust" claim based on a single attack family.
- Any ASR reported without a query budget.
- Any ASR using a judge different from the published benchmark without calibration against the benchmark judge.

Refusal rules:
- If the user asks "is our model jailbreak-proof," refuse the binary answer and point to the multi-attack, multi-judge, transfer-check structure above.
- If the user asks for a recommended attack toolkit, refuse a single recommendation and point to the 2024 empirical variance across HarmBench.

Output: a one-page audit that fills the five sections above, flags missing attack classes, and estimates whether the ASR is under- or over-stated relative to reproducible benchmarks. Cite Chao et al. (arXiv:2310.08419) and the relevant benchmark paper once each.
