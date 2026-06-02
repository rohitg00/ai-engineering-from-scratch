# 采样方法（Sampling Methods）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 采样是 AI 探索可能性空间的方式。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 仅用均匀随机数从零实现 inverse CDF（逆 CDF）、rejection（拒绝）和 importance（重要性）采样
- 为语言模型 token 生成实现 temperature、top-k 和 top-p（nucleus，核采样）
- 解释 reparameterization trick（重参数化技巧），以及它为什么能让 VAE 中的采样反向传播（backpropagation）
- 用 Metropolis-Hastings MCMC 从一个未归一化的目标分布里采样

## 问题（The Problem）

一个语言模型刚处理完你的 prompt，吐出一个长度为 50,000 的 logits 向量——词表里每个 token 一个值。现在它得选一个出来。怎么选？

如果总是挑概率最高的 token，每次回答都一模一样。确定性。无聊。如果均匀随机挑，输出就是一坨乱码。答案落在两个极端之间，而那个「中间地带」由采样决定。

采样不只是文本生成的事。强化学习用采样轨迹来估计 policy gradient。VAE 通过从学到的分布里采样、再让梯度穿过随机性，来学习 latent 表示。Diffusion 模型从噪声开始迭代去噪生成图像。Monte Carlo 方法估计没有解析解的积分。MCMC 算法在无法枚举的高维 posterior 分布里游走。

每个生成式 AI 系统都是采样系统。采样策略直接决定输出的质量、多样性和可控性。本课从均匀随机数出发，从零构建每一种主流采样方法，最终落到驱动现代 LLM 和生成模型的那些技术。

## 概念（The Concept）

### 为什么采样重要（Why Sampling Matters）

采样在 AI 和机器学习里扮演四种基本角色：

**生成（Generation）。** 语言模型、diffusion 模型、GAN 都靠采样产出。采样算法直接控制创造力、连贯性和多样性。Temperature、top-k、nucleus 采样就是工程师每天拧的旋钮。

**训练（Training）。** SGD 采样 mini-batch。Dropout 采样要关掉的神经元。数据增强采样随机变换。重要性采样在强化学习（PPO、TRPO）中给样本重新加权来降低梯度方差。

**估计（Estimation）。** ML 里很多量没有解析解：数据分布上的期望损失、能量模型的配分函数、贝叶斯推断里的 evidence。Monte Carlo 估计通过样本平均来逼近这些量。

**探索（Exploration）。** MCMC 算法在贝叶斯推断里探索 posterior 分布。进化策略采样参数扰动。Thompson sampling 在多臂老虎机里平衡探索与利用。

核心挑战：你只能从简单分布（均匀、正态）直接采样。其他分布都得想办法把简单样本转换成目标分布的样本。

### 均匀随机采样（Uniform Random Sampling）

每种采样方法都从这里出发。一个均匀随机数生成器在 [0, 1) 上产生值，且任意等长子区间的概率相等。

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

要从含 n 个元素的离散集合均匀采样，生成 U 后返回 floor(n * U)。从连续区间 [a, b] 采样，计算 a + (b - a) * U。

关键洞察：单个均匀随机数恰好包含从任意分布产出一个样本所需的随机性。诀窍是找到正确的变换。

### Inverse CDF 方法（逆变换采样，Inverse Transform Sampling）

累积分布函数（CDF）把值映射到概率：

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

只要能写出 F_inverse 的解析形式，这招就完美奏效。正态分布的逆 CDF 没有解析解，所以我们用别的办法（Box-Muller 或数值近似）。

**离散版本：** 对离散分布，把 CDF 构造成累积和，生成 U，找累积和首次超过 U 的下标。Lesson 06 里的 `sample_categorical` 就是这么干的。

### 拒绝采样（Rejection Sampling）

当你没法求 CDF 的逆，但能（在差一个常数范围内）算出目标 PDF 时，拒绝采样就派上用场。

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

界 M 越紧，接受率越高。低维（1-3 维）下拒绝采样工作得很好。高维下接受率指数级跌落，因为大部分 proposal 体积都被拒掉——这是拒绝采样面对的「维度灾难」。

**示例：从截断正态分布采样。** 在截断范围里用一个均匀 proposal。包络 M 取该范围内正态 PDF 的最大值。

**示例：从半圆采样。** 在外接矩形里均匀提议。点落在半圆内则接受。Monte Carlo 估计 pi 用的就是这招：接受率等于面积比 pi/4。

### 重要性采样（Importance Sampling）

有时你不需要目标分布 p(x) 的样本，而是想估计 p(x) 下的期望，但手头只有另一个分布 q(x) 的样本。

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

这一招在强化学习里至关重要。在 PPO（Proximal Policy Optimization）中，你用旧 policy pi_old 采集轨迹，但要优化新 policy pi_new。重要性权重就是 pi_new(a|s) / pi_old(a|s)。PPO 会对这些权重做 clip，避免新 policy 偏离旧 policy 太远。

重要性采样估计量的方差取决于 q 与 p 的相似程度。如果 q 和 p 差太远，少数样本会拿到极大的权重并主导整个估计。自归一化重要性采样（self-normalized importance sampling）通过除以权重之和来缓解这个问题：

```
E_p[f(x)] ~ sum(w_i * f(x_i)) / sum(w_i)
```

### Monte Carlo 估计（Monte Carlo Estimation）

Monte Carlo 估计通过对随机样本求平均来近似积分。大数定律保证收敛性。

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

误差率与维度无关。这就是为什么在网格积分行不通的高维场景里，Monte Carlo 方法称王。

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

### 马尔可夫链 Monte Carlo（MCMC）：Metropolis-Hastings

MCMC 构造一条以目标分布 p(x) 为平稳分布的马尔可夫链。运行足够步数后，链上的样本（近似）就是 p(x) 的样本。

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

对称 proposal（q(x'|x) = q(x|x')）下，比例简化为 p(x')/p(x)。这就是最早的 Metropolis 算法。

**为什么有效。** 接受规则保证 detailed balance（细致平衡）：在 x 处并跳到 x' 的概率，等于在 x' 处并跳到 x 的概率。细致平衡意味着 p(x) 是该链的平稳分布。

**实操注意点：**
- Burn-in：链还没到平衡前的早期样本要丢弃
- Thinning（稀释）：每隔 k 个保留一个样本以降低自相关
- Proposal 步长：太小则链动得慢（高接受率、慢探索）；太大则大多被拒（低接受率、原地打转）
- 高维下高斯 proposal 的最优接受率约为 0.234

### Gibbs 采样（Gibbs Sampling）

Gibbs 采样是 MCMC 在多元分布上的特例。它不一次性在所有维度上提议移动，而是每次从条件分布里更新一个变量。

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

Gibbs 采样要求你能从每个条件分布 p(x_i | x_{-i}) 里采样。许多模型都满足：
- 贝叶斯网络：条件分布从图结构推得
- 高斯混合模型：条件分布是高斯
- Ising 模型：每个 spin 的条件只依赖邻居

接受率永远是 1（每次提议都接受），因为从精确条件里采样自动满足细致平衡。

**局限。** 当变量高度相关时，Gibbs 采样混合得慢——一次只更新一个变量，没法在分布中沿对角方向迈大步。

### Temperature 采样（Used in LLMs）

语言模型为词表里每个 token 输出 logits z_1, ..., z_V。Softmax 把它们转成概率。Temperature 在 softmax 之前对 logits 做缩放：

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**为什么有效。** logits 除以 T < 1 会放大它们之间的差距。如果 z_1 = 2, z_2 = 1，除以 T = 0.5 得到 z_1/T = 4, z_2/T = 2，差距更大。softmax 之后，最高 logit 的 token 拿走更大的份额。

**实战取值：**
- T = 0.0：贪心解码，最适合事实性问答
- T = 0.3-0.7：略带创意，适合代码生成
- T = 0.7-1.0：平衡，适合通用对话
- T = 1.0-1.5：创意写作、头脑风暴
- T > 1.5：越来越乱，几乎没用

Temperature 不改变哪些 token 是可选的，只改变分配给每个 token 的概率质量。

### Top-k 采样（Top-k Sampling）

Top-k 采样把候选集限制为概率最高的 k 个 token，再重新归一化并从这个受限集合里采样。

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

Top-k 防止模型选中词表长尾里那些极不可能的 token（错字、胡言乱语）。问题是：k 是固定的，跟上下文无关。模型很自信时（一个 token 占 95%），k = 40 仍允许 39 个备选。模型不确定时（概率分布在 1000 个 token 上），k = 40 又把合理选项砍掉了。

### Top-p（Nucleus，核采样）

Top-p 采样动态调整候选集大小。它不是保留固定数量，而是保留累积概率超过 p 的最小 token 集合。

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

模型自信时，nucleus 采样保留很少的 token（也许 2-3 个）；模型不确定时，保留很多（也许 200 个）。这种自适应行为是 nucleus 采样通常比 top-k 产出更好文本的原因。

**常见组合：**
- Temperature 0.7 + top-p 0.9：通用场景的好设置
- Temperature 0.0（贪心）：确定性任务首选
- Temperature 1.0 + top-k 50：Fan et al. (2018) 原始论文设定

Top-k 和 top-p 可以叠加：先 top-k，再在剩余集合上做 top-p。

### 重参数化技巧（Reparameterization Trick，Used in VAEs）

变分自编码器（VAE）的训练流程是：把输入编码成 latent 空间里的一个分布，从中采样，再把样本解码回去。问题是：你没法对一个采样操作做反向传播。

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

重参数化技巧把随机性和参数分离开：

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

这能成立是因为 N(mu, sigma^2) 与 mu + sigma * N(0, 1) 同分布。关键洞察：把随机性挪到一个不含参数的源头（epsilon），然后把样本写成参数的可微变换。

**VAE 训练循环里：**
1. Encoder 为每个输入输出 mu 和 log(sigma^2)
2. 采样 epsilon ~ N(0, 1)
3. 计算 z = mu + sigma * epsilon
4. 把 z 解码以重建输入
5. 反向传播穿过第 4、3、2、1 步（因为第 3 步可微所以可行）

没有重参数化技巧，VAE 没法用标准反向传播训练。这一个洞察让 VAE 真正落地。

### Gumbel-Softmax（可微的离散采样）

重参数化技巧适用于连续分布（高斯）。对离散类别分布，需要另一套办法。Gumbel-Softmax 给出类别采样的可微近似。

**Gumbel-Max 技巧（不可微）：**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax（可微近似）：**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

Gumbel-Softmax 把离散样本松弛成连续向量，输出是一个概率向量（软 one-hot）而不是硬 one-hot。梯度能穿过 softmax。训练前向时可以用「直通」（straight-through）估计器：前向用硬 argmax，反向用 Gumbel-Softmax 的软梯度。

**应用：**
- VAE 中的离散 latent 变量
- 神经架构搜索（选择离散操作）
- 硬 attention 机制
- 离散动作的强化学习

### 分层采样（Stratified Sampling）

标准 Monte Carlo 采样可能因为运气导致样本空间出现空隙。分层采样把空间切成层（strata），强制每层都采到。

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

分层采样的方差始终不大于标准 Monte Carlo：

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**应用：**
- 数值积分（quasi-Monte Carlo）
- 训练数据划分（保证每折类别均衡）
- 带分层的重要性采样（两种技巧结合）
- NeRF（Neural Radiance Fields）沿相机射线做分层采样

### 与 Diffusion 模型的联系（Connection to Diffusion Models）

Diffusion 模型通过一个采样过程生成图像。前向过程在 T 步内向图像添加高斯噪声直到变成纯噪声。反向过程学习去噪，一步步把原图找回来。

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

它和本课方法的联系：
- 每个去噪步用到重参数化技巧（采样噪声、做确定性变换）
- 噪声调度 {alpha_t} 相当于一种 temperature 退火
- 训练用 Monte Carlo 估计来近似 ELBO（evidence lower bound，证据下界）
- Diffusion 中的 ancestral sampling 是马尔可夫链（每步只依赖当前状态）

整个图像生成过程就是迭代采样：从噪声起步，每步在学到的去噪模型条件下采样一个稍微少噪声的版本。

## 动手实现（Build It）

### Step 1: Uniform and inverse CDF sampling

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

生成 10,000 个指数样本，验证均值是否为 1/lambda。

### Step 2: Rejection sampling

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

用拒绝采样从截断正态分布抽样。把样本画成直方图，验证形状。

### Step 3: Importance sampling

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

用均匀 proposal 估计正态分布下的 E[X^2]。和已知答案（mu^2 + sigma^2）对比。

### Step 4: Monte Carlo estimation of pi

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

### Step 5: Metropolis-Hastings MCMC

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

从一个双峰分布（两个高斯的混合）采样。把链的轨迹可视化。

### Step 6: Gibbs sampling

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

### Step 7: Temperature sampling

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

展示 temperature 如何改变一组 token logits 的输出分布。

### Step 8: Top-k and top-p sampling

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

### Step 9: Reparameterization trick

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

演示梯度能穿过重参数化样本，但穿不过直接采样。

### Step 10: Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

展示 temperature 越小，输出越逼近 one-hot 向量。

完整实现和所有可视化都在 `code/sampling.py`。

## 用起来（Use It）

用 NumPy 和 SciPy 的生产版本：

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

大规模 MCMC 用专门的库：
- PyMC：完整的贝叶斯建模，配 NUTS（自适应 HMC）
- emcee：集成 MCMC 采样器
- NumPyro/JAX：GPU 加速的 MCMC

你已经从零搭过这些。现在你知道库调用背后到底在干什么。

## 练习（Exercises）

1. 给 Cauchy 分布实现 inverse CDF 采样。CDF 为 F(x) = 0.5 + arctan(x)/pi。生成 10,000 个样本，把直方图和真实 PDF 画在一起。注意它的重尾（远离中心的极端值）。

2. 用拒绝采样从 Beta(2, 5) 分布采样，proposal 用 Uniform(0, 1)。把接受的样本和真实 Beta PDF 画在一起。理论接受率是多少？

3. 用 Monte Carlo 估计 sin(x) 在 0 到 pi 上的积分，分别取 1,000、10,000 和 100,000 个样本。比较各级别的误差，验证误差按 O(1/sqrt(N)) 缩放。

4. 实现 Metropolis-Hastings 从一个 2D 分布 p(x, y) 正比于 exp(-(x^2 * y^2 + x^2 + y^2 - 8*x - 8*y) / 2) 采样。画出样本和链的轨迹。试不同的 proposal 标准差。

5. 搭一个完整的文本生成 demo：给定 10 个词的词表和 logits，分别用 (a) greedy、(b) temperature=0.7、(c) top-k=3、(d) top-p=0.9 各生成 20 个 token 的序列。跑 5 次，比较各方案输出的多样性。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|------|----------------|----------------------|
| Sampling（采样） | "抽随机值" | 按概率分布生成值。所有生成式 AI 背后的机制 |
| Uniform distribution（均匀分布） | "都一样可能" | [a, b] 内每个值概率密度都为 1/(b-a)。所有采样方法的起点 |
| Inverse CDF（逆 CDF） | "概率变换" | F_inverse(U) 把均匀样本转换为任意已知 CDF 分布的样本。精确高效 |
| Rejection sampling（拒绝采样） | "提议然后接受/拒绝" | 从简单 proposal 生成，按 target/proposal 比例接受。精确但浪费样本 |
| Importance sampling（重要性采样） | "重新加权样本" | 用 q(x) 的样本估计 p(x) 下的期望，每个样本乘 p(x)/q(x)。RL 中 PPO 的核心 |
| Monte Carlo | "随机样本求平均" | 用样本平均近似积分。误差 O(1/sqrt(N)) 与维度无关 |
| MCMC | "随机游走最终收敛" | 构造马尔可夫链使其平稳分布为目标。Metropolis-Hastings 是基础算法 |
| Metropolis-Hastings | "上坡接受，偶尔下坡" | 提议移动，按密度比接受。细致平衡确保收敛到目标分布 |
| Gibbs sampling | "一次一个变量" | 固定其他变量，从条件分布更新每个变量。100% 接受率 |
| Temperature | "自信度旋钮" | softmax 前 logits 除以 T。T<1 锐化（更自信），T>1 扁平（更多样） |
| Top-k sampling | "保留前 k 个" | 除前 k 高概率 token 外全部清零，重新归一化采样。候选集大小固定 |
| Nucleus sampling (top-p) | "保留高概率那些" | 保留累积概率超过 p 的最小 token 集合。候选集大小自适应 |
| Reparameterization trick | "把随机性挪出去" | 写成 z = mu + sigma * epsilon，epsilon ~ N(0,1)。让采样可微。VAE 训练必备 |
| Gumbel-Softmax | "软的离散采样" | 用 Gumbel 噪声 + 带 temperature 的 softmax 近似离散采样，且可微 |
| Stratified sampling（分层采样） | "强制覆盖" | 把样本空间切层，每层采样。方差始终不大于普通 Monte Carlo |
| Burn-in | "热身期" | 链未达平稳分布前丢弃的早期 MCMC 样本 |
| Detailed balance（细致平衡） | "可逆性条件" | p(x) * T(x->y) = p(y) * T(y->x)。p 是马尔可夫链平稳分布的充分条件 |
| Diffusion sampling | "迭代去噪" | 从噪声出发，应用学到的去噪步生成数据。每步都是一次条件采样 |

## 延伸阅读（Further Reading）

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010) — MCMC 基础的详尽教程
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144) — Gumbel-Softmax 原始论文
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751) — nucleus（top-p）采样论文
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) — VAE 论文，引入重参数化技巧
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) — DDPM，把采样和图像生成联系起来
