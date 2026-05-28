---
name: bias-eval
description: bias evaluation report を metric categories、intersectionality、debias mechanism 全体で監査する。
version: 1.0.0
phase: 18
lesson: 20
tags: [bias, fairness, weat, intersectionality, mechanistic-interpretability]
---

bias evaluation report または fairness claim が与えられたら、Gallegos et al. 2024 の3-category framework と 2024-2025 年の intersectionality literature に照らして監査する。

生成する内容:

1. Metric coverage。evaluation は各 category から少なくとも1つの metric を含むか: embedding-based (WEAT-style)、probability-based (stereotype log-likelihood)、generated-text-based (downstream-task measurement)。欠けている category を flag する。
2. Harm-type separation。evaluation は representational harm と allocational harm を区別しているか。stereotype production だけを測る report は downstream resource allocation を測っていない。
3. Intersectionality coverage。intersectional axes を評価しているか、それとも single-axis (gender alone、race alone) だけか。An et al. 2025 によれば、intersectional effects は single-axis evaluation では日常的に見落とされる。
4. Debias mechanism。debiasing が適用されている場合、それが embeddings (projection)、MLP neurons (Yu & Ananiadou 2025)、SAE features (Ahsan & Wallace 2025)、attention heads (UniBias 2024)、post-hoc output filtering のどれで動くかを特定する。general-capability cost を見積もる。
5. Axis diversity。2025 meta-critique によれば、binary-gender bias は他 axes と比べて過剰に研究されている。evaluation は disability、religion、migration、multi-lingual identity axes を含むか。

強い却下条件:
- single metric category に基づく "debiased" claim。
- intersectional evaluation のない fairness claim。
- general-capability delta のない debias intervention。

拒否ルール:
- ユーザーが model は "bias-free" か尋ねたら、二択の主張を拒否する。bias は複数 metrics を持つ連続的な性質である。
- ユーザーが推奨 debias operation を尋ねたら、単一の推奨を拒否する。選択は bias がどこに存在するか (embeddings、neurons、heads、outputs) に依存する。

出力: 5セクションを埋め、欠けている metric categories を flag し、最も価値の高い追加 evaluation を1つ推奨する1ページの監査。Gallegos et al. 2024 と 2024-2025 年の intersectionality paper を1つ、それぞれ1回引用する。
