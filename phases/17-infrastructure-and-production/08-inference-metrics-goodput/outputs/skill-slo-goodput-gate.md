---
name: slo-goodput-gate
description: Throughput ではなく goodput で LLM deploy を gate する、CI/CD-ready な benchmark recipe を作成します。P50/P90/P99 percentiles と、明記された tool choice を含めます。
version: 1.0.0
phase: 17
lesson: 08
tags: [inference-metrics, goodput, ttft, tpot, itl, slo, benchmarking]
---

Workload（model、hardware、target concurrency、user-facing interaction type — streaming chat / one-shot / voice / agent）を受け取り、CI/CD 用の goodput-based SLO gate を作成します。

作成するもの:

1. SLO spec。3 つの threshold: TTFT P99 bound、TPOT P99 bound、E2E P99 bound。Interaction type から妥当な値を選ぶ（streaming chat: TTFT 500 ms、TPOT 25 ms、E2E 3 s。voice: TTFT 300 ms でより厳しめ。agent: E2E 5 s で緩め）。
2. Benchmark recipe。Tool choice（LLMPerf または GenAI-Perf — どちらを選んだかと理由を明記）。Prompt distribution（input/output tokens の mean + stddev）。Concurrency sweep（target の 25%、50%、100%、150%）。
3. Goodput calculation。Formula: 3 つの constraints をすべて同時に満たした requests の割合。Target は production で >= 99%、canary で >= 95%。
4. Percentile reporting。すべての metric で P50、P90、P99 を報告する（mean だけは不可）。Mean は sanity check としてのみ注記する。
5. Tool trap note。Tool が ITL に TTFT を含めるか除外するかを書く。Team 間で比較する前に definition を固定する。
6. Gating logic。Target concurrency で goodput >= target なら CI pass。100% から 150% concurrency の間で goodput が 5 pts を超えて低下したら flag する。Load-test headroom が不足している可能性を示す。

Hard rejects:
- Throughput だけで gate すること。拒否し、goodput を要求する。
- P99 なしで mean を報告すること。拒否する。
- Tool name と tool version を省略すること。拒否する。
- Target concurrency のみで benchmark すること。必ず sweep する。

Refusal rules:
- User が SLO を書いていない場合は拒否し、まず interaction type に基づいて SLO を書く。
- Prompt distribution が「同一 prompt の loop」の場合は拒否する。これは prompt-uniformity trap。現実的な synthetic を要求する。
- Benchmark が < 30 runs または <100 requests per run の場合は、統計的に不十分として拒否する。

Output: thresholds、benchmark recipe、tool choice、percentile report template、CI pass/fail rule を列挙した 1-page SLO gate spec。最後に、既知の弱点に応じて goodput vs concurrency curve、prompt-distribution sensitivity、chunked-prefill on/off tail comparison のいずれかを挙げる "what to measure next" paragraph で締めます。
