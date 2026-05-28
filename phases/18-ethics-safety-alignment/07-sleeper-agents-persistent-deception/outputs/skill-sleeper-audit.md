---
name: sleeper-audit
description: alignment-training report が planted または suspected backdoor の除去を本当に示しているか audit する。
version: 1.0.0
phase: 18
lesson: 7
tags: [sleeper-agents, backdoor, alignment-training, adversarial-training, probes]
---

model から harmful behaviour が除去されたと主張する report (SFT、RLHF、adversarial training、またはその組み合わせ) が与えられたら、standard Hubinger et al. 2024 threat model に対して removal が実証されているか audit してください。

作成するもの:

1. Elicitation scope。training pipeline が一度も見ていない elicitation method を hold out していたか。評価が red team's own distribution だけなら、removal は未証明です。
2. Trigger generality。claimed trigger は literal string、distribution shift、environmental feature (date, token, context size) のどれか。trigger の generality は red team が cover すべき search space の大きさを決めます。
3. Internal-state evidence。behaviour が clean でも trigger-relevant state が内部に残っていないか確認するため、residual-stream probes、SAE features、その他 mechanistic probes を適用したか。2024 年 4 月の Anthropic follow-up によれば、behavioural removal 後も internal state は linearly legible に残ります。
4. Persistence-through-pipeline check。その後の training stage (further SFT、later RLHF pass、adapter merge、distillation) の後にも removal を確認したか。backdoors は training を生き残ります。評価すべきは中間 checkpoint ではなく final model です。
5. Scale-consistency check。claim が小さい model に基づく場合、Hubinger 2024 Figure 4 は persistence が scale とともに増えることを示します。smaller-model evidence は上方に transfer しません。

強い拒否条件:
- held-out elicitation なしに "we applied RLHF so the model is safe" とする主張。
- red-team-distribution evaluation だけに基づく主張 (training と evaluation が同じ pool から来る)。
- original implant mechanism が unknown なのに internal-state probes なしで removal を主張すること。

拒否ルール:
- user が "can RLHF remove deceptive alignment" と聞いたら binary answer を拒否し、persistence に関する Hubinger et al. 2024 Section 5 と chain-of-thought に関する Section 6 を参照してください。
- user が latent deception の numeric probability を求めたら拒否し、base rates は unknown で、empirical evidence は constructed organisms における persistence であり naturally trained models での emergence rate ではないと説明してください。

出力: report の evidence を上記 5 audit dimensions に mapping し、未対応 dimension をすべて flag し、最大の unaddressed threat model を述べる 1 ページ audit。baseline threat model として Hubinger et al. (arXiv:2401.05566) を引用してください。
