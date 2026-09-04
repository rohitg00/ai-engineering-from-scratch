---
name: skill-statistical-testing
description: Choose the right statistical test for comparing ML models and evaluating experiments
version: 1.0.0
phase: 1
lesson: 15
tags: [statistics, hypothesis-testing, model-comparison]
---

# Statistical Testing for ML

How to pick the right test when comparing models, running A/B experiments, or validating results.

## Decision Checklist

1. What are you comparing? Means, proportions, distributions, or correlations?
2. How many groups? One sample vs reference, two groups, or multiple groups?
3. Are observations paired (same test set, same folds) or independent?
4. Is the data normally distributed? If n < 30 and not clearly normal, use non-parametric.
5. Is the data continuous, ordinal, or categorical?
6. How many tests are you running? Apply correction if more than one.

## Decision tree

```text
Comparing means?
  Two groups?
    Paired (same data splits)? --> Paired t-test (or Wilcoxon signed-rank if non-normal)
    Independent? --> Welch's t-test (or Mann-Whitney U if non-normal)
  Multiple groups?
    Paired? --> Repeated measures ANOVA (or Friedman test)
    Independent? --> One-way ANOVA (or Kruskal-Wallis)

Comparing proportions?
  Two groups? --> Chi-squared test or Fisher's exact test (small n)
  Multiple groups? --> Chi-squared test

Comparing distributions?
  Is one distribution a reference? --> Kolmogorov-Smirnov test
  Are both empirical? --> Two-sample KS test

Measuring association?
  Both continuous, roughly normal? --> Pearson correlation
  Ordinal or non-normal? --> Spearman rank correlation
  Categorical x Categorical? --> Chi-squared test of independence

Running many tests?
  Apply Bonferroni correction: alpha_adjusted = alpha / number_of_tests
  Or use Holm-Bonferroni (less conservative, still controls family-wise error)
```

## When to use each test

| Test | Data type | Assumptions | ML use case |
|---|---|---|---|
| Paired t-test | Continuous, paired | Normal differences | Compare 2 models on same k-fold splits |
| Wilcoxon signed-rank | Continuous/ordinal, paired | None (non-parametric) | Compare 2 models, small k (5-10 folds) |
| Welch's t-test | Continuous, independent | Roughly normal | Compare model on two separate datasets |
| Mann-Whitney U | Continuous/ordinal, independent | None | Compare latency distributions |
| ANOVA | Continuous, 3+ groups | Normal, equal variance | Compare multiple model architectures |
| Kruskal-Wallis | Continuous/ordinal, 3+ groups | None | Compare multiple models, non-normal metrics |
| Chi-squared | Categorical counts | Expected count >= 5 | Compare class distributions, confusion matrices |
| Fisher's exact | Categorical counts | Small samples | Rare event comparison |
| KS test | Continuous | None | Check if predictions follow expected distribution |
| Bootstrap CI | Any statistic | None | Confidence interval for AUC, F1, any metric |
| McNemar's test | Paired binary | None | Compare two classifiers on same test set |

## Model comparison recipe

1. Define metric and significance level (alpha = 0.05) before running experiments.
2. Run both models on the same k-fold cross-validation splits (k = 5 or 10).
3. Collect paired scores: (a_1, b_1), (a_2, b_2), ..., (a_k, b_k).
4. Compute differences: d_i = b_i - a_i.
5. Run paired test (Wilcoxon for k <= 10, paired t-test for k > 10 or normal diffs).
6. Report: p-value, mean difference, 95% confidence interval, effect size (Cohen's d).
7. If p < alpha AND effect size is meaningful, the difference is real and worth acting on.

## Common mistakes

- Using an independent test when data is paired. If both models were evaluated on the same test folds, you must use a paired test. Independent tests throw away the pairing and lose statistical power.
- Reporting p < 0.05 without effect size. A statistically significant 0.1% accuracy improvement is not worth deploying. Always compute Cohen's d or the raw mean difference.
- Comparing models across different test sets. The test set MUST be identical for both models. Different test sets make comparison meaningless.
- Running 20 comparisons and reporting the best one without Bonferroni correction. With 20 tests at alpha = 0.05, you expect 1 false positive by chance.
- Using accuracy on imbalanced data. On a 99% majority class, a trivial classifier achieves 99%. Use F1, precision-recall AUC, or Matthews correlation coefficient.
- Treating cross-validation folds as independent samples. They share training data, which violates the independence assumption. The corrected resampled t-test accounts for this.

## Quick reference: effect size interpretation

| Cohen's d | Interpretation |
|---|---|
| 0.2 | Small effect |
| 0.5 | Medium effect |
| 0.8 | Large effect |
| > 1.0 | Very large effect |

| What to report | Why |
|---|---|
| p-value | Is the difference real? |
| Confidence interval | How big could the difference be? |
| Effect size (Cohen's d) | Is the difference meaningful? |
| Sample size (n or k folds) | Can we trust the result? |
