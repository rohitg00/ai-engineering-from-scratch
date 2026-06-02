# 概率与分布（Probability and Distributions）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 概率是 AI 用来表达不确定性的语言。

**Type:** Learn
**Language:** Python
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 从零实现 Bernoulli、categorical、Poisson、uniform、normal 分布的 PMF 和 PDF
- 计算期望、方差，并用中心极限定理（Central Limit Theorem）解释为什么 Gaussian 无处不在
- 用数值稳定技巧（减去最大 logit）实现 softmax 和 log-softmax
- 从 logits 计算 cross-entropy loss，并把它和负对数似然（negative log-likelihood）联系起来

## 问题（The Problem）

一个分类器输出 `[0.03, 0.91, 0.06]`。一个语言模型从 50,000 个候选词里挑下一个词。一个 diffusion 模型通过从学到的分布里采样来生成图像。这些全都是概率在起作用。

模型做的每一个预测都是一个概率分布。每一个损失函数都在度量预测分布和真实分布之间的距离。每一次训练都在调整参数，让一个分布更像另一个分布。没有概率，你读不懂任何一篇 ML 论文，调不了任何一个模型，也搞不清自己的训练 loss 为什么变成了 NaN。

## 概念（The Concept）

### 事件、样本空间和概率（Events, Sample Spaces, and Probability）

样本空间 S 是所有可能结果的集合。事件是样本空间的子集。概率把事件映射到 0 到 1 之间的数字。

```
Coin flip:
  S = {H, T}
  P(H) = 0.5,  P(T) = 0.5

Single die roll:
  S = {1, 2, 3, 4, 5, 6}
  P(even) = P({2, 4, 6}) = 3/6 = 0.5
```

整个概率论由三条公理定义：
1. P(A) >= 0，对任意事件 A 成立
2. P(S) = 1（总会发生点什么）
3. 当 A 和 B 不可能同时发生时，P(A or B) = P(A) + P(B)

其余一切（Bayes 定理、期望、各种分布）都从这三条规则推出来。

### 条件概率与独立性（Conditional Probability and Independence）

P(A|B) 是在 B 发生的前提下，A 发生的概率。

```
P(A|B) = P(A and B) / P(B)

Example: deck of cards
  P(King | Face card) = P(King and Face card) / P(Face card)
                      = (4/52) / (12/52)
                      = 4/12 = 1/3
```

两个事件相互独立，意味着知道其中一个不会告诉你另一个的任何信息：

```
Independent:   P(A|B) = P(A)
Equivalent to: P(A and B) = P(A) * P(B)
```

抛硬币是相互独立的。不放回抽牌则不是。

### 概率质量函数 vs 概率密度函数（Probability Mass Functions vs Probability Density Functions）

离散随机变量有概率质量函数（PMF）。每个结果都有一个具体的概率，可以直接读出来。

```
PMF: P(X = k)

Fair die:
  P(X = 1) = 1/6
  P(X = 2) = 1/6
  ...
  P(X = 6) = 1/6

  Sum of all probabilities = 1
```

连续随机变量有概率密度函数（PDF）。单点处的密度不是概率。概率需要把密度在某个区间上积分得到。

```
PDF: f(x)

P(a <= X <= b) = integral of f(x) from a to b

f(x) can be greater than 1 (density, not probability)
integral from -inf to +inf of f(x) dx = 1
```

这个区分在 ML 里很重要。分类器的输出是 PMF（离散选择）。VAE 的隐空间用的是 PDF（连续）。

### 常见分布（Common Distributions）

**Bernoulli：** 一次试验，两种结果。建模二分类。

```
P(X = 1) = p
P(X = 0) = 1 - p
Mean = p,  Variance = p(1-p)
```

**Categorical：** 一次试验，k 种结果。建模多分类（softmax 输出）。

```
P(X = i) = p_i,  where sum of p_i = 1
Example: P(cat) = 0.7,  P(dog) = 0.2,  P(bird) = 0.1
```

**Uniform（均匀分布）：** 所有结果等概率。用于随机初始化。

```
Discrete: P(X = k) = 1/n for k in {1, ..., n}
Continuous: f(x) = 1/(b-a) for x in [a, b]
```

**Normal（正态 / Gaussian）：** 钟形曲线。由均值（mu）和方差（sigma^2）决定。

```
f(x) = (1 / sqrt(2*pi*sigma^2)) * exp(-(x - mu)^2 / (2*sigma^2))

Standard normal: mu = 0, sigma = 1
  68% of data within 1 sigma
  95% within 2 sigma
  99.7% within 3 sigma
```

**Poisson（泊松分布）：** 固定区间里稀有事件的计数。建模事件发生的频率。

```
P(X = k) = (lambda^k * e^(-lambda)) / k!
Mean = lambda,  Variance = lambda
```

### 期望和方差（Expected Value and Variance）

期望是按概率加权的平均结果。

```
Discrete:   E[X] = sum of x_i * P(X = x_i)
Continuous: E[X] = integral of x * f(x) dx
```

方差度量结果围绕均值的散布程度。

```
Var(X) = E[(X - E[X])^2] = E[X^2] - (E[X])^2
Standard deviation = sqrt(Var(X))
```

在 ML 里，期望以损失函数的形式出现（在数据分布上的平均损失）。方差告诉你模型的稳定性。gradient 方差大意味着训练噪声大。

### 联合分布与边缘分布（Joint and Marginal Distributions）

联合分布 P(X, Y) 同时描述两个随机变量。

联合 PMF 示例（X = 天气，Y = 是否带伞）：

| | Y=0 (no umbrella) | Y=1 (umbrella) | Marginal P(X) |
|---|---|---|---|
| X=0 (sun) | 0.40 | 0.10 | P(X=0) = 0.50 |
| X=1 (rain) | 0.05 | 0.45 | P(X=1) = 0.50 |
| **Marginal P(Y)** | P(Y=0) = 0.45 | P(Y=1) = 0.55 | 1.00 |

边缘分布把另一个变量加和掉：

```
P(X = x) = sum over all y of P(X = x, Y = y)
```

上表的行总和与列总和就是边缘分布。

### 为什么正态分布无处不在（Why the Normal Distribution Shows Up Everywhere）

中心极限定理：许多独立随机变量的和（或平均）会收敛到正态分布，无论原始分布长什么样。

```
Roll 1 die:  uniform distribution (flat)
Average of 2 dice:  triangular (peaked)
Average of 30 dice: nearly perfect bell curve

This works for ANY starting distribution.
```

所以才有：
- 测量误差近似服从正态（来自许多独立的小误差源）
- 神经网络的权重初始化使用正态分布
- SGD 的 gradient 噪声近似正态（许多样本 gradient 的和）
- 在均值和方差给定的前提下，正态分布是最大熵分布

### 对数概率（Log Probabilities）

直接用原始概率会有数值问题。许多小概率连乘很快会下溢到零。

```
P(sentence) = P(word1) * P(word2) * ... * P(word_n)
            = 0.01 * 0.003 * 0.02 * ...
            -> 0.0 (underflow after ~30 terms)
```

对数概率解决了这个问题。乘法变成加法。

```
log P(sentence) = log P(word1) + log P(word2) + ... + log P(word_n)
                = -4.6 + -5.8 + -3.9 + ...
                -> finite number (no underflow)
```

规则：
- log(a * b) = log(a) + log(b)
- 对数概率始终 <= 0（因为 0 < P <= 1）
- 越负 = 越不可能
- cross-entropy loss 就是正确类别的负对数概率

### 把 softmax 看作概率分布（Softmax as a Probability Distribution）

神经网络输出原始分数（logits）。softmax 把它们转换成一个合法的概率分布。

```
softmax(z_i) = exp(z_i) / sum(exp(z_j) for all j)

Properties:
  - All outputs are in (0, 1)
  - All outputs sum to 1
  - Preserves relative ordering of inputs
  - exp() amplifies differences between logits
```

softmax 小技巧：在做指数之前，减掉最大的 logit，避免溢出。

```
z = [100, 101, 102]
exp(102) = overflow

z_shifted = z - max(z) = [-2, -1, 0]
exp(0) = 1  (safe)

Same result, no overflow.
```

log-softmax 把 softmax 和 log 合在一起，保持数值稳定。PyTorch 内部就用它来算 cross-entropy loss。

### 采样（Sampling）

采样指从一个分布里抽取随机值。在 ML 里：
- dropout 随机采样把哪些 neuron 置零
- 数据增强采样随机的变换
- 语言模型从预测分布里采样下一个 token
- diffusion 模型采样噪声并逐步去噪

从任意分布采样需要技巧，比如逆变换采样、拒绝采样，或者重参数化技巧（VAE 里用的）。

## 动手实现（Build It）

### 第 1 步：概率基础（Step 1: Probability basics）

```python
import math
import random

def factorial(n):
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

def combinations(n, k):
    return factorial(n) // (factorial(k) * factorial(n - k))

def conditional_probability(p_a_and_b, p_b):
    return p_a_and_b / p_b

p_king_given_face = conditional_probability(4/52, 12/52)
print(f"P(King | Face card) = {p_king_given_face:.4f}")
```

### 第 2 步：从零实现 PMF 和 PDF（Step 2: PMF and PDF from scratch）

```python
def bernoulli_pmf(k, p):
    return p if k == 1 else (1 - p)

def categorical_pmf(k, probs):
    return probs[k]

def poisson_pmf(k, lam):
    return (lam ** k) * math.exp(-lam) / factorial(k)

def uniform_pdf(x, a, b):
    if a <= x <= b:
        return 1.0 / (b - a)
    return 0.0

def normal_pdf(x, mu, sigma):
    coeff = 1.0 / (sigma * math.sqrt(2 * math.pi))
    exponent = -0.5 * ((x - mu) / sigma) ** 2
    return coeff * math.exp(exponent)
```

### 第 3 步：期望与方差（Step 3: Expected value and variance）

```python
def expected_value(values, probabilities):
    return sum(v * p for v, p in zip(values, probabilities))

def variance(values, probabilities):
    mu = expected_value(values, probabilities)
    return sum(p * (v - mu) ** 2 for v, p in zip(values, probabilities))

die_values = [1, 2, 3, 4, 5, 6]
die_probs = [1/6] * 6
mu = expected_value(die_values, die_probs)
var = variance(die_values, die_probs)
print(f"Die: E[X] = {mu:.4f}, Var(X) = {var:.4f}, SD = {var**0.5:.4f}")
```

### 第 4 步：从分布中采样（Step 4: Sampling from distributions）

```python
def sample_bernoulli(p, n=1):
    return [1 if random.random() < p else 0 for _ in range(n)]

def sample_categorical(probs, n=1):
    cumulative = []
    total = 0
    for p in probs:
        total += p
        cumulative.append(total)
    samples = []
    for _ in range(n):
        r = random.random()
        for i, c in enumerate(cumulative):
            if r <= c:
                samples.append(i)
                break
    return samples

def sample_normal_box_muller(mu, sigma, n=1):
    samples = []
    for _ in range(n):
        u1 = random.random()
        u2 = random.random()
        z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
        samples.append(mu + sigma * z)
    return samples
```

### 第 5 步：softmax 与对数概率（Step 5: Softmax and log probabilities）

```python
def softmax(logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    exps = [math.exp(z) for z in shifted]
    total = sum(exps)
    return [e / total for e in exps]

def log_softmax(logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = max_logit + math.log(sum(math.exp(z) for z in shifted))
    return [z - log_sum_exp for z in logits]

def cross_entropy_loss(logits, target_index):
    log_probs = log_softmax(logits)
    return -log_probs[target_index]
```

### 第 6 步：中心极限定理演示（Step 6: Central Limit Theorem demonstration）

```python
def demonstrate_clt(dist_fn, n_samples, n_averages):
    averages = []
    for _ in range(n_averages):
        samples = [dist_fn() for _ in range(n_samples)]
        averages.append(sum(samples) / len(samples))
    return averages
```

### 第 7 步：可视化（Step 7: Visualization）

```python
import matplotlib.pyplot as plt

xs = [mu + sigma * (i - 500) / 100 for i in range(1001)]
ys = [normal_pdf(x, mu, sigma) for x, mu, sigma in ...]
plt.plot(xs, ys)
```

完整实现和所有可视化都在 `code/probability.py` 里。

## 用起来（Use It）

有了 NumPy 和 SciPy，上面的一切都能写成一行：

```python
import numpy as np
from scipy import stats

normal = stats.norm(loc=0, scale=1)
samples = normal.rvs(size=10000)
print(f"Mean: {np.mean(samples):.4f}, Std: {np.std(samples):.4f}")
print(f"P(X < 1.96) = {normal.cdf(1.96):.4f}")

logits = np.array([2.0, 1.0, 0.1])
from scipy.special import softmax, log_softmax
probs = softmax(logits)
log_probs = log_softmax(logits)
print(f"Softmax: {probs}")
print(f"Log-softmax: {log_probs}")
```

你已经从零实现过这些。现在你知道这些库函数到底在做什么。

## 练习（Exercises）

1. 为指数分布（exponential distribution）实现逆变换采样。采 10,000 个值，把直方图和真实 PDF 对比验证。

2. 为两枚作弊骰子构造一张联合分布表。计算边缘分布，并检查这两枚骰子是否独立。

3. 一个 5 类分类器输出 logits `[2.0, 0.5, -1.0, 3.0, 0.1]`，正确类别是索引 3。计算它的 cross-entropy loss，然后用 PyTorch 的 `nn.CrossEntropyLoss` 验证。

4. 写一个函数：输入一个对数概率列表，返回最可能的序列、总对数概率以及对应的原始概率。用一句包含 50 个词、每个词概率 0.01 的句子测试。

## 关键术语（Key Terms）

| 术语 | 大家是怎么说的 | 它实际是什么 |
|------|----------------|----------------------|
| Sample space | "所有可能性" | 集合 S，包含一次实验所有可能的结果 |
| PMF | "那个概率函数" | 给出每个离散结果具体概率的函数，所有概率加起来等于 1 |
| PDF | "那条概率曲线" | 连续变量的密度函数。把它在某个区间上积分才得到概率 |
| Conditional probability | "在某条件下的概率" | P(A\|B) = P(A and B) / P(B)。Bayes 思维和 Bayes 定理的基础 |
| Independence | "互不影响" | P(A and B) = P(A) * P(B)。知道其中一个事件不会告诉你另一个的任何信息 |
| Expected value | "平均值" | 所有结果按概率加权求和。损失函数本质上就是一个期望 |
| Variance | "散得多开" | 与均值的平方偏差的期望。方差大 = 估计噪声大、不稳定 |
| Normal distribution | "钟形曲线" | f(x) = (1/sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2/(2*sigma^2))。因 CLT 而无处不在 |
| Central Limit Theorem | "平均了之后变正态" | 大量独立样本的均值会收敛到正态分布，无论原始分布是什么 |
| Joint distribution | "两个变量一起看" | P(X, Y) 描述 X 和 Y 各种取值组合的概率 |
| Marginal distribution | "把另一个变量加和掉" | P(X) = sum_y P(X, Y)。从联合分布里恢复某一个变量的分布 |
| Log probability | "概率的对数" | log P(x)。把乘法变成加法，避免长序列里的数值下溢 |
| Softmax | "把分数变成概率" | softmax(z_i) = exp(z_i) / sum(exp(z_j))。把实值 logits 映射成合法的概率分布 |
| Cross-entropy | "损失函数" | -sum(p_true * log(p_predicted))。度量两个分布的差异，越小越好 |
| Logits | "模型的原始输出" | softmax 之前的未归一化分数。名字来自 logistic 函数 |
| Sampling | "抽随机值" | 按某个概率分布生成值。模型生成输出的方式 |

## 延伸阅读（Further Reading）

- [3Blue1Brown: But what is the Central Limit Theorem?](https://www.youtube.com/watch?v=zeJD6dqJ5lo) —— 用可视化解释为什么平均之后会变正态
- [Stanford CS229 Probability Review](https://cs229.stanford.edu/section/cs229-prob.pdf) —— 涵盖本课所有内容（以及更多）的简明参考
- [The Log-Sum-Exp Trick](https://gregorygundersen.com/blog/2020/02/09/log-sum-exp/) —— 数值稳定为什么重要，以及怎么做到
