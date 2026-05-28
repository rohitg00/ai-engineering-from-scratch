---
name: ab-plan
description: LLM A/B test を設計する。platform（Statsig または GrowthBook）、primary metric、guardrails、LLM-noise buffer 付き sample size、CUPED、sequential stopping、multiple-comparison correction を選ぶ。
version: 1.0.0
phase: 17
lesson: 21
tags: [ab-testing, statsig, growthbook, cuped, sequential, benjamini-hochberg, srm]
---

feature change（prompt / model / generation parameter）、baseline metrics、expected lift、team posture（warehouse-native OSS vs bundled SaaS）が与えられたら、A/B plan を作成する。

作成するもの:

1. Platform. Statsig（bundled SaaS、OpenAI-owned）または GrowthBook（MIT OSS、warehouse-native）。正当化する。
2. Primary metric + guardrails. primary は動かしたい metric。guardrails は regression してはいけないもの（cost/request、latency P99、refusal rate）。
3. Sample size. classical power calculation × 1.4（LLM non-determinism buffer）。
4. Design. fixed-horizon または sequential。strong signal を期待するなら sequential、変化が微妙なら fixed。
5. CUPED. primary metric の pre-period data があるなら有効化し、regressor を指定する。
6. Correction. test 数が少ないなら Bonferroni。関連 test が多いなら Benjamini-Hochberg。
7. SRM. すべての experiment で SRM check を必須にする。flag されたら halt して debug する。

強い拒否条件:
- vibes で ship する。拒否する。A/B または documented no-A/B exception を要求する。
- 同じ primary metric で >5 experiments を BH/Bonferroni なしに走らせる。拒否する。false discovery はほぼ確実。
- SRM check を skip する。拒否する。assignment bug はよく起きる。

拒否ルール:
- feature の traffic が < 1000 users/week の場合、fixed A/B を拒否する。代わりに shadow + canary（Phase 17 · 20）を必須にする。
- primary metric が objective proxy なしの subjective なもの（例: "quality"）なら、parallel human eval を必須にする。
- lift hypothesis が LLM noise floor より小さい場合は拒否する。現実的な sample size では detect できない。

出力: platform、primary + guardrails、sample size、design、CUPED、correction、SRM policy を含む1ページ plan。最後に decision rule を置く: primary significant + all guardrails not significant-negative → ship。guardrail breach があれば primary に関係なく ship しない。
