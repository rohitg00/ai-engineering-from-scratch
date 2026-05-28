# Actor-Critic — A2C and A3C

> REINFORCE はノイジーである。`V̂(s)` を学習する critic を追加し、それを return から引くと、期待値は同じまま variance がはるかに低い advantage が得られる。これが actor-critic である。A2C は同期的に実行し、A3C は thread をまたいで実行する。どちらも、現代のあらゆる deep-RL method の mental model である。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 9 · 04 (TD Learning), Phase 9 · 06 (REINFORCE)
**所要時間:** 約75分

## 問題

Vanilla REINFORCE は動くが、variance がひどい。Monte Carlo returns `G_t` は episodes 間で10倍以上振れることがある。その noise に `∇ log π` を掛けて平均すると、DQN update ならはるかに少ない回数で動かせる距離を policy が動くまで、数千 episodes かかる gradient estimator になる。

Variance は生の returns を使うことから来る。Baseline `b(s_t)`、つまり学習された value を含む任意の state function を引いても、期待値は変わらず variance は下がる。扱いやすい最良の baseline は `V̂(s_t)` である。すると `∇ log π` に掛ける量は *advantage* になる。

`A(s, a) = G - V̂(s)`

ある行動は、平均より高い return を生んだなら良く、低いなら悪い。学習された critic を持つ REINFORCE が *actor-critic* である。Critic は actor に低 variance の教師信号を与える。これは2015年以降のあらゆる deep-policy method（A2C、A3C、PPO、SAC、IMPALA）である。

## コンセプト

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**2つの network、1つの共有 loss。**

- **Actor** `π_θ(a | s)`: policy。行動するためにサンプリングされ、policy gradient で訓練される。
- **Critic** `V_φ(s)`: state からの期待 return を推定する。`(V_φ(s) - target)²` を最小化するよう訓練される。

**Advantage。** 標準的な形は2つある。

- *MC advantage:* `A_t = G_t - V_φ(s_t)`。Unbiased だが variance が高い。
- *TD advantage:* `A_t = r_{t+1} + γ V_φ(s_{t+1}) - V_φ(s_t)`。Bias がある（`V_φ` を使う）が、variance ははるかに低い。*TD residual* `δ_t` とも呼ばれる。

**n-step advantage。** 2つの間を補間する。

`A_t^{(n)} = r_{t+1} + γ r_{t+2} + … + γ^{n-1} r_{t+n} + γ^n V_φ(s_{t+n}) - V_φ(s_t)`

`n = 1` は純粋な TD。`n = ∞` は MC。多くの実装では Atari に `n = 5`、MuJoCo の PPO に `n = 2048` を使う。

**Generalized Advantage Estimation (GAE)。** Schulman ら (2016) は、すべての n-step advantages に対する指数加重平均を提案した。

`A_t^{GAE} = Σ_{l=0}^{∞} (γλ)^l δ_{t+l}`

ここで `λ ∈ [0, 1]`。`λ = 0` は TD（低 variance、高 bias）。`λ = 1` は MC（高 variance、unbiased）。`λ = 0.95` が2026年のデフォルトであり、bias/variance のダイヤルが望む位置に来るまで調整する。

**A2C: synchronous advantage actor-critic。** `N` 個の parallel environments から `T` steps を集める。各 step の advantages を計算する。結合 batch 上で actor と critic を更新する。繰り返す。A3C の、より単純で scale しやすい兄弟である。

**A3C: asynchronous advantage actor-critic。** Mnih ら (2016)。`N` 個の worker threads を生成し、それぞれが env を実行する。各 worker は自身の rollout 上で局所的に gradients を計算し、それを共有 parameter server に非同期に適用する。Replay buffer は不要で、worker が異なる trajectories を走ることで相関を弱める。A3C は CPU だけでも scale して訓練できることを示した。2026年には GPU-based A2C（batched parallel envs）が主流である。GPU は大きな batch を望むからだ。

**Combined loss。**

`L(θ, φ) = -E[ A_t · log π_θ(a_t | s_t) ]  +  c_v · E[(V_φ(s_t) - G_t)²]  -  c_e · E[H(π_θ(·|s_t))]`

3つの項がある。Policy-gradient loss、value regression、entropy bonus。`c_v ~ 0.5`、`c_e ~ 0.01` が典型的な開始点である。

## 作ってみる

### ステップ1: critic

Linear critic `V_φ(s) = w · features(s)` を MSE で更新する。

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

Tabular env では critic は数百 episodes で収束する。Atari では linear critic を shared CNN trunk + value head に置き換える。

### ステップ2: n-step advantage

長さ `T` の rollout と、bootstrap された final `V(s_T)` が与えられたとする。

```python
def compute_advantages(rewards, values, gamma=0.99, lam=0.95, last_value=0.0):
    advantages = [0.0] * len(rewards)
    gae = 0.0
    for t in reversed(range(len(rewards))):
        next_v = values[t + 1] if t + 1 < len(values) else last_value
        delta = rewards[t] + gamma * next_v - values[t]
        gae = delta + gamma * lam * gae
        advantages[t] = gae
    returns = [a + v for a, v in zip(advantages, values)]
    return advantages, returns
```

`returns` は critic target である。`advantages` は `∇ log π` に掛ける量である。

### ステップ3: combined update

```python
for step_i, (x, a, _r, probs) in enumerate(traj):
    adv = advantages[step_i]
    target_v = returns[step_i]

    # critic
    critic_update(w, x, target_v, lr_v)

    # actor
    for i in range(N_ACTIONS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        for j in range(N_FEAT):
            theta[i][j] += lr_a * adv * grad_logpi * x[j]
```

On-policy、update あたり1 rollout、actor と critic には別々の learning rate を使う。

### ステップ4: parallelization（A3C vs A2C）

- **A3C:** `N` threads を立ち上げる。各 thread は自分の env と forward pass を実行する。定期的に gradient updates を共有 master に push する。Master 側に locks は不要で、race は noise を加えるだけなので許容される。
- **A2C:** 単一 process で `N` 個の env instances を実行し、observations を `[N, obs_dim]` batch に stack し、batched forward pass と batched backward pass を行う。GPU utilization が高く、決定的で、推論しやすい。2026年のデフォルトである。

この toy code は明快さのため single-threaded である。Batched A2C に書き換えるなら numpy の3行で済む。

## 落とし穴

- **Actor gradient 前の critic bias。** Critic が random なら baseline は情報を持たず、純粋な noise で訓練していることになる。Policy gradient を有効にする前に critic を数百 steps warm up するか、actor learning rate を遅くする。
- **Advantage normalization。** Batch ごとに advantages を zero-mean/unit-std に normalize する。ほぼコストなしで訓練を大きく安定させる。
- **Shared trunk。** Image inputs では actor と critic に共有 feature extractor を使う。Head は分ける。共有 features は両方の losses から恩恵を受ける。
- **On-policy contract。** A2C はデータを厳密に1回の update だけに使う。それ以上使うと gradient に bias が入る（importance-sampling correction を加えたものが PPO）。
- **Entropy collapse。** `c_e > 0` がないと、policy は数百 updates でほぼ決定的になり探索をやめる。
- **Reward scale。** Advantage magnitudes は reward scale に依存する。タスク間で一貫した gradient magnitude を得るには、報酬を normalize する（例: running-std で割る）。

## 使いどころ

A2C/A3C は2026年には最終選択になることは少ないが、後続手法が改良しているアーキテクチャそのものである。

| 手法 | A2C との関係 |
|--------|----------------|
| PPO | Multi-epoch updates のために clipped importance ratio を加えた A2C |
| IMPALA | V-trace off-policy correction を加えた A3C |
| SAC (Phase 9 · 07) | Soft-value critic を持つ off-policy A2C（次の lesson） |
| GRPO (Phase 9 · 12) | Critic のない A2C、group-relative advantage |
| DPO | Preference-ranking loss に畳み込まれた A2C。Sampling なし |
| AlphaStar / OpenAI Five | League training + imitation pre-training を伴う A2C |

2026年の paper で "advantage" を見たら、actor-critic を思い浮かべること。

## 出荷する

`outputs/skill-actor-critic-trainer.md` として保存する。

```markdown
---
name: actor-critic-trainer
description: 与えられた環境向けに、advantage estimation と loss weights を指定した A2C / A3C / GAE configuration を作成する。
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

環境と compute budget が与えられたら、次を出力する。

1. Parallelism。A2C（GPU batched）vs A3C（CPU async）と workers 数。
2. Rollout length T。Update あたり env ごとの steps。
3. Advantage estimator。n-step または GAE(λ)。λ を指定する。
4. Loss weights。`c_v`（value）、`c_e`（entropy）、gradient clip。
5. Learning rates。Actor と critic（使う場合は別々）。

Horizon > 1000 の環境で single-worker A2C は拒否する（on-policy すぎて遅すぎる）。Advantage normalization なしでの出荷は拒否する。`c_e = 0` かつ observed entropy < 0.1 の run は entropy-collapsed として指摘する。
```

## 演習

1. **初級。** 4×4 GridWorld で MC advantage（`G_t - V(s_t)`）を使って actor-critic を訓練する。Lesson 06 の REINFORCE-with-running-mean-baseline と sample efficiency を比較する。
2. **中級。** TD-residual advantage（`r + γ V(s') - V(s)`）へ切り替える。Advantage batches の variance を測る。どれだけ低下するか。
3. **上級。** GAE(λ) を実装する。`λ ∈ {0, 0.5, 0.9, 0.95, 1.0}` を sweep する。Final return vs sample efficiency を plot する。このタスクでの bias/variance sweet spot はどこか。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Actor | "The policy net" | `π_θ(a\|s)`。Policy gradient で更新される。 |
| Critic | "The value net" | `V_φ(s)`。Returns / TD targets への MSE regression で更新される。 |
| Advantage | "How much better than average" | `A(s, a) = Q(s, a) - V(s)` またはその推定量。`∇ log π` の乗数。 |
| TD residual | "δ" | `δ_t = r + γ V(s') - V(s)`。One-step advantage estimate。 |
| GAE | "The interpolation knob" | `λ` でパラメータ化された n-step advantages の指数加重和。 |
| A2C | "Synchronous actor-critic" | Envs をまたいだ batch。Rollout ごとに1 gradient step。 |
| A3C | "Async actor-critic" | Worker threads が共有 param server に gradients を push する。原論文の方式で、2026年にはあまり一般的でない。 |
| Bootstrap | "Use V at the horizon" | Rollout を打ち切り、和を閉じるために `γ^n V(s_{t+n})` を加える。 |

## 参考文献

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) — A3C の原論文であり、非同期 actor-critic の paper。
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) — GAE。
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) — 基礎。Critic が neural net の場合は Ch. 9 の function approximation と合わせて読む。
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) — V-trace off-policy correction を伴う scalable distributed actor-critic。
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) — 読む価値のある production A2C/PPO implementations。
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) — two-timescale actor-critic decomposition の基礎的な収束結果。
