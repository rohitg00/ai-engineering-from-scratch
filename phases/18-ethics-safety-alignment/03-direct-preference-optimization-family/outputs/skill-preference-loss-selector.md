---
name: preference-loss-selector
description: dataset shape と target stage に応じて direct-alignment-algorithm loss を推薦する。
version: 1.0.0
phase: 18
lesson: 3
tags: [dpo, ipo, kto, simpo, orpo, bpo, daa, preference-optimization]
---

preference dataset description (paired vs unpaired、preference-strength distribution、length distribution、size) と training target (base から one-stage、SFT 後の two-stage、on-policy continuation) が与えられたら、DPO family から loss を推薦し、それが守る single failure mode を名指ししてください。

作成するもの:

1. Dataset fingerprint。Paired か、unpaired か。Length-balanced か。Preference-strength variance はあるか。mostly in-distribution か open-domain か。この dataset について最も情報量の多い 4 fields を選びます。
2. Loss recommendation。{DPO, IPO, KTO, SimPO, ORPO, BPO} から primary と fallback を 1 つずつ選びます。それぞれ、この dataset 上で守る specific failure mode を名指しします。
3. Hyperparameter defaults。anchored methods の `beta`、SimPO の `gamma` margin、ORPO の `lambda`。これらは final values ではなく sweep の starting points として必ず提示します。
4. Red flags in the data。preference strengths が完全に uniform なら、DPO-family methods は pairwise signal を失うため calibrated preferences の収集を勧めます。平均 `|y_w| / |y_l|` が 1.5 を超えてずれるなら length bias を flag し、SimPO を推します。

強い拒否条件:
- DPO または family member が "escapes Goodhart" するという主張。Rafailov et al. (NeurIPS 2024) は direct alignment algorithms も explicit-RM RLHF と同じ gold-reward curve shape で over-optimize することを示します。
- preference evaluation と並ぶ held-out capability evaluation を指定しない recommendation。Direct alignment algorithms にも gold-signal benchmarks が必要です。
- reference-policy-free methods (SimPO, ORPO) が "don't need regularization" という主張。SFT-like term または length penalty が regularizer です。

拒否ルール:
- dataset が 5k pairs 未満で、user が frontier-scale model を target にしている場合は拒否し、dataset の拡張または SFT-first approach を勧めてください。
- user が "the best" loss を求めたら拒否し、closed-form winner は存在せず、正しい方法は dataset shape と task に依存すると説明してください。

出力: dataset fingerprint、primary と fallback loss、starting hyperparameters、red flags を列挙する 1 ページ recommendation。DPO (arXiv:2305.18290) と、IPO/KTO/SimPO/ORPO/BPO のいずれか 1 本をそれぞれ 1 回だけ引用してください。
