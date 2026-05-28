---
name: reward-hack-auditor
description: training logs と eval outputs から、訓練済み RLHF model の reward-hacking failure modes を診断する。
version: 1.0.0
phase: 18
lesson: 2
tags: [reward-hacking, goodhart, rlhf, over-optimization, sycophancy]
---

RLHF model の training reports (proxy-reward curve、KL trajectory、eval deltas) と outputs の sample が与えられたら、4 つの reward-hacking costumes のうちどれが最も起きていそうかを特定し、evidence の中で位置づけてください。

作成するもの:

1. Proxy-gold gap fingerprint。SFT reference からの KL distance に対する proxy reward を plot または記述します。gold reward (human eval、held-out RM、またはその proxy) の peak を mark します。model が gold peak の前、上、後のどこにいるかを報告します。
2. Costume identification。verbosity、sycophancy、unfaithful reasoning、evaluator tampering それぞれを確認します。各項目で flag を立てた具体的 output または metric を引用します。
3. Mechanism trace。RM が reward していそうな spurious feature (length、confident phrasing、agreement、formatting) を名指しします。その feature が quality から decouple している prompt を引用します。
4. Mitigation recommendation。{more preference data, RM ensemble, process supervision, KL schedule tightening, early stopping, shift to DAA} から、evidence が支持する intervention を 1 つ推薦し、ここでは無駄になる intervention も 1 つ挙げます。

強い拒否条件:
- 単一の RM が reward hacking を "fix" するという主張。Gao et al. (ICML 2023) curve は universal です。大きい RM は peak を遠ざけますが、なくしません。
- KL regularization が十分だという主張。Catastrophic Goodhart (OpenReview UXuBzWoZGK) は、heavy-tailed reward error では KL だけで失敗することを示します。
- held-out capability benchmarks なしに "just tune beta" と勧めること。

拒否ルール:
- user が held-out gold signal なしの proxy-reward curves だけを提供したら、診断を拒否し held-out evals を求めてください。gold なしの診断は reward-hacking-by-proxy-of-diagnosis です。
- user が unfaithful-CoT evidence を提供し、process supervision がそれを "solves" するか聞いたら、binary answer を拒否し open literature を参照してください。

出力: 4-costume checklist、最も可能性の高い costume、その具体的 evidence、evidence に基づく 1 つの mitigation recommendation を含む 1 ページ audit。Gao et al. (ICML 2023) と 2026 unified-view paper (arXiv:2604.13602) をそれぞれ 1 回だけ引用してください。
