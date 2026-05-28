# サンプリング手法

> サンプリングは、AI が可能性の空間を探索する方法です。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**所要時間:** 約120分

## 学習目標

- uniform random numbers だけを使って inverse CDF、rejection、importance sampling を一から実装する
- language model token generation のための temperature、top-k、top-p（nucleus）sampling を作る
- reparameterization trick と、それが VAEs で sampling を通した backpropagation を可能にする理由を説明する
- Metropolis-Hastings MCMC を実行し、unnormalized target distribution から sample する

## 問題

language model が prompt を処理し終えると、vocabulary の各 token に対して 50,000 個の logits を出します。次に 1 つを選ばなければなりません。どう選ぶべきでしょうか。

常に highest-probability token を選ぶと、応答は決定的で退屈になります。uniform random に選ぶと、出力は支離滅裂になります。答えはその中間にあり、その位置を制御するのが sampling です。

sampling は text generation だけではありません。reinforcement learning は trajectories を sample して policy gradients を推定します。VAEs は learned distributions から sample し、その randomness を通して backpropagate します。diffusion models は noise を sample し、反復的に denoise して画像を生成します。Monte Carlo methods は closed-form solution のない integrals を推定します。MCMC は列挙できない high-dimensional posterior distributions を探索します。

すべての generative AI system は sampling system です。

## 概念

### なぜ Sampling が重要か

sampling は AI/ML で 4 つの役割を持ちます。

**Generation.** Language models、diffusion models、GANs は sampling によって output を作ります。temperature、top-k、nucleus sampling は creativity、coherence、diversity を直接制御します。

**Training.** SGD は mini-batches を sample します。Dropout は deactivate する neurons を sample します。Data augmentation は random transformations を sample します。RL では importance sampling が gradient variance を下げます。

**Estimation.** expected loss、partition function、Bayesian evidence など closed-form solution のない量を Monte Carlo estimation で近似します。

**Exploration.** MCMC は posterior distributions を探索し、evolutionary strategies は parameter perturbations を sample し、Thompson sampling は bandits で exploration と exploitation を調整します。

### Uniform Random Sampling

すべての sampling method はここから始まります。uniform random number generator は [0, 1) の値を生成します。

```text
U ~ Uniform(0, 1)
P(a <= U <= b) = b - a
E[U] = 0.5
Var(U) = 1/12
```

discrete set の n items から uniform に sample するには `floor(n * U)` を返します。continuous range [a, b] からは `a + (b - a) * U` を使います。

### Inverse CDF Method

CDF は values を probabilities に写像します。

```text
F(x) = P(X <= x)
```

inverse CDF は probabilities を values に戻します。`U ~ Uniform(0, 1)` なら、`X = F_inverse(U)` は target distribution に従います。

```text
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)
```

exponential distribution の例:

```text
CDF: F(x) = 1 - exp(-lambda * x)
x = -ln(1 - u) / lambda
```

`1 - U` と `U` は同じ distribution なので、`x = -ln(u) / lambda` と書けます。normal distribution のように closed-form inverse CDF がない場合は Box-Muller や numerical approximation を使います。

### Rejection Sampling

CDF を invert できなくても、target PDF を定数倍まで評価できるなら rejection sampling が使えます。

```text
Target distribution: p(x)
Proposal distribution: q(x)
Bound: M such that p(x) <= M * q(x)

Algorithm:
  1. Sample x ~ q(x)
  2. Sample u ~ Uniform(0, 1)
  3. If u < p(x) / (M * q(x)), accept x
  4. Otherwise, reject and repeat
```

M が tight であるほど acceptance rate は高くなります。low dimensions では有効ですが、高次元では proposal volume の大半が reject され、acceptance rate が指数的に落ちます。

### Importance Sampling

target distribution p(x) からの sample 自体ではなく、p(x) の下での expectation を推定したい場合があります。別の distribution q(x) から sample し、weights で補正します。

```text
E_p[f(x)] = integral f(x) * p(x) dx
          = E_q[f(x) * p(x)/q(x)]
```

```text
w(x) = p(x) / q(x)
E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))
```

PPO では old policy で集めた trajectories を new policy の optimization に使うため、importance weight `pi_new(a|s) / pi_old(a|s)` を使います。q が p と大きく違うと少数の巨大 weights が推定を支配するため、self-normalized importance sampling や clipping が使われます。

### Monte Carlo Estimation

Monte Carlo estimation は random samples の平均で integrals を近似します。

```text
I = integral of g(x) dx over domain D
I ~ (Volume of D / N) * sum(g(x_i))
Error: O(1 / sqrt(N))
```

error rate は dimension-independent です。grid-based integration が不可能な high dimensions で Monte Carlo methods が重要な理由です。

pi の推定では、[-1, 1] x [-1, 1] から points を sample し、unit circle 内に入った割合に 4 を掛けます。

### Markov Chain Monte Carlo: Metropolis-Hastings

MCMC は stationary distribution が target distribution p(x) になる Markov chain を構築します。

```text
Target: p(x)
Proposal: q(x'|x)

Algorithm:
  1. Start at x_0
  2. Propose x' ~ q(x'|x_t)
  3. Compute alpha = [p(x') * q(x_t|x')] / [p(x_t) * q(x'|x_t)]
  4. Accept with probability min(1, alpha)
  5. Discard burn-in samples
```

symmetric proposal では ratio は `p(x')/p(x)` に簡略化されます。acceptance rule は detailed balance を満たし、p(x) を chain の stationary distribution にします。

実務上の注意:
- burn-in: equilibrium 前の samples を捨てる
- thinning: autocorrelation を減らすため every k-th sample を残す
- proposal scale: 小さすぎると slow exploration、大きすぎると rejections が多い
- high-dimensional Gaussian proposal の optimal acceptance rate は約 0.234

### Gibbs Sampling

Gibbs sampling は multivariate distributions 用の MCMC です。一度に全 dimensions を動かす代わりに、conditional distribution から 1 variable ずつ更新します。

```text
Sample x_1 ~ p(x_1 | x_2, ..., x_d)
Sample x_2 ~ p(x_2 | x_1, x_3, ..., x_d)
...
```

conditional distributions から sample できる Bayesian networks、Gaussian mixtures、Ising models で有用です。proposal は常に accept されますが、variables が強く correlated していると mixing が遅くなります。

### Temperature Sampling

LLM は vocabulary の各 token に logit を出します。temperature は softmax 前に logits を rescale します。

```text
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: original distribution
T -> 0:  argmax
T -> inf: uniform
T < 1.0: sharpens distribution
T > 1.0: flattens distribution
```

実務では、T = 0.0 は factual Q&A、T = 0.3-0.7 は code generation、T = 0.7-1.0 は general conversation、T = 1.0-1.5 は creative writing に向きます。

### Top-k Sampling

top-k sampling は probability が高い k tokens だけを残し、renormalize して sample します。

```text
k = 1: greedy decoding
k = V: no filtering
k = 40: long tail を除去する典型値
```

固定 k の問題は、model が非常に confident なときでも 39 alternatives を許し、不確かなときには plausible options を切り捨てることです。

### Top-p（Nucleus）Sampling

top-p sampling は candidate set size を適応的に変えます。cumulative probability が p を超える最小 token 集合を残します。

```text
p = 0.9: probability mass の 90% を覆う tokens を残す
p = 1.0: no filtering
p = 0.1: very restrictive
```

model が confident なときは少数の tokens を残し、不確かなときは多く残します。これが top-p が top-k より自然な text を生みやすい理由です。

よくある組み合わせ:
- Temperature 0.7 + top-p 0.9: general-purpose
- Temperature 0.0: deterministic tasks
- Temperature 1.0 + top-k 50: Fan et al. (2018) の設定

### Reparameterization Trick

VAEs は inputs を latent space の distribution に encode し、そこから sample して decode します。標準的な sampling は differentiable ではありません。

```text
Standard sampling:
  z ~ N(mu, sigma^2)
```

reparameterization trick は randomness を parameters から分離します。

```text
epsilon ~ N(0, 1)
z = mu + sigma * epsilon
d(z)/d(mu) = 1
d(z)/d(sigma) = epsilon
```

これにより z は mu と sigma の deterministic, differentiable function になり、gradients が流れます。

### Gumbel-Softmax

continuous distributions では reparameterization trick が使えますが、categorical distributions には Gumbel-Softmax を使います。

```text
g = -log(-log(u)), where u ~ Uniform(0, 1)
argmax(log(p_i) + g_i)
```

hard argmax の代わりに softmax を使うと differentiable approximation になります。

```text
y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))
```

tau が 0 に近づくと one-hot に近づき、infinity に近づくと uniform に近づきます。

### Stratified Sampling

standard Monte Carlo は偶然 sample space に gaps を作ることがあります。stratified sampling は空間を strata に分け、それぞれから sample して coverage を強制します。

```text
x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1)
```

smooth functions では variance が standard Monte Carlo 以下になります。numerical integration、training data splits、NeRF の camera rays などで使われます。

### Diffusion Models との関係

diffusion models は sampling process で画像を生成します。forward process は Gaussian noise を徐々に加え、reverse process は denoising を学習します。

```text
Forward:
  x_t = sqrt(alpha_t) * x_{t-1} + sqrt(1 - alpha_t) * epsilon

Reverse:
  x_{t-1} = learned denoising step + sigma_t * z
```

各 denoising step は conditional sampling です。noise schedule は temperature annealing に似ており、training は ELBO を Monte Carlo estimation で近似します。

## 実装

完全な実装と可視化は `code/sampling.py` にあります。

### Uniform と inverse CDF

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

### Rejection sampling

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

### Importance sampling

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

### Monte Carlo estimation of pi

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

### Metropolis-Hastings

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

### Temperature、top-k、top-p

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

## Use It

production では NumPy、SciPy、PyMC、emcee、NumPyro/JAX のような library を使います。ここで一から実装する目的は、library calls の内部で何が起きているかを理解することです。

```python
import numpy as np

rng = np.random.default_rng(42)
exponential_samples = rng.exponential(scale=2.0, size=10000)
print(f"Exponential mean: {exponential_samples.mean():.4f} (expected 2.0)")
```

## Exercises

1. Cauchy distribution の inverse CDF sampling を実装し、heavy tails を確認する。
2. Uniform(0, 1) proposal で Beta(2, 5) distribution を rejection sampling する。
3. sin(x) の 0 から pi までの integral を Monte Carlo で推定し、error が O(1/sqrt(N)) で減ることを確認する。
4. 2D distribution に対して Metropolis-Hastings を実装し、proposal standard deviation を変えて chain を可視化する。
5. 10 words の vocabulary と logits で greedy、temperature=0.7、top-k=3、top-p=0.9 の text generation demo を作る。

## Key Terms

| Term | What it means |
|------|---------------|
| Sampling | probability distribution に従って values を生成すること |
| Uniform distribution | [a, b] の各値が等しい density を持つ distribution |
| Inverse CDF | `F_inverse(U)` で uniform sample を target sample に変換する手法 |
| Rejection sampling | proposal から生成し、target/proposal ratio で accept/reject する |
| Importance sampling | q(x) からの samples を p(x)/q(x) で reweight する |
| Monte Carlo | random samples の平均で integrals を近似する |
| MCMC | stationary distribution が target になる Markov chain を作る |
| Metropolis-Hastings | density ratio に基づいて proposals を accept する MCMC |
| Gibbs sampling | conditionals から 1 variable ずつ更新する MCMC |
| Temperature | softmax 前に logits を T で割る diversity/confidence knob |
| Top-k sampling | k 個の highest-probability tokens だけを残す |
| Nucleus sampling | cumulative probability が p を超える最小集合を残す |
| Reparameterization trick | `z = mu + sigma * epsilon` と書き、sampling を differentiable にする |
| Gumbel-Softmax | categorical sampling の differentiable approximation |
| Stratified sampling | sample space を strata に分け、それぞれから sample する |
| Burn-in | MCMC chain が stationary distribution に達する前の samples |
| Detailed balance | p(x) * T(x->y) = p(y) * T(y->x) |
| Diffusion sampling | noise から始め、learned denoising steps で data を生成する |

## 参考文献

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010)
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144)
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114)
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)
