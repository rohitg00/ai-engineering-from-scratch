# 06 · 概率与分布

> 概率是 AI 用来表达不确定性的语言。

**类型：** 学习
**语言：** Python
**前置：** 第 1 阶段，第 01-04 课
**时长：** 约 75 分钟

## 学习目标

- 从零实现伯努利（Bernoulli）、类别（categorical）、泊松（Poisson）、均匀（uniform）和正态（normal）分布的 PMF 和 PDF
- 计算期望值、方差，并用中心极限定理（Central Limit Theorem）解释为什么高斯分布无处不在
- 用数值稳定技巧（减去最大 logit）构建 softmax 和 log-softmax 函数
- 从 logits 计算交叉熵损失（cross-entropy loss），并将其与负对数似然（negative log-likelihood）联系起来

## 问题所在

一个分类器输出 `[0.03, 0.91, 0.06]`。一个语言模型从 50,000 个候选词中挑选下一个词。一个扩散模型通过从学到的分布中采样来生成图像。所有这些都是概率的实际应用。

模型做出的每一次预测都是一个概率分布。每一个损失函数都在衡量预测分布与真实分布之间的差距。每一个训练步骤都在调整参数，让一个分布更接近另一个分布。没有概率，你读不懂任何一篇机器学习论文，调试不了任何一个模型，也无法理解为什么你的训练损失变成了 NaN。

## 核心概念

### 事件、样本空间与概率

样本空间（sample space）S 是所有可能结果的集合。事件（event）是样本空间的一个子集。概率把事件映射为 0 到 1 之间的数字。

```
Coin flip:
  S = {H, T}
  P(H) = 0.5,  P(T) = 0.5

Single die roll:
  S = {1, 2, 3, 4, 5, 6}
  P(even) = P({2, 4, 6}) = 3/6 = 0.5
```

三条公理定义了整个概率论：
1. 对任意事件 A，P(A) >= 0
2. P(S) = 1（总会发生某件事）
3. 当 A 和 B 不可能同时发生时，P(A 或 B) = P(A) + P(B)

其余的一切（贝叶斯定理、期望、各种分布）都由这三条规则推导而来。

### 条件概率与独立性

P(A|B) 是在 B 已发生的条件下 A 发生的概率。

```
P(A|B) = P(A and B) / P(B)

Example: deck of cards
  P(King | Face card) = P(King and Face card) / P(Face card)
                      = (4/52) / (12/52)
                      = 4/12 = 1/3
```

当知道一个事件不会告诉你关于另一个事件的任何信息时，这两个事件是独立的：

```
Independent:   P(A|B) = P(A)
Equivalent to: P(A and B) = P(A) * P(B)
```

掷硬币是独立的。不放回地抽牌则不是。

### 概率质量函数与概率密度函数

离散随机变量有一个概率质量函数（probability mass function, PMF）。每个结果都有一个可以直接读出的具体概率。

```
PMF: P(X = k)

Fair die:
  P(X = 1) = 1/6
  P(X = 2) = 1/6
  ...
  P(X = 6) = 1/6

  Sum of all probabilities = 1
```

连续随机变量有一个概率密度函数（probability density function, PDF）。单个点处的密度不是概率。概率来自于对密度在某个区间上的积分。

```
PDF: f(x)

P(a <= X <= b) = integral of f(x) from a to b

f(x) can be greater than 1 (density, not probability)
integral from -inf to +inf of f(x) dx = 1
```

这个区别在机器学习中很重要。分类输出是 PMF（离散选择）。VAE 的隐空间使用 PDF（连续）。

### 常见分布

**伯努利（Bernoulli）：** 一次试验，两种结果。用于建模二分类。

```
P(X = 1) = p
P(X = 0) = 1 - p
Mean = p,  Variance = p(1-p)
```

**类别（Categorical）：** 一次试验，k 种结果。用于建模多分类（softmax 输出）。

```
P(X = i) = p_i,  where sum of p_i = 1
Example: P(cat) = 0.7,  P(dog) = 0.2,  P(bird) = 0.1
```

**均匀（Uniform）：** 所有结果等可能。用于随机初始化。

```
Discrete: P(X = k) = 1/n for k in {1, ..., n}
Continuous: f(x) = 1/(b-a) for x in [a, b]
```

**正态/高斯（Normal/Gaussian）：** 钟形曲线。由均值（mu）和方差（sigma^2）参数化。

```
f(x) = (1 / sqrt(2*pi*sigma^2)) * exp(-(x - mu)^2 / (2*sigma^2))

Standard normal: mu = 0, sigma = 1
  68% of data within 1 sigma
  95% within 2 sigma
  99.7% within 3 sigma
```

**泊松（Poisson）：** 固定区间内罕见事件的计数。用于建模事件发生率。

```
P(X = k) = (lambda^k * e^(-lambda)) / k!
Mean = lambda,  Variance = lambda
```

### 期望值与方差

期望值（expected value）是按概率加权的平均结果。

```
Discrete:   E[X] = sum of x_i * P(X = x_i)
Continuous: E[X] = integral of x * f(x) dx
```

方差（variance）衡量围绕均值的离散程度。

```
Var(X) = E[(X - E[X])^2] = E[X^2] - (E[X])^2
Standard deviation = sqrt(Var(X))
```

在机器学习中，期望值表现为损失函数（在数据分布上的平均损失）。方差则告诉你模型的稳定性。梯度的高方差意味着训练过程噪声大。

### 联合分布与边缘分布

联合分布（joint distribution）P(X, Y) 同时描述两个随机变量。

联合 PMF 示例（X = 天气，Y = 雨伞）：

| | Y=0（无伞） | Y=1（有伞） | 边缘 P(X) |
|---|---|---|---|
| X=0（晴） | 0.40 | 0.10 | P(X=0) = 0.50 |
| X=1（雨） | 0.05 | 0.45 | P(X=1) = 0.50 |
| **边缘 P(Y)** | P(Y=0) = 0.45 | P(Y=1) = 0.55 | 1.00 |

边缘分布（marginal distribution）通过对另一个变量求和而得到：

```
P(X = x) = sum over all y of P(X = x, Y = y)
```

上表中的行合计与列合计就是边缘分布。

### 为什么正态分布无处不在

中心极限定理：许多独立随机变量的和（或平均值）会收敛到正态分布，而与原始分布无关。

```
Roll 1 die:  uniform distribution (flat)
Average of 2 dice:  triangular (peaked)
Average of 30 dice: nearly perfect bell curve

This works for ANY starting distribution.
```

这就是为什么：
- 测量误差近似服从正态分布（来自许多微小的独立来源）
- 神经网络中的权重初始化使用正态分布
- SGD 中的梯度噪声近似服从正态分布（许多样本梯度之和）
- 对于给定的均值和方差，正态分布是最大熵分布

### 对数概率

原始概率会引发数值问题。把许多小概率相乘，很快就会下溢（underflow）到零。

```
P(sentence) = P(word1) * P(word2) * ... * P(word_n)
            = 0.01 * 0.003 * 0.02 * ...
            -> 0.0 (underflow after ~30 terms)
```

对数概率（log probability）解决了这个问题。乘法变成了加法。

```
log P(sentence) = log P(word1) + log P(word2) + ... + log P(word_n)
                = -4.6 + -5.8 + -3.9 + ...
                -> finite number (no underflow)
```

规则：
- log(a * b) = log(a) + log(b)
- 对数概率始终 <= 0（因为 0 < P <= 1）
- 越负 = 越不可能
- 交叉熵损失就是正确类别的负对数概率

### 作为概率分布的 Softmax

神经网络输出原始分数（logits）。Softmax 把它们转换为一个有效的概率分布。

```
softmax(z_i) = exp(z_i) / sum(exp(z_j) for all j)

Properties:
  - All outputs are in (0, 1)
  - All outputs sum to 1
  - Preserves relative ordering of inputs
  - exp() amplifies differences between logits
```

Softmax 技巧：在取指数之前减去最大的 logit，以防止溢出。

```
z = [100, 101, 102]
exp(102) = overflow

z_shifted = z - max(z) = [-2, -1, 0]
exp(0) = 1  (safe)

Same result, no overflow.
```

Log-softmax 将 softmax 和 log 结合起来以保证数值稳定。PyTorch 在内部就是用它来计算交叉熵损失的。

### 采样

采样（sampling）意味着从一个分布中抽取随机值。在机器学习中：
- Dropout 随机采样哪些神经元被置零
- 数据增强采样随机的变换
- 语言模型从预测分布中采样下一个 token
- 扩散模型采样噪声并逐步去噪

从任意分布中采样需要用到诸如逆变换采样（inverse transform sampling）、拒绝采样（rejection sampling），或重参数化技巧（reparameterization trick，用于 VAE）等方法。

## 动手构建

### 第 1 步：概率基础

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

### 第 2 步：从零实现 PMF 和 PDF

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

### 第 3 步：期望值与方差

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

### 第 4 步：从分布中采样

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

### 第 5 步：Softmax 与对数概率

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

### 第 6 步：中心极限定理演示

```python
def demonstrate_clt(dist_fn, n_samples, n_averages):
    averages = []
    for _ in range(n_averages):
        samples = [dist_fn() for _ in range(n_samples)]
        averages.append(sum(samples) / len(samples))
    return averages
```

### 第 7 步：可视化

```python
import matplotlib.pyplot as plt

xs = [mu + sigma * (i - 500) / 100 for i in range(1001)]
ys = [normal_pdf(x, mu, sigma) for x, mu, sigma in ...]
plt.plot(xs, ys)
```

包含所有可视化的完整实现位于 `code/probability.py`。

## 实际运用

借助 NumPy 和 SciPy，上面这一切都是一行代码就能搞定的：

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

你已经从零构建了这些。现在你知道这些库调用背后到底在做什么了。

## 练习

1. 为指数分布（exponential distribution）实现逆变换采样。采样 10,000 个值并将其直方图与真实 PDF 进行比较来验证。

2. 为两个灌铅骰子（loaded dice）构建一张联合分布表。计算各边缘分布，并检验这两个骰子是否独立。

3. 一个 5 类分类器在正确类别为索引 3 时输出 logits `[2.0, 0.5, -1.0, 3.0, 0.1]`，计算其交叉熵损失。然后用 PyTorch 的 `nn.CrossEntropyLoss` 验证你的答案。

4. 编写一个函数，接收一组对数概率，返回最可能的序列、总对数概率，以及对应的原始概率。用一个 50 个词的句子来测试，其中每个词的概率为 0.01。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|----------------|----------------------|
| 样本空间（Sample space） | "所有的可能性" | 集合 S，即一次实验所有可能结果的集合 |
| PMF | "概率函数" | 给出每个离散结果精确概率的函数，所有概率之和为 1 |
| PDF | "概率曲线" | 连续变量的密度函数。在某区间上对其积分即得概率 |
| 条件概率（Conditional probability） | "在某条件下的概率" | P(A\|B) = P(A and B) / P(B)。贝叶斯思维和贝叶斯定理的基础 |
| 独立性（Independence） | "它们互不影响" | P(A and B) = P(A) * P(B)。知道一个事件不会告诉你关于另一个事件的任何信息 |
| 期望值（Expected value） | "平均值" | 所有结果按概率加权的和。损失函数就是一个期望值 |
| 方差（Variance） | "有多分散" | 相对于均值的期望平方偏差。高方差 = 噪声大、不稳定的估计 |
| 正态分布（Normal distribution） | "钟形曲线" | f(x) = (1/sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2/(2*sigma^2))。因 CLT 而无处不在 |
| 中心极限定理（Central Limit Theorem） | "平均值会变成正态" | 许多独立样本的均值会收敛到正态分布，与来源无关 |
| 联合分布（Joint distribution） | "两个变量放在一起" | P(X, Y) 描述 X 与 Y 结果每种组合的概率 |
| 边缘分布（Marginal distribution） | "把另一个变量求和消掉" | P(X) = sum_y P(X, Y)。从联合分布中恢复出单个变量的分布 |
| 对数概率（Log probability） | "概率的对数" | log P(x)。把乘积变成求和，防止长序列中的数值下溢 |
| Softmax | "把分数变成概率" | softmax(z_i) = exp(z_i) / sum(exp(z_j))。把实值 logits 映射为一个有效的概率分布 |
| 交叉熵（Cross-entropy） | "损失函数" | -sum(p_true * log(p_predicted))。衡量两个分布的差异程度。越低越好 |
| Logits | "模型的原始输出" | softmax 之前未归一化的分数。得名于逻辑斯谛函数（logistic function） |
| 采样（Sampling） | "抽取随机值" | 按照某个概率分布生成值。模型就是这样生成输出的 |

## 延伸阅读

- [3Blue1Brown：But what is the Central Limit Theorem?](https://www.youtube.com/watch?v=zeJD6dqJ5lo) —— 关于为什么平均值会变成正态的可视化证明
- [Stanford CS229 Probability Review](https://cs229.stanford.edu/section/cs229-prob.pdf) —— 涵盖此处全部内容及更多的简明参考资料
- [The Log-Sum-Exp Trick](https://gregorygundersen.com/blog/2020/02/09/log-sum-exp/) —— 为什么数值稳定性很重要，以及如何实现它
