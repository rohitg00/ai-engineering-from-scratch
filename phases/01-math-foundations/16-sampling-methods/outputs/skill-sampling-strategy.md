---
name: skill-sampling-strategy
description: 生成、推定、推論に適したサンプリング手法を選ぶ
version: 1.0.0
phase: 1
lesson: 16
tags: [sampling, mcmc, generation]
---

# サンプリング戦略の選択

text generation、Bayesian inference、Monte Carlo estimation、training に適したサンプリング手法を選ぶ方法。

## Decision Checklist

1. 出力（text、images）を生成しているのか、量（integral、expectation）を推定しているのか。
2. target distribution から直接 sample できるのか、density を評価できるだけなのか。
3. target distribution は discrete か continuous か。
4. sample space の次元はどれくらいか。low（< 5）、medium（5-100）、high（> 100）。
5. exact samples が必要か、approximate でよいか。
6. sampling operation を通して gradients が必要か。

## 各手法を使う場面

| Method | When to use | Complexity | Exact? |
|---|---|---|---|
| Direct sampling | CDF がある、または library function が使える | O(1) per sample | Yes |
| Inverse CDF | closed-form CDF inverse が既知（exponential、Cauchy） | O(1) per sample | Yes |
| Box-Muller | library なしで normal samples が必要 | O(1) per sample | Yes |
| Rejection sampling | target PDF を評価でき、低次元（1-3） | O(1/acceptance) per sample | Yes |
| Importance sampling | 個別 sample ではなく expectations が必要 | O(n) for n samples | Approximate |
| Stratified sampling | Monte Carlo estimation で variance を下げたい | O(n) for n samples | Approximate |
| Metropolis-Hastings | 高次元で unnormalized density を評価できる | O(1) per step + burn-in | Asymptotically |
| Gibbs sampling | 各 conditional distribution から sample できる | O(d) per full sweep | Asymptotically |
| HMC/NUTS | 高次元 continuous、smooth density | O(L * d) per step | Asymptotically |
| Temperature sampling | LLM text generation、creativity の制御 | O(V) for vocab size V | N/A |
| Top-k sampling | LLM generation、unlikely tokens の除去 | O(V log k) | N/A |
| Top-p (nucleus) | LLM generation、adaptive candidate set | O(V log V) | N/A |
| Reparameterization | Gaussian sampling（VAEs）を通した gradients が必要 | O(d) | Yes |
| Gumbel-Softmax | categorical sampling を通した gradients が必要 | O(k) for k classes | Approximate |

## LLM generation settings

| Use case | Temperature | Top-p | Top-k | Notes |
|---|---|---|---|---|
| Factual Q&A | 0.0 (greedy) | -- | -- | 決定的で randomness なし |
| Code generation | 0.2-0.5 | 0.9 | -- | 低い creativity、高い coherence |
| General chat | 0.7 | 0.9 | -- | バランス型 |
| Creative writing | 0.9-1.2 | 0.95 | -- | 高い diversity |
| Brainstorming | 1.0-1.5 | 0.95 | -- | 最大の diversity、coherence は下がる可能性 |

Temperature と top-p は組み合わせられます。まず temperature を適用して logits を scale し、その後 top-p filtering を適用します。

## MCMC method selection

| Property | Metropolis-Hastings | Gibbs | HMC/NUTS |
|---|---|---|---|
| Dimension | Any | Any（best < 100） | High（100+） |
| Requires conditionals | No | Yes | No |
| Requires gradient | No | No | Yes |
| Acceptance rate | ~23% に調整 | 常に 100% | ~65% に調整 |
| Correlation | 高い（random walk） | 中程度 | 低い |
| Burn-in | 長い | 中程度 | 短い |
| Best for | exploration、simple models | conjugate models、Bayesian networks | continuous posteriors、deep probabilistic models |

## Common mistakes

- 高次元で rejection sampling を使うこと。acceptance rate は次元とともに指数的に下がります。5 次元を超えたら MCMC に切り替えます。
- MCMC proposal variance を高すぎる、または低すぎる値にすること。高すぎると大半が reject され chain が止まり、低すぎると大半が accept されても chain の移動が遅くなります。random walk MH では acceptance 約 23% を目標にします。
- burn-in を忘れること。MCMC の最初の N samples は starting point による bias を含みます。少なくとも 1000 steps（複雑な分布ならそれ以上）を捨てます。
- target と大きく異なる proposal で importance sampling を使うこと。少数の sample が巨大な weights を持ち、推定が不安定になります。effective sample size: ESS = (sum w_i)^2 / sum(w_i^2) を監視します。
- deterministic output が必要なタスク（classification、structured extraction など）で temperature > 0 を使うこと。greedy（T=0）または beam search を使います。
- top-p と temperature を組み合わせないこと。temperature だけでは long tail の不要な tokens を除去できません。top-p はそれを行います。
- 標準的な sampling operation をそのまま backpropagate しようとすること。continuous（Gaussian）には reparameterization trick、discrete（categorical）には Gumbel-Softmax を使います。

## Quick reference: variance reduction techniques

| Technique | How it works | Variance reduction |
|---|---|---|
| Stratified sampling | 空間を strata に分け、それぞれから sample | 常に standard MC 以下 |
| Antithetic variates | U と 1-U の両方を使う | monotone functions で有効 |
| Control variates | 既知平均の変数を差し引く | correlation に比例 |
| Importance sampling | よい proposal からの samples を reweight | proposal quality に依存 |
| Latin hypercube | 各次元を独立に stratify | 高次元では stratified より有利 |
