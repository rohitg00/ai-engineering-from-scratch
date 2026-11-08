# 采样方法

> 采样是人工智能如何探索可能性的空间.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**Time:** ~120 minutes

## 学习目标

- 通过单一随机数量从零开始实施反向CDF,拒绝和重点样本
- 构建温度,顶-k和顶-p (核心) 样本,用于语言模型代币生成
- 解释重构化技巧以及为什么它通过AVE样本采集使反扩散成为可能
- 运行Metropoolis-Hastings MCMC从一个不正常化的目标分布中采样

## 问题

语言模型完成了处理提示,产生了5万个标记的向量.一个用于其词汇中的每个代币.现在它必须选择一个.

如果它总是选择最高概率的代币,每个反应都是相同的. 确定性. 无聊. 如果它随机选择均,输出是的. 答案在这些极端之间某个地方生活,在某个地方由样本控制.

采样不仅限于文本生成. 强化学习通过采样轨迹估计政策梯度. 通过从学习分布中抽样并通过随机性传播,VAE学习隐藏的表示. 扩散模型通过采样噪音和反复测试生成图像. 蒙特卡罗方法估计没有封闭形式的整体.  MCMC算法探索不可能编译的高维后部分布.

每个生成人工智能系统都是采样系统.采样策略决定了输出的质量,多样性和可控制性.这个课程从零开始构建了每种主要采样方法,从统一的随机数开始,并以支持现代LLM和生成模型的技术结束.

## 概念

### 为什么样本采样是重要的

采样表现出在人工智能和机器学习中四个基本角色:

**Generation.**语言模型,扩散模型和GAN都通过采样产生输出.采样算法直接控制创造力,一致性和多样性.温度,顶级k和核采样是工程师每天转换的按.

**Training.**缩梯度下降样本小批. 脱节样本神经元去关闭. 数据增强样本随机转变. 重要样本重量样本以减少增强学习的梯度差异 (PPO,TRPO).

**Estimation.**许多数量在ML中没有封闭形式的解决方案.数据分布的预期损失,基于能量的模型的分区函数,贝叶斯推理中的证据.蒙特卡罗估计通过对样本进行平均估算来近似所有这些.

**Exploration.**马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克思马克斯马克斯马克斯马克斯马克斯马克斯马克斯马克斯马克斯

基本挑战是:只能直接从简单分布中取样 (均,正常).

### 统一的随机抽样

随机数生成器生成的值在$[0, 1)$在每一个长度相同的子间隔都有相同的概率.

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

单独的集合中均的样本$n$产品,产品$U$现在,我们要回来.$\lfloor n U \rfloor$通过连续范围进行样本$[a, b]$计算$a + (b - a) U$现在,我们要去.

基本的见解是:一个统一的随机数量包含了正确的随机数量,

### 逆转CDF方法 (逆转转换样本采样)

累积分布函数 (CDF) 将值映射到概率:

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

逆转CDF将概率映射到值.$U \sim \text{Uniform}(0, 1)$现在$X = F^{-1}(U)$按照目标分布进行.

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**Exponential distribution example:**

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

这很好,如果你能写下来.$F^{-1}$对于正常分布,没有封闭形式的反向CDF,所以我们使用其他方法 (Box-Muller或数值近似).

**Discrete version:**对于分离分布,构建CDF作为累计数量,生成$U$查找第一个指数,总额超过$U$这就是怎么做`sample_categorical`在第06课中工作.

### 拒绝样本

当你不能逆转CDF,但可以评估目标PDF到一个常态,拒绝样本工作.

```
Target distribution: p(x)  (can evaluate, possibly unnormalized)
Proposal distribution: q(x)  (can sample from)
Bound: M such that p(x) <= M * q(x) for all x

Algorithm:
  1. Sample x ~ q(x)
  2. Sample u ~ Uniform(0, 1)
  3. If u < p(x) / (M * q(x)), accept x
  4. Otherwise, reject and go to step 1

Acceptance rate = Z/M, where Z is the integral of p(x)
                (Z = 1, so the rate is 1/M, when p is normalized)
```

越紧,越紧.$M$在低尺寸 (1-3) 中,拒绝采样工作很好.在高尺寸中,由于大部分提案量被拒绝,接受率会呈指数级下降.这是拒绝采样的尺寸性诅咒.

**Example: sampling from a truncated normal.**通过缩短范围使用统一的建议.$M$是该范围内的正常PDF最大值.

**Example: sampling from a semicircle.**通过一个直角的边缘,如果这个点落在半圆中,就算得.$\pi$: 接受率等于面积比率$\pi/4$现在,我们要去.

### 重要性样本

有时你不需要目标分布的样本$p(x)$你需要估计一个预期$p(x)$您的样本来自不同的分布$q(x)$现在,我们要去.

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

在PPO (近距离政策优化) 中,你收集了旧政策下的轨迹$\pi_{\text{old}}$但希望优化新政策$\pi_{\text{new}}$重要重量是$\pi_{\text{new}}(a \mid s) / \pi_{\text{old}}(a \mid s)$为了防止新政策与旧政策过分分离,

重要性采样估计器的差异取决于相似性$q$是要$p$如果$q$很不同于$p$为了减少这个问题,自正常化的重要性采样分为重量的总和:

```math
\mathbb{E}_p[f(x)] \approx \frac{\sum_i w_i \, f(x_i)}{\sum_i w_i}
```

### 蒙特卡罗估计

蒙特卡罗估计通过平均随机样本来接近整体. 大数法保证了融合.

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

错误率是不依赖维度的,这就是为什么蒙特卡罗方法在高维度中占主导地位,而在网格基础上的整合是不可能的.

**Estimating pi:**

```
Sample (x, y) uniformly from [-1, 1] x [-1, 1]
Count how many fall inside the unit circle: x^2 + y^2 <= 1
pi ~ 4 * (count inside) / (total count)
```

**Estimating expectations:**

```
E[f(X)] ~ (1/N) * sum(f(x_i))    where x_i ~ p(x)

The sample mean converges to the true expectation.
Variance of the estimator = Var(f(X)) / N
```

### 马科夫链蒙特卡罗 (MCMC):大都会-哈斯廷斯

马克思集团构建了马克思链,其固定分布是目标分布.$p(x)$经过足够的步骤,链中的样本是 (大约) 样本$p(x)$现在,我们要去.

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

对于对称性提案$(q(x' \mid x) = q(x \mid x'))$平均水平为$p(x')/p(x)$这是原始的Metropoles算法.

**Why it works.**接受规则确保了详细的平衡:$x$现在,我们要去$x'$占到的概率是$x'$现在,我们要去$x$详细的平衡意味着$p(x)$是链的静止分布.

**Practical considerations:**
- 燃烧:在链达到平衡之前,丢弃早期样本
- 薄:保持每一个$k$-第一个样本减少自动相关性
- 提案规模:太小,链路缓慢 (接受度高,探索度慢);太大,大多数提案被拒绝 (接受度低,不适用)
- 高尺寸高的高斯提案的最佳接受率是约0.234

### 吉布斯样本

吉布斯样本采集是 MCMC的多变量分布的一个特殊例.它不是一次地提出所有维度的移动,而是一次更新一个变量从其条件分布.

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

基布斯样本采集要求你可以从每个条件分布中取样$p(x_i \mid x_{-i})$这对许多模型来说是很简单的:
- 贝叶斯网络:从图形结构中得到条件
- 盖斯混合物:条件是盖斯混合物
- 异性模型:每个旋转的条件只取决于其邻居

接受率总是1 (每一个提案都被接受),因为从具体条件中抽样自动满足详细的平衡.

**Limitation.**当变量高度相关时,吉布斯采样会缓慢混合,因为一次更新一个变量不能通过分布进行大角形移动.

### 温度样本 (用于LLM)

语言模型输出记录$z_1, \ldots, z_V$软max 将这些转换为概率.温度在软max之前重新调整了逻辑:

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**Why it works.**按分数分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分分$T < 1$增加了位之间的差异.$z_1 = 2$其他$z_2 = 1$通过$T = 0.5$给出$z_1/T = 4$其他$z_2/T = 2$软max之后,最高的logit令牌获得了更大的份额.

**In practice:**
- $T = 0.0$的解码,最适合事实质疑问答
- $T = 0.3\text{-}0.7$:有点创意,适合代码生成
- $T = 0.7\text{-}1.0$:平衡,适合一般对话
- $T = 1.0\text{-}1.5$创意写作,脑海风暴
- $T > 1.5$: 越来越随机,很少有用

温度不会改变哪些代币可能,而是改变每个代币分配的概率量.

### 顶部样本

顶级k样本采集将设置的候选人限制在$k$具有最高概率的代币,然后从该限制集中重新正常化和样本.

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

问题是: 对于使用字母来说,它是非常难以理解的.$k$模型是自信的 (一个代币有95%的概率),$k = 40$虽然这个模型是不确定的 (概率分布在1000个代币中),但它仍然允许39种替代方案.$k = 40$削减可行的选择.

### 顶部 (核) 样本

顶点p样本调整了候选集体大小.它不保留固定数量的代币,而是保留了超过累积概率的最小的代币集团.$p$现在,我们要去.

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

当模型自信时,核样本采集保持少量的代币 (可能是2-3).当模型不确定时,它保留许多代币 (可能是200).这种适应性行为是为什么核样本采集通常产生比顶级k更好的文本.

**Common combinations:**
- 温度0.7 +上层p0.9:一般用途的设置良好
- 温度0.0 (贪):最适合确定性任务
- 温度1.0+顶-k50:Fan et al. (2018) 原始纸设置

首先应用top-k,然后在剩余的集合上应用top-p.

### 修复尺寸化技巧 (在 VAEs 中使用)

变化自动编码器 (VAE) 通过编码输入到隐藏空间中的分布中,从该分布中取样,并重新解码样本学习.问题是:通过采样操作无法反传播.

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

复制化技巧将随机性与参数分开:

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

这就能有效,因为$\mathcal{N}(\mu, \sigma^2)$具有与 相同的分布$\mu + \sigma \cdot \mathcal{N}(0, 1)$关键见解:将随机性转移到一个没有参数的源 ($\epsilon$),然后将样本表达为参数的可分化转换.

**In the VAE training loop:**
1. 编码输出$\mu$其他$\log(\sigma^2)$每个输入
2. 样本$\epsilon \sim \mathcal{N}(0, 1)$
3. 计算$z = \mu + \sigma \epsilon$
4. 解码$z$为了重建输入
5. 通过步骤4,3,2,1 (可能因为步骤3是可分化的)

没有重构化技巧,无线电传输器无法通过标准的背扩散训练.

### 贝尔-软max (可分类的类型样本)

复制分量方法对连续分布 (高斯式) 有效.对于分离的分类分布,我们需要不同的方法.Gumbel-Softmax为分类采样提供了可差距的近似方法.

**The Gumbel-Max trick (non-differentiable):**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax (differentiable approximation):**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

贝尔-软max产生一个离散样本的连续放松.输出是概率向量 (软一个热) 而不是硬一个热.渐变体通过软max流.在训练中前进通过时,你可以使用"直径"估计器:使用硬 argmax 进行前进通过,但软的贝尔-软max 渐变体用于后退通过.

**Applications:**
- 隐形变量在 VAEs中
- 神经架构搜索 (选择分离操作)
- 硬注意力机制
- 通过单独行动加强学习

### 层次采样

标准蒙特卡罗样本采集可以随机在样本空间中留下空隙. 层次采集通过将空间分为层次并从每个层中采样来进行覆盖.

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

与标准蒙特卡罗相比,层样本总是具有较低或相同的差异:

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**Applications:**
- 数字整合 (近蒙特卡洛)
- 培训数据分类 (确保每个阶段的类平衡)
- 具有重要性的采样与分层 (结合两种技术)
- 通过NeRF (神经辐射场) 采用相机射线沿线的层次采样

### 连接到扩散模型

通过采样过程生成图像. 前进过程将高斯噪音添加到图像中.$T$逆流程学会了化,逐步恢复原始图像.

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

在本课程中使用的方法的联系:
- 每个测试步骤都使用了重设设法 (样本噪音,应用定性转换)
- 噪音时间表$\lbrace \alpha_t \rbrace$控制一种温度缩形式
- 训练使用蒙特卡罗估计接近ELBO (证据下限)
- 在扩散模型中,祖先采样是马科夫链 (每个步骤只取决于当前状态)

整个图像生成过程都是反复采样:从噪音开始,并在每一步都采样一个稍微不那么噪音的版本,根据学习的化模型.

```figure
monte-carlo-pi
```

## 建立它

### 步骤1:均和反向的CDF采样

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

生成1万个指数样本,验证平均值.$1/\lambda$现在,我们要去.

### 步骤2:拒绝采样

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

使用拒绝样本从一个缩小的正常分布中抽取.通过对样本进行 histogramming来验证形状.

### 步骤3:重要性样本

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

估计$\mathbb{E}[X^2]$根据统一提案的正常分布.$\mu^2 + \sigma^2$)

### 步骤4:蒙特卡罗估计 pi

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

### 步骤5: 城市-哈斯廷斯 MCMC

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

采用双模分布 (两个高斯人的混合物) 的样本.

### 第六步:吉布斯样本

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

### 步骤7:温度采样

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

显示温度如何改变一个符号 logit 的输出分布.

### 步骤8:顶部k和顶部p样本

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

### 步骤9: 修复尺寸化技巧

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

证明梯度通过重构样本流动,但不是通过直接样本采集.

### 第十步:Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

显示温度下降使输出接近单热向量.

完整的实现,所有可视化都在`code/sampling.py`现在,我们要去.

类型字符号端口已启动`code/sampling.ts`它使用了自己的种子随机发电机,所以随机数量与Python输出不同.

## 用它

通过NumPy和SciPy,生产版本:

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

对于 MCMC 规模,使用专用图书馆:
- PyMC:全方位贝耶斯模型与NUTS (适应性HMC)
- 机组:集体MCMC样品仪
- 编码: 编码: 编码: 编码:

你从头开始了,现在你知道图书馆的电话是什么.

## 运动

1. 对于卡奇分布进行反向CDF采样.$F(x) = 0.5 + \arctan(x)/\pi$创建1万个样本,将历史图与真实的PDF绘制起来. 注意重尾 (极端值远离中心).

2. 使用拒绝样本生成Beta(2,5) 分布的样本,使用Uniform(0,1) 提案.将接受的样本与真实Beta PDF进行图谱.理论接受率是多少?

3. 估计整体$\sin(x)$从0到$\pi$根据每一个级别的错误进行比较.$O(1/\sqrt{N})$现在,我们要去.

4. 实现2D分布中的样本$p(x, y)$比例到$\exp(-(x^2 y^2 + x^2 + y^2 - 8x - 8y) / 2)$试验不同提案标准偏差.

5. 构建一个完整的文本生成演示:给出一个10个词汇和logits,使用 (a) 贪, (b) 温度=0.7, (c) 顶-k=3, (d) 顶-p=0.9生成20个代币的序列.

### 暗示

**Exercise 1.**解决问题$u = F(x)$为了$x$通过$x = \tan(\pi(u - 0.5))$检查样本中位数接近0并且约6%的样本有$\lvert x \rvert > 10$现在,$1 - (2/\pi)\arctan(10)$现在,我们要去.

**Exercise 2.**的密度是$30x(1-x)^4$在模式下找到最大值$x = 1/5$并且使用该值为$M$在`rejection_sample`理论上接受率是$1/M$现在,我们需要做一个比较,

**Exercise 3.**确切值为2.`monte_carlo_integral(math.sin, 0, math.pi, n)`每个$n$并且用几种种子重复每次运行.$n$平均误差应该下降约10倍$\sqrt{10} \approx 3.2$现在,我们要去.

**Exercise 4.**写目标日志,这是$-(x^2 y^2 + x^2 + y^2 - 8x - 8y)/2$通过给`metropolis_hastings_2d`记录每项提案的接受率标准偏差:一个非常小的值接受几乎每一步,但慢慢移动,而一个非常大的值拒绝几乎每一步.

**Exercise 5.**利解码每一步都会使用最大的索引.`temperature_sample`现在`top_k_sample`其他`top_p_sample`对于其他三种方法,贪必须在所有五个运行中都给出相同的序列,所以计算每个方法的不同的序列来测量多样性.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Sampling | "Drawing random values" | Generating values according to a probability distribution. The mechanism behind all generative AI |
| Uniform distribution | "All equally likely" | Every value in $[a, b]$ has equal probability density $1/(b-a)$. The starting point for all sampling methods |
| Inverse CDF | "Probability transform" | $F^{-1}(U)$ converts a uniform sample into a sample from any distribution with known CDF. Exact and efficient |
| Rejection sampling | "Propose and accept/reject" | Generate from a simple proposal, accept with probability proportional to target/proposal ratio. Exact but wastes samples |
| Importance sampling | "Reweight samples" | Estimate expectations under $p(x)$ using samples from $q(x)$ by weighting each sample by $p(x)/q(x)$. Core to PPO in RL |
| Monte Carlo | "Average random samples" | Approximate integrals as sample averages. Error $O(1/\sqrt{N})$ regardless of dimension |
| MCMC | "Random walk that converges" | Construct a Markov chain whose stationary distribution is the target. Metropolis-Hastings is the foundational algorithm |
| Metropolis-Hastings | "Accept uphill, sometimes downhill" | Propose moves, accept based on density ratio. Detailed balance ensures convergence to target distribution |
| Gibbs sampling | "One variable at a time" | Update each variable from its conditional distribution holding others fixed. 100% acceptance rate |
| Temperature | "Confidence knob" | Divides logits by $T$ before softmax. $T<1$ sharpens (more confident), $T>1$ flattens (more diverse) |
| Top-k sampling | "Keep the k best" | Zero out all but the $k$ highest-probability tokens, renormalize, sample. Fixed candidate set size |
| Nucleus sampling (top-p) | "Keep the probable ones" | Keep the smallest set of tokens whose cumulative probability exceeds $p$. Adaptive candidate set size |
| Reparameterization trick | "Move randomness outside" | Write $z = \mu + \sigma \epsilon$ where $\epsilon \sim \mathcal{N}(0,1)$. Makes sampling differentiable. Essential for VAE training |
| Gumbel-Softmax | "Soft categorical sampling" | Differentiable approximation to categorical sampling using Gumbel noise + softmax with temperature |
| Stratified sampling | "Forced coverage" | Divide sample space into strata, sample from each. Always lower variance than naive Monte Carlo |
| Burn-in | "Warm-up period" | Initial MCMC samples discarded before the chain reaches its stationary distribution |
| Detailed balance | "Reversibility condition" | $p(x) T(x \to y) = p(y) T(y \to x)$. Sufficient condition for $p$ to be the stationary distribution of a Markov chain |
| Diffusion sampling | "Iterative denoising" | Generate data by starting from noise and applying learned denoising steps. Each step is a conditional sampling operation |

## 进一步阅读

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010)- 详细教程关于MCMC基础
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144)- 原始的Gumbel-Softmax纸
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)- 核 (上) 样本纸
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114)- 引入重构方法的VAE论文
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)- DDPM将采样与图像生成连接
