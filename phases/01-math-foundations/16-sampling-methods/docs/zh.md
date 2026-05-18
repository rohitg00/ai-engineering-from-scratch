# Sampling Methods

> 采样是人工智能探索可能性空间的方式。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 第1阶段，第06-07课（概率、Bayes ' Theory）
** 时间：** ~120分钟

## Learning Objectives

- 仅使用均匀随机数从头开始实施逆EDF、拒绝和重要性采样
- 为语言模型令牌生成构建温度、top-k和top-p（核心）采样
- 解释重新参数化技巧以及为什么它可以通过VAE中的采样实现反向传播
- 运行Metropolis-Hastings MCMC以从未规范化的目标分布中采样

## The Problem

语言模型完成处理提示并生成50，000个logit的载体。其词汇表中的每个代币都有一个。现在它必须选择一个。如何？

如果它总是选择概率最高的令牌，那么每个响应都是相同的。确定性的。无聊了如果它随机均匀选择，则输出是胡言乱语的。答案就在这两个极端之间的某个地方，而这个地方是由抽样控制的。

采样不仅限于文本生成。强化学习通过采样轨迹来估计政策梯度。VAE通过从学习到的分布中采样并通过随机性反向传播来学习潜在表示。扩散模型通过采样噪音和迭代去噪来生成图像。蒙特卡洛方法估计没有封闭解的积分。MCMC算法探索不可能列举的多维后验分布。

每个生成式人工智能系统都是一个采样系统。抽样策略决定输出的质量、多样性和可控性。本课从头开始构建每种主要的采样方法，从均匀随机数开始，以支持现代LLM和生成式模型的技术结束。

## The Concept

### Why Sampling Matters

采样在人工智能和机器学习中发挥着四个基本作用：

** 一代。**语言模型、扩散模型和GAN都通过采样产生输出。采样算法直接控制创造力、一致性和多样性。温度、top-k和核采样是工程师每天要解决的问题。

** 培训。**随机梯度下降对小批次进行抽样。Dropout对神经元进行采样以使其失活。数据增强采样随机转换。重要性抽样重新加权样本以减少强化学习（PPO、TRPO）中的梯度方差。

** 估计。** ML中的许多量没有封闭形式的解决方案。数据分布的预期损失、基于能量的模型的分配函数、Bayesian推理中的证据。蒙特卡洛估计通过对样本进行平均来逼近所有这些。

** 探索。** MCMC算法探索Bayesian推理中的后验分布。进化策略采样参数扰动。汤普森抽样平衡了土匪的勘探和剥削。

核心挑战：您只能直接从简单分布（均匀、正态）中进行抽样。对于其他一切，您需要一种方法将简单样本转换为目标分布的样本。

### Uniform Random Sampling

每种采样方法都从这里开始。均匀随机数生成器生成[0，1）中的值，其中每个等长的子区间具有相等的概率。

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

要从n个项目的离散集合中均匀采样，请生成U并返回楼层（n * U）。要从连续范围[a，b]进行采样，请计算a +（b-a）* U。

关键见解：单个均匀随机数包含完全正确的随机量，可以从任何分布中产生一个样本。技巧在于找到正确的转变。

### Inverse CDF Method (Inverse Transform Sampling)

累积分布函数（EDF）将值映射到概率：

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

逆EDF将概率映射回值。如果U ~ Uniform（0，1），则X = F_inverter（U）遵循目标分布。

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

** 指数分布示例：**

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

当您可以以封闭形式写下F_inverter时，这会非常有效。对于正态分布，不存在封闭形式的逆EDF，因此我们使用其他方法（Box-Muller，或数值逼近）。

** 离散版本：** 对于离散分布，将EDF构建为累积和，生成U，并找到累积和超过U的第一个指数。这就是第06课中“sample_category”的工作原理。

### Rejection Sampling

当您无法倒置EDF但可以将目标PDF评估为恒定值时，拒绝采样就有效。

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

界限M越紧，接受率越高。在低维度（1-3）中，拒绝抽样效果良好。在高维度中，接受率呈指数级下降，因为大部分提案量都会被拒绝。这是拒绝抽样的维度诅咒。

** 示例：从截断正态进行抽样。**在截断范围内使用统一提案。信封M是该范围内正常PDF的最大值。

** 示例：从半圆中采样。**在边界矩形中均匀提出。如果该点落在半圆内，则接受。这就是蒙特卡洛计算pi的方法：接受率等于面积比pi/4。

### Importance Sampling

有时您不需要来自目标分布p（x）的样本。您需要估计p（x）下的期望，并且您有来自不同分布q（x）的样本。

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

这在强化学习中至关重要。在PPO（近端策略优化）中，您收集旧策略pi_old下的轨迹，但想要优化新策略pi_new。重要性权重是pi_new（a| s）/ pi_old（a| s）。PPO削减了这些权重，以防止新政策与旧政策偏离太远。

重要性抽样估计器的方差取决于q与p的相似程度。如果q与p非常不同，则一些样本将获得巨大的权重并主导估计。自标准化重要性抽样除以权重和以减少此问题：

```
E_p[f(x)] ~ sum(w_i * f(x_i)) / sum(w_i)
```

### Monte Carlo Estimation

蒙特卡洛估计通过平均随机样本来逼近积分。大数定律保证收敛。

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

错误率与维度无关。这就是蒙特卡洛方法在不可能实现基于网格的集成的高维度中占据主导地位的原因。

** 估计圆周率：**

```
Sample (x, y) uniformly from [-1, 1] x [-1, 1]
Count how many fall inside the unit circle: x^2 + y^2 <= 1
pi ~ 4 * (count inside) / (total count)
```

** 估计期望：**

```
E[f(X)] ~ (1/N) * sum(f(x_i))    where x_i ~ p(x)

The sample mean converges to the true expectation.
Variance of the estimator = Var(f(X)) / N
```

### Markov Chain Monte Carlo (MCMC): Metropolis-Hastings

MCMC构建一个Markov链，其平稳分布是目标分布p（x）。经过足够多的步骤后，链中的样本（大约）是p（x）的样本。

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

对于对称提案（q（x '| x）= q（x| x '）），则比率简化为p（x '）/p（x）。这是最初的Metropolis算法。

** 为什么它有效。**接受规则确保了详细的平衡：位于x并移动到x的概率“等于位于x”并移动到x的概率。详细平衡意味着p（x）是链的平稳分布。

** 实际考虑：**
- 老化：在链达到平衡之前丢弃早期样本
- 细化：保留每个第k个样本以减少自相关
- 提案规模：太小，链条移动缓慢（接受度高，探索缓慢）;太大，大多数提案被拒绝（接受度低，停留在原地）
- 高维度高斯提案的最佳接受率约为0.234

### Gibbs Sampling

吉布斯抽样是多元分布MCMC的一种特例。它不是同时提出所有维度的举措，而是从条件分布中一次更新一个变量。

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

Gibbs抽样要求您可以从每个条件分布p（x_i）中抽样|x_{-i}）。这对于许多型号来说都很简单：
- Bayesian网络：条件项源自图结构
- 高斯混合：条件是高斯的
- 伊辛模型：每个旋转的条件仅取决于其邻居

接受率始终为1（每个提案都被接受），因为从确切的条件中进行抽样会自动满足详细的平衡。

** 限制。**当变量高度相关时，吉布斯抽样混合速度较慢，因为一次更新一个变量无法在分布中进行大的对角线移动。

### Temperature Sampling (Used in LLMs)

语言模型输出logits z_1，.，词汇表中每个标记的z_V。Softmax将这些转换为概率。温度重新调整softmax之前的logits：

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

** 为什么它有效。** logits除以T < 1放大了logits之间的差异。如果z_1 = 2和z_2 = 1，除以T = 0.5得到z_1/T = 4和z_2/T = 2，使间隙更大。在softmax之后，logit最高的令牌获得更大的份额。

** 实践中：**
- T = 0.0：贪婪解码，最适合事实问答
- T = 0.3-0.7：有点创意，适合代码生成
- T = 0.7-1.0：平衡，适合一般对话
- T = 1.0-1.5：创意写作、头脑风暴
- T > 1.5：越来越随机，很少有用

温度不会改变可能存在的代币。它改变分配给每个令牌的概率质量。

### Top-k Sampling

Top-k采样将候选集限制为概率最高的k个令牌，然后重新正规化并从该受限制的集中进行采样。

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

Top-k防止模型选择存在于词汇分布长尾中的极不可能的标记（拼写错误、无意义）。问题：无论上下文如何，k都是固定的。当模型有信心（一个令牌有95%的可能性）时，k = 40仍然允许39个替代方案。当模型不确定时（概率分布在1000个代币上），k = 40就会切断合理的选择。

### Top-p (Nucleus) Sampling

Top-p采样动态调整候选集大小。它不会保留固定数量的代币，而是保留累积概率超过p的最小代币集。

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

当模型有信心时，核采样保留很少的标记（可能2-3个）。当模型不确定时，它会保留很多（也许200个）。这种自适应行为就是为什么核采样通常会产生比top-k更好的文本。

** 常见组合：**
- 温度0.7 + top-p 0.9：良好的通用设置
- 温度0.0（贪婪）：最适合确定性任务
- 温度1.0 + top-k 50：Fan等人（2018）原始纸张设置

Top-k和top-p可以组合。首先应用top-k，然后在剩余集合上应用top-p。

### Reparameterization Trick (Used in VAEs)

变分自动编码器（VAE）通过将输入编码到潜在空间中的分布中、从该分布中采样并将样本解码回来来学习。问题：您无法通过采样操作反向传播。

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

重新参数化的技巧将随机性与参数分开：

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

这是有效的，因为N（ku，Sigma ' 2）与μ + Sigma * N（0，1）具有相同的分布。关键见解：将随机性移动到无参数源（RST），然后将样本表示为参数的可微变换。

** 在VAE培训循环中：**
1. 编码器为每个输入输出μ和log（西格玛' 2）
2. 样本收件箱~ N（0，1）
3. 计算z = μ +西格玛 *
4. 解码z以重建输入
5. 通过步骤4、3、2、1反向传播（可能，因为步骤3是可微的）

如果没有重新参数化技巧，VAE就无法使用标准反向传播来训练。这一见解使VAE变得实用。

### Gumbel-Softmax (Differentiable Categorical Sampling)

重新参数化技巧适用于连续分布（高斯）。对于离散类别分布，我们需要不同的方法。Gumbel-Softmax提供了分类抽样的可微逼近。

** Gumbel-Max技巧（不可微）：**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax（可微逼近）：**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

Gumbel-Softmax产生离散样本的连续松弛。输出是概率载体（软一热），而不是硬一热。学生流经softmax。在训练中向前传球期间，您可以使用“直通”估计器：向前传球使用硬argmax，向后传球使用软Gumbel-Softmax梯度。

** 申请：**
- VAE中的离散潜在变量
- 神经架构搜索（选择离散操作）
- 硬关注机制
- 具有离散动作的强化学习

### Stratified Sampling

标准蒙特卡洛抽样可能会偶然在样本空间中留下间隙。分层抽样通过将空间分成分层并从每个分层进行抽样来强制均匀覆盖。

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

与标准蒙特卡罗相比，分层抽样总是具有更低或相等的方差：

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

** 申请：**
- 数值积分（准蒙特卡洛）
- 培训数据拆分（确保每个折叠中的班级平衡）
- 分层的重要性抽样（结合两种技术）
- NeRF（神经辐射场）使用沿着摄像机光线的分层采样

### Connection to Diffusion Models

扩散模型通过采样过程生成图像。前向过程在T步上将高斯噪声添加到图像中，直到它变成纯噪声。逆过程学习去噪，逐步恢复原始图像。

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

与本课中方法的联系：
- 每个去噪步骤都使用重新参数化技巧（采样噪声，应用确定性变换）
- 噪音时间表{Alpha_t}控制一种形式的温度模拟
- 训练使用蒙特卡洛估计来逼近ELBO（证据下限）
- 扩散模型中的祖先抽样是马尔科夫链（每一步仅取决于当前状态）

整个图像生成过程是迭代采样：从噪音开始，在每一步，根据学习的去噪模型对噪音稍低的版本进行采样。

## Build It

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

生成10，000个指数样本并验证平均值是否为1/拉姆达。

### Step 2: Rejection sampling

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

使用拒绝抽样从截断正态分布中提取。通过对样本进行柱状图来验证形状。

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

使用统一提案在正态分布下估计E[X#2]。与已知答案（μ #2+西格玛#2）进行比较。

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

来自双峰分布（两个高斯混合）的样本。想象链条的轨迹。

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

显示温度如何改变一组令牌日志的输出分布。

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

证明梯度流经重新参数化的样本，但不流经直接采样。

### Step 10: Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

展示温度下降如何使输出接近单热量。

所有可视化的完整实施均位于“code/sampling.py”中。

## Use It

对于NumPy和SciPy，生产版本：

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

对于大规模MCMC，请使用专用库：
- PyMC：使用NUTS（自适应HMC）的完整Bayesian建模
- 主持人：合奏MCMC采样器
- NumPyro/JAX：GPU加速的MCMC

这些都是你从头开始建造的。现在你知道图书馆呼叫正在做什么了。

## Exercises

1. 对柯西分布实施逆EDF采样。EDF为F（x）= 0.5 + arctan（x）/pi。生成10，000个样本并根据真实PDF绘制矩形图。注意沉重的尾巴（远离中心的极端值）。

2. 使用拒绝抽样使用均匀（0，1）提案从Beta（2，5）分布生成样本。将接受的样本与真实的Beta PDF进行绘图。理论接受率是多少？

3. 使用Monte Carlo使用1，000、10，000和100，000个样本估计sin（x）从0到pi的积分。比较每个级别的误差。验证误差是否为O（1/平方t（N））。

4. 实现Metropolis-Hastings从与BEP（-（x#2 * y#2 + x#2 + y#2 - 8*x - 8*y）/ 2成比例的2D分布p（x，y）进行采样。绘制样本和链轨迹。尝试不同的提案标准差。

5. 构建一个完整的文本生成演示：给定10个单词的词汇表，使用（a）贪婪，（b）温度=0.7，（c）top-k=3，（d）top-p=0.9生成20个令牌的序列。比较5次运行的输出多样性。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|----------------|----------------------|
| 采样 | “绘制随机值” | 根据概率分布生成值。所有生成人工智能背后的机制 |
| 均匀分布 | “一切都同等可能” | [a，b]中的每个值都具有相等的概率密度1/（b-a）。所有采样方法的起点 |
| 反向EDF | “概率转换” | F_inverse（U）将均匀样本转换为具有已知CDF的任何分布的样本。准确高效 |
| 拒绝抽样 | “提出并接受/拒绝” | 从简单的提案中生成，以与目标/提案比例成比例的概率接受。精确但浪费样本 |
| 重要抽样 | “重新称重样本” | 使用q（x）中的样本，通过p（x）/q（x）加权每个样本来估计p（x）下的期望。RL中的核心到PPO |
| 蒙特卡罗 | “平均随机样本” | 作为样本平均值的近似积分。无论维度如何，误差O（1/平方t（N）） |
| MCMC | “收敛的随机行走” | 构造一个以平稳分布为目标的马尔科夫链。Metropolis-Hastings是基础算法 |
| metropolis-Hastings | “接受上坡，有时接受下坡” | 提出动作，根据密度比接受。详细的平衡确保与目标分布的趋同 |
| Gibbs抽样 | “一次一个变量” | 更新每个变量的条件分布，保持其他变量固定。100%接受率 |
| 温度 | “信心旋钮” | 在softmax之前将logits除以T。T<1更尖锐（更自信），T>1更尖锐（更多元化） |
| Top-k抽样 | “保持k最好” | 除k个概率最高的标记外，将所有标记归零，重新归一化，采样。固定候选集大小 |
| 核采样（顶部-p） | “保留可能的” | 保留累积概率超过p的最小令牌集。自适应候选集大小 |
| 重新参数化技巧 | “将随机性转移到外面” | 写出z = μ +西格玛 *，其中~ N（0，1）。使抽样具有可区分性。对于VAE培训至关重要 |
| Gumbel-Softmax | “软分类抽样” | 使用Gumbel噪音+带温度的softmax对分类抽样进行可微逼近 |
| 分层抽样 | “强制报道” | 将样本空间分为分层，并从每个分层中采样。方差总是比天真的蒙特卡洛更低 |
| 老化 | “热身期” | 初始MCMC样本在链达到其平稳分布之前被丢弃 |
| 细致平衡 | “可逆条件” | p（x）* T（x->y）= p（y）* T（y->x）。p为Markov链平稳分布的充分条件 |
| 扩散采样 | “迭代去噪” | 从噪音开始并应用学习的去噪步骤来生成数据。每一步都是条件抽样操作 |

## Further Reading

- [霍尔布鲁克（2023）：Metropolis-Hastings算法]（https：//arxiv.org/ab/2304.07010）-MCMC基础的详细教程
- [Jang，Gu，Poole（2017）：使用Gumbel-Softmax进行分类重新参数化]（https：//arxiv.org/ab/1611.01144）-Gumbel-Softmax原始论文
- [Holtzman等人。（2020）：神经文本退化的奇怪案例]（https：//arxiv.org/ab/1904.09751）-核（top-p）样本纸
- [Kingma & Welling（2014）：自动编码变分Bayes]（https：//arxiv.org/ab/1312.6114）- VAE论文介绍重新参数化技巧
- [Ho，Jain，Abbeel（2020）：去噪扩散概率模型]（https：//arxiv.org/abs/2006.11239）- DDPM将采样与图像生成联系起来
