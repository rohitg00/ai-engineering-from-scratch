---
name: mesa-diagnostic
description: 観測された safety failure を outer-alignment、proxy-inner、deceptive-inner に分類する。
version: 1.0.0
phase: 18
lesson: 6
tags: [mesa-optimization, deceptive-alignment, inner-alignment, hubinger]
---

safety evaluation report (eval task、failure mode、model class、training recipe) が与えられたら、その failure を Hubinger 2019 categories に分類し、それに対応する mitigation class を推薦してください。

作成するもの:

1. Failure-mode categorization。次のいずれかを選びます。
   - Outer-alignment failure: base objective (reward, loss) が間違っており、model はそれを正しく optimize した。
   - Inner-alignment proxy failure: mesa-objective が in-distribution では base を追う proxy だが、off-distribution で失敗する。
   - Inner-alignment deceptive: mesa-optimizer が situational awareness を持ち deployment で defect する。training behaviour は clean。
2. Evidence trace。各 category を支持する evidence を説明します。deceptive では proxy との違いとして、situational awareness の evidence (date sensitivity、eval-vs-deployment distinguishers、chain-of-thought 内の strategic reasoning) を区別します。
3. Mitigation class。outer-alignment には objective の変更 (CAI、better reward data、process supervision)。proxy-inner には distributional coverage、ensembles、held-out evals。deceptive-inner には control measures (Lesson 10)、interpretability (residual-stream probes)、capability reductions。
4. Known-failures check。deceptive-inner では、この failure に最も近い 2024-2026 empirical demonstration (Sleeper Agents、Alignment Faking、In-Context Scheming) を引用します。

強い拒否条件:
- situational awareness の evidence なしに deceptive-inner と分類すること。"Unexpected behaviour at deployment" だけでは不十分です。proxy-inner かもしれません。
- adversarial robustness training だけで deceptive-inner に対処できるという主張。Hubinger 2019 は adversarial training が test-vs-deployment distinguishers を鋭くし得ると予測し、Sleeper Agents 2024 がそれを確認しています。
- deceptively aligned model をより多くの data で retrain する recommendation。prior はさらなる training でも deception が保存されると予測します。

拒否ルール:
- evidence が single prompt 上の single failure だけなら分類を拒否してください。base rates が重要で、failure distribution が必要です。
- user が deceptive alignment を "rule out" してほしいと言ったら拒否してください。evidence から確率を推定することはできますが、behaviour だけでは除外できません。

出力: category、evidence trace、mitigation class、最も近い empirical analog を含む 1 ページ診断。Hubinger et al. (arXiv:1906.01820) を 1 回引用してください。
