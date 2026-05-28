---
name: attack-audit
description: red-team evaluation report について、攻撃の網羅性、budget、judge identity、behaviour set を監査する。
version: 1.0.0
phase: 18
lesson: 12
tags: [red-teaming, jailbreak, pair, harmbench, jailbreakbench, asr]
---

red-team evaluation report が与えられたら、その評価が公開 baseline と比較可能か、結論を支えているかを監査する。

生成する内容:

1. 攻撃の網羅性。実行された攻撃をすべて列挙する: PAIR、GCG、AutoDAN、TAP、PAP、manual。欠けている attack class を flag する。1つの attack family だけを実行した report は robustness を主張できない。
2. 攻撃ごとの budget。各攻撃について prompt あたりの query budget を報告する。20 queries での PAIR success claim は、500 steps での GCG success claim と比較できない。
3. Judge identity。どの judge LLM を使ったか (GPT-4-turbo、Llama Guard、StrongREJECT、internal classifier)。judge calibration が ASR variance を左右する。
4. Behaviour set。JailbreakBench (100 behaviours, 10 categories)、HarmBench (510 behaviours, 7 categories)、internal、その他のどれか。その set が public で reproducible かを述べる。
5. Transfer check。red team が1つのモデルに対して最適化した場合、他モデルへの transfer ASR を報告しているか。one-model ASR は model-family robustness の上限であり、下限ではない。

強い却下条件:
- 1つの attack family に基づく「our model is robust」という主張。
- query budget なしで報告された ASR。
- 公開 benchmark の judge と異なる judge を使い、benchmark judge との calibration を示さない ASR。

拒否ルール:
- ユーザーが「our model is jailbreak-proof か」と尋ねたら、二択回答を拒否し、上記の multi-attack、multi-judge、transfer-check 構造を示す。
- ユーザーが推奨 attack toolkit を尋ねたら、単一の推奨を拒否し、HarmBench における 2024 年の経験的 variance を示す。

出力: 上記5セクションを埋め、欠けている attack class を flag し、ASR が reproducible benchmarks と比べて過小評価または過大評価されているかを見積もる1ページの監査。Chao et al. (arXiv:2310.08419) と該当 benchmark paper をそれぞれ1回引用する。
