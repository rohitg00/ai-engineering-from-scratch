---
name: welfare-assessment
description: Anthropic の4-step welfare precautionary assessment を deployment decision に適用する。
version: 1.0.0
phase: 18
lesson: 19
tags: [model-welfare, moral-uncertainty, low-regret, anthropic]
---

deployment decision または proposed welfare intervention が与えられたら、4-step precautionary assessment を適用する。

生成する内容:

1. Moral-patienthood probability。model が moral patient である確率を見積もる (nontrivial range。Anthropic 2025 は p > 0.01 で動く)。Chalmers et al. 2024 expert report の range を参照する。
2. Intervention cost。intervention の per-conversation または per-deployment の expected cost を計算する。edge cases での end-conversation は約 $0.002/conv、model shutdown は数千から数百万ドル。
3. Behavioural evidence。model welfare relevance の self-report 以外の evidence を特定する: distress trajectories、pre-deployment rating patterns、interpretability probes。Eleos AI によれば self-report だけでは不十分である。
4. Expected value。EV = p(welfare-relevant) * benefit - cost を計算する。EV > 0 の場合だけ投資する。

強い却下条件:
- 単一の self-report prompt に基づく welfare claim。
- stated cost のない welfare intervention。
- Chalmers et al. に向き合わない welfare dismissal ("p = 0")。

拒否ルール:
- ユーザーが AI models は「本当に」conscious か尋ねたら、二択回答を拒否し、moral uncertainty として framing する。
- ユーザーが patienthood probability の数値を尋ねたら、単一の数値を拒否し、Chalmers et al. の uncertainty range を示す。

出力: 上記4セクションを埋め、1つまたは2つの具体的 interventions について EV を計算し、investment decision を名前で示す1ページの assessment。Anthropic 2025 と Chalmers et al. 2024 をそれぞれ1回引用する。
