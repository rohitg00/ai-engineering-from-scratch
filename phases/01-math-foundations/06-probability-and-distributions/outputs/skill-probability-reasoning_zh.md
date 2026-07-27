---
name: skill-probability-reasoning
description: 针对给定的ML问题选择正确的概率分布
version: 1.0.0
phase: 1
lesson: 6
tags: [probability, distributions, modeling]
---

# 概率分布选择

如何在对数据建模、设计损失函数或设置先验时选择正确的分布。

## 决策清单

1. 结果是离散的（类别、计数）还是连续的（测量值、分数）？
2. 结果是有界的（例如 [0, 1]）还是无界的？
3. 有多少种可能的结果？两个？k个？无穷多个？
4. 数据是对称的还是偏斜的？
5. 事件是独立的还是相关的？
6. 你在对什么建模？速率、计数、比例还是测量值？

## 分布决策树

```
变量是离散的吗？
  是 --> 只有2个结果？--> Bernoulli (p)
     |   k个结果，一次试验？--> Categorical (p1...pk)
     |   k个结果，n次试验？--> Multinomial (n, p1...pk)
     |   n次试验中的成功次数？--> Binomial (n, p)
     |   每个区间内的事件次数？--> Poisson (lambda)
     |   直到首次成功的试验次数？--> Geometric (p)
     |   直到r次成功的试验次数？--> Negative Binomial (r, p)
  否 --> 对称、钟形？--> Normal (mu, sigma)
     |   正值、右偏？--> Log-normal 或 Exponential
     |   有界于 [0, 1]？--> Beta (alpha, beta)
     |   正值、形状灵活？--> Gamma (alpha, beta)
     |   事件间的时间？--> Exponential (lambda)
     |   需要重尾？--> Student's t (nu) 或 Cauchy
     |   多元、钟形？--> Multivariate Normal
     |   在单纯形上（和为1）？--> Dirichlet (alpha)
```

## 真实ML场景到分布的映射

| 场景 | 分布 | 参数 |
|---|---|---|
| 二分类输出 | Bernoulli | p = sigmoid(logit) |
| 多分类输出 | Categorical | p = softmax(logits) |
| 语言模型中的Token预测 | Categorical（在词表上） | p来自softmax |
| 像素强度（归一化后） | Beta 或 Uniform [0, 1] | 取决于图像统计量 |
| 文档中的词数 | Poisson | lambda = 平均词数 |
| 用户请求间的时间间隔 | Exponential | lambda = 请求速率 |
| 测量误差 | Normal | mu = 0, sigma 来自数据 |
| 权重初始化 | Normal 或 Uniform | Kaiming/Xavier规则 |
| VAE隐空间先验 | Standard Normal | mu = 0, sigma = 1 |
| 比例的先验（贝叶斯） | Beta | alpha, beta 来自信念 |
| 类别权重的先验（贝叶斯） | Dirichlet | alpha向量 |
| 回归目标的噪声 | Normal | mu = 0, sigma 估计得到 |
| 鲁棒回归（抗异常值） | Student's t | 低自由度 |
| 持续时间/生存时间建模 | Weibull 或 Gamma | 形状和尺度参数 |
| 每文档主题分布（LDA） | Dirichlet | alpha < 1 表示稀疏 |

## 分布选错时的问题

- 数据有硬性下界时使用正态分布（如价格、距离）。正态分布会给负值分配非零概率。应使用log-normal或gamma。
- 方差与均值不同时使用泊松分布。泊松分布假设均值=方差。如果方差>均值，应使用负二项分布。
- 对多分类问题使用伯努利分布。伯努利严格限于二分类。对于k>2应使用类别分布。
- 观测相关时假设独立性。时间序列、空间数据和分组数据违反了独立性假设。应使用自回归或层次模型。

## 常见错误

- 混淆PDF值和概率。PDF可以超过1。概率来自PDF在区间上的积分。
- 忘记softmax输出是类别概率，而非独立的伯努利概率。它们构造上就满足和为1。
- 在有领域知识时仍然使用均匀先验。选择得当的信息先验可以在不偏置结果的情况下减少方差。
- 将对数概率当作概率处理。对数概率总是负的（或零）。它们的和不为1。

## 快速参考：分布性质

| 分布 | 支撑集 | 均值 | 方差 | 关键特性 |
|---|---|---|---|---|
| Bernoulli(p) | {0, 1} | p | p(1-p) | 最简单的离散分布 |
| Binomial(n, p) | {0..n} | np | np(1-p) | n个Bernoulli之和 |
| Poisson(lam) | {0, 1, 2, ...} | lam | lam | 均值=方差 |
| Normal(mu, s^2) | (-inf, inf) | mu | s^2 | 给定均值和方差时熵最大 |
| Exponential(lam) | [0, inf) | 1/lam | 1/lam^2 | 无记忆性 |
| Beta(a, b) | [0, 1] | a/(a+b) | ab/((a+b)^2(a+b+1)) | Binomial的共轭先验 |
| Gamma(a, b) | (0, inf) | a/b | a/b^2 | Poisson的共轭先验 |
| Dirichlet(alpha) | 单纯形 | alpha_i/sum | （见公式） | Categorical的共轭先验 |
