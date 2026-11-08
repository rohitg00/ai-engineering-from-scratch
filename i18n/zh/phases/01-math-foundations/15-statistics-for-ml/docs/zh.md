# 机器学习的统计数据

> 统计是如何知道你的模型是否真的有效,或者只是幸运.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**Time:** ~120 minutes

## 学习目标

- 计算描述性统计,皮尔森/斯皮尔曼相关性和零的共变矩阵
- 执行假设测试 (t测试,chi-平方) 并正确解释p值和信任间隔
- 使用bootstrap重样构建任何测量值的信任间隔,而没有分布假设
- 使用效果尺寸测量来区分统计意义与实用意义

## 问题

你训练了两个模型.A型号在测试组上得分0.87,B型号在得分0.89,你部署B型号.三周后,生产指标比以前更糟.

模型B实际上没有超过模型A.0.02的差异是噪音.你的测试组太小,或变异太高,或者两者都.你装扮成改进的随机性.

随时发生这种情况. 曲排名表的调整. 文件无法复制. A/B 测试,根据几百个样本宣布获胜者. 根本原因总是相同的:有人跳过了统计数据.

统计数据给你提供了区分信号和噪音的工具. 它告诉你什么时候差异是真实的,你应该有多自信,以及你需要多少数据才能相信结果. 每个ML管道,每一个模型比较,每一个实验都需要统计.没有它,你猜测.

## 概念

### 描述统计:概括数据

在你做任何模型之前,你需要知道你的数据是什么样子.描述性统计数据集将数据集压缩成几个数字,

**Measures of central tendency**答案是"中间在哪里?"

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

平均值是平衡点.中位数是半途线.当它们分离时,你的分布是偏差的.收入分布有$\text{mean} \gg \text{median}$经过培训期间的损失分布通常会有$\text{mean} \ll \text{median}$(从轻松的样本中左侧偏差).

**Measures of spread**答案是"数据分布多大?"

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

**Percentiles**分类数据成100个等部分.25个百分点 (Q1) 表示25%的值落在这个点以下.50个百分点是中位数.75个百分点是Q3.

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

在ML中,你关心推断延迟,预测信心分布和理解错误分布的百分比.一个平均错误低但可怕的P99错误的模型可能对安全关键应用来说是无用的.

**Sample vs population statistics.**在计算样本的差异时,分为 $(n-1)$没有$n$这就是贝塞尔的纠正,它补偿了你样本平均值不是真正的人口平均值.$n$在指数中,你系统地低估了真正的差异.$(n-1)$估计是无偏见的.

```math
\begin{aligned}
\text{Population variance:} \quad \sigma^2 &= \frac{1}{N} \sum (x_i - \mu)^2 \\
\text{Sample variance:} \quad s^2 &= \frac{1}{n-1} \sum (x_i - \bar{x})^2
\end{aligned}
```

在实践中:如果$n$虽然数量不高,但如果数量不高,$n$虽然它很小 (数十个样本),但它很重要.

### 相关性:变量如何一起移动

相关性衡量两个变量之间的线性关系的强度和方向.

**Pearson correlation coefficient**措施是线性协同:

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

皮尔森假设这种关系是线性,两个变量都大致正常分布.它对异常值敏感.一个极端点可以拖动$r$它们的数量从0.1到0.9

**Spearman rank correlation**措施单调的联系:

```
1. Replace each value with its rank (1, 2, 3, ...)
2. Compute Pearson correlation on the ranks

Spearman catches any monotonic relationship, not just linear.
If y = x^3, Pearson gives r < 1 but Spearman gives rho = 1.
```

**When to use each:**

```
Pearson:    Both variables are continuous and roughly normal.
            You care about the linear relationship specifically.
            No extreme outliers.

Spearman:   Ordinal data (rankings, ratings).
            Data is not normally distributed.
            You suspect a monotonic but not linear relationship.
            Outliers are present.
```

**The golden rule:**相关性并不意味着因果关系.冰淋销售和溺水死亡都相关,因为夏季都会增加. 模型的准确性和参数数数量都相关,但添加参数不会自动提高准确性 (见:过度配件).

### 变量矩阵

两个变量之间的共变量衡量它们如何与 nhau变化:

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

为了$d$特性,共变矩阵$C$是一个$d \times d$矩阵$C[i][j] = \mathop{\mathrm{Cov}}(\text{feature}_i, \text{feature}_j)$斜面的输入$C[i][i]$它们的不同性.

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

**Connection to PCA.**实际上,在一个对比数组中,一个对比数组的位置是个对比数组. PCA 自身构成了共变矩阵.自向量是主要的组件 (最大变异的方向).自值值告诉你每个组件捕获多少变异.这正是10课程所涵盖的,但现在你看到了为什么共变矩阵是分解的正确东西:它编码了你数据中的所有对对线关系.

**Connection to correlation.**相关性矩阵是标准化变量 (每个变量以其标准偏差分为) 的共变矩阵.$[-1, 1]$现在,我们要去.

### 假设测试

假设测试是在不确定性下做出决定的框架.

**The setup:**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**The p-value**假设H0是真的,这是一个最常见的误解.

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**Confidence intervals**给一个参数一个可行的值范围:

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

宽度的保证间隔告诉你准确性.宽度的间隔意味着高的不确定性.狭的间隔意味着你的估计是准确的 (但不一定是准确的,如果你的数据偏见).

### 测试

测试比较了各种味道.

**One-sample t-test:**人口平均值与假设值不同吗?

```math
\begin{aligned}
t &= \frac{\bar{x} - \mu_0}{s / \sqrt{n}} \\[4pt]
\text{degrees of freedom} &= n - 1
\end{aligned}
```

**Two-sample t-test (independent):**两个群体的意思是不同的吗?

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**Paired t-test:**测量对 (相同模型在相同的数据分区上进行评估):

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

在ML中,对 t 测试是常见的:你运行两个模型在相同的10个验证折叠上,并对比它们的分数.

### 奇方体测试

检查观察频率是否与预期频率相匹配.

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

### 对于ML模型进行A/B测试

在ML中A/B测试与网络A/B测试不同.模型比较具有具体的挑战:

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

**The procedure:**

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

### 统计意义与实用意义

结果可能是统计上显著的,但实际上是无意义的.

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

**Effect size**量化了不同程度,不论样本大小如何:

```math
\begin{aligned}
\text{Cohen's } d &= \frac{\text{mean}_1 - \text{mean}_2}{\text{pooled\_std}} \\[4pt]
d &= 0.2: \quad \text{small effect} \\
d &= 0.5: \quad \text{medium effect} \\
d &= 0.8: \quad \text{large effect}
\end{aligned}
```

总是报告p值和效果大小.p值告诉你是否有真正的差异.效果大小告诉你是否重要.

### 多种比较问题

假设是很重要的,但如果你测试20个东西,$\alpha = 0.05$假阳性,即使没有什么是真实的.

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni correction:**分开$\alpha$根据测试数量.

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

在ML中,当你比较一个模型在多个指标中,测试许多超参数配置,或在多个数据集上评估时,这很重要.

### 启动方法

引导测试通过替换数据来估计统计数据的样本分布.

**The algorithm:**

```
1. You have n data points
2. Draw n samples WITH replacement (some points appear multiple times,
   some not at all)
3. Compute your statistic on this bootstrap sample
4. Repeat B times (typically B = 1000 to 10000)
5. The distribution of bootstrap statistics approximates the
   sampling distribution
```

**Bootstrap confidence interval (percentile method):**

```
Sort the B bootstrap statistics
95% CI = [2.5th percentile, 97.5th percentile]
```

**Why bootstrap matters for ML:**

```
- Test set accuracy is a point estimate. Bootstrap gives you
  confidence intervals.
- You cannot assume metric distributions are normal (especially
  for AUC, F1, precision at k).
- Bootstrap works for ANY statistic: median, ratio of two means,
  difference in AUC between two models.
- No closed-form formula needed.
```

**Bootstrap for model comparison:**

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

这比对 t 测试更强大,因为它没有分布假设.

### 参数对非参数测试

**Parametric tests**假设一个特定的分布 (通常是正常的):

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**Non-parametric tests**没有进行分布假设:

```
Mann-Whitney U:     compares two groups (replaces independent t-test)
Wilcoxon signed-rank: compares paired data (replaces paired t-test)
Spearman rho:       correlation on ranks (replaces Pearson)
Kruskal-Wallis:     compares multiple groups (replaces ANOVA)
```

**When to use non-parametric:**

```
- Small sample size (n < 30) and data is clearly non-normal
- Ordinal data (ratings, rankings)
- Heavy outliers you cannot remove
- Skewed distributions
```

**When to use parametric:**

```
- Large sample size (CLT makes the test statistic approximately normal)
- Data is roughly symmetric without extreme outliers
- More statistical power (better at detecting real differences)
```

在ML实验中,你通常有小的$n$由于这些测试的结果,通常会比t测试更适合.

### 中央限度定理:实际含义

根据CLT的说法,样本的分布平均接近正常分布,$n$尽管人口分布不相同,但

```
If X_1, X_2, ..., X_n are iid with mean mu and variance sigma^2:

    X_bar ~ Normal(mu, sigma^2 / n)    as n -> infinity

Works for n >= 30 in most cases.
For highly skewed distributions, you might need n >= 100.
```

**Why this matters for ML:**

```
1. Justifies confidence intervals and t-tests on aggregated metrics
2. Explains why averaging over cross-validation folds gives stable
   estimates even when individual folds vary wildly
3. Mini-batch gradient descent works because the average gradient
   over a batch approximates the true gradient (CLT in action)
4. Ensemble methods: averaging predictions from many models gives
   more stable output than any single model
```

**What CLT does NOT do:**

```
- Does NOT make your data normal. It makes the MEAN of samples normal.
- Does NOT work for heavy-tailed distributions with infinite variance
  (Cauchy distribution).
- Does NOT apply to dependent data (time series without correction).
```

### 常见的ML论文的统计错误

1. **Testing on the training set.**确保过度适应. 保持模型在训练中不会看到的数据.

2. **No confidence intervals.**报告单个准确数号,而无可确定性,使得结果无法复制和无法验证.

3. **Ignoring multiple comparisons.**测试50个配置,报告最好的配置,

4. **Confusing statistical and practical significance.**对于0.01%的精度提高,一个0.001的p值是没有意义的.

5. **Using accuracy on imbalanced data.**模型没有学到任何东西.使用精度,回忆,F1,或AUC.

6. **Cherry-picking metrics.**诚实评估报告所有相关的指标.

7. **Leaking information across train/test splits.**在分开之前,将其正常化,或者使用未来数据来预测过去.

8. **Small test sets with no variance estimates.**通过100个样本进行评估,并声称2%的改善是噪音,而不是信号.

9. **Assuming independence when data is not independent.**医疗图像来自同一患者,同一文件的多句话.

10. **P-hacking.**试试不同的测试,子集,或排斥标准,直到你得到$p < 0.05$结果是搜索的文物.

## 建立它

你将实施:

1. **Descriptive statistics from scratch**(平均,中位数,模式,标准偏差,百分点,IQR)
2. **Correlation functions**(皮尔森和斯皮尔曼,与共变矩阵)
3. **Hypothesis tests**(一个样本的t测试,两个样本的t测试,四方的chi测试)
4. **Bootstrap confidence intervals**(对于任何统计数据,不需要假设)
5. **A/B test simulator**(生成数据,测试,检查I类和II类错误)
6. **Statistical vs practical significance demo**(显示出那么大的$n$让一切都"重要")

只有使用`math`其他`random`没有,没有.

```figure
f3-bootstrap-resample
```

## 关键词

| Term | Definition |
|---|---|
| Mean | Sum of values divided by count. Sensitive to outliers. |
| Median | Middle value of sorted data. Robust to outliers. |
| Standard deviation | Square root of variance. Measures spread in original units. |
| Percentile | Value below which a given percentage of data falls. |
| IQR | Interquartile range. Q3 minus Q1. The spread of the middle 50%. |
| Pearson correlation | Measures linear association between two variables. Range $[-1, 1]$. |
| Spearman correlation | Measures monotonic association using ranks. |
| Covariance matrix | Matrix of pairwise covariances between all features. |
| Null hypothesis | Default assumption of no effect or no difference. |
| p-value | Probability of data this extreme given the null hypothesis is true. |
| Confidence interval | Range of plausible values for a parameter at a given confidence level. |
| t-test | Tests whether means differ significantly. Uses the t-distribution. |
| Chi-squared test | Tests whether observed frequencies differ from expected frequencies. |
| Effect size | Magnitude of a difference, independent of sample size. Cohen's d is common. |
| Bonferroni correction | Divides significance threshold by number of tests to control false positives. |
| Bootstrap | Resampling with replacement to estimate sampling distributions. |
| Type I error | False positive. Rejecting H0 when it is true. |
| Type II error | False negative. Failing to reject H0 when it is false. |
| Statistical power | Probability of correctly rejecting a false H0. Power = 1 minus Type II error rate. |
| Central limit theorem | Sample means converge to a normal distribution as sample size grows. |
| Parametric test | Assumes a specific distribution for the data (usually normal). |
| Non-parametric test | Makes no distributional assumptions. Works on ranks or signs. |
