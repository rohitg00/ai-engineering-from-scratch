# 確率過程

> 構造を持つランダム性。random walks、Markov chains、diffusion models の背後にある数学です。

**種類:** Learn
**言語:** Python
**前提:** Phase 1, Lessons 06-07 (probability, Bayes)
**時間:** 約75分

## 学習目標

- 1D と 2D の random walks をシミュレートし、変位が `sqrt(n)` でスケールすることを確認する
- Markov chain simulator を作り、eigendecomposition で stationary distribution を計算する
- target distributions から sample するために Metropolis-Hastings MCMC と Langevin dynamics を実装する
- forward diffusion process を Brownian motion と結びつけ、reverse process がデータを生成する仕組みを説明する

## 問題

多くの AI システムでは、時間とともに進むランダム性が関わります。静的なランダム性ではなく、各ステップが前の状態に依存する、構造化された逐次的なランダム性です。

language models は token を一つずつ生成します。diffusion models は画像へ少しずつ noise を加え、逆向きに denoise して新しい画像を作ります。reinforcement learning では action によって状態が確率的に遷移します。MCMC は stationary distribution が posterior になる Markov chain を作ります。

これらは四つの基礎に支えられています。random walks、Markov chains、Langevin dynamics、Metropolis-Hastings です。

## 概念

### Random Walks

位置 0 から始め、各ステップでコインを投げます。表なら右へ `+1`、裏なら左へ `-1`。`n` ステップ後の位置は、独立な `+/-1` の和です。期待位置は 0 ですが、原点からの典型的な距離は `sqrt(n)` で増えます。

```
Step 0:  Position = 0
Step 1:  Position = +1 or -1
Step 2:  Position = +2, 0, or -2
...
Step 100: Expected distance from origin ~ 10 (sqrt(100))
Step 10000: Expected distance from origin ~ 100 (sqrt(10000))
```

各ステップの分散が 1 で独立なので、和 `S_n` の分散は `n`、標準偏差は `sqrt(n)` です。中心極限定理により `S_n / sqrt(n)` は標準正規分布へ近づきます。

この `sqrt(n)` は ML でもよく現れます。SGD noise は `1/sqrt(batch_size)` でスケールし、独立なランダム加算の特徴が平方根として出ます。

### Brownian Motion

random walk の連続時間極限が Brownian motion `B(t)` です。`B(0)=0`、増分 `B(t)-B(s)` は平均 0、分散 `t-s` の正規分布で、重ならない区間の増分は独立です。

離散的には次で近似します。

```
B(t + dt) = B(t) + sqrt(dt) * z,    where z ~ N(0, 1)
```

`sqrt(dt)` のスケールが重要です。これは random walks に中心極限定理を適用した結果です。Brownian motion は diffusion models の noise process の数学的基礎です。

### Markov Chains

Markov chain は、固定された確率で状態間を遷移するシステムです。重要なのは、次の状態が現在の状態だけに依存し、過去の履歴には依存しないことです。

```
P(X_{t+1} = j | X_t = i, X_{t-1} = ...) = P(X_{t+1} = j | X_t = i)
```

これが Markov property です。transition matrix `P` で全体のダイナミクスを表せます。

```
P[i][j] = probability of going from state i to state j
```

各行は 1 に和がなります。

stationary distribution `pi` は `pi * P = pi` を満たす分布です。長期的に各状態にいる割合を表します。`P^T` の固有値 1 に対応する eigenvector として求められます。

収束には、すべての状態が互いに到達可能な irreducible と、固定周期で振動しない aperiodic が必要です。absorbing state は一度入ると出ない状態で、ゲーム終了や end-of-text token のような terminal states を表します。

### Language Models との接続

language model の token generation は近似的に Markov process です。現在の context から次 token の分布を出し、そこから sample して進みます。temperature は分布の鋭さを制御します。

```
P(token_i) = exp(logit_i / temperature) / sum(exp(logit_j / temperature))
```

Top-k sampling と Top-p sampling は、遷移確率を切り詰めることで生成のランダム性を調整します。

### Langevin Dynamics

Langevin dynamics は、energy function `U(x)` に対して `exp(-U(x)/T)` に比例する分布を探る過程です。

```
x_{t+1} = x_t - dt * gradient(U(x_t)) + sqrt(2 * T * dt) * z_t
```

gradient force は低エネルギーへ押し、random force は探索を行います。`T = 0` では純粋な gradient descent になり、高温では random walk に近くなります。

diffusion model の forward process は、データに少しずつ noise を混ぜる Markov chain です。

```
x_t = sqrt(alpha_t) * x_{t-1} + sqrt(1 - alpha_t) * noise
```

十分なステップ後に `x_T` はほぼ Gaussian noise になります。reverse process は、neural network が学習した遷移で noise から data へ戻る Markov chain です。

### MCMC: Markov Chain Monte Carlo

直接 sample できないが、定数倍を除いて評価できる分布 `p(x)` から sample したいことがあります。Bayesian posterior が代表例です。

Metropolis-Hastings は stationary distribution が `p(x)` になる Markov chain を作ります。

1. 現在位置 `x` から始める
2. proposal distribution `Q(x'|x)` から新しい位置 `x'` を提案する
3. acceptance ratio `a = p(x') * Q(x|x') / (p(x) * Q(x'|x))` を計算する
4. 確率 `min(1, a)` で `x'` を受理し、そうでなければ `x` に留まる
5. 繰り返す

`Q` が対称なら比は `p(x') / p(x)` に簡略化され、正規化定数は打ち消されます。

実務では burn-in、thinning、multiple chains、acceptance rate の確認が重要です。Gaussian proposals では acceptance rate はおおむね 23-50% が目安です。

## 実装

### Step 1: Random walk simulator

```python
import numpy as np

def random_walk_1d(n_steps, seed=None):
    rng = np.random.RandomState(seed)
    steps = rng.choice([-1, 1], size=n_steps)
    positions = np.concatenate([[0], np.cumsum(steps)])
    return positions
```

### Step 2: Markov chain

```python
class MarkovChain:
    def __init__(self, transition_matrix, state_names=None):
        self.P = np.array(transition_matrix, dtype=float)
        self.n_states = len(self.P)
        self.state_names = state_names or [str(i) for i in range(self.n_states)]

    def step(self, current_state, rng=None):
        if rng is None:
            rng = np.random.RandomState()
        probs = self.P[current_state]
        return rng.choice(self.n_states, p=probs)

    def stationary_distribution(self):
        eigenvalues, eigenvectors = np.linalg.eig(self.P.T)
        idx = np.argmin(np.abs(eigenvalues - 1.0))
        stationary = np.real(eigenvectors[:, idx])
        stationary = stationary / stationary.sum()
        return np.abs(stationary)
```

### Step 3: Langevin dynamics

```python
def langevin_dynamics(grad_U, x0, dt, temperature, n_steps, seed=None):
    rng = np.random.RandomState(seed)
    x = np.array(x0, dtype=float)
    trajectory = [x.copy()]
    for _ in range(n_steps):
        noise = rng.randn(*x.shape)
        x = x - dt * grad_U(x) + np.sqrt(2 * temperature * dt) * noise
        trajectory.append(x.copy())
    return np.array(trajectory)
```

### Step 4: Metropolis-Hastings

```python
def metropolis_hastings(target_log_prob, proposal_std, x0, n_samples, seed=None):
    rng = np.random.RandomState(seed)
    x = np.array(x0, dtype=float)
    samples = [x.copy()]
    accepted = 0
    for _ in range(n_samples - 1):
        x_proposed = x + rng.randn(*x.shape) * proposal_std
        log_ratio = target_log_prob(x_proposed) - target_log_prob(x)
        if np.log(rng.rand()) < log_ratio:
            x = x_proposed
            accepted += 1
        samples.append(x.copy())
    acceptance_rate = accepted / (n_samples - 1)
    return np.array(samples), acceptance_rate
```

## Use It

実務では確立したライブラリを使いますが、仕組みを理解していると tuning と debugging ができます。Markov chain では transition matrix を繰り返し掛ける power method、MCMC では acceptance rate と収束診断、diffusion では noise schedule と reverse process の品質を確認します。

## Ship It

このレッスンで作るもの:
- `outputs/prompt-stochastic-process-advisor.md`: 問題に適した stochastic process framework を選ぶための prompt

## 接続

| 概念 | 現れる場所 |
|---------|------------|
| Random walk | Node2Vec graph embeddings, exploration in RL |
| Markov chain | Token generation in LLMs, MCMC sampling |
| Brownian motion | Forward diffusion process in DDPM |
| Langevin dynamics | Score-based generative models, SGLD |
| Stationary distribution | MCMC convergence target, PageRank |
| Metropolis-Hastings | Bayesian posterior sampling |
| Temperature | LLM sampling, Boltzmann exploration in RL |
| Mixing time | MCMC convergence speed |
| Absorbing state | End-of-sequence token, terminal states in RL |

## 演習

1. 10000 ステップの random walk を 1000 本シミュレートし、最終位置が平均 0、標準偏差 `sqrt(10000)=100` の正規分布に近いことを確認してください。
2. 小さな corpus から単語遷移を数え、Markov chain text generator を作ってください。
3. Metropolis-Hastings を使って simulated annealing を実装してください。
4. double-well potential `U(x) = (x^2 - 1)^2` で、temperature を変えた Langevin dynamics を比較してください。
5. 1D signal に 100 ステップで noise を加える forward diffusion process を実装してください。

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| Random walk | 「コイン投げの移動」 | 各ステップでランダムな増分だけ位置が変わる過程 |
| Markov property | 「memoryless」 | 未来が現在の状態だけに依存し、履歴に依存しないこと |
| Transition matrix | 「確率表」 | `P[i][j]` が状態 `i` から `j` へ移る確率 |
| Stationary distribution | 「長期平均」 | `pi*P = pi` を満たす equilibrium distribution |
| Brownian motion | 「ランダムな揺らぎ」 | random walk の連続時間極限 |
| Langevin dynamics | 「noise つき gradient descent」 | deterministic gradient と random perturbation を組み合わせる更新 |
| MCMC | 「target へ向かう chain」 | 欲しい分布を stationary distribution に持つ Markov chain を作ること |
| Metropolis-Hastings | 「提案して受理/棄却」 | acceptance ratios で正しい分布へ収束させる MCMC algorithm |
| Temperature | 「ランダム性のつまみ」 | exploration と exploitation のトレードオフを制御するパラメータ |
| Diffusion process | 「noise を入れて戻す」 | forward で noise を加え、reverse で取り除いて data を生成する過程 |

## 参考資料

- **Ho, Jain, Abbeel (2020)** -- "Denoising Diffusion Probabilistic Models."
- **Song & Ermon (2019)** -- "Generative Modeling by Estimating Gradients of the Data Distribution."
- **Roberts & Rosenthal (2004)** -- "General state space Markov chains and MCMC algorithms."
- **Norris (1997)** -- "Markov Chains."
- **Welling & Teh (2011)** -- "Bayesian Learning via Stochastic Gradient Langevin Dynamics."
