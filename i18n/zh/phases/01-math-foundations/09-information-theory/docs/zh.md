# 信息理论

> 信息理论是惊喜的,损失函数是基于它.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lesson 06 (Probability)
**Time:** ~60 minutes

## 学习目标

- 从零开始计算进化,交叉进化和KL分离,并解释它们的关系
- 推导为什么减少交叉缩损失等于最大化日志概率
- 计算特征和目标之间的互通信息,以排名特征的重要性
- 解释一个语言模型选择的有效词汇量

## 问题

你给我打电话`CrossEntropyLoss()`在每一个你训练的分类模型中,你会看到"困惑"在每一个语言模型论文中.你读到关于KL分歧的VAE,蒸和RLHF. 这些不是离散的概念.它们都是一样的想法穿着不同的帽子.

信息理论让你能够理解不确定性,压缩和预测.克劳德·尚农于1948年发明了这个语言,以解决通信问题.结果,训练神经网络是一种通信问题:模型试图通过学习的杂权重的道传输正确的标签.

这一课将每一个公式从头开始,让你看看它们来自哪里,以及它们为什么运作.

## 概念

### 信息内容 (惊喜)

什么不太可能发生,它带有更多信息. 一个硬币登陆头? 不奇怪. 抽奖胜利?

具有概率的事件的信息内容$p$是:

```math
I(x) = -\log(p(x))
```

运用日志基础2给你比特,运用自然日志给你纳茨.

```
Event              Probability    Surprise (bits)
Fair coin heads    0.5            1.0
Rolling a 6        0.167          2.58
1-in-1000 event    0.001          9.97
Certain event      1.0            0.0
```

某些事件没有信息,你已经知道它们会发生.

### 体 (平均惊喜)

透是分布的所有可能结果中所预期的惊喜.

```math
H(P) = -\sum_{x} p(x) \log(p(x))
```

公平硬币对二进制变量具有最大的进化值:1位.偏见硬币 (99%头) 的进化值低:0.08位.你已经知道会发生什么,所以每次翻转几乎什么都不告诉你.

```math
\begin{aligned}
\text{Fair coin:} \quad & H = -(0.5 \log_2(0.5) + 0.5 \log_2(0.5)) = 1.0 \text{ bit} \\
\text{Biased coin:} \quad & H = -(0.99 \log_2(0.99) + 0.01 \log_2(0.01)) = 0.08 \text{ bits}
\end{aligned}
```

透是指分布中不可减小的不确定性.

### 交叉透 (你每天使用的损失功能)

通过分布来测量平均惊喜$Q$编码实际来自分发的事件$P$现在,我们要去.

```math
H(P, Q) = -\sum_{x} p(x) \log(q(x))
```

$P$标签是真正的分布.$Q$现在,我们可以看到一个模型的预测.$Q$匹配$P$完全,交叉值等于值.任何不匹配都会使它变得更大.

在分类中,$P$是一个热向量 (真类的概率是 1,其他所有都是0). 这简化了交叉缩为:

```math
H(P, Q) = -\log(q(\text{true\_class}))
```

它们是对类别的整个交叉缩损失公式.

### 基因分歧 (分布之间的距离)

分量测量使用的额外惊喜量$Q$没有$P$现在,我们要去.

```math
\begin{aligned}
D_{KL}(P \,\|\, Q) &= \sum_{x} p(x) \log(p(x) / q(x)) \\
&= H(P, Q) - H(P)
\end{aligned}
```

交叉缩是缩加上KL分离.因为正确分布的缩在训练过程中是恒定的,减少交叉缩就等于减少KL分离.你正在推动模型的分布向正确分布.

 KL分离不对称: $D_{KL}(P \Vert Q) \ne D_{KL}(Q \Vert P)$这不是真正的距离指标.

### 互通信息

相互信息衡量知道一个变量告诉你关于另一个变量的程度.

```math
\begin{aligned}
I(X; Y) &= H(X) - H(X \mid Y) \\
&= H(X) + H(Y) - H(X, Y)
\end{aligned}
```

如果$X$其他$Y$它们是独立的,相互信息是零的.知道一个对另一个什么都不告诉你.如果它们完全相关,相互信息等于任何变量的.

在特征选择中,特征与目标之间的互通信息很高,意味着特征是有用的.

### 条件性

$H(Y \mid X)$衡量有关目前存在多少不确定性$Y$在你观察之后$X$现在,我们要去.

```math
H(Y \mid X) = H(X,Y) - H(X)
```

两种极端:
- 如果$X$完全决定了$Y$现在$H(Y \mid X) = 0$知道$X$消除了关于$Y$举个例子:$X$温度在摄氏度$Y$温度在法氏度.
- 如果$X$没有告诉你什么.$Y$现在$H(Y \mid X) = H(Y)$知道$X$没有任何减少你的不确定性.$X$钱,钱$Y$未来的天气.

条件性透总是非负的,永远不会超过.$H(Y)$其他:

```math
0 \le H(Y \mid X) \le H(Y)
```

在机器学习中,决定树中出现了条件性透.$X$这将减少$H(Y \mid X)$-- 消除标签的最不确定性$Y$现在,我们要去.

### 关联

$H(X,Y)$是 共同分布的进化值$X$其他$Y$我们一起.

```math
H(X,Y) = -\sum_{x} \sum_{y} p(x,y) \log(p(x,y))
```

关键属性:

```math
H(X,Y) \le H(X) + H(Y)
```

平等是当$X$其他$Y$它们是独立的.如果它们分享信息,关联的 entropies 比单个 entropies 的总和少. "缺失"的 entropies 正是相互的信息.

```mermaid
graph TD
    subgraph "Information Venn Diagram"
        direction LR
        HX["H(X)"]
        HY["H(Y)"]
        MI["I(X;Y)<br/>Mutual<br/>Information"]
        HXgY["H(X|Y)<br/>= H(X) - I(X;Y)"]
        HYgX["H(Y|X)<br/>= H(Y) - I(X;Y)"]
        HXY["H(X,Y) = H(X) + H(Y) - I(X;Y)"]
    end

    HXgY --- MI
    MI --- HYgX
    HX -.- HXgY
    HX -.- MI
    HY -.- MI
    HY -.- HYgX
    HXY -.- HXgY
    HXY -.- MI
    HXY -.- HYgX
```

关系:
- $H(X,Y) = H(X) + H(Y \mid X) = H(Y) + H(X \mid Y)$
- $I(X;Y) = H(X) - H(X \mid Y) = H(Y) - H(Y \mid X)$
- $H(X,Y) = H(X) + H(Y) - I(X;Y)$

### 互通信息 (深入潜水)

相互信息$I(X;Y)$量化了知道一个变量会减少对另一个变量的不确定性.

```math
\begin{aligned}
I(X;Y) &= H(X) - H(X \mid Y) \\
&= H(Y) - H(Y \mid X) \\
&= H(X) + H(Y) - H(X,Y) \\
&= \sum_{x} \sum_{y} p(x,y) \log\left(\frac{p(x,y)}{p(x) \, p(y)}\right)
\end{aligned}
```

性能:
- $I(X;Y) \ge 0$通过观察,你永远不会失去信息.
- $I(X;Y) = 0$如果和只有如果$X$其他$Y$它们是独立的.
- $I(X;Y) = I(Y;X)$它是对称的,与KL差异不同.
- $I(X;X) = H(X)$一个变量与自己分享所有信息.

**Mutual information for feature selection.**在ML中,你需要有关目标的信息功能.互通信息为你提供了原则性地排名功能的方式:

1. 对于每一个特征$X_i$计算$I(X_i; Y)$在哪里$Y$是目标变量.
2. 根据MI分数的排名.
3. 保持顶部$k$其他功能

这对于特征与目标之间的任何关系都适用 - - 线性,非线性,单调或不.皮尔森相关性只捕捉到线性关系.MI捕捉到任何依赖性,但在有限的数据下,它的估计需要足够的样本和合理的结合.

| Method | Detects | Computational cost | Handles categorical? |
|--------|---------|-------------------|---------------------|
| Pearson correlation | Linear relationships | $O(n)$ | No |
| Spearman correlation | Monotonic relationships | $O(n \log n)$ | No |
| Mutual information | Any statistical dependency | $O(n \log n)$ with binning | Yes |

### 标签滑滑和交叉透

标准分类使用硬目标: [0, 0, 1, 0].真正类得到概率 1,其他所有得到0.标签平滑取代这些软目标:

```math
\text{soft\_target} = (1 - \epsilon) \cdot \text{hard\_target} + \epsilon / \text{num\_classes}
```

随着$\epsilon = 0.1$其他类型:
- 强度目标: [0, 0, 1, 0]
- 软目标: [0.025,0.025,0.925,0.025]

从信息理论的角度来看,标签平滑增加了目标分布的缩.硬的单热目标具有缩0.没有不确定性.软的目标具有积极的缩.

为什么这有帮助:
- 防止模型将高位数推向极端值 (在交叉值下,将无限高位数需要完美匹配一个热点目标)
- 作为规律化:模型不能100%自信
- 提高校准:预测概率更好地反映了真实的不确定性
- 减少训练和推断行为之间的差距

标签滑滑的交叉缩损失变为:

```math
L = (1 - \epsilon) \cdot \text{CE}(\text{hard\_target}, \text{prediction}) + \epsilon \cdot H_{\text{uniform}}(\text{prediction})
```

第二个术语惩罚了远非统一的预测,

### 为什么跨是分类的损失

只有三个观点,同一个结论.

**Information theory view.**通过使用模型的分布而不是真正的分布来测量你浪费多少位.

**Maximum likelihood view.**为了$N$实类的培训样本$y_i$其他:

```math
\begin{aligned}
\text{Likelihood} &= \prod_i q(y_i) \\
\text{Log-likelihood} &= \sum_i \log(q(y_i)) \\
\text{Negative log-likelihood} &= -\sum_i \log(q(y_i))
\end{aligned}
```

减少交叉缩 = 最大化训练数据的可能性.

**Gradient view.**对于位的交叉位梯度简单 (预测 - 确实).清洁,稳定,快速计算.这就是为什么它与软max完美结合.

### 子与子

唯一的区别是木材的基础.

```
log base 2   -> bits      (information theory tradition)
log base e   -> nats      (machine learning convention)
log base 10  -> hartleys  (rarely used)
```

子$1/\ln(2)$默认情况下 PyTorch 和 TensorFlow 使用自然日志 (nats).

### 困惑

杂度是交叉透的指数,它告诉你模型不确定的同样可能的实际数量.

```math
\begin{aligned}
\text{Perplexity} &= 2^{H(P,Q)} \quad \text{(if using bits)} \\
\text{Perplexity} &= e^{H(P,Q)} \quad \text{(if using nats)}
\end{aligned}
```

语言模型中50个难以理解的模特,平均是像必须从50个可能的下一个代币中均地选择一样困惑.

现代模型在一个数字中表达了很好的域名.

```figure
entropy-kl
```

## 建立它

### 步骤1:信息内容和透

```python
import math

def information_content(p, base=2):
    if p <= 0 or p > 1:
        return float('inf') if p <= 0 else 0.0
    return -math.log(p) / math.log(base)

def entropy(probs, base=2):
    return sum(
        p * information_content(p, base)
        for p in probs if p > 0
    )

fair_coin = [0.5, 0.5]
biased_coin = [0.99, 0.01]
fair_die = [1/6] * 6

print(f"Fair coin entropy:   {entropy(fair_coin):.4f} bits")
print(f"Biased coin entropy: {entropy(biased_coin):.4f} bits")
print(f"Fair die entropy:    {entropy(fair_die):.4f} bits")
```

### 步骤2:跨和KL分离

```python
def cross_entropy(p, q, base=2):
    total = 0.0
    for pi, qi in zip(p, q):
        if pi > 0:
            if qi <= 0:
                return float('inf')
            total += pi * (-math.log(qi) / math.log(base))
    return total

def kl_divergence(p, q, base=2):
    return cross_entropy(p, q, base) - entropy(p, base)

true_dist = [0.7, 0.2, 0.1]
good_model = [0.6, 0.25, 0.15]
bad_model = [0.1, 0.1, 0.8]

print(f"Entropy of true dist:     {entropy(true_dist):.4f} bits")
print(f"CE (good model):          {cross_entropy(true_dist, good_model):.4f} bits")
print(f"CE (bad model):           {cross_entropy(true_dist, bad_model):.4f} bits")
print(f"KL divergence (good):     {kl_divergence(true_dist, good_model):.4f} bits")
print(f"KL divergence (bad):      {kl_divergence(true_dist, bad_model):.4f} bits")
```

### 阶段3: 交叉缩作为分类损失

```python
def softmax(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def cross_entropy_loss(true_class, logits):
    probs = softmax(logits)
    return -math.log(probs[true_class])

logits = [2.0, 1.0, 0.1]
true_class = 0

probs = softmax(logits)
loss = cross_entropy_loss(true_class, logits)

print(f"Logits:      {logits}")
print(f"Softmax:     {[f'{p:.4f}' for p in probs]}")
print(f"True class:  {true_class}")
print(f"Loss:        {loss:.4f} nats")
print(f"Perplexity:  {math.exp(loss):.2f}")
```

### 步骤4:交叉缩等于负记记概率

```python
import random

random.seed(42)

n_samples = 1000
n_classes = 3
true_labels = [random.randint(0, n_classes - 1) for _ in range(n_samples)]
model_logits = [[random.gauss(0, 1) for _ in range(n_classes)] for _ in range(n_samples)]

ce_loss = sum(
    cross_entropy_loss(label, logits)
    for label, logits in zip(true_labels, model_logits)
) / n_samples

nll = -sum(
    math.log(softmax(logits)[label])
    for label, logits in zip(true_labels, model_logits)
) / n_samples

print(f"Cross-entropy loss:      {ce_loss:.6f}")
print(f"Negative log-likelihood: {nll:.6f}")
print(f"Difference:              {abs(ce_loss - nll):.2e}")
```

### 步骤5:相互信息

```python
def mutual_information(joint_probs, base=2):
    rows = len(joint_probs)
    cols = len(joint_probs[0])

    margin_x = [sum(joint_probs[i][j] for j in range(cols)) for i in range(rows)]
    margin_y = [sum(joint_probs[i][j] for i in range(rows)) for j in range(cols)]

    mi = 0.0
    for i in range(rows):
        for j in range(cols):
            pxy = joint_probs[i][j]
            if pxy > 0:
                mi += pxy * math.log(pxy / (margin_x[i] * margin_y[j])) / math.log(base)
    return mi

independent = [[0.25, 0.25], [0.25, 0.25]]
dependent = [[0.45, 0.05], [0.05, 0.45]]

print(f"MI (independent): {mutual_information(independent):.4f} bits")
print(f"MI (dependent):   {mutual_information(dependent):.4f} bits")
```

## 用它

实际上,你将使用的方法:

```python
import numpy as np

def np_entropy(p):
    p = np.asarray(p, dtype=float)
    mask = p > 0
    result = np.zeros_like(p)
    result[mask] = p[mask] * np.log(p[mask])
    return -result.sum()

def np_cross_entropy(p, q):
    p, q = np.asarray(p, dtype=float), np.asarray(q, dtype=float)
    mask = p > 0
    return -(p[mask] * np.log(q[mask])).sum()

def np_kl_divergence(p, q):
    return np_cross_entropy(p, q) - np_entropy(p)

true = np.array([0.7, 0.2, 0.1])
pred = np.array([0.6, 0.25, 0.15])
print(f"Entropy:    {np_entropy(true):.4f} nats")
print(f"Cross-ent:  {np_cross_entropy(true, pred):.4f} nats")
print(f"KL div:     {np_kl_divergence(true, pred):.4f} nats")
```

你从零开始建造了什么?`torch.nn.CrossEntropyLoss()`现在你知道训练期间的损失为什么会减少:模型的预测分布接近真实的分布,

## 运动

1. 根据英语字母的统一分布 (26 字母) 来计算英语字母的缩.然后使用实际字母频率来估算它.

2. 一个模型输出对真类型的样本的 logits [5.0, 2.0, 0.5] 1. 手动计算交叉缩损失,然后用你的 `cross_entropy_loss`什么地址会产生零损失?

3. 显示KL分离不对称.$P$其他$Q$计算$D_{KL}(P \Vert Q)$其他$D_{KL}(Q \Vert P)$解释他们为什么不同.

4. 构建一个函数,计算一个符号预测序列的困难. 给出 (true_token_index, predicted_logits) 对的列表,返回序列的困难.

### 暗示

**Exercise 1.**电话`entropy`结果必须是$\log_2 26 \approx 4.70$实际的字母频率不均,所以它们的值一定较低.

**Exercise 2.**计算`softmax`子的子,$-\ln$分析结果的概率在指数1上,并与`cross_entropy_loss(1, logits)`只有当类1的逻辑比其他两个大得多时,损失才接近0

**Exercise 3.**例如,使用两个不同形状的小分布.$P = [0.9, 0.1]$其他$Q = [0.5, 0.5]$打电话`kl_divergence`两种值必须不同,因为每个方向的分量与分数不同.

**Exercise 4.**对于每一对,计算`cross_entropy_loss(true_token_index, predicted_logits)`通过一个字母,`perplexity`查看统一的记录.$V$标记: 必须是$V$现在,我们要去.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Information content | "Surprise" | The number of bits (or nats) needed to encode an event: $-\log(p)$ |
| Entropy | "Randomness" | The average surprise across all outcomes of a distribution. Measures irreducible uncertainty. |
| Cross-entropy | "The loss function" | Average surprise when using model distribution $Q$ to encode events from true distribution $P$. |
| KL divergence | "Distance between distributions" | Extra bits wasted by using $Q$ instead of $P$. Equals cross-entropy minus entropy. Not symmetric. |
| Mutual information | "How related are X and Y" | Reduction in uncertainty about $X$ from knowing $Y$. Zero means independent. |
| Softmax | "Turn logits into probabilities" | Exponentiate and normalize. Maps any real-valued vector to a valid probability distribution. |
| Perplexity | "How confused the model is" | Exponential of cross-entropy. The effective vocabulary size the model is choosing from at each step. |
| Bits | "Shannon's unit" | Information measured with log base 2. One bit resolves one fair coin flip. |
| Nats | "ML's unit" | Information measured with natural log. Used by PyTorch and TensorFlow by default. |
| Negative log-likelihood | "NLL loss" | Identical to cross-entropy loss for one-hot labels. Minimizing it maximizes the probability of correct predictions. |

## 进一步阅读

- [Shannon 1948: A Mathematical Theory of Communication](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf)- 原文,仍可读
- [Visual Information Theory (Chris Olah)](https://colah.github.io/posts/2015-09-Visual-Information/)- 能对和KL分离进行最佳视觉解释
- [PyTorch CrossEntropyLoss docs](https://pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html)- 框架如何实现你刚刚构建的
