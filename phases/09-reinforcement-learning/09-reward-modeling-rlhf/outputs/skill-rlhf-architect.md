---
name: rlhf-architect
description: RM、KL、データ戦略を含め、言語モデル向けの RLHF / DPO / GRPO alignment pipeline を設計する。
version: 1.0.0
phase: 9
lesson: 9
tags: [rl, rlhf, alignment, llm]
---

base LM、目標行動 (alignment / reasoning / refusal / agent)、選好または verifier の予算を受け取り、次を出力する:

1. Stage。SFT? RM? DPO? GRPO? 根拠も含める。
2. 選好または verifier の source。人間、AI feedback、rule-based、unit-test-pass、または reward distillation。
3. KL strategy。固定 β、adaptive β、または DPO (implicit KL)。
4. Diagnostics。平均 KL、reward stability、過剰最適化 guard (holdout human eval)。
5. Safety gate。Red-team set、refusal rate、helpfulness RM とは別の safety RM。

KL monitor なしで RLHF-PPO を出荷することを拒否する。target policy より小さい RM の使用を拒否する。length-only rewards を拒否する。blind human-eval set を保持しない pipeline は、過剰最適化への保護が欠けていると flag する。
