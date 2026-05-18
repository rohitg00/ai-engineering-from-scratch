# 机器学习统计数据

> 统计数据是您知道您的模型是否真的有效或只是幸运的方法。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 第1阶段，第06课（概率与分布）、第07课（Bayes ' Theory）
** 时间：** ~120分钟

## 学习目标

- 从头开始计算描述性统计量、Pearson/Spearman相关性和协方差矩阵
- 执行假设检验（t检验、卡方）并正确解释p值和置信区间
- 使用Bootstrap重新采样为任何没有分布假设的指标构建置信区间
- 使用效应量测量区分统计显着性与实际显着性

## 问题

你训练了两个模型。型号A在您的测试集中得分为0.87。型号B评分0.89。您部署Model B。三周后，生产指标比以前更差。发生了什么？

型号B实际上并没有优于型号A。0.02的差异是噪音。您的测试集太小，或者方差太高，或者两者兼而有之。你把随机性打扮成改进。

这种情况不断发生。Kaggle排行榜变动。无法复制的论文。A/B测试根据几百个样本宣布获胜者。根本原因总是一样的：有人跳过了统计数据。

统计数据为您提供了区分信号与噪音的工具。它会告诉您何时存在真正的差异、您应该有多自信，以及在您信任结果之前需要多少数据。每个ML管道、每个模型比较、每个实验都需要统计数据。没有它，你就是在猜测。

## 概念

### 描述性统计：总结您的数据

在对任何事物建模之前，您需要知道您的数据是什么样子。描述性统计将数据集压缩为几个数字来捕捉其形状。

** 集中趋势的衡量标准 ** 回答“中间在哪里？"

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

平均值是平衡点。中位数是中间标记。当它们出现分歧时，你的分布就会倾斜。收入分配具有平均值'>中位数（亿万富翁的正确倾斜）。训练期间的损失分布通常具有平均值<<中位数（来自简单样本的左倾斜）。

** 传播指标 ** 回答“数据的分散程度如何？"

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

** 百分位数 ** 将排序后的数据分成100等份。第25百分位（Q1）意味着25%的值低于这一点。第50百分位是中位数。第75百分位是Q3。

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

在ML中，您关心推理延迟的百分位数、预测置信分布和理解错误分布。平均误差较低但P99错误严重的模型对于安全关键应用程序可能无用。

** 样本与人口统计数据。**当计算样本的方差时，请除以（n-1）而不是n。这是贝塞尔的更正。它弥补了您的样本平均值不是真实的人口平均值这一事实。如果分母为n，则系统性地低估了真实方差。对于（n-1），估计是无偏的。

```
Population variance: sigma^2 = (1/N) * sum((x_i - mu)^2)
Sample variance:     s^2     = (1/(n-1)) * sum((x_i - x_bar)^2)
```

实际上：如果n很大（数千个样本），那么差异可以忽略不计。如果n很小（数十个样本），那就很重要。

### 相关性：变量如何相互作用

相关性衡量两个变量之间线性关系的强度和方向。

** 皮尔逊相关系数 ** 衡量线性关联：

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

皮尔森假设这种关系是线性的，并且两个变量大致呈正态分布。它对异常值很敏感。一个极端点可以将r从0.1拖到0.9。

**Spearman等级相关性 ** 衡量单调关联：

```
1. Replace each value with its rank (1, 2, 3, ...)
2. Compute Pearson correlation on the ranks

Spearman catches any monotonic relationship, not just linear.
If y = x^3, Pearson gives r < 1 but Spearman gives rho = 1.
```

** 何时使用每个：**

```
Pearson:    Both variables are continuous and roughly normal.
            You care about the linear relationship specifically.
            No extreme outliers.

Spearman:   Ordinal data (rankings, ratings).
            Data is not normally distributed.
            You suspect a monotonic but not linear relationship.
            Outliers are present.
```

** 黄金法则：** 相关性并不意味着因果关系。冰淇淋销量和溺水死亡是相关的，因为两者在夏季都会增加。您的模型的准确性和参数数量是相关的，但添加参数不会自动提高准确性（请参阅：过拟适）。

### 协方差矩阵

两个变量之间的协方差衡量它们如何一起变化：

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

对于d个特征，协方差矩阵C是d x d矩阵，其中C[i][j] = Cov（feature_i，feature_j）。对角线项C[i][i]是每个特征的方差。

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

** 连接到PCA。** PCA对协方差矩阵进行特征分解。特征向量是主成分（最大方差方向）。特征值告诉您每个分量捕获了多少方差。这正是第10课所涵盖的内容，但现在您明白了为什么协方差矩阵是正确的分解方法：它编码数据中的所有成对线性关系。

** 与相关性的联系。**相关矩阵是标准化变量的协方差矩阵（每个变量除以其标准差）。相关性将协方差标准化，因此所有值都落在[-1，1]中。

### 假设检验

假设测试是在不确定性下做出决策的框架。您从索赔开始，收集数据，并确定数据是否与索赔一致。

** 设置：**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

** p值 ** 是假设H 0为真，看到数据与您观察到的情况一样极端的概率。这不是H 0为真的可能性。这是统计中最常见的误解。

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

** 置信区间 ** 给出参数的合理值范围：

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

置信区间的宽度告诉您精确度。间隔宽意味着不确定性高。窄的间隔意味着您的估计是准确的（但如果您的数据存在偏差，则不一定准确）。

### t检验

t检验比较平均值。有几种口味。

** 单样本t检验：** 总体平均值是否与假设值不同？

```
t = (x_bar - mu_0) / (s / sqrt(n))

degrees of freedom = n - 1
```

** 两样本t检验（独立）：** 两组平均值是否不同？

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

** 配对t检验：** 当测量值成对出现时（同一模型对相同的数据分割进行评估）：

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

在ML中，配对t检验很常见：您在相同的10个交叉验证折叠上运行两个模型，并成对比较它们的分数。

### 卡方检验

卡方测试检查观察到的频率是否与预期频率匹配。对于分类数据有用。

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

### ML模型的A/B测试

ML中的A/B测试与Web A/B测试不同。模型比较有具体的挑战：

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

** 程序：**

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

### 统计意义与实际意义

结果可能在统计上具有显着意义，但实际上毫无意义。有了足够的数据，即使是微不足道的差异也变得具有统计意义。

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

** 效应大小 ** 量化差异有多大，与样本大小无关：

```
Cohen's d = (mean_1 - mean_2) / pooled_std

d = 0.2:  small effect
d = 0.5:  medium effect
d = 0.8:  large effect
```

始终报告p值和效应量。p值告诉你差异是否真实。效果大小告诉你它是否重要。

### 多重比较问题

当你测试许多假设时，有些假设可能是偶然的。如果你在alpha = 0.05的条件下测试20个事物，即使没有什么是真实的，你也会期望有1个假阳性。

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni纠正：** 将阿尔法除以测试次数。

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

在ML中，当您跨多个指标比较模型，测试许多超参数配置或在多个数据集上进行评估时，这很重要。

### Bootstrap方法

Bootstrapping通过使用替换重新同步数据来估计统计数据的抽样分布。无需对基本分布进行假设。

** 算法：**

```
1. You have n data points
2. Draw n samples WITH replacement (some points appear multiple times,
   some not at all)
3. Compute your statistic on this bootstrap sample
4. Repeat B times (typically B = 1000 to 10000)
5. The distribution of bootstrap statistics approximates the
   sampling distribution
```

**Bootstrap置信区间（百分位法）：**

```
Sort the B bootstrap statistics
95% CI = [2.5th percentile, 97.5th percentile]
```

** 为什么引导程序对ML很重要：**

```
- Test set accuracy is a point estimate. Bootstrap gives you
  confidence intervals.
- You cannot assume metric distributions are normal (especially
  for AUC, F1, precision at k).
- Bootstrap works for ANY statistic: median, ratio of two means,
  difference in AUC between two models.
- No closed-form formula needed.
```

** 用于型号比较的Bootstrap：**

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

这比配对t检验更稳健，因为它没有做出分布假设。

### 参数与非参数测试

** 参数检验 ** 假设特定分布（通常为正态分布）：

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

** 非参数测试 ** 不做出分布假设：

```
Mann-Whitney U:     compares two groups (replaces independent t-test)
Wilcoxon signed-rank: compares paired data (replaces paired t-test)
Spearman rho:       correlation on ranks (replaces Pearson)
Kruskal-Wallis:     compares multiple groups (replaces ANOVA)
```

** 何时使用非参数：**

```
- Small sample size (n < 30) and data is clearly non-normal
- Ordinal data (ratings, rankings)
- Heavy outliers you cannot remove
- Skewed distributions
```

** 何时使用参数：**

```
- Large sample size (CLT makes the test statistic approximately normal)
- Data is roughly symmetric without extreme outliers
- More statistical power (better at detecting real differences)
```

在ML实验中，n通常很小（5或10个交叉验证折叠），因此Wilcoxon符号排序等非参数测试通常比t测试更合适。

### 中心极限定理：实际含义

CLT表示，随着n的增长，样本均值的分布接近正态分布，而不管潜在的人口分布如何。

```
If X_1, X_2, ..., X_n are iid with mean mu and variance sigma^2:

    X_bar ~ Normal(mu, sigma^2 / n)    as n -> infinity

Works for n >= 30 in most cases.
For highly skewed distributions, you might need n >= 100.
```

** 为什么这对ML很重要：**

```
1. Justifies confidence intervals and t-tests on aggregated metrics
2. Explains why averaging over cross-validation folds gives stable
   estimates even when individual folds vary wildly
3. Mini-batch gradient descent works because the average gradient
   over a batch approximates the true gradient (CLT in action)
4. Ensemble methods: averaging predictions from many models gives
   more stable output than any single model
```

** CLT不做的事情：**

```
- Does NOT make your data normal. It makes the MEAN of samples normal.
- Does NOT work for heavy-tailed distributions with infinite variance
  (Cauchy distribution).
- Does NOT apply to dependent data (time series without correction).
```

### ML论文中常见的统计错误

1. ** 在训练集上进行测试。**保证过度贴合。始终保留模型在训练期间从未看到的数据。

2. ** 没有置信区间。**报告单一准确度数字而没有不确定性会导致结果无法重现和无法验证。

3. ** 忽略多次比较。**测试50种配置并在不进行纠正的情况下报告最佳配置会增加假阳性率。

4. ** 统计意义和实际意义混淆。**准确性提高0.01%时p值为0.001没有意义。

5. ** 在不平衡数据上使用准确性。**具有99%负类的数据集的99%准确性意味着模型什么也没学到。使用精确度、召回率、F1或UC。

6. ** 樱桃采摘指标。**仅报告您的模型获胜的指标。诚实的评估报告所有相关指标。

7. ** 跨列车/测试时段泄露信息。**在分裂之前进行规范化，或使用未来数据来预测过去。

8. ** 没有方差估计的小型测试集。**评估100个样本并声称改善2%是噪音，而不是信号。

9. ** 当数据不独立时假设独立性。**来自同一患者的医疗图像，来自同一文档的多个句子。群体内的观察是相关的。

10. ** P黑客。**尝试不同的测试、子集或排除标准，直到p < 0.05。结果是搜索的产物。

## 建造它

您将实施：

1. ** 从头开始的描述性统计 **（平均值、中位数、众数、标准差、百分位数、IQR）
2. ** 相关函数 **（Pearson和Spearman，以及协方差矩阵）
3. ** 假设检验 **（单样本t检验、双样本t检验、卡方检验）
4. **Bootstrap置信区间 **（对于任何统计数据，无需假设）
5. **A/B测试模拟器 **（生成数据、测试、检查I型和II型错误）
6. ** 统计与实际意义演示 **（表明大n使一切都“有意义”）

这一切都是从头开始的，只使用“数学”和“随机”。没有麻木，没有麻木。

## 关键术语

| Term | 定义 |
|---|---|
| 是说 | 值和除以计数。对异常值敏感。 |
| 中值 | 排序数据的中间值。对离群值稳健。 |
| 标准偏差 | 方差的平方根。措施按原单位展开。 |
| 百分位 | 给定百分比的数据低于该值。 |
| IQR | 四分位间距。Q3减去Q1。中间50%的价差。 |
| Pearson相关 | 衡量两个变量之间的线性关联。范围[-1，1]。 |
| Spearman相关 | 使用排名衡量单调关联。 |
| 协方差矩阵 | 所有特征之间的成对协方差矩阵。 |
| 零假设 | 默认假设没有影响或没有差异。 |
| p值 | 假设零假设为真，数据出现如此极端的可能性。 |
| 置信区间 | 给定置信水平下参数的合理值范围。 |
| t检验 | 测试平均值是否存在显着差异。使用t分布。 |
| 卡方检验 | 测试观察到的频率是否与预期频率不同。 |
| 效应量 | 差异的幅度，与样本量无关。科恩的d很常见。 |
| Bonferroni校正 | 将显着性阈值除以测试次数以控制假阳性。 |
| Bootstrap | 用替换重新恢复以估计抽样分布。 |
| I类错误 | 假阳性。当H 0为真时拒绝。 |
| II类误差 | 假阴性。H 0为假时未能拒绝。 |
| 统计功效 | 正确拒绝假H 0的可能性。功效= 1减去II类错误率。 |
| 中心极限定理 | 随着样本量的增加，样本均值收敛于正态分布。 |
| 参数检验 | 假设数据的特定分布（通常为正态）。 |
| 非参数检验 | 不做出分配假设。适用于等级或标志。 |
