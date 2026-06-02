# 机器学习中的统计学

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 统计学是你判断模型到底是真有效，还是只是运气好的工具。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 从零实现描述性统计、Pearson/Spearman 相关性以及协方差矩阵
- 进行假设检验（t-test、卡方检验），并正确理解 p-value 和置信区间
- 使用 bootstrap 重采样为任意指标构造置信区间，无需任何分布假设
- 通过效应量（effect size）区分统计显著性与实际显著性

## 问题（The Problem）

你训练了两个模型。Model A 在测试集上得分 0.87，Model B 得分 0.89。于是你部署了 Model B。三周后，生产环境的指标比之前更糟。怎么回事？

Model B 其实根本没有比 Model A 更好。这 0.02 的差距只是噪声。可能你的测试集太小，或者方差太高，或者两者都有。你把随机性当成了改进直接上线了。

这种事每天都在发生。Kaggle 排行榜的洗牌、复现不出来的论文、靠几百个样本就宣布胜出的 A/B 测试，根因都一样：有人跳过了统计学。

统计学给你区分信号与噪声的工具。它告诉你某个差异是不是真的、你应该多自信、需要多少数据才能信任一个结果。每条 ML 流水线、每次模型对比、每个实验都需要统计学。没有它，你就是在猜。

## 概念（The Concept）

### 描述性统计：总结你的数据（Descriptive Statistics: Summarizing Your Data）

在建模之前，你得先知道数据长什么样。描述性统计把一个数据集压缩成几个能刻画其形态的数字。

**集中趋势的度量**回答「中心在哪里？」

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

均值是平衡点，中位数是过半点。当二者背离，就说明你的分布是偏态的。收入分布的均值远大于中位数（亿万富翁导致右偏）。训练时损失分布往往均值远小于中位数（简单样本导致左偏）。

**离散程度的度量**回答「数据有多分散？」

```
Variance:   average squared deviation from the mean
            sigma^2 = (1/n) * sum((x_i - mu)^2)

Standard deviation:  square root of variance
                     sigma = sqrt(sigma^2)
                     Same units as the data, so more interpretable.

Range:      max - min
            Sensitive to outliers. Almost never useful alone.

IQR:        Q3 - Q1 (interquartile range)
            The range of the middle 50% of the data.
            Robust to outliers. Used for box plots and outlier detection.
```

**百分位数（Percentiles）**把排序后的数据切成 100 等份。第 25 百分位（Q1）意味着有 25% 的值落在它之下。第 50 百分位是中位数。第 75 百分位是 Q3。

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

在 ML 里，你会关心推理延迟、预测置信度分布以及误差分布的百分位数。一个平均误差很低但 P99 误差糟糕的模型，对安全敏感场景可能完全没法用。

**样本统计 vs 总体统计。** 从样本计算方差时，要除以 (n-1) 而不是 n。这就是 Bessel 修正。它是为了补偿样本均值并不是真实总体均值这一事实。如果分母用 n，你会系统性低估真实方差；用 (n-1) 才是无偏估计。

```
Population variance: sigma^2 = (1/N) * sum((x_i - mu)^2)
Sample variance:     s^2     = (1/(n-1)) * sum((x_i - x_bar)^2)
```

实务上：n 大（成千上万的样本）时差别可以忽略；n 小（几十个样本）时这个修正就很关键。

### 相关性：变量如何共同变化（Correlation: How Variables Move Together）

相关性衡量两个变量之间线性关系的强度和方向。

**Pearson 相关系数（Pearson correlation coefficient）**衡量线性关联：

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

Pearson 假设关系是线性的，并且两个变量大致服从正态分布。它对离群点很敏感。一个极端点就能把 r 从 0.1 拽到 0.9。

**Spearman 秩相关（Spearman rank correlation）**衡量单调关联：

```
1. Replace each value with its rank (1, 2, 3, ...)
2. Compute Pearson correlation on the ranks

Spearman catches any monotonic relationship, not just linear.
If y = x^3, Pearson gives r < 1 but Spearman gives rho = 1.
```

**何时用哪个：**

```
Pearson:    Both variables are continuous and roughly normal.
            You care about the linear relationship specifically.
            No extreme outliers.

Spearman:   Ordinal data (rankings, ratings).
            Data is not normally distributed.
            You suspect a monotonic but not linear relationship.
            Outliers are present.
```

**黄金法则：** 相关不蕴含因果。冰淇淋销量和溺水死亡数相关，是因为两者都在夏天升高。模型准确率和参数量相关，但加参数并不会自动提升准确率（参考：过拟合）。

### 协方差矩阵（Covariance Matrix）

两个变量之间的协方差衡量它们如何共同变化：

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

对于 d 个特征，协方差矩阵 C 是一个 d × d 的矩阵，其中 C[i][j] = Cov(feature_i, feature_j)。对角线元素 C[i][i] 是每个特征的方差。

```
C = | Var(x1)      Cov(x1,x2)  Cov(x1,x3) |
    | Cov(x2,x1)  Var(x2)      Cov(x2,x3) |
    | Cov(x3,x1)  Cov(x3,x2)  Var(x3)     |

Properties:
  - Symmetric: C[i][j] = C[j][i]
  - Positive semi-definite: all eigenvalues >= 0
  - Diagonal = variances
  - Off-diagonal = covariances
```

**与 PCA 的联系。** PCA 对协方差矩阵做特征值分解。特征向量是主成分（方差最大的方向），特征值告诉你每个成分捕获了多少方差。这正是第 10 课的内容，但现在你能看懂为什么协方差矩阵是合适的分解对象：它编码了数据中所有成对的线性关系。

**与相关系数的联系。** 相关矩阵就是标准化后变量（每个变量除以其标准差）的协方差矩阵。相关性把协方差归一化到 [-1, 1]。

### 假设检验（Hypothesis Testing）

假设检验是在不确定性下做决策的框架。你先提出一个论断，再收集数据，然后判断数据是否与论断一致。

**基本设置：**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**p-value** 是在 H0 为真的前提下，看到与你观测同样极端的数据的概率。它**不是** H0 为真的概率。这是统计学里最常见的误解，没有之一。

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**置信区间（Confidence intervals）**给出参数的一个合理取值范围：

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

置信区间的宽度反映精度。区间宽就是不确定性高，区间窄就是估计很精确（但如果数据有偏，未必准确）。

### t 检验（The t-test）

t 检验用于比较均值，有几种变体。

**单样本 t 检验（One-sample t-test）：** 总体均值是否不同于某个假设值？

```
t = (x_bar - mu_0) / (s / sqrt(n))

degrees of freedom = n - 1
```

**双样本 t 检验（独立样本，Two-sample t-test）：** 两组的均值是否不同？

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**配对 t 检验（Paired t-test）：** 当测量是成对出现时（同一组模型在相同的数据划分上评估）：

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

在 ML 里配对 t 检验非常常见：你让两个模型跑相同的 10 折交叉验证，再成对比较它们的得分。

### 卡方检验（Chi-squared Test）

卡方检验检查观测频数是否与期望频数相符，对类别数据很有用。

```
chi^2 = sum((observed - expected)^2 / expected)

Example: does a language model's output distribution match the
training distribution across categories?

Category    Observed   Expected
Positive       120        100
Negative        80        100
chi^2 = (120-100)^2/100 + (80-100)^2/100 = 4 + 4 = 8

With 1 degree of freedom, chi^2 = 8 gives p < 0.005.
The difference is significant.
```

### ML 模型的 A/B 测试（A/B Testing for ML Models）

ML 中的 A/B 测试和网页 A/B 测试不一样。模型对比有它专属的挑战：

```
1. Same test set:    Both models must be evaluated on identical data.
                     Different test sets make comparison meaningless.

2. Multiple metrics: Accuracy alone is not enough. You need precision,
                     recall, F1, latency, and fairness metrics.

3. Variance:         Use cross-validation or bootstrap to estimate
                     the variance of each metric, not just point estimates.

4. Data leakage:     If the test set was used during model selection,
                     your comparison is biased. Hold out a final test set.
```

**流程：**

```
1. Define your metric and significance level (alpha = 0.05)
2. Run both models on the same k-fold cross-validation splits
3. Collect paired scores: [(a1, b1), (a2, b2), ..., (ak, bk)]
4. Compute differences: d_i = b_i - a_i
5. Run a paired t-test on the differences
6. Check: is the mean difference significantly different from 0?
7. Compute a confidence interval for the mean difference
8. Compute effect size (Cohen's d) to judge practical significance
```

### 统计显著 vs 实际显著（Statistical Significance vs Practical Significance）

一个结果可以在统计上显著，但在实际上毫无意义。只要数据足够多，再微不足道的差异都会变得「统计显著」。

```
Example:
  Model A accuracy: 0.9234
  Model B accuracy: 0.9237
  n = 1,000,000 test samples
  p-value = 0.001

Statistically significant? Yes.
Practically significant? A 0.03% improvement is not worth the
engineering cost of deploying a new model.
```

**效应量（Effect size）**衡量差异的大小，与样本量无关：

```
Cohen's d = (mean_1 - mean_2) / pooled_std

d = 0.2:  small effect
d = 0.5:  medium effect
d = 0.8:  large effect
```

永远要同时报告 p-value 和效应量。p-value 告诉你差异是不是真的，效应量告诉你差异重不重要。

### 多重比较问题（Multiple Comparison Problem）

当你做很多次假设检验时，有些会因为运气而「显著」。如果你以 alpha = 0.05 检验 20 个东西，即便没有一个是真的，你也会有 1 个假阳性的预期。

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni 校正：** 把 alpha 除以检验次数。

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

在 ML 里，当你跨多个指标比较模型、测试很多超参数配置或在多个数据集上评估时，这点尤其重要。

### Bootstrap 方法（Bootstrap Methods）

Bootstrap 通过对数据进行有放回的重采样，来估计某个统计量的抽样分布。无需对底层分布做任何假设。

**算法：**

```
1. You have n data points
2. Draw n samples WITH replacement (some points appear multiple times,
   some not at all)
3. Compute your statistic on this bootstrap sample
4. Repeat B times (typically B = 1000 to 10000)
5. The distribution of bootstrap statistics approximates the
   sampling distribution
```

**Bootstrap 置信区间（百分位数法）：**

```
Sort the B bootstrap statistics
95% CI = [2.5th percentile, 97.5th percentile]
```

**Bootstrap 对 ML 为什么重要：**

```
- Test set accuracy is a point estimate. Bootstrap gives you
  confidence intervals.
- You cannot assume metric distributions are normal (especially
  for AUC, F1, precision at k).
- Bootstrap works for ANY statistic: median, ratio of two means,
  difference in AUC between two models.
- No closed-form formula needed.
```

**用 Bootstrap 做模型对比：**

```
1. You have predictions from Model A and Model B on the same test set
2. For each bootstrap iteration:
   a. Resample test indices with replacement
   b. Compute metric_A and metric_B on the resampled set
   c. Store diff = metric_B - metric_A
3. 95% CI for the difference:
   [2.5th percentile of diffs, 97.5th percentile of diffs]
4. If the CI does not contain 0, the difference is significant
```

这比配对 t 检验更稳健，因为它不做任何分布假设。

### 参数检验 vs 非参数检验（Parametric vs Non-parametric Tests）

**参数检验（Parametric tests）**假设数据服从特定分布（通常是正态）：

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**非参数检验（Non-parametric tests）**不做任何分布假设：

```
Mann-Whitney U:     compares two groups (replaces independent t-test)
Wilcoxon signed-rank: compares paired data (replaces paired t-test)
Spearman rho:       correlation on ranks (replaces Pearson)
Kruskal-Wallis:     compares multiple groups (replaces ANOVA)
```

**何时用非参数：**

```
- Small sample size (n < 30) and data is clearly non-normal
- Ordinal data (ratings, rankings)
- Heavy outliers you cannot remove
- Skewed distributions
```

**何时用参数：**

```
- Large sample size (CLT makes the test statistic approximately normal)
- Data is roughly symmetric without extreme outliers
- More statistical power (better at detecting real differences)
```

ML 实验里，n 通常很小（5 折或 10 折交叉验证），所以像 Wilcoxon signed-rank 这样的非参数检验往往比 t 检验更合适。

### 中心极限定理：实际意义（Central Limit Theorem: Practical Implications）

中心极限定理（CLT）说，无论底层总体分布如何，样本均值的分布都会随 n 增大趋近于正态分布。

```
If X_1, X_2, ..., X_n are iid with mean mu and variance sigma^2:

    X_bar ~ Normal(mu, sigma^2 / n)    as n -> infinity

Works for n >= 30 in most cases.
For highly skewed distributions, you might need n >= 100.
```

**它对 ML 为什么重要：**

```
1. Justifies confidence intervals and t-tests on aggregated metrics
2. Explains why averaging over cross-validation folds gives stable
   estimates even when individual folds vary wildly
3. Mini-batch gradient descent works because the average gradient
   over a batch approximates the true gradient (CLT in action)
4. Ensemble methods: averaging predictions from many models gives
   more stable output than any single model
```

**CLT 不会替你做什么：**

```
- Does NOT make your data normal. It makes the MEAN of samples normal.
- Does NOT work for heavy-tailed distributions with infinite variance
  (Cauchy distribution).
- Does NOT apply to dependent data (time series without correction).
```

### ML 论文里常见的统计错误（Common Statistical Mistakes in ML Papers）

1. **在训练集上测试。** 必然过拟合。永远要留出模型在训练时从未见过的数据。

2. **没有置信区间。** 只报一个准确率数字而不带不确定性，结果就既无法复现也无法验证。

3. **忽视多重比较。** 测试 50 个配置只报告最好的那个、不做校正，会让假阳性率飙升。

4. **混淆统计显著与实际显著。** 在 0.01% 准确率提升上得到 p = 0.001 没什么意义。

5. **在不平衡数据上用准确率。** 一个 99% 负类的数据集上 99% 的准确率说明模型什么都没学到。要用 precision、recall、F1 或 AUC。

6. **挑指标说话（Cherry-picking）。** 只报告自家模型胜出的那个指标。诚实的评估应该报告所有相关指标。

7. **训练/测试划分之间泄漏信息。** 在划分前就归一化，或者用未来数据预测过去。

8. **测试集小且没有方差估计。** 在 100 个样本上评估并宣称 2% 提升，那是噪声，不是信号。

9. **在数据并不独立时假设独立。** 同一病人的多张医学影像、同一文档的多个句子。同一组内的观测是相关的。

10. **P-hacking。** 不停尝试不同的检验、子集或排除标准，直到 p < 0.05。这种结果只是搜索过程的人造产物。

## 动手实现（Building It）

你将实现：

1. **从零实现描述性统计**（mean、median、mode、标准差、百分位数、IQR）
2. **相关性函数**（Pearson 与 Spearman，外加协方差矩阵）
3. **假设检验**（单样本 t 检验、双样本 t 检验、卡方检验）
4. **Bootstrap 置信区间**（适用于任意统计量，无需任何假设）
5. **A/B 测试模拟器**（生成数据、做检验、检查 Type I 与 Type II 错误）
6. **统计 vs 实际显著性演示**（展示大 n 会让一切都「显著」）

全部从零实现，只用 `math` 和 `random`。不用 numpy、不用 scipy。

## 关键术语（Key Terms）

| Term | Definition |
|---|---|
| Mean | 所有值之和除以数量。对离群点敏感。 |
| Median | 排序后位于中间的值。对离群点稳健。 |
| Standard deviation | 方差的平方根。以原始单位衡量离散程度。 |
| Percentile | 给定百分比的数据落在其下方的那个值。 |
| IQR | 四分位距。Q3 减 Q1。中间 50% 数据的跨度。 |
| Pearson correlation | 衡量两变量间线性关联。范围 [-1, 1]。 |
| Spearman correlation | 用秩衡量单调关联。 |
| Covariance matrix | 所有特征间两两协方差组成的矩阵。 |
| Null hypothesis | 默认假设，通常是「无效应」或「无差异」。 |
| p-value | 在原假设为真的前提下，看到与观测同样极端数据的概率。 |
| Confidence interval | 在给定置信水平下，参数的合理取值范围。 |
| t-test | 检验均值是否存在显著差异。基于 t 分布。 |
| Chi-squared test | 检验观测频数是否与期望频数有差异。 |
| Effect size | 差异的大小，与样本量无关。常用 Cohen's d。 |
| Bonferroni correction | 用检验次数去除显著性阈值，控制假阳性。 |
| Bootstrap | 有放回地重采样以估计抽样分布。 |
| Type I error | 假阳性。在 H0 为真时拒绝它。 |
| Type II error | 假阴性。在 H0 为假时未能拒绝它。 |
| Statistical power | 在 H0 为假时正确拒绝它的概率。Power = 1 减 Type II 错误率。 |
| Central limit theorem | 样本均值随样本量增大趋近正态分布。 |
| Parametric test | 假设数据服从特定分布（通常是正态）。 |
| Non-parametric test | 不做分布假设。基于秩或符号工作。 |
