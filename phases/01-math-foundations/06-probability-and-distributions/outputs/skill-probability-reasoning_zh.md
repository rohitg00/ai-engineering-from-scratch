---
name: skill-probability-reasoning
description: 为给定的ML问题选择正确的概率分布
version: 1.0.0
phase: 1
lesson: 6
tags: [probability, distributions, modeling]
---

# 概率分布选择

在建模数据、设计损失函数或设置先验时，如何选择正确的分布。

## 决策清单

1. 结果是离散的（类别、计数）还是连续的（测量、分数）？
2. 结果是有界的（例如 [0, 1]）还是无界的？
3. 有多少种可能的结果？两个？k个？无限？
4. 数据是对称的还是偏态的？
5. 事件是独立的还是相关的？
6. 您是在建模比率、计数、比例还是测量？

## 分布决策树

```
变量是离散的吗？
  是 --> 只有 2 种结果？ --> Bernoulli (p)
     |    k 种结果，一次试验？ --> Categorical (p1...pk)
     |    k 种结果，n 次试验？ --> Multinomial (n, p1...pk)
     |    n 次试验中的成功计数？ --> Binomial (n, p)
     |    每个间隔的事件计数？ --> Poisson (lambda)
     |    直到第一次成功的试验计数？ --> Geometric (p)
     |    直到 r 次成功的试验计数？ --> Negative Binomial (r, p)
  否 --> 对称，钟形？ --> Normal (mu, sigma)
     |    正值，右偏？ --> Log-normal 或 Exponential
     |    在 [0, 1] 中有界？ --> Beta (alpha, beta)
     |    正值，灵活形状？ --> Gamma (alpha, beta)
     |    事件之间的时间？ --> Exponential (lambda)
     |    需要重尾？ --> Student's t (nu) 或 Cauchy
     |    多元，钟形？ --> Multivariate Normal
     |    在单纯形上（总和为 1）？ --> Dirichlet (alpha)
```

## 将真实世界ML场景映射到分布

| 场景 | 分布 | 参数 |
|---|---|---|
| 二分类输出 | Bernoulli | p = sigmoid(logit) |
| 多分类输出 | Categorical | p = softmax(logits) |
| 语言模型中的token预测 | 词汇表上的Categorical | p 来自 softmax |
| 像素强度（归一化） | Beta 或 Uniform [0, 1] | 取决于图像统计 |
| 文档中的单词计数 | Poisson | lambda = 平均单词数 |
| 用户请求之间的时间 | Exponential | lambda = 请求率 |
| 测量误差 | Normal | mu = 0，sigma 来自数据 |
| 权重初始化 | Normal 或 Uniform | Kaiming/Xavier 规则 |
| VAE 潜在空间先验 | Standard Normal | mu = 0，sigma = 1 |
| 比例上的贝叶斯先验 | Beta | alpha, beta 来自信念 |
| 类别权重上的贝叶斯先验 | Dirichlet | alpha 向量 |
| 回归目标中的噪声 | Normal | mu = 0，sigma 估计 |
| 对异常值鲁棒的回归 | Student's t | 低自由度 |
| 持续时间/生命周期建模 | Weibull 或 Gamma | 形状和规模 |
| 每个文档的主题分布（LDA） | Dirichlet | alpha < 1 用于稀疏性 |

## 当分布出错时

- 当数据有硬下界时使用 Normal（例如，价格、距离）。正态分布为负值分配非零概率。改用对数正态或伽马。
- 当方差与均值不同时使用 Poisson。Poisson 假设均值 = 方差。如果方差 > 均值，使用负二项式。
- 对于多分类问题使用 Bernoulli。Bernoulli 严格是二值的。对于 k > 2 使用 categorical。
- 当观测相关时假设独立性。时间序列、空间数据和分组数据违反独立性。使用自回归或层次模型。

## 常见错误

- 混淆 PDF 值与概率。PDF 可以超过 1。概率来自在区间上积分 PDF。
- 忘记 softmax 输出是 categorical 概率，不是独立的 Bernoulli 概率。它们通过构造总和为 1。
- 当您有领域知识时使用均匀先验。如果选择得当，信息先验会减少方差而不会偏向结果。
- 将对数概率视为概率。对数概率始终为负（或零）。它们不总和为 1。

## 快速参考：分布属性

| 分布 | 支持 | 均值 | 方差 | 关键属性 |
|---|---|---|---|---|
| Bernoulli(p) | {0, 1} | p | p(1-p) | 最简单的离散分布 |
| Binomial(n, p) | {0..n} | np | np(1-p) | n 个 Bernoulli 的和 |
| Poisson(lam) | {0, 1, 2, ...} | lam | lam | 均值 = 方差 |
| Normal(mu, s^2) | (-inf, inf) | mu | s^2 | 对于给定均值/方差的最大熵 |
| Exponential(lam) | [0, inf) | 1/lam | 1/lam^2 | 无记忆 |
| Beta(a, b) | [0, 1] | a/(a+b) | ab/((a+b)^2(a+b+1)) | 二项式的共轭 |
| Gamma(a, b) | (0, inf) | a/b | a/b^2 | Poisson 的共轭 |
| Dirichlet(alpha) | 单纯形 | alpha_i/sum | （见公式） | Categorical 的共轭 |
