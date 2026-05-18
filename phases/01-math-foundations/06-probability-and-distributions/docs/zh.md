# Probability and Distributions

> Probability is the language AI uses to express uncertainty.

** 类型：** 学习
** 语言：** Python
** 先决条件：** 第1阶段，课程01-04
** 时间：** ~75分钟

## Learning Objectives

- 从头开始实施伯努里、类别、Poisson、均匀和正态分布的PMF和PDF
- 计算期望值、方差，并使用中心极限定理解释高斯占主导地位的原因
- 使用数字稳定性技巧构建softmax和log-softmax函数（减去最大logit）
- 计算logit的交叉熵损失并将其连接到负log似然

## The Problem

分类器输出“[0.03，0.91，0.06]”。语言模型从50，000个候选人中选择下一个单词。扩散模型通过从学习到的分布中采样来生成图像。所有这些都是行动中的可能性。

模型做出的每一个预测都是一个概率分布。每个损失函数都衡量预测分布与真实分布的距离。每个训练步骤都会调整参数，使一个分布看起来更像另一个分布。如果没有概率，您就无法阅读一篇ML论文、调试单个模型或理解为什么您的训练损失是NaN。

## The Concept

### Events, Sample Spaces, and Probability

样本空间S是所有可能结果的集合。事件是样本空间的子集。概率将事件映射为0和1之间的数字。

```
Coin flip:
  S = {H, T}
  P(H) = 0.5,  P(T) = 0.5

Single die roll:
  S = {1, 2, 3, 4, 5, 6}
  P(even) = P({2, 4, 6}) = 3/6 = 0.5
```

三个公理定义了所有的可能性：
1. 对于任何事件A，P（A）>= 0
2. P（S）= 1（总会发生一些事情）
3. P(A or B) = P(A) + P(B) when A and B cannot both occur

Everything else (Bayes' theorem, expectations, distributions) follows from these three rules.

### Conditional Probability and Independence

P(A|B) is the probability of A given that B happened.

```
P(A|B) = P(A and B) / P(B)

Example: deck of cards
  P(King | Face card) = P(King and Face card) / P(Face card)
                      = (4/52) / (12/52)
                      = 4/12 = 1/3
```

当知道其中一个事件对另一个事件一无所知时，两个事件是独立的：

```
Independent:   P(A|B) = P(A)
Equivalent to: P(A and B) = P(A) * P(B)
```

抛硬币是独立的。不更换的抽牌则不然。

### Probability Mass Functions vs Probability Density Functions

Discrete random variables have a probability mass function (PMF). Each outcome has a specific probability that you can read off directly.

```
PMF: P(X = k)

Fair die:
  P(X = 1) = 1/6
  P(X = 2) = 1/6
  ...
  P(X = 6) = 1/6

  Sum of all probabilities = 1
```

连续随机变量具有概率密度函数（PDF）。单点的密度不是概率。概率来自于对一个区间内的密度进行积分。

```
PDF: f(x)

P(a <= X <= b) = integral of f(x) from a to b

f(x) can be greater than 1 (density, not probability)
integral from -inf to +inf of f(x) dx = 1
```

这种区别在ML中很重要。分类输出是PMF（离散选择）。VAE潜在空间使用PDF（连续）。

### Common Distributions

**Bernoulli:** one trial, two outcomes. Models binary classification.

```
P(X = 1) = p
P(X = 0) = 1 - p
Mean = p,  Variance = p(1-p)
```

**Categorical:** one trial, k outcomes. Models multi-class classification (softmax output).

```
P(X = i) = p_i,  where sum of p_i = 1
Example: P(cat) = 0.7,  P(dog) = 0.2,  P(bird) = 0.1
```

** 一致：** 所有结果的可能性相同。用于随机初始化。

```
Discrete: P(X = k) = 1/n for k in {1, ..., n}
Continuous: f(x) = 1/(b-a) for x in [a, b]
```

** 正态（高斯）：** 钟形曲线。通过平均值（μ）和方差（西格玛' 2）参数化。

```
f(x) = (1 / sqrt(2*pi*sigma^2)) * exp(-(x - mu)^2 / (2*sigma^2))

Standard normal: mu = 0, sigma = 1
  68% of data within 1 sigma
  95% within 2 sigma
  99.7% within 3 sigma
```

**Poisson:** counts of rare events in a fixed interval. Models event rates.

```
P(X = k) = (lambda^k * e^(-lambda)) / k!
Mean = lambda,  Variance = lambda
```

### Expected Value and Variance

Expected value is the weighted average outcome.

```
Discrete:   E[X] = sum of x_i * P(X = x_i)
Continuous: E[X] = integral of x * f(x) dx
```

方差测量值分布在平均值周围。

```
Var(X) = E[(X - E[X])^2] = E[X^2] - (E[X])^2
Standard deviation = sqrt(Var(X))
```

在ML中，期望值表现为损失函数（数据分布上的平均损失）。方差告诉您模型稳定性。梯度的高方差意味着训练有噪音。

### Joint and Marginal Distributions

A joint distribution P(X, Y) describes two random variables together.

Joint PMF example (X = weather, Y = umbrella):

|  | Y=0（无伞） | Y=1（伞） | Marginal P(X) |
|---|---|---|---|
| X=0（太阳） | 0.40 | 0.10 | P(X=0) = 0.50 |
| X=1（雨） | 0.05 | 0.45 | P(X=1) = 0.50 |
| ** 边缘P（Y）** | P（Y=0）= 0.45 | P（Y=1）= 0.55 | 1.00 |

边际分布总结了另一个变量：

```
P(X = x) = sum over all y of P(X = x, Y = y)
```

The row and column totals in the table above are the marginals.

### Why the Normal Distribution Shows Up Everywhere

The Central Limit Theorem: the sum (or average) of many independent random variables converges to a normal distribution, regardless of the original distribution.

```
Roll 1 die:  uniform distribution (flat)
Average of 2 dice:  triangular (peaked)
Average of 30 dice: nearly perfect bell curve

This works for ANY starting distribution.
```

这就是为什么：
- 测量误差大致正常（许多小型独立来源）
- Weight initializations in neural networks use normal distributions
- Gradient noise in SGD is approximately normal (sum of many sample gradients)
- 正态分布是给定平均值和方差的最大熵分布

### Log Probabilities

原始概率会导致数字问题。将许多小概率相乘在一起会很快潜到零。

```
P(sentence) = P(word1) * P(word2) * ... * P(word_n)
            = 0.01 * 0.003 * 0.02 * ...
            -> 0.0 (underflow after ~30 terms)
```

Log probabilities fix this. Multiplications become additions.

```
log P(sentence) = log P(word1) + log P(word2) + ... + log P(word_n)
                = -4.6 + -5.8 + -3.9 + ...
                -> finite number (no underflow)
```

规则：
- log（a * b）= log（a）+ log（b）
- log probabilities are always <= 0 (since 0 < P <= 1)
- More negative = less likely
- 交叉熵损失是正确类别的负对log概率

### Softmax as a Probability Distribution

神经网络输出原始分数（logits）。Softmax将它们转换为有效的概率分布。

```
softmax(z_i) = exp(z_i) / sum(exp(z_j) for all j)

Properties:
  - All outputs are in (0, 1)
  - All outputs sum to 1
  - Preserves relative ordering of inputs
  - exp() amplifies differences between logits
```

The softmax trick: subtract the max logit before exponentiating to prevent overflow.

```
z = [100, 101, 102]
exp(102) = overflow

z_shifted = z - max(z) = [-2, -1, 0]
exp(0) = 1  (safe)

Same result, no overflow.
```

Log-softmax combines softmax and log for numerical stability. PyTorch uses this internally for cross-entropy loss.

### Sampling

抽样意味着从分布中提取随机值。ML中：
- Dropout随机抽取哪些神经元归零
- 数据增强示例随机转换
- 语言模型从预测分布中采样下一个令牌
- Diffusion models sample noise and progressively denoise

从任意分布进行采样需要逆变换采样、拒绝采样或重新参数化技巧（用于VAE）等技术。

## Build It

### Step 1: Probability basics

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

### Step 2: PMF and PDF from scratch

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

### Step 3: Expected value and variance

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

### Step 4: Sampling from distributions

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

### Step 5: Softmax and log probabilities

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

### Step 6: Central Limit Theorem demonstration

```python
def demonstrate_clt(dist_fn, n_samples, n_averages):
    averages = []
    for _ in range(n_averages):
        samples = [dist_fn() for _ in range(n_samples)]
        averages.append(sum(samples) / len(samples))
    return averages
```

### Step 7: Visualization

```python
import matplotlib.pyplot as plt

xs = [mu + sigma * (i - 500) / 100 for i in range(1001)]
ys = [normal_pdf(x, mu, sigma) for x, mu, sigma in ...]
plt.plot(xs, ys)
```

所有可视化的完整实施均位于“code/probability.py”中。

## Use It

With NumPy and SciPy, everything above is one-liners:

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

这些都是你从头开始建造的。现在你知道图书馆呼叫正在做什么了。

## Exercises

1. 对指数分布实施逆变换采样。通过采样10，000个值并将矩形图与真实PDF进行比较来验证。

2. Build a joint distribution table for two loaded dice. Compute the marginal distributions and check whether the dice are independent.

3. 当正确的类为索引3时，计算输出逻辑位“[2.0，0.5，-1.0，3.0，0.1]”的5类分类器的交叉熵损失。然后使用PyTorch的“nn.CrossEntropyLoss”验证您的答案。

4. 编写一个函数，获取一系列log概率并返回最可能的序列、总log概率和等效的原始概率。用一个50个单词的句子来测试，其中每个单词的概率为0.01。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|----------------|----------------------|
| Sample space | “所有的可能性” | 实验每个可能结果的集合S |
| PMF | "The probability function" | A function that gives the exact probability of each discrete outcome, summing to 1 |
| PDF | “概率曲线” | A density function for continuous variables. Integrate it over an interval to get probability |
| Conditional probability | “给定某事的可能性” | P（A\ | B) = P(A and B) / P(B). The foundation of Bayesian thinking and Bayes' theorem |
| 独立 | “他们不会互相影响” | P（A和B）= P（A）* P（B）。了解一个事件并不能告诉你关于另一个事件的任何信息 |
| 预期值 | “平均水平” | The probability-weighted sum of all outcomes. The loss function is an expected value |
| Variance | "How spread out" | 与平均值的预期平方偏差。高方差=有噪音、不稳定的估计 |
| 正态分布 | "The bell curve" | f(x) = (1/sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2/(2*sigma^2)). Appears everywhere due to the CLT |
| Central Limit Theorem | “阿斯伯格变得正常” | 无论来源如何，许多独立样本的平均值都收敛于正态分布 |
| Joint distribution | “两个变量在一起” | P（X，Y）描述X和Y结果的每个组合的概率 |
| 边缘分布 | “计算出其他变量” | P（X）= sum_y P（X，Y）。从关节恢复一个变量的分布 |
| 对数概率 | “概率日志” | log P（x）。将积转化为总和，防止长序列中的数字下溢 |
| Softmax | "Turn scores into probabilities" | softmax(z_i) = exp(z_i) / sum(exp(z_j)). Maps real-valued logits to a valid probability distribution |
| 交叉熵 | “损失功能” | -sum(p_true * log(p_predicted)). Measures how different two distributions are. Lower is better |
| Logits | “原始模型输出” | softmax之前的非标准化分数。以逻辑函数命名 |
| Sampling | “绘制随机值” | 根据概率分布生成值。模型如何产生输出 |

## Further Reading

- [3 Blue 1 Brown：但是什么是中心极限定理？]（https：www.youtube.com/watch? v= zeJD 6dqJ 5lo）-平均值为何成为正常值的视觉证据
- [斯坦福CS229概率评论]（https：//cs229.stanford.edu/section/cs229-prob.pdf）-简明的参考，涵盖了这里的一切和更多
- [The Log-Sum-Exp Trick]（https：//gregundersen.com/blog/2020/02/09/log-sum-exp/）-为什么数字稳定性很重要以及如何实现它
