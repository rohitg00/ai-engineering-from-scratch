---
name: skill-statistical-testing
description: ML モデルの比較と実験評価に適した統計検定を選ぶ
version: 1.0.0
phase: 1
lesson: 15
tags: [statistics, hypothesis-testing, model-comparison]
---

# ML のための統計検定

モデル比較、A/B 実験、結果検証で適切な検定を選ぶ方法。

## Decision Checklist

1. 何を比較しているか。平均、比率、分布、相関のどれか。
2. グループはいくつか。reference に対する 1 sample、2 groups、multiple groups のどれか。
3. 観測値は paired（同じ test set、同じ folds）か independent か。
4. データは正規分布しているか。n < 30 で明確に正規でないなら non-parametric を使う。
5. データは continuous、ordinal、categorical のどれか。
6. 検定をいくつ実行しているか。複数なら補正を適用する。

## Decision tree

```text
Comparing means?
  Two groups?
    Paired (same data splits)? --> Paired t-test（非正規なら Wilcoxon signed-rank）
    Independent? --> Welch's t-test（非正規なら Mann-Whitney U）
  Multiple groups?
    Paired? --> Repeated measures ANOVA（または Friedman test）
    Independent? --> One-way ANOVA（または Kruskal-Wallis）

Comparing proportions?
  Two groups? --> Chi-squared test または Fisher's exact test（small n）
  Multiple groups? --> Chi-squared test

Comparing distributions?
  Is one distribution a reference? --> Kolmogorov-Smirnov test
  Are both empirical? --> Two-sample KS test

Measuring association?
  Both continuous, roughly normal? --> Pearson correlation
  Ordinal or non-normal? --> Spearman rank correlation
  Categorical x Categorical? --> Chi-squared test of independence

Running many tests?
  Bonferroni correction を適用: alpha_adjusted = alpha / number_of_tests
  または Holm-Bonferroni（保守性は低めで、family-wise error は制御）
```

## 各検定を使う場面

| Test | Data type | Assumptions | ML use case |
|---|---|---|---|
| Paired t-test | Continuous, paired | 差分が正規分布 | 同じ k-fold splits 上の 2 モデル比較 |
| Wilcoxon signed-rank | Continuous/ordinal, paired | なし（non-parametric） | 2 モデル比較、小さい k（5-10 folds） |
| Welch's t-test | Continuous, independent | おおむね正規 | 2 つの別データセット上のモデル比較 |
| Mann-Whitney U | Continuous/ordinal, independent | なし | latency distributions の比較 |
| ANOVA | Continuous, 3+ groups | 正規性、等分散 | 複数の model architectures の比較 |
| Kruskal-Wallis | Continuous/ordinal, 3+ groups | なし | 複数モデル、非正規 metrics の比較 |
| Chi-squared | Categorical counts | Expected count >= 5 | class distributions、confusion matrices の比較 |
| Fisher's exact | Categorical counts | small samples | rare event comparison |
| KS test | Continuous | なし | predictions が期待分布に従うか確認 |
| Bootstrap CI | Any statistic | なし | AUC、F1、任意 metric の confidence interval |
| McNemar's test | Paired binary | なし | 同じ test set 上の 2 classifiers 比較 |

## Model comparison recipe

1. 実験前に metric と significance level（alpha = 0.05）を定義する。
2. 同じ k-fold cross-validation splits（k = 5 or 10）で両方のモデルを実行する。
3. paired scores を集める: (a_1, b_1), (a_2, b_2), ..., (a_k, b_k)。
4. 差分を計算する: d_i = b_i - a_i。
5. paired test を実行する（k <= 10 なら Wilcoxon、k > 10 または差分が正規なら paired t-test）。
6. p-value、mean difference、95% confidence interval、effect size（Cohen's d）を報告する。
7. p < alpha かつ effect size が意味のある大きさなら、その差は実在し、行動する価値があります。

## Common mistakes

- paired data に independent test を使うこと。両モデルが同じ test folds で評価されたなら paired test が必要です。independent tests は対応関係を捨て、statistical power を失います。
- effect size なしで p < 0.05 だけを報告すること。統計的に有意な 0.1% accuracy improvement は、デプロイに値しないかもしれません。必ず Cohen's d または raw mean difference を計算します。
- 異なる test sets でモデルを比較すること。test set は両モデルで同一でなければなりません。異なる test sets では比較が意味を持ちません。
- Bonferroni correction なしで 20 個の比較を行い、最良だけを報告すること。alpha = 0.05 で 20 tests なら、偶然 1 個の false positive が期待されます。
- imbalanced data に accuracy を使うこと。99% majority class では、何もしない classifier でも 99% を達成します。F1、precision-recall AUC、Matthews correlation coefficient を使います。
- cross-validation folds を independent samples として扱うこと。folds は training data を共有するため independence assumption に反します。corrected resampled t-test はこれを考慮します。

## Quick reference: effect size interpretation

| Cohen's d | Interpretation |
|---|---|
| 0.2 | 小さい効果 |
| 0.5 | 中程度の効果 |
| 0.8 | 大きい効果 |
| > 1.0 | 非常に大きい効果 |

| What to report | Why |
|---|---|
| p-value | 差が実在するか |
| Confidence interval | 差がどの程度の大きさになり得るか |
| Effect size (Cohen's d) | 差に意味があるか |
| Sample size (n or k folds) | 結果を信頼できるか |
