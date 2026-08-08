# 15 · 机器学习中的统计学

> 统计学是你判断模型是真的有效、还是只是运气好的方法。

**类型：** 构建（Build）
**语言：** Python
**前置：** 阶段 1，第 06 课（概率与分布）、第 07 课（贝叶斯定理）
**时长：** 约 120 分钟

## 学习目标

- 从零计算描述性统计量、皮尔逊/斯皮尔曼相关系数（Pearson/Spearman correlation）以及协方差矩阵（covariance matrix）
- 执行假设检验（t 检验、卡方检验），并正确解读 p 值（p-value）和置信区间（confidence interval）
- 使用自助重采样（bootstrap resampling）为任意指标构造置信区间，无需对分布做出假设
- 借助效应量（effect size）度量，区分统计显著性（statistical significance）与实际显著性（practical significance）

## 问题所在

你训练了两个模型。模型 A 在测试集上得分 0.87，模型 B 得分 0.89。于是你部署了模型 B。三周后，生产环境指标比之前还要差。发生了什么？

模型 B 实际上并没有比模型 A 更优。那 0.02 的差距只是噪声。要么你的测试集太小，要么方差太高，或者两者兼有。你把随机性包装成了改进，然后上线了它。

这种情况屡见不鲜。Kaggle 排行榜的剧烈洗牌、无法复现的论文、基于几百个样本就宣布胜者的 A/B 测试。根本原因总是一样：有人跳过了统计学。

统计学给你区分信号与噪声的工具。它告诉你一个差异何时是真实的、你应该有多大信心、以及在你能信任某个结果之前需要多少数据。每一条 ML 流水线、每一次模型对比、每一个实验都需要统计学。没有它，你就只是在猜。

## 核心概念

### 描述性统计：概括你的数据

在你为任何东西建模之前，你需要知道数据长什么样。描述性统计（descriptive statistics）把一个数据集压缩成几个能刻画其形状的数字。

**集中趋势的度量**回答的是「中间在哪里？」

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

均值（mean）是平衡点。中位数（median）是中间标记。当二者发散时，你的分布就是偏斜的。收入分布的均值远大于中位数（来自亿万富翁的右偏）。训练期间的损失分布往往均值远小于中位数（来自简单样本的左偏）。

**离散程度的度量**回答的是「数据有多分散？」

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

**百分位数（percentiles）**把排序后的数据分成 100 个相等的部分。第 25 百分位（Q1）意味着 25% 的值落在该点以下。第 50 百分位是中位数。第 75 百分位是 Q3。

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

在 ML 中，你会关心推理延迟、预测置信度分布以及理解误差分布的百分位数。一个平均误差很低、但 P99 误差糟糕透顶的模型，对于安全攸关的应用可能毫无用处。

**样本统计量 vs 总体统计量。** 从样本计算方差时，要除以 (n-1) 而不是 n。这就是贝塞尔校正（Bessel's correction）。它补偿了「你的样本均值并非真实总体均值」这一事实。若分母用 n，你会系统性地低估真实方差。若用 (n-1)，估计就是无偏的。

```
Population variance: sigma^2 = (1/N) * sum((x_i - mu)^2)
Sample variance:     s^2     = (1/(n-1)) * sum((x_i - x_bar)^2)
```

实践中：如果 n 很大（数千个样本），这个差别可以忽略。如果 n 很小（几十个样本），它就很重要。

### 相关性：变量如何一起变动

相关性（correlation）度量两个变量之间线性关系的强度和方向。

**皮尔逊相关系数（Pearson correlation coefficient）**度量线性关联：

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

皮尔逊假设关系是线性的、且两个变量都大致服从正态分布。它对离群点很敏感。单个极端点就能把 r 从 0.1 拖到 0.9。

**斯皮尔曼秩相关（Spearman rank correlation）**度量单调关联：

```
1. Replace each value with its rank (1, 2, 3, ...)
2. Compute Pearson correlation on the ranks

Spearman catches any monotonic relationship, not just linear.
If y = x^3, Pearson gives r < 1 but Spearman gives rho = 1.
```

**何时使用各自：**

```
Pearson:    Both variables are continuous and roughly normal.
            You care about the linear relationship specifically.
            No extreme outliers.

Spearman:   Ordinal data (rankings, ratings).
            Data is not normally distributed.
            You suspect a monotonic but not linear relationship.
            Outliers are present.
```

**黄金法则：** 相关不蕴含因果。冰淇淋销量和溺水死亡数相关，是因为两者都在夏天上升。你模型的准确率和参数数量相关，但增加参数并不会自动提升准确率（参见：过拟合）。

### 协方差矩阵

两个变量之间的协方差（covariance）度量它们如何一起变化：

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

对于 d 个特征，协方差矩阵 C 是一个 d x d 矩阵，其中 C[i][j] = Cov(feature_i, feature_j)。对角线元素 C[i][i] 是各特征的方差。

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

**与 PCA 的联系。** PCA 对协方差矩阵做特征分解。特征向量就是主成分（principal components，方差最大的方向）。特征值告诉你每个成分捕获了多少方差。这正是第 10 课所讲的内容，但现在你明白了为什么协方差矩阵才是值得分解的对象：它编码了数据中所有成对的线性关系。

**与相关性的联系。** 相关矩阵就是标准化变量（每个变量都除以其标准差）的协方差矩阵。相关性把协方差归一化，使所有值落在 [-1, 1] 之间。

### 假设检验

假设检验（hypothesis testing）是在不确定性下做决策的框架。你先提出一个主张，收集数据，然后判断数据是否与该主张一致。

**基本设置：**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**p 值（p-value）**是在假设 H0 为真的前提下，看到像你观测到的那样极端（或更极端）数据的概率。它**不是** H0 为真的概率。这是统计学中最常见的单一误解。

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**置信区间（confidence intervals）**给出参数的一段合理取值范围：

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

置信区间的宽度告诉你精度的高低。区间宽意味着不确定性高。区间窄意味着你的估计很精确（但若你的数据有偏，未必准确）。

### t 检验

t 检验（t-test）比较均值。它有好几种变体。

**单样本 t 检验：** 总体均值是否不同于某个假设值？

```
t = (x_bar - mu_0) / (s / sqrt(n))

degrees of freedom = n - 1
```

**双样本 t 检验（独立）：** 两组的均值是否不同？

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**配对 t 检验（paired t-test）：** 当测量值成对出现时（同一个模型在相同的数据划分上评估）：

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

在 ML 中，配对 t 检验很常见：你在相同的 10 折交叉验证（cross-validation）上运行两个模型，然后逐对比较它们的分数。

### 卡方检验

卡方检验（chi-squared test）检查观测频数是否与期望频数相符。适用于类别型数据。

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

### ML 模型的 A/B 测试

ML 中的 A/B 测试与网页 A/B 测试不同。模型对比有其特有的挑战：

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

**操作流程：**

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

### 统计显著性 vs 实际显著性

一个结果可以在统计上显著，但实际上毫无意义。只要数据足够多，哪怕微不足道的差异也会变得统计显著。

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

**效应量（effect size）**量化差异有多大，且与样本量无关：

```
Cohen's d = (mean_1 - mean_2) / pooled_std

d = 0.2:  small effect
d = 0.5:  medium effect
d = 0.8:  large effect
```

始终同时报告 p 值和效应量。p 值告诉你差异是否真实。效应量告诉你它是否重要。

### 多重比较问题

当你检验许多假设时，总会有一些「显著」纯属偶然。如果你在 alpha = 0.05 下检验 20 件事，即使没有任何真实效应，你也预期会出现 1 个假阳性。

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**邦费罗尼校正（Bonferroni correction）：** 把 alpha 除以检验的数量。

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

在 ML 中，当你跨多个指标对比一个模型、检验许多超参数配置、或在多个数据集上评估时，这一点就很重要。

### 自助法（Bootstrap）

自助法（bootstrapping）通过对数据进行有放回的重采样，来估计某个统计量的抽样分布。无需对底层分布做任何假设。

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

**自助置信区间（百分位法）：**

```
Sort the B bootstrap statistics
95% CI = [2.5th percentile, 97.5th percentile]
```

**为什么自助法对 ML 很重要：**

```
- Test set accuracy is a point estimate. Bootstrap gives you
  confidence intervals.
- You cannot assume metric distributions are normal (especially
  for AUC, F1, precision at k).
- Bootstrap works for ANY statistic: median, ratio of two means,
  difference in AUC between two models.
- No closed-form formula needed.
```

**用自助法做模型对比：**

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

### 参数检验 vs 非参数检验

**参数检验（parametric tests）**假设一个特定的分布（通常是正态分布）：

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**非参数检验（non-parametric tests）**不做任何分布假设：

```
Mann-Whitney U:     compares two groups (replaces independent t-test)
Wilcoxon signed-rank: compares paired data (replaces paired t-test)
Spearman rho:       correlation on ranks (replaces Pearson)
Kruskal-Wallis:     compares multiple groups (replaces ANOVA)
```

**何时使用非参数检验：**

```
- Small sample size (n < 30) and data is clearly non-normal
- Ordinal data (ratings, rankings)
- Heavy outliers you cannot remove
- Skewed distributions
```

**何时使用参数检验：**

```
- Large sample size (CLT makes the test statistic approximately normal)
- Data is roughly symmetric without extreme outliers
- More statistical power (better at detecting real differences)
```

在 ML 实验中，你通常只有很小的 n（5 或 10 折交叉验证），所以像 Wilcoxon 符号秩检验这样的非参数检验往往比 t 检验更合适。

### 中心极限定理：实际意义

中心极限定理（Central Limit Theorem，CLT）指出：随着 n 增大，样本均值的分布会趋近于正态分布，与底层总体分布无关。

```
If X_1, X_2, ..., X_n are iid with mean mu and variance sigma^2:

    X_bar ~ Normal(mu, sigma^2 / n)    as n -> infinity

Works for n >= 30 in most cases.
For highly skewed distributions, you might need n >= 100.
```

**为什么它对 ML 很重要：**

```
1. Justifies confidence intervals and t-tests on aggregated metrics
2. Explains why averaging over cross-validation folds gives stable
   estimates even when individual folds vary wildly
3. Mini-batch gradient descent works because the average gradient
   over a batch approximates the true gradient (CLT in action)
4. Ensemble methods: averaging predictions from many models gives
   more stable output than any single model
```

**CLT 不做什么：**

```
- Does NOT make your data normal. It makes the MEAN of samples normal.
- Does NOT work for heavy-tailed distributions with infinite variance
  (Cauchy distribution).
- Does NOT apply to dependent data (time series without correction).
```

### ML 论文中常见的统计错误

1. **在训练集上测试。** 这保证了过拟合。务必留出模型在训练期间从未见过的数据。

2. **没有置信区间。** 只报告单个准确率数字、不附带不确定性，会使结果无法复现、无法验证。

3. **忽视多重比较。** 检验 50 种配置、不做校正就报告其中最好的一个，会抬高假阳性率。

4. **混淆统计显著性与实际显著性。** 在 0.01% 的准确率提升上得到 0.001 的 p 值，并无意义。

5. **在不平衡数据上使用准确率。** 在 99% 为负类的数据集上达到 99% 准确率，意味着模型什么也没学到。应使用精确率、召回率、F1 或 AUC。

6. **挑拣指标（cherry-picking）。** 只报告你的模型获胜的那个指标。诚实的评估会报告所有相关指标。

7. **在训练/测试划分之间泄露信息。** 在划分之前做归一化，或用未来数据预测过去。

8. **小测试集且没有方差估计。** 在 100 个样本上评估并宣称 2% 的提升，那是噪声，不是信号。

9. **在数据并不独立时假设其独立。** 同一患者的医学影像、同一文档中的多个句子。同一组内的观测是相关的。

10. **P 值操纵（P-hacking）。** 不断尝试不同的检验、子集或排除标准，直到得到 p < 0.05。这样的结果是搜索过程的产物。

## 动手构建

你将实现：

1. **从零实现描述性统计**（均值、中位数、众数、标准差、百分位数、IQR）
2. **相关函数**（皮尔逊与斯皮尔曼，含协方差矩阵）
3. **假设检验**（单样本 t 检验、双样本 t 检验、卡方检验）
4. **自助置信区间**（适用于任意统计量，无需任何假设）
5. **A/B 测试模拟器**（生成数据、检验、检查第一类与第二类错误）
6. **统计显著性 vs 实际显著性演示**（展示大的 n 如何让一切都「显著」）

全部从零实现，仅使用 `math` 和 `random`。不用 numpy，不用 scipy。

## 关键术语

| 术语 | 定义 |
|---|---|
| 均值（Mean） | 值之和除以个数。对离群点敏感。 |
| 中位数（Median） | 排序后数据的中间值。对离群点稳健。 |
| 标准差（Standard deviation） | 方差的平方根。以原始单位度量离散程度。 |
| 百分位数（Percentile） | 一个值，给定百分比的数据落在其以下。 |
| IQR | 四分位距。Q3 减 Q1。中间 50% 数据的离散程度。 |
| 皮尔逊相关（Pearson correlation） | 度量两个变量之间的线性关联。范围 [-1, 1]。 |
| 斯皮尔曼相关（Spearman correlation） | 用秩度量单调关联。 |
| 协方差矩阵（Covariance matrix） | 所有特征之间成对协方差构成的矩阵。 |
| 原假设（Null hypothesis） | 「无效应或无差异」的默认假设。 |
| p 值（p-value） | 在原假设为真时，出现如此极端数据的概率。 |
| 置信区间（Confidence interval） | 在给定置信水平下，参数的一段合理取值范围。 |
| t 检验（t-test） | 检验均值是否显著不同。使用 t 分布。 |
| 卡方检验（Chi-squared test） | 检验观测频数是否不同于期望频数。 |
| 效应量（Effect size） | 差异的量级，与样本量无关。Cohen's d 是常用度量。 |
| 邦费罗尼校正（Bonferroni correction） | 把显著性阈值除以检验数量，以控制假阳性。 |
| 自助法（Bootstrap） | 有放回重采样，用于估计抽样分布。 |
| 第一类错误（Type I error） | 假阳性。在 H0 为真时拒绝它。 |
| 第二类错误（Type II error） | 假阴性。在 H0 为假时未能拒绝它。 |
| 统计功效（Statistical power） | 正确拒绝一个假 H0 的概率。功效 = 1 减去第二类错误率。 |
| 中心极限定理（Central limit theorem） | 随着样本量增大，样本均值收敛到正态分布。 |
| 参数检验（Parametric test） | 假设数据服从特定分布（通常为正态）。 |
| 非参数检验（Non-parametric test） | 不做任何分布假设。基于秩或符号工作。 |
