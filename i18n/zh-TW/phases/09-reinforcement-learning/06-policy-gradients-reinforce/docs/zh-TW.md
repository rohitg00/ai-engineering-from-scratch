# 策略梯度（policy gradient）——從零寫 REINFORCE

> 別再估計價值。直接把策略參數化，算出期望回報的梯度，朝梯度上升方向更新。Williams（1992）以一個定理闡明這件事。PPO、GRPO，以及每個語言模型的 RL 迴圈，都源於它。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 03 (Monte Carlo), Phase 9 · 04 (TD Learning)
**Time:** ~75 minutes

## The Problem｜問題

Q-learning 和 DQN 參數化的是*價值*函數。你用 `argmax Q` 挑動作。離散動作、離散狀態這樣沒問題。動作連續時就行不通（10 維力矩要怎麼 `argmax`？），或你想要隨機策略時也行不通（`argmax` 依構造就是確定性的）。

策略梯度改去參數化*策略*。`π_θ(a | s)` 是一個神經網路，輸出動作上的分布。依該分布取樣並採取動作。算期望回報相對於 `θ` 的梯度。朝梯度上升方向更新。沒有 `argmax`。沒有 Bellman 遞迴。就是在 `J(θ) = E_{π_θ}[G]` 上做梯度上升。

REINFORCE 定理（Williams，1992）告訴你這個梯度算得出來：`∇J(θ) = E_π[ G · ∇_θ log π_θ(a | s) ]`。跑一個回合。算回報。每一步乘上 `∇ log π_θ(a | s)`。平均。以梯度上升最大化目標函數。

2026 年每個語言模型的 RL 演算法——PPO、DPO、GRPO——都是 REINFORCE 的精煉。親手把它弄懂，是這個階段剩下的課、以及第 10 階段 · 07（RLHF 實作）和第 10 階段 · 08（DPO）的前提。

## The Concept｜核心概念

![Policy gradient: softmax policy, log-π gradient, return-weighted update](../assets/policy-gradient.svg)

**策略梯度定理。** 對任何由 `θ` 參數化的策略 `π_θ`：

`∇J(θ) = E_{τ ~ π_θ}[ Σ_{t=0}^{T} G_t · ∇_θ log π_θ(a_t | s_t) ]`

其中 `G_t = Σ_{k=t}^{T} γ^{k-t} r_{k+1}` 是從步驟 `t` 起的折扣回報。期望值是對從 `π_θ` 抽樣得到的完整軌跡 `τ` 計算的。

**證明很短。** 在期望下對 `J(θ) = Σ_τ P(τ; θ) G(τ)` 微分。用 `∇P(τ; θ) = P(τ; θ) ∇ log P(τ; θ)`（對數導數技巧，log-derivative trick）。把 `log P(τ; θ) = Σ log π_θ(a_t | s_t) + environment terms that do not depend on θ` 分解開來。與 θ 無關的環境項在求導後消失。兩行代數就得到定理。

**降低變異數的技巧。** 原味 REINFORCE 的變異數極高——回報與 `∇ log π` 都含有雜訊，兩者的乘積雜訊更大。兩項常見的變異數減少方法：

1. **減掉基準（baseline）。** 把 `G_t` 換成 `G_t - b(s_t)`，基準 `b(s_t)` 只要不依賴 `a_t` 就行。不偏，因為 `E[b(s_t) · ∇ log π(a_t | s_t)] = 0`。典型選擇：`b(s_t) = V̂(s_t)`，由一個評論者（critic）學出來 → actor-critic（第 07 課）。
2. **從當下起的獎勵（reward-to-go）。** 把 `Σ_t G_t · ∇ log π_θ(a_t | s_t)` 換成 `Σ_t G_t^{from t} · ∇ log π_θ(a_t | s_t)`。給定一個動作，只有未來回報重要——過去的獎勵貢獻的是零均值雜訊。

合併後：

`∇J ≈ (1/N) Σ_{i=1}^{N} Σ_{t=0}^{T_i} [ G_t^{(i)} - V̂(s_t^{(i)}) ] · ∇_θ log π_θ(a_t^{(i)} | s_t^{(i)})`

這就是帶基準的 REINFORCE；A2C（第 07 課）與 PPO（第 08 課）都是直接由它發展而來。

**softmax 策略參數化。** 離散動作的標準選擇：

`π_θ(a | s) = exp(f_θ(s, a)) / Σ_{a'} exp(f_θ(s, a'))`

其中 `f_θ` 是任何對每個動作輸出一個分數的神經網路。梯度的形式簡潔：

`∇_θ log π_θ(a | s) = ∇_θ f_θ(s, a) - Σ_{a'} π_θ(a' | s) ∇_θ f_θ(s, a')`

也就是：採取的那個動作的分數，減掉它在策略下的期望值。

**連續動作的高斯策略。** `π_θ(a | s) = N(μ_θ(s), σ_θ(s))`。`∇ log N(a; μ, σ)` 有閉式解。第 9 階段 · 07 的 SAC 需要的就是這個。

```figure
policy-gradient-landscape
```

## Build It｜動手實作

### 步驟 1：softmax 策略網路

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

表格式環境用線性策略（每個動作一個權重向量，weight vector）。Atari 就換成 CNN，softmax 頭留著。

### 步驟 2：抽樣與對數機率（log-probability）

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

### 步驟 3：展開（rollout）時把對數機率留住

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

### 步驟 4：REINFORCE 更新

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

梯度 `∇ log π(a|s) = e_a - π(·|s)`（`a` 的獨熱減掉機率）是 softmax 策略梯度的核心。熟記這個梯度。

### 步驟 5：基準

最近幾個回合 `G` 的移動平均即可降低足夠的變異數，讓 4×4 GridWorld 開始學習；大約 500 個回合收斂。把基準升級成學出來的 `V̂(s)`，就得到 actor-critic。

## 容易踩的坑

- **梯度爆炸。** 回報可以很大。乘上 `∇ log π` 之前，一定要先把 `G` 在批次裡正規化到 `~N(0, 1)`。
- **熵崩塌（entropy collapse）。** 策略太早收斂成幾乎確定的動作，不再探索，就停滯不前。解法：在目標裡加熵獎勵（entropy bonus） `β · H(π(·|s))`。
- **高變異。** 原味 REINFORCE 需要幾千個回合。評論者基準（第 07 課）或 TRPO／PPO 的信賴域（第 08 課）是常用解法。
- **樣本效率（sample efficiency）差。** 同策略表示每次更新後就把每筆轉移丟掉。用重要性取樣做異策略修正可以重新利用這些資料，代價是變異（PPO 的比率就是截斷過的 IS 權重）。
- **非平穩梯度。** 100 個回合前的同一個梯度，用的是舊的 `π`。同策略方法每隔幾次展開就更新，就是這個原因。
- **功勞分配（credit assignment）。** 不用從當下起的獎勵，過去的獎勵就會貢獻雜訊。一律採用從當下起的獎勵。

## Use It｜實際應用

2026 年，REINFORCE 很少直接跑，但它的梯度公式廣泛應用於各類方法：

| 用途 | 衍生方法 |
|------|----------|
| 連續控制 | 帶高斯策略的 PPO／SAC |
| 語言模型 RLHF | 帶 KL 懲罰的 PPO，跑在 token 層級的策略上 |
| 語言模型推理（DeepSeek） | GRPO——帶組內相對基準的 REINFORCE，沒有評論者 |
| 多 agent | 集中式評論者的 REINFORCE（MADDPG、COMA） |
| 離散動作的機器人 | A2C、A3C、PPO |
| 只有偏好的設定 | DPO——把 REINFORCE 改寫成偏好概似損失，不用抽樣 |

當你在 2026 年的訓練腳本裡讀到 `loss = -advantage * log_prob`，那就是帶基準的 REINFORCE。DPO、GRPO、RLOO 等方法都是在這項更新上加入變異數減少技巧。

## Ship It｜交付成果

存成 `outputs/skill-policy-gradient-trainer.md`：

```markdown
---
name: policy-gradient-trainer
description: Produce a REINFORCE / actor-critic / PPO training config for a given task and diagnose variance issues.
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

Given an environment (discrete / continuous actions, horizon, reward stats), output:

1. Policy head. Softmax (discrete) or Gaussian (continuous) with parameter counts.
2. Baseline. None (vanilla), running mean, learned `V̂(s)`, or A2C critic.
3. Variance controls. Reward-to-go on by default, return normalization, gradient clip value.
4. Entropy bonus. Coefficient β and decay schedule.
5. Batch size. Episodes per update; on-policy data freshness contract.

Refuse REINFORCE-no-baseline on horizons > 500 steps. Refuse continuous-action control with a softmax head. Flag any run with `β = 0` and observed policy entropy < 0.1 as entropy-collapsed.
```

## Exercises｜練習

1. **簡單。** 在 4×4 GridWorld 上，用線性 softmax 策略實作 REINFORCE。不帶基準訓練 1 千個回合。畫學習曲線；量變異（回報的標準差）。
2. **中等。** 加上移動平均基準。再訓練一次。和原味那次比樣本效率與變異。基準能讓收斂步數減少多少？
3. **困難。** 加上熵獎勵 `β · H(π)`。掃描 `β ∈ {0, 0.01, 0.1, 1.0}`。畫最終回報和策略熵。這個任務上，最佳點落在哪裡？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 策略梯度 | 「直接訓練策略」 | `∇J(θ) = E[G · ∇ log π_θ(a\|s)]`；從對數導數技巧導出。 |
| REINFORCE | 「最早的策略梯度演算法」 | Williams（1992）；蒙地卡羅回報乘上對數策略梯度。 |
| 對數導數技巧 | 「分數函數估計量」 | `∇P(τ;θ) = P(τ;θ) · ∇ log P(τ;θ)`；讓期望的梯度變得好算。 |
| 基準 | 「降變異」 | 從 `G` 減掉任何 `b(s)`；不偏，因為 `E[b · ∇ log π] = 0`。 |
| 從當下起的獎勵 | 「只看未來回報」 | 用 `G_t^{from t}`，不用完整的 `G_0`；此形式正確，且變異較低。 |
| 熵獎勵 | 「鼓勵探索」 | `+β · H(π(·\|s))` 這一項讓策略不至於崩塌。 |
| 同策略 | 「拿剛剛看到的來訓練」 | 梯度期望是對當下策略計算的——不能直接重用舊資料。 |
| 優勢（advantage） | 「比平均好多少」 | `A(s, a) = G(s, a) - V(s)`；帶基準的 REINFORCE 更新中與對數機率相乘的有號量。 |

## Further Reading｜延伸閱讀

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696) ——REINFORCE 的原始論文。
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html) ——帶函數近似的現代策略梯度定理。
- [Sutton & Barto (2018). Ch. 13 — Policy Gradient Methods](http://incompleteideas.net/book/RLbook2020.pdf) ——教科書的講法。
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) ——講得很清楚的教學，附 PyTorch 程式。
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) ——降變異，以及把 REINFORCE 接到信賴域家族（TRPO、PPO）的自然梯度觀點。
