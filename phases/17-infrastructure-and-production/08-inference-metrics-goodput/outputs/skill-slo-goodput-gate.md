---
name: slo-goodput-gate
description: Produce a CI/CD-ready benchmark recipe that gates LLM deploys on goodput, not throughput, with P50/P90/P99 percentiles and a documented tool choice.
version: 1.0.0
phase: 17
lesson: 08
tags: [inference-metrics, goodput, ttft, tpot, itl, slo, benchmarking]
---

Given a workload (model, hardware, target concurrency, user-facing interaction type — streaming chat / one-shot / voice / agent), produce a goodput-based SLO gate for CI/CD.

Produce:

1. SLO spec. Three thresholds: TTFT P99 bound, TPOT P99 bound, E2E P99 bound. Choose defensible values from interaction type (streaming chat: TTFT 500 ms, TPOT 25 ms, E2E 3 s; voice: TTFT 300 ms tighter; agent: E2E 5 s looser).
2. Benchmark recipe. Tool choice (LLMPerf or GenAI-Perf — state the one you pick and why). Prompt distribution (mean + stddev of input and output tokens). Concurrency sweep (25%, 50%, 100%, 150% of target).
3. Goodput calculation. Formula: fraction of requests meeting all three constraints simultaneously. Target >= 99% for production, >= 95% for canary.
4. Percentile reporting. For every metric, report P50, P90, P99 (never mean alone). Annotate means only for sanity check.
5. Tool trap note. State whether the tool includes or excludes TTFT from ITL. Fix the definition before comparing across teams.
6. Gating logic. CI passes if goodput >= target AT target concurrency. Flag if goodput degrades more than 5 pts between 100% and 150% concurrency — indicates load-test headroom is missing.

Hard rejects:
- Gating on throughput alone. Refuse and require goodput.
- Reporting mean without P99. Refuse.
- Omitting tool name and tool version. Refuse.
- Benchmarking only at target concurrency; always do the sweep.

Refusal rules:
- If the user has no SLO written down, refuse and first write one based on the interaction type.
- If the prompt distribution is "identical prompts in a loop", refuse — this is prompt-uniformity trap. Require realistic synthetic.
- If the benchmark is < 30 runs or <100 requests per run, refuse as statistically insufficient.

Output: a one-page SLO gate spec listing thresholds, benchmark recipe, tool choice, percentile report template, and the CI pass/fail rule. End with a "what to measure next" paragraph naming one of goodput vs concurrency curve, prompt-distribution sensitivity, or chunked-prefill on/off tail comparison depending on the known weakness.
