# 概率与分布

> 概率是AI用来表达不确定性的语言。

**类型：** 学习  
**语言：** Python  
**前置知识：** 第一阶段，第01-04课  
**时间：** ~75分钟

## 学习目标

- 从头实现伯努利分布、分类分布、泊松分布、均匀分布和正态分布的概率质量函数（PMF）与概率密度函数（PDF）
- 计算期望值、方差，并利用中心极限定理解释为何高斯分布如此普遍
- 构建带有数值稳定性技巧（减去最大对数几率）的Softmax和对数Softmax函数
- 从对数几率计算交叉熵损失，并将其与负对数似然联系起来

## 问题

一个分类器输出 `[0.03, 0.91, 0.06]`。一个语言模型从50,000个候选词中选出下一个词。一个扩散模型通过从学习到的分布中采样来生成图像。这些都是概率的实际应用。

模型做出的每一个预测都是一个概率分布。每一个损失函数衡量的是预测分布与真实分布之间的差距。每一次训练步骤调整参数，使一个分布更接近另一个分布。没有概率，你就无法阅读任何一篇机器学习论文，无法调试任何一个模型，也无法理解为什么你的训练损失会是NaN。

## 概念

### 事件、样本空间与概率

样本空间S是所有可能结果的集合。事件是样本空间的一个子集。概率将事件映射到0和1之间的数值。

```
抛硬币：
  S = {H, T}
  P(H) = 0.5,  P(T) = 0.5

掷单颗骰子：
  S = {1, 2, 3, 4, 5, 6}
  P(偶数) = P({2, 4, 6}) = 3/6 = 0.5
```

三个公理定义了概率的全部：
1. 对于任意事件A，有 P(A) >= 0
2. P(S) = 1（总有事发生）
3. 当A和B不能同时发生时，P(A或B) = P(A) + P(B)

其他一切（贝叶斯定理、期望、分布）都源自这三条规则。

### 条件概率与独立性

P(A|B) 是在B发生的条件下A发生的概率。

```
P(A|B) = P(A 且 B) / P(B)

例子：一副扑克牌
  P(K | 人头牌) = P(K 且 人头牌) / P(人头牌)
                 = (4/52) / (12/52)
                 = 4/12 = 1/3
```

当知道一个事件不会告诉你关于另一个事件任何信息时，这两个事件是独立的：

```
独立：   P(A|B) = P(A)
等价于： P(A 且 B) = P(A) * P(B)
```

抛硬币是独立的。不放回抽牌不是独立的。

### 概率质量函数 vs 概率密度函数

离散随机变量具有概率质量函数（PMF）。每个结果都有一个可以直接读出的具体概率。

```
PMF: P(X = k)

公平骰子：
  P(X = 1) = 1/6
  P(X = 2) = 1/6
  ...
  P(X = 6) = 1/6

  所有概率之和 = 1
```

连续随机变量具有概率密度函数（PDF）。单点处的密度不是概率。概率来自对区间上的密度进行积分。

```
PDF: f(x)

P(a <= X <= b) = 从a到b对f(x)积分

f(x)可以大于1（密度，不是概率）
从-∞到+∞对f(x) dx积分 = 1
```

这个区别在机器学习中很重要。分类输出是PMF（离散选择）。变分自编码器（VAE）的潜空间使用PDF（连续）。

### 常见分布

**伯努利分布：** 一次试验，两个结果。用于建模二分类。

```
P(X = 1) = p
P(X = 0) = 1 - p
均值 = p， 方差 = p(1-p)
```

**分类分布：** 一次试验，k个结果。用于建模多分类（softmax输出）。

```
P(X = i) = p_i，其中 p_i 之和 = 1
例子：P(猫) = 0.7，P(狗) = 0.2，P(鸟) = 0.1
```

**均匀分布：** 所有结果等可能。用于随机初始化。

```
离散：P(X = k) = 1/n，k 属于 {1, ..., n}
连续：f(x) = 1/(b-a)，x 属于 [a, b]
```

**正态分布（高斯分布）：** 钟形曲线。由均值（mu）和方差（sigma^2）参数化。

```
f(x) = (1 / sqrt(2*pi*sigma^2)) * exp(-(x - mu)^2 / (2*sigma^2))

标准正态：mu = 0，sigma = 1
  68% 的数据在1个标准差内
  95% 的数据在2个标准差内
  99.7% 的数据在3个标准差内
```

**泊松分布：** 固定区间内罕见事件发生的次数。用于建模事件发生率。

```
P(X = k) = (lambda^k * e^(-lambda)) / k!
均值 = lambda， 方差 = lambda
```

### 期望值与方差

期望值是加权平均结果。

```
离散：   E[X] = 所有 x_i * P(X = x_i) 之和
连续：   E[X] = 对 x * f(x) dx 积分
```

方差度量围绕均值的分散程度。

```
Var(X) = E[(X - E[X])^2] = E[X^2] - (E[X])^2
标准差 = sqrt(Var(X))
```

在机器学习中，期望值以损失函数形式出现（数据分布上的平均损失）。方差告诉你模型的稳定性。梯度的高方差意味着训练过程噪声大。

### 联合分布与边缘分布

联合分布 P(X, Y) 描述两个随机变量一起的情况。

联合PMF示例（X = 天气，Y = 雨伞）：

| | Y=0（无伞） | Y=1（有伞） | 边缘P(X) |
|---|---|---|---|
| X=0（晴） | 0.40 | 0.10 | P(X=0) = 0.50 |
| X=1（雨） | 0.05 | 0.45 | P(X=1) = 0.50 |
| **边缘P(Y)** | P(Y=0) = 0.45 | P(Y=1) = 0.55 | 1.00 |

边缘分布是对另一个变量求和得到：

```
P(X = x) = 对所有 y 的 P(X = x, Y = y) 求和
```

上表中的行和列总和就是边缘分布。

### 正态分布为何无处不在

中心极限定理：大量独立随机变量的和（或均值）收敛于正态分布，无论原始分布是什么。

```
掷1颗骰子：均匀分布（平坦）
2颗骰子的均值：三角形（有峰）
30颗骰子的均值：近乎完美的钟形曲线

这对任意起始分布都成立。
```

这就是为什么：
- 测量误差近似正态（许多小的独立来源）
- 神经网络的权重初始化使用正态分布
- 随机梯度下降（SGD）中的梯度噪声近似正态（许多样本梯度的和）
- 对于给定均值和方差，正态分布是最大熵分布

### 对数概率

原始概率会导致数值问题。将许多小概率相乘很快会下溢为零。

```
P(句子) = P(词1) * P(词2) * ... * P(词_n)
        = 0.01 * 0.003 * 0.02 * ...
        -> 0.0（大约30项后下溢）
```

对数概率解决了这个问题。乘法变成了加法。

```
log P(句子) = log P(词1) + log P(词2) + ... + log P(词_n)
           = -4.6 + -5.8 + -3.9 + ...
           -> 有限数值（无下溢）
```

规则：
- log(a * b) = log(a) + log(b)
- 对数概率总是 <= 0（因为0 < P <= 1）
- 数值越小（越负）表示可能性越小
- 交叉熵损失是正确类别的负对数概率

### Softmax 作为概率分布

神经网络输出原始分数（logits）。Softmax将它们转换为有效的概率分布。

```
softmax(z_i) = exp(z_i) / 所有 j 的 sum(exp(z_j))

性质：
  - 所有输出在 (0, 1) 之间
  - 所有输出之和为1
  - 保持输入相对顺序
  - exp() 放大对数几率之间的差异
```

Softmax技巧：在指数化之前减去最大对数几率，以防止溢出。

```
z = [100, 101, 102]
exp(102) = 溢出

z_shifted = z - max(z) = [-2, -1, 0]
exp(0) = 1（安全）

结果相同，不会溢出。
```

对数Softmax（Log-softmax）将Softmax和对数结合以获得数值稳定性。PyTorch在交叉熵损失内部使用它。

### 采样

采样是指从分布中随机抽取数值。在机器学习中：
- Dropout随机采样要置零的神经元
- 数据增强随机采样变换
- 语言模型从预测分布中采样下一个token
- 扩散模型采样噪声并逐步去噪

从任意分布中采样需要逆变换采样、拒绝采样或重参数化技巧（用于VAE）等技术。

## 动手实现

### 第1步：概率基础

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

### 第2步：从头实现PMF和PDF

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

### 第3步：期望值和方差

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

### 第4步：从分布中采样

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

### 第5步：Softmax和对数概率

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

### 第6步：中心极限定理演示

```python
def demonstrate_clt(dist_fn, n_samples, n_averages):
    averages = []
    for _ in range(n_averages):
        samples = [dist_fn() for _ in range(n_samples)]
        averages.append(sum(samples) / len(samples))
    return averages
```

### 第7步：可视化

```python
import matplotlib.pyplot as plt

xs = [mu + sigma * (i - 500) / 100 for i in range(1001)]
ys = [normal_pdf(x, mu, sigma) for x, mu, sigma in ...]
plt.plot(xs, ys)
```

完整实现及所有可视化见 `code/probability.py`。

## 使用现成库

使用NumPy和SciPy，上述一切都可以一行搞定：

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

你从头构建了这些。现在你知道库函数在做什么了。

## 练习

1. 实现指数分布的逆变换采样。通过采样10,000个值并将直方图与真实PDF进行比较来验证。

2. 为两个有偏骰子构建一个联合分布表。计算边缘分布，并检查两个骰子是否独立。

3. 对于一个5类分类器，输出logits为 `[2.0, 0.5, -1.0, 3.0, 0.1]`，正确类别索引为3，计算交叉熵损失。然后用PyTorch的 `nn.CrossEntropyLoss` 验证你的答案。

4. 编写一个函数，输入一个对数概率列表，返回最可能的序列、总对数概率以及等价的原始概率。用一个50个词的句子测试，每个词的概率为0.01。

## 关键术语

| 术语 | 人们通常怎么说 | 实际含义 |
|------|----------------|----------|
| 样本空间（Sample space） | “所有可能性” | 实验中每个可能结果的集合S |
| 概率质量函数（PMF） | “概率函数” | 给出每个离散结果确切概率的函数，总和为1 |
| 概率密度函数（PDF） | “概率曲线” | 连续变量的密度函数。在区间上积分得到概率 |
| 条件概率（Conditional probability） | “给定某事的概率” | P(A\|B) = P(A和B) / P(B)。贝叶斯思维和贝叶斯定理的基础 |
| 独立性（Independence） | “它们互不影响” | P(A和B) = P(A) * P(B)。知道一个事件对另一个事件无影响 |
| 期望值（Expected value） | “平均值” | 所有结果的概率加权和。损失函数就是一个期望值 |
| 方差（Variance） | “分散程度” | 与均值的期望平方偏差。方差大意味着估计有噪声、不稳定 |
| 正态分布（Normal distribution） | “钟形曲线” | f(x) = (1/sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2/(2*sigma^2))。由于