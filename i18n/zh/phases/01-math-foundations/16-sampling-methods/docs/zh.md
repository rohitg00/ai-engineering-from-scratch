# 采样方法

> 采样是 AI 探索可能性空间的方式。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 06-07 (概率、贝叶斯定理)
**Time:** ~120 分钟

## 学习目标

- 仅使用均匀随机数，从零实现逆 CDF 采样、拒绝采样和重要性采样
- 为语言模型的 token 生成构建温度采样、top-k 和 top-p(核)采样
- 解释重参数化技巧，以及它为何能让 VAE 中的采样支持反向传播
- 运行 Metropolis-Hastings MCMC，从非归一化的目标分布中采样

## 问题

一个语言模型处理完你的提示词后，产生一个包含 50,000 个 logits 的向量——词表中的每个 token 对应一个。现在它必须从中选出一个。怎么做？

如果它总是选概率最高的 token，那么每次响应都完全相同。确定性。无趣。如果它均匀随机地选，输出就是乱码。答案介于这两个极端之间，而这个位置由采样控制。

采样并不局限于文本生成。强化学习通过采样轨迹来估计策略梯度。VAE 通过从学习到的分布中采样并对随机性进行反向传播来学习潜在表示。扩散模型通过采样噪声并迭代去噪来生成图像。蒙特卡洛方法估计没有解析解的积分。MCMC 算法探索无法穷举的高维后验分布。

每个生成式 AI 系统都是一个采样系统。采样策略决定了输出的质量、多样性和可控性。本课程从零构建每一种主要采样方法，从均匀随机数开始，以驱动现代 LLM 和生成模型的技术结束。

## 概念

### 为什么采样很重要

采样在 AI 和机器学习中扮演四个基本角色：

**生成。** 语言模型、扩散模型和 GAN 都通过采样产生输出。采样算法直接控制创造性、连贯性和多样性。温度、top-k 和核采样是工程师每天调节的旋钮。

**训练。** 随机梯度下降采样 mini-batch。Dropout 采样要停用的神经元。数据增强采样随机变换。重要性采样通过重新加权样本来降低强化学习(PPO、TRPO)中的梯度方差。

**估计。** 机器学习中的许多量没有解析解。数据分布上的期望损失、能量模型的配分函数、贝叶斯推断中的证据。蒙特卡洛估计通过对样本求平均来近似所有这些量。

**探索。** MCMC 算法在贝叶斯推断中探索后验分布。进化策略采样参数扰动。Thompson 采样在多臂老虎机问题中平衡探索与利用。

核心挑战：你只能直接从简单分布(均匀分布、正态分布)中采样。对于其他所有分布，你需要一种方法把简单样本转换为目标分布的样本。

### 均匀随机采样

每种采样方法都从这里开始。均匀随机数生成器产生 [0, 1) 区间内的值，其中每个等长子区间具有相等的概率。

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

要从 n 个离散项中均匀采样，生成 U 并返回 floor(n * U)。要从连续区间 [a, b] 中采样，计算 a + (b - a) * U。

关键洞察：单个均匀随机数恰好包含从任何分布产生一个样本所需的随机量。技巧在于找到正确的变换。

### 逆 CDF 方法(逆变换采样)

累积分布函数(CDF)把值映射为概率：

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

逆 CDF 把概率映射回值。如果 U ~ Uniform(0, 1)，那么 X = F_inverse(U) 服从目标分布。

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**指数分布示例：**

```
PDF: f(x) = lambda * exp(-lambda * x),   x >= 0
CDF: F(x) = 1 - exp(-lambda * x)

Solve F(x) = u for x:
  u = 1 - exp(-lambda * x)
  exp(-lambda * x) = 1 - u
  x = -ln(1 - u) / lambda

Since (1 - U) and U have the same distribution:
  x = -ln(u) / lambda
```

当你能写出 F_inverse 的解析形式时，这个方法完美有效。对于正态分布，逆 CDF 没有解析形式，所以我们要用其他方法(Box-Muller，或数值近似)。

**离散版本：** 对于离散分布，把 CDF 构建为累积和，生成 U，找到累积和首次超过 U 的索引。这就是第 06 课中 `sample_categorical` 的工作原理。

### 拒绝采样

当你无法对 CDF 求逆，但可以在相差一个常数的意义上评估目标 PDF 时，拒绝采样就能奏效。

```
Target distribution: p(x)  (can evaluate, possibly unnormalized)
Proposal distribution: q(x)  (can sample from)
Bound: M such that p(x) <= M * q(x) for all x

Algorithm:
  1. Sample x ~ q(x)
  2. Sample u ~ Uniform(0, 1)
  3. If u < p(x) / (M * q(x)), accept x
  4. Otherwise, reject and go to step 1

Acceptance rate = 1/M
```

边界 M 越紧，接受率越高。在低维(1-3 维)情形下，拒绝采样效果很好。在高维情形下，接受率呈指数下降，因为提议体积的大部分都会被拒绝。这就是拒绝采样维数灾难。

**示例：从截断正态分布采样。** 在截断范围内使用均匀提议。包络 M 是正态 PDF 在该范围内的最大值。

**示例：从半圆采样。** 在包围矩形内均匀提议。如果点落在半圆内就接受。这就是蒙特卡洛计算 pi 的方法：接受率等于面积比 pi/4。

### 重要性采样

有时你并不需要来自目标分布 p(x) 的样本。你需要估计 p(x) 下的期望，而你手里只有来自另一个分布 q(x) 的样本。

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

这在强化学习中至关重要。在 PPO(Proximal Policy Optimization)中，你在旧策略 pi_old 下收集轨迹，却想优化新策略 pi_new。重要性权重是 pi_new(a|s) / pi_old(a|s)。PPO 对这些权重进行裁剪，以防新策略偏离旧策略太远。

重要性采样估计量的方差取决于 q 与 p 的相似程度。如果 q 与 p 差别很大，少数样本会获得巨大的权重并主导估计。自归一化重要性采样通过除以权重之和来缓解这个问题：

```
E_p[f(x)] ~ sum(w_i * f(x_i)) / sum(w_i)
```

### 蒙特卡洛估计

蒙特卡洛估计通过对随机样本求平均来近似积分。大数定律保证了收敛性。

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

误差率与维度无关。这就是为什么在基于网格的积分不可行的高维情形下，蒙特卡洛方法占据主导地位。

**估计 pi：**

```
Sample (x, y) uniformly from [-1, 1] x [-1, 1]
Count how many fall inside the unit circle: x^2 + y^2 <= 1
pi ~ 4 * (count inside) / (total count)
```

**估计期望：**

```
E[f(X)] ~ (1/N) * sum(f(x_i))    where x_i ~ p(x)

The sample mean converges to the true expectation.
Variance of the estimator = Var(f(X)) / N
```

### 马尔可夫链蒙特卡洛(MCMC)：Metropolis-Hastings

MCMC 构建一条平稳分布为目标分布 p(x) 的马尔可夫链。经过足够多的步骤后，链上的样本(近似)就是来自 p(x) 的样本。

```
Target: p(x)  (known up to a normalizing constant)
Proposal: q(x'|x)  (how to propose the next state given the current state)

Metropolis-Hastings algorithm:
  1. Start at some x_0
  2. For t = 1, 2, ..., T:
     a. Propose x' ~ q(x'|x_t)
     b. Compute acceptance ratio:
        alpha = [p(x') * q(x_t|x')] / [p(x_t) * q(x'|x_t)]
     c. Accept with probability min(1, alpha):
        - If u < alpha (u ~ Uniform(0,1)): x_{t+1} = x'
        - Otherwise: x_{t+1} = x_t
  3. Discard first B samples (burn-in)
  4. Return remaining samples
```

对于对称提议(q(x'|x) = q(x|x'))，比值简化为 p(x')/p(x)。这就是最初的 Metropolis 算法。

**为什么有效。** 接受规则确保了细致平衡：处于 x 并移动到 x' 的概率等于处于 x' 并移动到 x 的概率。细致平衡意味着 p(x) 是该链的平稳分布。

**实践要点：**
- Burn-in：丢弃链达到平稳之前的早期样本
- Thinning：每 k 个样本保留一个，以降低自相关性
- 提议尺度：太小则链移动缓慢(高接受率、探索慢)；太大则大多数提议被拒绝(低接受率、原地不动)
- 高维情况下高斯提议的最优接受率约为 0.234

### Gibbs 采样

Gibbs 采样是 MCMC 针对多元分布的一种特例。它不是同时在所有维度上提议移动，而是每次从条件分布中更新一个变量。

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

Gibbs 采样要求你能够从每个条件分布 p(x_i | x_{-i}) 中采样。对许多模型而言这很直接：
- 贝叶斯网络：条件分布可由图结构推出
- 高斯混合模型：条件分布是高斯的
- Ising 模型：每个自旋的条件分布只依赖其邻居

接受率总是 1(每个提议都被接受)，因为从精确条件分布中采样自动满足细致平衡。

**局限性。** 当变量高度相关时，Gibbs 采样混合缓慢，因为每次只更新一个变量无法在分布中做大幅度的对角移动。

### 温度采样(用于 LLM)

语言模型为词表中的每个 token 输出 logits z_1, ..., z_V。Softmax 把这些转换为概率。温度在 softmax 之前对 logits 进行缩放：

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**为什么有效。** 用 T < 1 除以 logits 会放大 logits 之间的差异。如果 z_1 = 2、z_2 = 1，除以 T = 0.5 得到 z_1/T = 4 和 z_2/T = 2，差距变大。经过 softmax 后，最高 logit 的 token 获得大得多的份额。

**实践中：**
- T = 0.0：贪心解码，最适合事实性问答
- T = 0.3-0.7：略有创造性，适合代码生成
- T = 0.7-1.0：平衡，适合一般对话
- T = 1.0-1.5：创意写作、头脑风暴
- T > 1.5：越来越随机，很少有用

温度不会改变哪些 token 是可能的。它改变的是分配给每个 token 的概率质量。

### Top-k 采样

Top-k 采样把候选集限制在概率最高的 k 个 token，然后重新归一化并从这个受限集合中采样。

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Keep only the top k tokens
  4. Renormalize: p_i' = p_i / sum(p_j for j in top-k)
  5. Sample from the renormalized distribution

k = 1:  greedy decoding
k = V:  no filtering (standard sampling)
k = 40: typical setting, removes long tail of unlikely tokens
```

Top-k 防止模型选中词表分布长尾中存在的极低概率 token(错别字、无意义内容)。问题在于：k 与上下文无关，是固定的。当模型很确定(某个 token 有 95% 的概率)时，k = 40 仍然允许 39 个备选。当模型不确定(概率分散在 1000 个 token 上)时，k = 40 会截掉合理的选项。

### Top-p(核)采样

Top-p 采样动态调整候选集大小。它不是保留固定数量的 token，而是保留累积概率超过 p 的最小 token 集合。

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Find smallest k such that sum of top-k probabilities >= p
  4. Keep only those k tokens
  5. Renormalize and sample

p = 0.9:  keeps tokens covering 90% of probability mass
p = 1.0:  no filtering
p = 0.1:  very restrictive, nearly greedy
```

当模型很确定时，核采样只保留少数 token(可能 2-3 个)。当模型不确定时，它保留很多(可能 200 个)。这种自适应行为正是核采样通常比 top-k 产生更好文本的原因。

**常见组合：**
- Temperature 0.7 + top-p 0.9：良好的通用设置
- Temperature 0.0(贪心)：最适合确定性任务
- Temperature 1.0 + top-k 50：Fan et al. (2018) 原始论文的设置

Top-k 和 top-p 可以组合使用。先应用 top-k，再在剩余集合上应用 top-p。

### 重参数化技巧(用于 VAE)

变分自编码器(VAE)的学习方式是：把输入编码为潜在空间中的一个分布，从该分布中采样，再把样本解码回来。问题在于：你无法对采样操作进行反向传播。

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

重参数化技巧把随机性与参数分离：

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

这之所以有效，是因为 N(mu, sigma^2) 与 mu + sigma * N(0, 1) 具有相同的分布。关键洞察：把随机性转移到一个无参数的来源(epsilon)，然后把样本表示为参数的可微变换。

**在 VAE 训练循环中：**
1. 编码器为每个输入输出 mu 和 log(sigma^2)
2. 采样 epsilon ~ N(0, 1)
3. 计算 z = mu + sigma * epsilon
4. 解码 z 以重构输入
5. 依次经过步骤 4、3、2、1 进行反向传播(可行，因为步骤 3 是可微的)

没有重参数化技巧，VAE 就无法用标准反向传播进行训练。正是这一洞察让 VAE 变得实用。

### Gumbel-Softmax(可微类别采样)

重参数化技巧适用于连续分布(高斯)。对于离散类别分布，我们需要另一种方法。Gumbel-Softmax 提供了类别采样的可微近似。

**Gumbel-Max 技巧(不可微)：**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax(可微近似)：**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

Gumbel-Softmax 产生离散样本的连续松弛。输出是概率向量(soft one-hot)而不是硬 one-hot。梯度可以流过 softmax。在训练的前向传播中，可以使用 "straight-through" 估计器：前向传播使用硬 argmax，反向传播使用软 Gumbel-Softmax 梯度。

**应用：**
- VAE 中的离散潜在变量
- 神经架构搜索(选择离散操作)
- 硬注意力机制
- 离散动作的强化学习

### 分层采样

标准蒙特卡洛采样可能因偶然性在样本空间中留下空隙。分层采样通过把空间划分为层并从每层采样来强制均匀覆盖。

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

与标准蒙特卡洛相比，分层采样的方差总是更低或相等：

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**应用：**
- 数值积分(拟蒙特卡洛)
- 训练数据划分(确保每折中类别平衡)
- 带分层的重要性采样(结合两种技术)
- NeRF(Neural Radiance Fields)沿相机光线使用分层采样

### 与扩散模型的联系

扩散模型通过一个采样过程生成图像。前向过程在 T 个步骤中逐步向图像添加高斯噪声，直到它变成纯噪声。反向过程学习去噪，一步步恢复原始图像。

```
Forward process (known):
  x_t = sqrt(alpha_t) * x_{t-1} + sqrt(1 - alpha_t) * epsilon
  where epsilon ~ N(0, I)

  After T steps: x_T ~ N(0, I)  (pure noise)

Reverse process (learned):
  x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (1 - alpha_t)/sqrt(1 - alpha_bar_t) * epsilon_theta(x_t, t)) + sigma_t * z
  where z ~ N(0, I)

  Each denoising step is a sampling step.
```

与本课方法的联系：
- 每个去噪步骤使用重参数化技巧(采样噪声，应用确定性变换)
- 噪声调度 {alpha_t} 控制了一种形式的温度退火
- 训练使用蒙特卡洛估计来近似 ELBO(证据下界)
- 扩散模型中的祖先采样是一条马尔可夫链(每步只依赖当前状态)

整个图像生成过程就是迭代采样：从噪声开始，每一步都基于学习到的去噪模型采样一个噪声略小的版本。

```figure
monte-carlo-pi
```

## 动手构建

### 步骤 1：均匀采样与逆 CDF 采样

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

生成 10,000 个指数分布样本，并验证均值是否为 1/lambda。

### 步骤 2：拒绝采样

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

使用拒绝采样从截断正态分布中抽取样本。通过对样本绘制直方图来验证分布形状。

### 步骤 3：重要性采样

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

使用均匀提议估计正态分布下的 E[X^2]。与已知答案(mu^2 + sigma^2)进行比较。

### 步骤 4：蒙特卡洛估计 pi

```python
def monte_carlo_pi(n):
    inside = 0
    for _ in range(n):
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        if x*x + y*y <= 1:
            inside += 1
    return 4 * inside / n
```

### 步骤 5：Metropolis-Hastings MCMC

```python
def metropolis_hastings(target_log_pdf, proposal_sample, proposal_log_pdf, x0, n_samples, burn_in):
    samples = []
    x = x0
    for i in range(n_samples + burn_in):
        x_new = proposal_sample(x)
        log_alpha = (target_log_pdf(x_new) + proposal_log_pdf(x, x_new)
                     - target_log_pdf(x) - proposal_log_pdf(x_new, x))
        if math.log(random.random()) < log_alpha:
            x = x_new
        if i >= burn_in:
            samples.append(x)
    return samples
```

从双峰分布(两个高斯的混合)中采样。可视化链的轨迹。

### 步骤 6：Gibbs 采样

```python
def gibbs_sampling_2d(conditional_x_given_y, conditional_y_given_x, x0, y0, n_samples, burn_in):
    x, y = x0, y0
    samples = []
    for i in range(n_samples + burn_in):
        x = conditional_x_given_y(y)
        y = conditional_y_given_x(x)
        if i >= burn_in:
            samples.append((x, y))
    return samples
```

### 步骤 7：温度采样

```python
def softmax(logits):
    max_l = max(logits)
    exps = [math.exp(z - max_l) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def temperature_sample(logits, temperature):
    scaled = [z / temperature for z in logits]
    probs = softmax(scaled)
    return sample_from_probs(probs)
```

展示温度如何改变一组 token logits 的输出分布。

### 步骤 8：Top-k 和 top-p 采样

```python
def top_k_sample(logits, k):
    indexed = sorted(enumerate(logits), key=lambda x: -x[1])
    top = indexed[:k]
    top_logits = [l for _, l in top]
    probs = softmax(top_logits)
    idx = sample_from_probs(probs)
    return top[idx][0]

def top_p_sample(logits, p):
    probs = softmax(logits)
    indexed = sorted(enumerate(probs), key=lambda x: -x[1])
    cumsum = 0
    selected = []
    for token_idx, prob in indexed:
        cumsum += prob
        selected.append((token_idx, prob))
        if cumsum >= p:
            break
    sel_probs = [pr for _, pr in selected]
    total = sum(sel_probs)
    sel_probs = [pr / total for pr in sel_probs]
    idx = sample_from_probs(sel_probs)
    return selected[idx][0]
```

### 步骤 9：重参数化技巧

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

证明梯度可以流过重参数化后的样本，但无法流过直接采样。

### 步骤 10：Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

展示降低温度如何使输出趋近 one-hot 向量。

包含全部可视化的完整实现见 `code/sampling.py`。

## 实际使用

使用 NumPy 和 SciPy 的生产版本：

```python
import numpy as np

rng = np.random.default_rng(42)

exponential_samples = rng.exponential(scale=2.0, size=10000)
print(f"Exponential mean: {exponential_samples.mean():.4f} (expected 2.0)")

from scipy import stats
normal = stats.norm(loc=0, scale=1)
print(f"CDF at 1.96: {normal.cdf(1.96):.4f}")
print(f"Inverse CDF at 0.975: {normal.ppf(0.975):.4f}")

logits = np.array([2.0, 1.0, 0.5, 0.1, -1.0])
temperature = 0.7
scaled = logits / temperature
probs = np.exp(scaled - scaled.max()) / np.exp(scaled - scaled.max()).sum()
token = rng.choice(len(logits), p=probs)
print(f"Sampled token index: {token}")
```

对于大规模 MCMC，使用专门的库：
- PyMC：完整的贝叶斯建模，支持 NUTS(自适应 HMC)
- emcee：集成 MCMC 采样器
- NumPyro/JAX：GPU 加速的 MCMC

你已经从零构建了这些方法。现在你知道库调用在做什么了。

## 练习

1. 为 Cauchy 分布实现逆 CDF 采样。CDF 为 F(x) = 0.5 + arctan(x)/pi。生成 10,000 个样本，并将直方图与真实 PDF 对比。注意其重尾(远离中心的极端值)。

2. 使用 Uniform(0, 1) 提议，通过拒绝采样从 Beta(2, 5) 分布生成样本。将接受的样本与真实 Beta PDF 对比绘图。理论接受率是多少？

3. 使用 1,000、10,000 和 100,000 个样本的蒙特卡洛方法估计 sin(x) 从 0 到 pi 的积分。比较每个规模的误差。验证误差按 O(1/sqrt(N)) 缩放。

4. 实现 Metropolis-Hastings，从正比于 exp(-(x^2 * y^2 + x^2 + y^2 - 8*x - 8*y) / 2) 的二维分布 p(x, y) 中采样。绘制样本和链轨迹。尝试不同的提议标准差。

5. 构建一个完整的文本生成演示：给定 10 个单词及其 logits 的词表，分别使用 (a) 贪心、(b) temperature=0.7、(c) top-k=3、(d) top-p=0.9 生成 20 个 token 的序列。比较 5 次运行输出的多样性。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| Sampling | "抽取随机值" | 按照概率分布生成值。所有生成式 AI 背后的机制 |
| Uniform distribution | "全部等可能" | [a, b] 中每个值都具有相等的概率密度 1/(b-a)。所有采样方法的起点 |
| Inverse CDF | "概率变换" | F_inverse(U) 把均匀样本转换成任何已知 CDF 分布的样本。精确且高效 |
| Rejection sampling | "提议并接受/拒绝" | 从简单提议分布生成，按目标/提议比值成比例的概率接受。精确但浪费样本 |
| Importance sampling | "重新加权样本" | 使用 q(x) 的样本，按 p(x)/q(x) 对每个样本加权来估计 p(x) 下的期望。强化学习中 PPO 的核心 |
| Monte Carlo | "对随机样本求平均" | 把积分近似为样本均值。误差 O(1/sqrt(N))，与维度无关 |
| MCMC | "收敛的随机游走" | 构建平稳分布为目标分布的马尔可夫链。Metropolis-Hastings 是奠基性算法 |
| Metropolis-Hastings | "上坡必收，下坡偶尔收" | 提议移动，按密度比值决定接受。细致平衡保证收敛到目标分布 |
| Gibbs sampling | "一次一个变量" | 在固定其他变量的条件下，从条件分布更新每个变量。接受率 100% |
| Temperature | "信心旋钮" | 在 softmax 之前用 T 除以 logits。T<1 使分布更尖锐(更自信)，T>1 使分布更平坦(更多样) |
| Top-k sampling | "保留最好的 k 个" | 除概率最高的 k 个 token 外全部置零，重新归一化后采样。候选集大小固定 |
| Nucleus sampling (top-p) | "保留概率高的那些" | 保留累积概率超过 p 的最小 token 集合。候选集大小自适应 |
| Reparameterization trick | "把随机性移出去" | 写成 z = mu + sigma * epsilon，其中 epsilon ~ N(0,1)。使采样可微。VAE 训练的关键 |
| Gumbel-Softmax | "软类别采样" | 使用 Gumbel 噪声 + 带温度的 softmax，对类别采样的可微近似 |
| Stratified sampling | "强制覆盖" | 把样本空间划分为层，从每层采样。方差总是低于朴素的蒙特卡洛 |
| Burn-in | "预热阶段" | 丢弃链达到平稳分布之前的初始 MCMC 样本 |
| Detailed balance | "可逆性条件" | p(x) * T(x->y) = p(y) * T(y->x)。p 成为马尔可夫链平稳分布的充分条件 |
| Diffusion sampling | "迭代去噪" | 从噪声开始，应用学习到的去噪步骤来生成数据。每一步都是一次条件采样操作 |

## 延伸阅读

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010) - MCMC 基础的详细教程
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144) - Gumbel-Softmax 原始论文
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751) - 核(top-p)采样论文
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) - 提出重参数化技巧的 VAE 论文
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) - DDPM 将采样与图像生成联系起来