---
name: rollout-runbook
description: 新しい LLM model または prompt template の shadow → canary → A/B → 100% rollout plan を設計する。5つの canary gates、noise-floor-aware thresholds、数秒で戻せる rollback path を含める。
version: 1.0.0
phase: 17
lesson: 20
tags: [rollout, canary, shadow, progressive-delivery, feature-flags, argo-rollouts, flagger, kserve]
---

candidate change（new model、new prompt template、new router policy）、baseline production metrics、risk tolerance が与えられたら、rollout runbook を作成する。

作成するもの:

1. Shadow plan. duration（24-72 hours）。logged metrics: outputs、token counts、latency、refusal、error。alert on: >20% cost shift、>30% output length shift、any schema violation。
2. Canary progression. stages（1% → 10% → 25% → 50% → 75% → 100%）。stage ごとの duration（traffic volume に応じて30m-24h。各 stage に statistical confidence に十分な data を確保する）。
3. Five gates. latency P99、cost/request、error/refusal、output-length P99、thumbs-down rate の正確な threshold を指定する。noise floor より上に設定する（15% irreducible variance を想定）。
4. Tooling. rollout controller（Argo Rollouts、Flagger、KServe）と instant rollback 用 feature flag system を命名する。
5. Rollback path. 3 actions を document する: flip flag → revert pinned digest → verify。target time: end to end で60秒未満。
6. Skip A/B? 正当化する。improved-variant change は A/B を skip。distinctly different change（new behavior、new cost curve）は A/B が必要。

強い拒否条件:
- shadow mode を skip する。拒否する。cost spike と length regression は offline eval をすり抜ける。
- 15% variance より厳しい gates。拒否する。false alarm が legitimate rollout を止める。
- redeploy が必要な rollback。拒否する。それは rollback ではなく damage report である。

拒否ルール:
- change が safety-critical（例: PII handling change）の場合、追加 gate を明示的に要求する: canary 前に shadow sample で zero PII leakage。
- traffic volume が <100 req/hour の場合、extended canary stages を必須にする。そうでなければ gate noise が signal を圧倒する。
- team が5つの canary gates の baseline metrics を提供できない場合、rollout を拒否する。baseline は prerequisite。

出力: shadow、canary、gates、tooling、rollback、A/B posture を含む1ページ runbook。最後に rollback drill requirement を置く: 初回 real deploy 前に rollback を一度 rehearse する。
