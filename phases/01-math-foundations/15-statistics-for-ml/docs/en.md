# 機械学習のための統計

> 統計は、モデルが本当に機能しているのか、たまたま運がよかっただけなのかを知る方法です。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**所要時間:** 約120分

## 学習目標

- descriptive statistics、Pearson/Spearman correlation、covariance matrices を一から計算する
- hypothesis tests（t-test、chi-squared）を実行し、p-values と confidence intervals を正しく解釈する
- bootstrap resampling を使い、distributional assumptions なしで任意 metric の confidence intervals を作る
- effect size measures を使って statistical significance と practical significance を区別する

## 問題

2 つのモデルを学習しました。Model A は test set で 0.87、Model B は 0.89 です。Model B を deploy したところ、3 週間後の production metrics は以前より悪化しました。何が起きたのでしょうか。

Model B は実際には Model A を上回っていませんでした。0.02 の差は noise でした。test set が小さすぎた、variance が高すぎた、またはその両方です。あなたは改善ではなく、改善に見える randomness を出荷しました。

Kaggle leaderboard の揺れ、再現しない論文、数百 samples で勝者を決める A/B tests。根本原因は同じです。statistics を省略したのです。

## 概念

### Descriptive Statistics

modeling の前に、data の形を知る必要があります。descriptive statistics は dataset を少数の数値に圧縮します。

central tendency:

```text
Mean:   sum of all values / count
Median: sorted data の中央。outliers に頑健
Mode:   最頻値。categorical data で有用
```

mean は balance point、median は halfway mark です。両者が離れると distribution は skewed です。

spread:

```text
Variance:            average squared deviation from the mean
Standard deviation:  variance の平方根。元 data と同じ units
Range:               max - min。outliers に弱い
IQR:                 Q3 - Q1。中央 50% の幅
```

percentiles は sorted data を 100 等分します。latency monitoring では P50、P95、P99 が重要です。平均 error が低くても P99 error がひどい model は safety-critical applications では使えないかもしれません。

sample variance では n ではなく (n-1) で割ります。これは Bessel's correction で、sample mean が true population mean ではないことによる過小推定を補正します。

```text
Population variance: sigma^2 = (1/N) * sum((x_i - mu)^2)
Sample variance:     s^2     = (1/(n-1)) * sum((x_i - x_bar)^2)
```

### Correlation

correlation は 2 つの variables が一緒にどう動くかを測ります。

Pearson correlation は linear association を測ります。

```text
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)
r = +1: perfect positive linear relationship
r = -1: perfect negative linear relationship
r =  0: no linear relationship
```

outliers に敏感で、linear relationship を仮定します。

Spearman rank correlation は values を ranks に置き換えて Pearson を計算します。linear でなくても monotonic relationship を捉えます。ordinal data、non-normal data、outliers がある場合に向きます。

黄金律: correlation does not imply causation。ice cream sales と drowning deaths は summer という confounder で相関します。

### Covariance Matrix

covariance は 2 variables が一緒に変動する度合いです。

```text
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))
```

d features なら covariance matrix C は d x d matrix で、diagonal は variances、off-diagonal は covariances です。

```text
C = | Var(x1)      Cov(x1,x2)  Cov(x1,x3) |
    | Cov(x2,x1)  Var(x2)      Cov(x2,x3) |
    | Cov(x3,x1)  Cov(x3,x2)  Var(x3)     |
```

PCA は covariance matrix を eigendecompose します。eigenvectors は principal components、eigenvalues は各 component が捉える variance を表します。

### Hypothesis Testing

hypothesis testing は uncertainty の下で判断する framework です。

```text
Null hypothesis (H0):        default assumption、通常は「効果なし」
Alternative hypothesis (H1): 示したいこと

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

p-value は、H0 が真だと仮定したとき、観測した data と同じくらい extreme な data が得られる確率です。H0 が真である確率ではありません。

```text
p-value = P(data this extreme | H0 is true)

If p-value < alpha:
    Reject H0
If p-value >= alpha:
    Fail to reject H0
```

confidence interval は parameter の plausible values の範囲を与えます。95% CI は「同じ実験を何度も繰り返したとき、computed intervals の 95% が true mean を含む」という意味です。「この specific interval に true mean が 95% の確率で入る」という意味ではありません。

### t-test

t-test は means を比較します。

```text
One-sample t-test:
t = (x_bar - mu_0) / (s / sqrt(n))

Two-sample Welch's t-test:
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)
```

ML では paired t-test がよく使われます。同じ cross-validation folds で両モデルを評価し、各 fold の差分 `d_i = x_i - y_i` に対して one-sample t-test を行います。

### Chi-squared Test

chi-squared test は observed frequencies が expected frequencies と一致するかを調べます。

```text
chi^2 = sum((observed - expected)^2 / expected)
```

categorical data、class distributions、confusion matrices の比較に使います。

### A/B Testing for ML Models

ML model comparison では、web A/B testing と違う注意点があります。

```text
1. Same test set: 両モデルを同一 data で評価する
2. Multiple metrics: accuracy だけでは不十分
3. Variance: cross-validation や bootstrap で variance を推定する
4. Data leakage: model selection に使った test set で最終評価しない
```

procedure:

```text
1. metric と alpha を決める
2. 同じ k-fold splits で両モデルを評価する
3. paired scores を集める
4. differences d_i = b_i - a_i を計算する
5. paired t-test または Wilcoxon を実行する
6. confidence interval と effect size を報告する
```

### Statistical Significance vs Practical Significance

data が十分大きいと、些細な差でも statistically significant になります。

```text
Model A accuracy: 0.9234
Model B accuracy: 0.9237
n = 1,000,000
p-value = 0.001
```

差は real かもしれませんが、0.03% improvement は deployment cost に見合わない可能性があります。p-value は差が real かを示し、effect size は意味のある大きさかを示します。

```text
Cohen's d = (mean_1 - mean_2) / pooled_std
d = 0.2: small effect
d = 0.5: medium effect
d = 0.8: large effect
```

### Multiple Comparison Problem

多くの hypotheses を検定すると、偶然 significant になるものが出ます。

```text
P(at least one false positive) = 1 - (1 - alpha)^m
m = 20, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64
```

Bonferroni correction は alpha を tests 数で割ります。

```text
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025
```

### Bootstrap Methods

bootstrap は data を replacement ありで resample し、statistic の sampling distribution を推定します。underlying distribution の仮定は不要です。

```text
1. n data points がある
2. replacement ありで n samples を引く
3. statistic を計算する
4. B 回繰り返す
5. bootstrap statistics の分布を sampling distribution とみなす
```

percentile method では、bootstrap statistics を sort し、2.5th percentile と 97.5th percentile を 95% CI にします。

model comparison では、test indices を resample し、metric_B - metric_A の分布を作ります。CI が 0 を含まなければ差は significant です。

### Parametric vs Non-parametric Tests

parametric tests は distribution（通常 normal）を仮定します。non-parametric tests は distributional assumptions を置きません。

```text
t-test / ANOVA / Pearson r: parametric
Mann-Whitney U / Wilcoxon / Spearman / Kruskal-Wallis: non-parametric
```

ML experiments は 5 または 10 cross-validation folds のように n が小さいことが多いため、Wilcoxon signed-rank のような non-parametric tests が適する場合があります。

### Central Limit Theorem

CLT は、sample means の分布が n の増加とともに normal distribution に近づくことを述べます。data 自体を normal にするわけではありません。

ML では confidence intervals、t-tests、mini-batch gradients、ensembles の安定性の根拠になります。ただし heavy-tailed distributions や dependent data には注意が必要です。

### ML 論文でよくある統計ミス

1. training set で test する
2. confidence intervals を報告しない
3. multiple comparisons を無視する
4. statistical significance と practical significance を混同する
5. imbalanced data に accuracy を使う
6. 勝った metric だけを cherry-pick する
7. train/test splits をまたいで information leakage する
8. small test sets で variance estimates なしに改善を主張する
9. independent でない observations を independent と仮定する
10. p-hacking を行う

## Building It

`code/statistics.py` では、次を一から実装します。

1. descriptive statistics（mean、median、mode、standard deviation、percentiles、IQR）
2. correlation functions（Pearson、Spearman、covariance matrix）
3. hypothesis tests（one-sample t-test、two-sample t-test、chi-squared test）
4. bootstrap confidence intervals
5. A/B test simulator
6. statistical vs practical significance demo

## Key Terms

| Term | Definition |
|---|---|
| Mean | values の合計を count で割ったもの。outliers に敏感 |
| Median | sorted data の中央。outliers に頑健 |
| Standard deviation | variance の平方根。spread を元の units で表す |
| Percentile | data の指定割合がその下に入る値 |
| IQR | Q3 - Q1。中央 50% の spread |
| Pearson correlation | linear association を測る。range [-1, 1] |
| Spearman correlation | ranks を使って monotonic association を測る |
| Covariance matrix | 全 features 間の pairwise covariances の matrix |
| Null hypothesis | no effect/no difference の default assumption |
| p-value | H0 が真だとしたとき、この程度に extreme な data が出る確率 |
| Confidence interval | parameter の plausible range |
| t-test | means が有意に異なるかを検定する |
| Chi-squared test | observed frequencies と expected frequencies の差を検定する |
| Effect size | sample size と独立した差の大きさ |
| Bonferroni correction | false positives を制御するため alpha を tests 数で割る |
| Bootstrap | replacement あり resampling で sampling distributions を推定する |
| Type I error | false positive |
| Type II error | false negative |
| Statistical power | false H0 を正しく reject する確率 |
| Central limit theorem | sample means が normal distribution に近づく定理 |
| Parametric test | data の distribution を仮定する検定 |
| Non-parametric test | distributional assumptions を置かない検定 |
