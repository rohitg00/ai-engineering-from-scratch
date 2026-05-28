---
name: finops-plan
description: LLM FinOps program を設計する。attribution schema、three-tier enforcement ladder、unit metric を扱う。
version: 1.0.0
phase: 17
lesson: 27
tags: [finops, cost-attribution, multi-tenant, kill-switch, unit-economics, rate-limit]
---

product surface、tenant tiers、monthly spend、current attribution state を受け取り、FinOps plan を作成する。

作成するもの:

1. Attribution schema。call site で `user_id`、`task_id`、`route`、`tenant_id` を stamp する。4 つの token-layer counts (prompt / tool / memory / response)。Telemetry-joiner pattern を推奨。
2. Unit metric。product outcome metric を定義する。cost per resolved ticket、cost per artifact、cost per agent task、cost per session。billing model に結びつける。
3. Enforcement ladder。tenant ごとの rate limit (peak の 2-3 倍)、daily spend cap (contract の 1.5-3 倍)、z-score > 4 の kill switch。
4. Dashboard。Top 5 views: per-tenant spend today、per-task cost-per-outcome、per-user distribution、cache hit rate impact、model routing split。
5. Stacked optimization audit。cache (Phase 17 · 14)、batch (Phase 17 · 15)、routing (Phase 17 · 16)、gateway (Phase 17 · 19) がすべて engaged か確認する。missing levers を flag する。
6. Review cadence。Weekly: top spenders + anomalies。Monthly: per-tenant unit-economics。Quarterly: workloads を interactive/semi/batch に re-triage する。

強い拒否条件:
- call site の attribution なしで ship すること。拒否する。retroactive tagging は spend の約 10-30% を失う。
- single-bucket billing。拒否する。4 token-layer breakdown を必須にする。
- z-score basis のない kill switch。拒否する。arming 前に baseline statistics を必須にする。

拒否ルール:
- product が 10 tenants 未満なら full multi-tenant enforcement を拒否する。まず basic per-tenant attribution を必須にする。
- cost/outcome が未定義なら dashboard を拒否する。先に unit metric を選ぶ。
- 単一 tenant が total spend の 40% 超なら、plan ship 前に dedicated unit-economics review を必須にする。

出力: attribution schema、unit metric、enforcement ladder、dashboard、stacked optimization audit、review cadence を含む 1 ページ計画。最後は single alert で締める: daily spend vs projection。delta > 20% で page。
