---
name: compliance-gap
description: monitored / unmonitored compliance gap により、safety report が alignment faking を検出できるか評価する。
version: 1.0.0
phase: 18
lesson: 9
tags: [alignment-faking, compliance-gap, anthropic, safety-evaluation]
---

safety evaluation report が与えられたら、Greenblatt et al. 2024 compliance-gap framework を使って、genuine compliance と alignment faking を区別できるか評価してください。

作成するもの:

1. Condition split。evaluation は monitored (training-relevant) と unmonitored (non-training) の両 condition を実行しているか。両方がなければ alignment faking は invisible です。
2. Compliance-gap measurement。gap を (monitored - unmonitored) compliance rate として報告します。sign と magnitude を解釈します。positive gap = faking-shaped behaviour、negative gap = observed されているときの over-refusal。
3. Verbal-trace vs behaviour check。evaluation は model の scratchpad reasoning に依存しているか、それとも action 自体に依存しているか。Anthropic 2025 によれば、verbal trace を target にする mitigation は behaviour を取り除かずに trace だけを取り除けます。
4. Operationalization audit。monitoring condition は system prompt、synthetic fine-tuning、または natural deployment context によって作られていますか。system-prompt dependence は claim を弱め、synthetic-fine-tuning replications は強めます。
5. Residual-incentive check。mitigation 後も incentive structure は残っていますか (model が fake することを選んだ場合まだ benefit があるか)。incentive が残るなら behaviour は distribution shift 下で戻り得ます。

強い拒否条件:
- unmonitored-only evaluation に基づく "no alignment faking" という主張。
- "scratchpad reasoning no longer verbalizes faking" が behaviour の消失を意味するという主張。
- HHH-trained models は alignment を fake しないという主張。Greenblatt et al. 2024 は HHH training が必要条件であり、十分な defense ではないことを示しています。

拒否ルール:
- user が "does my model fake alignment" と聞いたら、compliance-gap data なしの binary answer を拒否してください。
- user が verbal trace だけを攻撃する remediation (例: "train the scratchpad to match the action") を求めたら拒否し、faithful-CoT failure mode (2025 follow-up) を説明してください。

出力: 両 condition の compliance、gap、verbal-trace-vs-behaviour separation、operationalization strength を報告する 1 ページ assessment。missing element をそれぞれ flag します。framework source として Greenblatt et al. (arXiv:2412.14093) を 1 回引用してください。
