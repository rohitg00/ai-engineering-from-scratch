# 時序差分（temporal difference）——Q-learning 與 SARSA

> 蒙地卡羅（Monte Carlo）等到回合結束才更新。TD 每一步都更新，用下一個價值估計做自助（bootstrapping）。Q-learning 是異策略（off-policy）、樂觀的；SARSA 是同策略（on-policy）、謹慎的。兩者的更新都是一行。這個階段的每個深度 RL 方法，都以它們為基礎。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## The Problem｜問題

蒙地卡羅能運作，但有兩項成本高昂的要求。回合必須終止，而且要等待回合結束並計算完整回報才能更新。回合如果有 1000 步，MC 要等 1000 步才更新任何東西。它變異高、偏差低，實務上很慢。

動態規劃（dynamic programming）剛好相反——零變異的自助回推——但需要已知模型。

時序差分（TD）學習介於兩者之間。從單一個轉移（transition） `(s, a, r, s')`，做出一步目標（one-step target） `r + γ V(s')`，再使 `V(s)` 朝目標值更新。沒有模型。不需要完整回合。右邊用的是近似的 `V`，所以有偏差，但變異遠低於 MC，而且從第一步就能做線上（online）更新。

這是整個現代 RL 的關鍵轉折——DQN、A2C、PPO、SAC。第 9 階段剩下的，是函數近似（function approximation）和各種技巧，建構在這一課你要寫的那一行一步 TD 更新之上。

## The Concept｜核心概念

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**V 的 TD(0) 更新：**

`V(s) ← V(s) + α [r + γ V(s') - V(s)]`

括號裡的量是 TD 誤差（TD error）`δ = r + γ V(s') - V(s)`。它是 MC 裡 `G_t - V(s_t)` 的線上版本。收斂要求 `α` 滿足 Robbins-Monro（`Σ α = ∞`、`Σ α² < ∞`），而且每個狀態（state）被造訪無限次。

**Q-learning。** 控制用的異策略 TD 方法：

`Q(s, a) ← Q(s, a) + α [r + γ max_{a'} Q(s', a') - Q(s, a)]`

這裡的 `max` 假設從 `s'` 往後會跟著*貪婪（greedy）*策略走，不管 agent 實際上採取哪個動作。這個脫鉤讓 Q-learning 在 agent 用 ε-貪婪探索（exploration）時，仍然學到 `Q*`。Mnih 等人（2015）將其發展為 Atari 上的深度 Q-learning（第 05 課）。

**SARSA。** 同策略的 TD 方法：

`Q(s, a) ← Q(s, a) + α [r + γ Q(s', a') - Q(s, a)]`

名字就是那個元組 `(s, a, r, s', a')`。SARSA 用 agent *實際上*下一步會採取的動作 `a'`，不是貪婪的 `argmax`。它收斂到當下正在跑的那個 ε-貪婪 `π` 的 `Q^π`；在極限 `ε → 0` 時，那就是 `Q*`。

**懸崖行走（cliff-walking）的差別。** 在經典的懸崖行走任務（掉下懸崖的獎勵是 -100），Q-learning 學到沿著懸崖邊緣的最佳路徑，但探索時偶爾會踩到懲罰。SARSA 學到離懸崖一步的較安全路徑，因為它將探索期間採取的動作納入 Q 值。訓練下去，兩者在 `ε → 0` 時都到達最佳。實務上這點有差異：如果部署時探索真的還在發生，SARSA 的行為較為保守。

**期望 SARSA（Expected SARSA）。** 把 `Q(s', a')` 換成它在 `π` 下的期望值（expected value）：

`Q(s, a) ← Q(s, a) + α [r + γ Σ_{a'} π(a'|s') Q(s', a') - Q(s, a)]`

變異比 SARSA 低（不用抽 `a'`），目標仍是同策略的。現代教科書常常把它當預設。

**n 步 TD（n-step TD）與 TD(λ)。** 等 `n` 步再自助，在 TD(0) 和 MC 之間內插。`n=1` 是 TD，`n=∞` 是 MC。TD(λ) 用幾何權重 `(1-λ)λ^{n-1}` 把所有 `n` 平均起來。大多數深度 RL 把 `n` 放在 3 到 20 之間。

```figure
qlearning-gridworld
```

## Build It｜動手實作

### 步驟 1：在 ε-貪婪策略上跑 SARSA

```python
def sarsa(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})

    def choose(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        s = env.reset()
        a = choose(s)
        while True:
            s_next, r, done = env.step(s, a)
            a_next = choose(s_next) if not done else None
            target = r + (gamma * Q[s_next][a_next] if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s, a = s_next, a_next
    return Q
```

八行。和 Q-learning *唯一*的差別是目標那一行。

### 步驟 2：Q-learning

```python
def q_learning(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    for _ in range(episodes):
        s = env.reset()
        while True:
            a = choose(s, Q, epsilon)
            s_next, r, done = env.step(s, a)
            target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s = s_next
    return Q
```

這個 `max` 把目標和行為脫鉤。那一個符號，就是同策略和異策略的差別。

### 步驟 3：學習曲線

每 100 個回合追蹤平均回報。Q-learning 在簡單的確定性 GridWorld 上收斂比較快；SARSA 在懸崖行走上較為保守。`code/main.py` 裡的 4×4 GridWorld，兩者在大約 2000 個回合、`α=0.1, ε=0.1` 之後都接近最佳。

### 步驟 4：和 DP 的真值比較

跑價值迭代（第 02 課）得到 `Q*`。檢查 `max_{s,a} |Q_learned(s,a) - Q*(s,a)|`。健康的表格式 TD agent，在 4×4 GridWorld 上跑 1 萬個回合後，會落在 `~0.5` 以內。

## 容易踩的坑

- **Q 的初始值有差。** 樂觀初始化（負獎勵任務用 `Q = 0`）鼓勵探索。悲觀初始化可能使貪婪策略永遠陷入困境。
- **α 排程。** 非平穩問題用常數 `α` 就好。衰減的 `α_n = 1/n` 理論上會收斂，實務上太慢——把 `α` 維持在 `[0.05, 0.3]`，並看學習曲線。
- **ε 排程。** 從高的開始（`ε=1.0`），衰減到 `ε=0.05`。「GLIE」（greedy in the limit with infinite exploration，極限下貪婪且探索無限）是收斂條件。
- **Q-learning 的最大化偏差（maximization bias）。** `Q` 有雜訊時，`max` 算子往上偏。會造成高估——Hasselt 的雙 Q-learning（Double Q-learning，第 05 課的 DDQN 在用）用兩張 Q 表加以修正。
- **不終止的回合。** TD 沒有終止狀態也能學，但需要把步數封頂，或在封頂處正確處理自助。標準做法：把封頂當成非終止，繼續自助。
- **狀態的雜湊。** 狀態如果是 tuple 或張量，要用可雜湊的鍵（用 tuple，不要用 list；浮點數先四捨五入再做成 tuple，不要用原始值）。

## Use It｜實際應用

2026 年的 TD 版圖：

| 任務 | 方法 | 理由 |
|------|------|------|
| 小的表格式環境 | Q-learning | 直接學到最佳策略。 |
| 同策略、安全關鍵 | SARSA／期望 SARSA | 探索期間較為保守。 |
| 高維狀態 | DQN（第 9 階段 · 05） | 帶重放緩衝（replay buffer）和目標網路（target network）的神經網路 Q 函數。 |
| 連續動作 | SAC／TD3（第 9 階段 · 07） | 在 Q 網路上做 TD 更新；策略網路吐出動作。 |
| 語言模型的 RL（以獎勵模型為基礎） | PPO／GRPO（第 9 階段 · 08、12） | actor-critic，透過 GAE 計算 TD 風格的優勢估計。 |
| 離線 RL | CQL／IQL（第 9 階段 · 08） | 帶保守正規化的 Q-learning。 |

2026 年論文裡你讀到的「RL」，九成是 Q-learning 或 SARSA 的某種引申。深入閱讀前，先親手熟悉表格式更新。

## Ship It｜交付成果

存成 `outputs/skill-td-agent.md`：

```markdown
---
name: td-agent
description: Pick between Q-learning, SARSA, Expected SARSA for a tabular or small-feature RL task.
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

Given a tabular or small-feature environment, output:

1. Algorithm. Q-learning / SARSA / Expected SARSA / n-step variant. One-sentence reason tied to on-policy vs off-policy and variance.
2. Hyperparameters. α, γ, ε, decay schedule.
3. Initialization. Q_0 value (optimistic vs zero) and justification.
4. Convergence diagnostic. Target learning curve, `|Q - Q*|` check if DP is possible.
5. Deployment caveat. How will exploration behave at inference? Is SARSA's conservatism needed?

Refuse to apply tabular TD to state spaces > 10⁶. Refuse to ship a Q-learning agent without a max-bias caveat. Flag any agent trained with ε held at 1.0 throughout (no exploitation phase).
```

## Exercises｜練習

1. **簡單。** 在 4×4 GridWorld 上實作 Q-learning 和 SARSA。畫 2000 個回合的學習曲線（每 100 個回合的平均回報）。哪一種收斂較快？
2. **中等。** 做一個懸崖行走環境（4×12，最後一列是懸崖，獎勵 -100，並重設回起點）。比較 Q-learning 和 SARSA 的最終策略。把各自走的路徑截圖。哪一條比較靠近懸崖？
3. **困難。** 實作雙 Q-learning。在獎勵有雜訊的 GridWorld（每步獎勵加上高斯雜訊（Gaussian noise）σ=5），顯示 Q-learning 會把 `V*(0,0)` 高估到有意義的程度，雙 Q-learning 則不會。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| TD 誤差 | 「更新訊號」 | `δ = r + γ V(s') - V(s)`，由自助估計產生的殘差（residual）。 |
| TD(0) | 「一步 TD」 | 每次轉移之後就更新，只用下一個狀態的估計。 |
| Q-learning | 「異策略 RL 入門」 | 用下一個狀態各動作的 `max` 做 TD 更新；不管行為策略是什麼，都學 `Q*`。 |
| SARSA | 「同策略的 Q-learning」 | 用實際上的下一個動作做 TD 更新；學的是當下 ε-貪婪 π 的 `Q^π`。 |
| 期望 SARSA | 「低變異的 SARSA」 | 把抽到的 `a'` 換成它在 π 下的期望。 |
| GLIE | 「正確的探索排程」 | 極限下貪婪且探索無限；Q-learning 收斂需要它。 |
| 自助 | 「目標裡用當下的估計」 | TD 和 MC 的分野。偏差的來源，但變異大幅降低。 |
| 最大化偏差 | 「Q-learning 會高估」 | 雜訊估計上的 `max` 會往上偏；雙 Q-learning 加以修正。 |

## Further Reading｜延伸閱讀

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) ——原始論文和收斂證明。
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) ——TD(0)、SARSA、Q-learning、期望 SARSA。
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) ——最大化偏差的解法。
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) ——期望 SARSA 的動機。
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) ——造出 SARSA 這個名字的論文（當時叫「modified connectionist Q-learning」）。
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) ——把 TD(0) 推廣成 TD(n)，從 Q-learning 走到資格跡（eligibility traces），再到後來 PPO 裡的 GAE。
