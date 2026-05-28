# Policy Gradient — REINFORCE from Scratch

> 価値の推定をやめる。方策を直接パラメータ化し、期待 return の勾配を計算し、上り方向へ進む。Williams (1992) はこれを1つの定理として書いた。PPO、GRPO、そしてすべての LLM RL loop が存在する理由がここにある。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 3 · 03 (Backpropagation), Phase 9 · 03 (Monte Carlo), Phase 9 · 04 (TD Learning)
**所要時間:** 約75分

## 問題

Q-learning と DQN は *value* function をパラメータ化する。行動は `argmax Q` で選ぶ。これは離散行動かつ離散状態なら問題ない。しかし、行動が連続の場合（10次元 torque に対してどの `argmax` を取るのか）や、確率的方策が欲しい場合（`argmax` は構造上決定的）には破綻する。

Policy gradients は代わりに *policy* をパラメータ化する。`π_θ(a | s)` は、行動上の分布を出力するニューラルネットである。そこからサンプリングして行動する。`θ` に関する期待 return の勾配を計算する。上り方向へ進む。`argmax` はない。Bellman recursion もない。`J(θ) = E_{π_θ}[G]` に対する gradient ascent だけである。

REINFORCE theorem (Williams 1992) は、この勾配が計算可能であることを示す。`∇J(θ) = E_π[ G · ∇_θ log π_θ(a | s) ]`。Episode を実行する。Return を計算する。各ステップで `∇ log π_θ(a | s)` に掛ける。平均する。Gradient-ascent。完了。

2026年のすべての LLM-RL algorithm、PPO、DPO、GRPO は REINFORCE の改良である。これを手で理解しておくことは、この phase の残り、さらに Phase 10 · 07（RLHF implementation）と Phase 10 · 08（DPO）の前提条件である。

## コンセプト

![Policy gradient: softmax policy, log-π gradient, return-weighted update](../assets/policy-gradient.svg)

**Policy gradient theorem。** `θ` でパラメータ化された任意の policy `π_θ` について、

`∇J(θ) = E_{τ ~ π_θ}[ Σ_{t=0}^{T} G_t · ∇_θ log π_θ(a_t | s_t) ]`

ここで `G_t = Σ_{k=t}^{T} γ^{k-t} r_{k+1}` はステップ `t` からの discounted return である。期待値は `π_θ` からサンプリングされた完全な trajectory `τ` に関するもの。

**証明は短い。** 期待値の内側で `J(θ) = Σ_τ P(τ; θ) G(τ)` を微分する。`∇P(τ; θ) = P(τ; θ) ∇ log P(τ; θ)`（log-derivative trick）を使う。`log P(τ; θ) = Σ log π_θ(a_t | s_t) + environment terms that do not depend on θ` と分解する。Environment terms は消える。2行の代数で定理が得られる。

**Variance reduction tricks。** 素の REINFORCE は非常に variance が大きい。Return はノイジーで、`∇ log π` もノイジーで、その積はさらにノイジーである。標準的な修正は2つある。

1. **Baseline subtraction。** `G_t` を、`a_t` に依存しない任意の baseline `b(s_t)` について `G_t - b(s_t)` に置き換える。`E[b(s_t) · ∇ log π(a_t | s_t)] = 0` なので unbiased である。典型的には critic が学習した `b(s_t) = V̂(s_t)` を使う。これが actor-critic（Lesson 07）につながる。
2. **Reward-to-go。** `Σ_t G_t · ∇ log π_θ(a_t | s_t)` を `Σ_t G_t^{from t} · ∇ log π_θ(a_t | s_t)` に置き換える。ある行動に関係するのは未来の return だけであり、過去の報酬は zero-mean noise になる。

組み合わせると次の式になる。

`∇J ≈ (1/N) Σ_{i=1}^{N} Σ_{t=0}^{T_i} [ G_t^{(i)} - V̂(s_t^{(i)}) ] · ∇_θ log π_θ(a_t^{(i)} | s_t^{(i)})`

これは baseline 付き REINFORCE であり、A2C（Lesson 07）と PPO（Lesson 08）の直接の祖先である。

**Softmax policy parameterization。** 離散行動では、標準的な選択は次である。

`π_θ(a | s) = exp(f_θ(s, a)) / Σ_{a'} exp(f_θ(s, a'))`

ここで `f_θ` は各行動に score を出す任意のニューラルネットである。勾配はきれいな形になる。

`∇_θ log π_θ(a | s) = ∇_θ f_θ(s, a) - Σ_{a'} π_θ(a' | s) ∇_θ f_θ(s, a')`

つまり、実際に取った行動の score から、policy の下での期待値を引いたものになる。

**連続行動の Gaussian policy。** `π_θ(a | s) = N(μ_θ(s), σ_θ(s))`。`∇ log N(a; μ, σ)` には閉形式がある。Phase 9 · 07 の SAC に必要なのはこれだけである。

## 作ってみる

### ステップ1: softmax policy network

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

Tabular env では linear policy（行動ごとに1つの weight vector）を使う。Atari では CNN に差し替え、softmax head はそのままにする。

### ステップ2: sampling と log-probability

```python
def sample_action(probs, rng):
    x = rng.random()
    cum = 0
    for a, p in enumerate(probs):
        cum += p
        if x <= cum:
            return a
    return len(probs) - 1

def log_prob(probs, a):
    return log(probs[a] + 1e-12)
```

### ステップ3: log-probs を保持した rollout

```python
def rollout(theta, env, rng, gamma):
    trajectory = []
    s = env.reset()
    while not done:
        logits = policy_logits(theta, s)
        probs = softmax(logits)
        a = sample_action(probs, rng)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r, probs))
        s = s_next
    return trajectory
```

### ステップ4: REINFORCE update

```python
def reinforce_step(theta, trajectory, gamma, lr, baseline=0.0):
    returns = compute_returns(trajectory, gamma)
    for (s, a, _, probs), G in zip(trajectory, returns):
        advantage = G - baseline
        grad_log_pi_a = [-p for p in probs]
        grad_log_pi_a[a] += 1.0
        for i in range(N_ACTIONS):
            for j in range(len(s)):
                theta[i][j] += lr * advantage * grad_log_pi_a[i] * s[j]
```

勾配 `∇ log π(a|s) = e_a - π(·|s)`（`a` の onehot から確率を引く）が softmax policy gradients の核心である。体に刻み込むこと。

### ステップ5: baselines

直近 episodes の `G` の running mean だけでも、4×4 GridWorld を動かすには十分な variance reduction になり、収束には約500 episodes かかる。Baseline を学習された `V̂(s)` に上げると actor-critic になる。

## 落とし穴

- **Exploding gradients。** Return は巨大になりうる。`∇ log π` を掛ける前に、必ず batch 内で `G` を `~N(0, 1)` に normalize する。
- **Entropy collapse。** Policy が早すぎる段階でほぼ決定的な行動に収束し、探索をやめて詰まる。修正策は、目的関数に entropy bonus `β · H(π(·|s))` を追加すること。
- **High variance。** 素の REINFORCE は数千 episodes を必要とする。Critic baseline（Lesson 07）または TRPO/PPO の trust region（Lesson 08）が標準的な修正である。
- **Sample inefficiency。** On-policy なので、各 transition は1回の update 後に捨てる。Importance sampling による off-policy correction でデータを再利用できるが、variance が増える（PPO の ratio は clipped IS weight である）。
- **Non-stationary gradients。** 100 episodes 前の同じ勾配は古い `π` を使っている。そのため on-policy methods は数 rollout ごとに更新する。
- **Credit assignment。** Reward-to-go がないと、過去の報酬が noise になる。常に reward-to-go を使う。

## 使いどころ

2026年時点で REINFORCE がそのまま実行されることは少ないが、その勾配公式は至るところにある。

| ユースケース | 派生手法 |
|----------|---------------|
| Continuous control | PPO / SAC with Gaussian policy |
| LLM RLHF | PPO with KL penalty, running on token-level policy |
| LLM reasoning (DeepSeek) | GRPO — group-relative baseline を使う critic なし REINFORCE |
| Multi-agent | Centralized-critic REINFORCE (MADDPG, COMA) |
| Discrete action robotics | A2C, A3C, PPO |
| Preference-only settings | DPO — preference-likelihood loss として書き直した REINFORCE。Sampling なし |

2026年の訓練スクリプトで `loss = -advantage * log_prob` を見たら、それは baseline 付き REINFORCE である。DPO、GRPO、RLOO といった論文全体が、この1行の上に積まれた variance-reduction trick である。

## 出荷する

`outputs/skill-policy-gradient-trainer.md` として保存する。

```markdown
---
name: policy-gradient-trainer
description: 与えられたタスク向けに REINFORCE / actor-critic / PPO training config を作成し、variance の問題を診断する。
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

環境（discrete / continuous actions、horizon、reward stats）が与えられたら、次を出力する。

1. Policy head。Softmax（discrete）または Gaussian（continuous）と parameter counts。
2. Baseline。None（vanilla）、running mean、学習された `V̂(s)`、または A2C critic。
3. Variance controls。Reward-to-go はデフォルトで有効、return normalization、gradient clip value。
4. Entropy bonus。Coefficient β と decay schedule。
5. Batch size。Update あたりの episodes、on-policy data freshness contract。

Horizon が 500 steps を超える REINFORCE-no-baseline は拒否する。Softmax head を使う continuous-action control は拒否する。`β = 0` かつ observed policy entropy < 0.1 の run は entropy-collapsed として指摘する。
```

## 演習

1. **初級。** Linear softmax policy で 4×4 GridWorld に REINFORCE を実装する。Baseline なしで 1,000 episodes 訓練する。Learning curve を plot し、variance（returns の std）を測る。
2. **中級。** Running-mean baseline を追加する。再度訓練する。Vanilla run と sample efficiency と variance を比較する。Baseline によって収束までの steps はどれだけ減るか。
3. **上級。** Entropy bonus `β · H(π)` を追加する。`β ∈ {0, 0.01, 0.1, 1.0}` を sweep する。Final return と policy entropy を plot する。このタスクでの sweet spot はどこか。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Policy gradient | "Train the policy directly" | `∇J(θ) = E[G · ∇ log π_θ(a\|s)]`。Log-derivative trick から導かれる。 |
| REINFORCE | "The original PG algorithm" | Williams (1992)。Monte Carlo returns に log-policy gradient を掛ける。 |
| Log-derivative trick | "Score function estimator" | `∇P(τ;θ) = P(τ;θ) · ∇ log P(τ;θ)`。期待値の勾配を扱いやすくする。 |
| Baseline | "Variance reduction" | `G` から引く任意の `b(s)`。`E[b · ∇ log π] = 0` なので unbiased。 |
| Reward-to-go | "Only future returns count" | Full `G_0` ではなく `G_t^{from t}`。正しく、variance が低い。 |
| Entropy bonus | "Encourage exploration" | `+β · H(π(·\|s))` 項が policy collapse を防ぐ。 |
| On-policy | "Train on what you just saw" | Gradient expectation は現在の policy に関するものなので、古いデータを直接再利用できない。 |
| Advantage | "How much better than average" | `A(s, a) = G(s, a) - V(s)`。REINFORCE-with-baseline が掛ける符号付き量。 |

## 参考文献

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696) — REINFORCE の原論文。
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html) — function approximation を伴う現代的な policy-gradient theorem。
- [Sutton & Barto (2018). Ch. 13 — Policy Gradient Methods](http://incompleteideas.net/book/RLbook2020.pdf) — 教科書的説明。
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) — PyTorch code 付きの明快な教育的解説。
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) — variance reduction と natural-gradient view。REINFORCE を trust-region family（TRPO、PPO）につなげる。
