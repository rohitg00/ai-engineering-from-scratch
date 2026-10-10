# 動態規劃（dynamic programming）——策略迭代（policy iteration）與價值迭代（value iteration）

> 動態規劃是強化學習中的作弊模式。轉移函數（transition function）和獎勵函數（reward function）你已經知道，只要把 Bellman 方程式迭代到 `V` 或 `π` 停止變動。它是每個抽樣式方法都想逼近的基準（benchmark）。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 minutes

## The Problem｜問題

你有一個已知模型（model）的 MDP：任何狀態－動作配對，你都能查 `P(s' | s, a)` 和 `R(s, a, s')`。庫存管理員知道需求分布。棋類遊戲的轉移是確定的。GridWorld 是四行 Python。你手上有*模型*。

無模型（model-free）的 RL（Q-learning、PPO、REINFORCE）是為了沒有模型、只能從環境抽樣的情況發明的。但你真的有模型時，有更快、更好的方法：動態規劃。Bellman 在 1957 年設計它們。它們到現在仍定義正確性：當人們說「這個 MDP 的最佳策略」，意思就是 DP 會回傳的那個策略。

2026 年你需要它們，理由有三個。第一，RL 研究裡每個表格式（tabular）環境（GridWorld、FrozenLake、CliffWalking）都用 DP 解出黃金標準（gold standard）策略。第二，精確的價值讓你*除錯*抽樣方法：如果 Q-learning 估出來的 `V*(s_0)` 和 DP 的答案差了 30%，你的 Q-learning 有 bug。第三，現代的離線 RL 和規劃方法（MCTS、AlphaZero 的搜尋、第 9 階段 · 10 的模型式 RL，model-based RL）都在學到的或給定的模型上，反覆做 Bellman 回推（backup）。

## The Concept｜核心概念

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**兩個演算法，都是 Bellman 上的不動點迭代（fixed-point iteration）。**

**策略迭代。** 交替兩個步驟，直到策略不再變。

1. *評估（evaluation）：* 給定策略 `π`，反覆套用 `V(s) ← Σ_a π(a|s) Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`，直到收斂，算出 `V^π`。
2. *改進（improvement）：* 給定 `V^π`，令 `π` 對 `V^π` 採貪婪策略（greedy）：`π(s) ← argmax_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`。

收斂有保證，因為 (a) 每一次改進不是讓 `π` 不變，就是讓某個狀態的 `V^π` 嚴格變大，(b) 確定性策略的空間是有限的。就算狀態空間很大，通常大約 5 到 20 次外層迭代就收斂。

**價值迭代。** 把評估和改進併成一次掃描（sweep）。套用 Bellman *最優*方程式：

`V(s) ← max_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`

重複到 `max_s |V_{new}(s) - V(s)| < ε`。最後依貪婪動作導出策略。每次迭代的計算量較低——沒有內層評估迴圈——但通常要更多次迭代才收斂。

**廣義策略迭代（Generalized Policy Iteration，GPI）。** 這是把它們統一起來的講法。價值函數與策略在雙向改進迴圈中互相推進；任何把兩者推向彼此一致的方法（非同步價值迭代、修正策略迭代、Q-learning、actor-critic、PPO）都是 GPI 的一個例子。

**為什麼 `γ < 1` 要緊。** Bellman 算子在上確界範數（sup-norm）下是 `γ`-收縮（contraction）：`||T V - T V'||_∞ ≤ γ ||V - V'||_∞`。收縮代表有唯一不動點，而且幾何收斂。移除 `γ < 1` 後，這個保證就不再成立——你需要有限視野，或一個吸收性（absorbing）終止狀態（terminal state）。

```figure
value-iteration-gamma
```

## Build It｜動手實作

### 步驟 1：建立 GridWorld 的 MDP 模型

用第 01 課同一個 4×4 GridWorld。我們加一個隨機變體（stochastic variant）：以 `0.1` 的機率，agent 會滑向隨機的垂直方向。

```python
SLIP = 0.1

def transitions(state, action):
    if state == TERMINAL:
        return [(state, 0.0, 1.0)]
    outcomes = []
    for direction, prob in action_probs(action):
        outcomes.append((apply_move(state, direction), -1.0, prob))
    return outcomes
```

`transitions(s, a)` 回傳一串 `(s', r, p)`。這就是整個模型。

### 步驟 2：策略評估

給定策略 `π(s) = {action: prob}`，把 Bellman 方程式反覆迭代，直到 `V` 收斂：

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = sum(pi_a * sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a))
                   for a, pi_a in policy(s).items())
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

### 步驟 3：策略改進

把 `π` 換成對 `V` 採貪婪策略的版本。如果 `π` 沒變，就返回——已經在最佳解。

```python
def policy_improvement(V, gamma=0.99):
    new_policy = {}
    for s in states():
        best_a = max(
            ACTIONS,
            key=lambda a: sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a)),
        )
        new_policy[s] = best_a
    return new_policy
```

### 步驟 4：把兩者接起來

```python
def policy_iteration(gamma=0.99):
    policy = {s: "up" for s in states()}   # arbitrary start
    for _ in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma)
        new_policy = policy_improvement(V, gamma)
        if new_policy == policy:
            return V, policy
        policy = new_policy
```

4×4 上典型的收斂是 4 到 6 次外層迭代。輸出 `V*(0,0) ≈ -6`，以及一個步數嚴格遞減的策略。

### 步驟 5：價值迭代（單迴圈版本）

```python
def value_iteration(gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = max(sum(p * (r + gamma * V[s_prime])
                       for s_prime, r, p in transitions(s, a))
                   for a in ACTIONS)
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            break
    policy = policy_improvement(V, gamma)
    return V, policy
```

同一個不動點，程式更短。

## 容易踩的坑

- **忘了處理終止狀態。** 如果把 Bellman 套到吸收狀態，它還是會挑一個什麼都沒改的「最佳動作」。以 `if s == terminal: V[s] = 0` 加以防護。
- **上確界範數對上 L2 收斂。** 用 `max |V_new - V|`，不要用平均。理論保證是在上確界範數上。
- **就地（in-place）更新對上同步（synchronous）更新。** 就地更新 `V[s]`（Gauss-Seidel）比另外放一份 `V_new` 字典（Jacobi）收斂快。正式環境程式使用就地更新。
- **策略平手。** 如果兩個動作的 Q 值相等，`argmax` 每次迭代打破平手的方式可能不同，使「策略穩定」檢查反覆震盪。用穩定的平手規則（tie-breaking rule，固定順序裡的第一個動作）。
- **狀態空間爆炸。** DP 每次掃描是 `O(|S| · |A|)`。大約到 1000 萬個狀態仍可處理。再大就需要函數近似（function approximation），從第 9 階段 · 05 起。

## Use It｜實際應用

2026 年，動態規劃是正確性的基準，也是規劃器的內層迴圈：

| 用途 | 方法 |
|------|------|
| 精確解一個小的表格式 MDP | 價值迭代（比較單純）或策略迭代（外層步數較少） |
| 驗證 Q-learning／PPO 的實作 | 在玩具環境上和 DP 最佳的 V* 比較 |
| 模型式 RL（第 9 階段 · 10） | 在學到的轉移模型上做 Bellman 回推 |
| AlphaZero／MuZero 裡的規劃 | 蒙地卡羅樹搜尋 = 非同步 Bellman 回推 |
| 離線 RL（CQL、IQL） | 保守 Q 迭代——帶分布外（OOD）動作懲罰的 DP |

每次有人說「最佳價值函數」，意思就是「DP 的不動點」。論文裡看到 `V*` 或 `Q*`，腦中就該浮出這個迴圈。

## Ship It｜交付成果

存成 `outputs/skill-dp-solver.md`：

```markdown
---
name: dp-solver
description: Solve a small tabular MDP exactly via policy iteration or value iteration. Report convergence behavior.
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

Given an MDP with a known model, output:

1. Choice. Policy iteration vs value iteration. Reason tied to |S|, |A|, γ.
2. Initialization. V_0, starting policy. Convergence sensitivity.
3. Stopping. Sup-norm tolerance ε. Expected number of sweeps.
4. Verification. V*(s_0) computed exactly. Greedy policy extracted.
5. Use. How this baseline will be used to debug/evaluate sampling-based methods.

Refuse to run DP on state spaces > 10⁷. Refuse to claim convergence without a sup-norm check. Flag any γ ≥ 1 on an infinite-horizon task as a guarantee violation.
```

## Exercises｜練習

1. **簡單。** 在 4×4 GridWorld 上跑價值迭代，`γ ∈ {0.9, 0.99}`。幾次掃描後 `max |ΔV| < 1e-6`？把 `V*` 印成 4×4 網格。
2. **中等。** 在*隨機* GridWorld（滑動機率 `0.1`）上比較策略迭代和價值迭代。數這三樣：掃描次數、實際耗時（wall-clock）、最終的 `V*(0,0)`。哪一種方法的迭代次數較少？哪一種的實際耗時較短？
3. **困難。** 做修正策略迭代：評估那一步只跑 `k` 次掃描，不要跑到收斂。對 `k ∈ {1, 2, 5, 10, 50}` 畫 `V*(0,0)` 誤差對 `k` 的圖。這條曲線對評估／改進的取捨說了什麼？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 策略迭代 | 「DP 演算法」 | 交替評估（`V^π`）和改進（對 `V^π` 採貪婪策略的 `π`），直到策略不再變。 |
| 價值迭代 | 「比較快的 DP」 | 一次掃描套上 Bellman 最優回推；幾何收斂到 `V*`。 |
| Bellman 算子 | 「那個遞迴」 | `(T V)(s) = max_a Σ P (r + γ V(s'))`；上確界範數下的 `γ`-收縮。 |
| 收縮 | 「DP 為什麼收斂」 | 任何滿足 `\|\|T x - T y\|\| ≤ γ \|\|x - y\|\|` 的算子 `T` 都有唯一不動點。 |
| GPI | 「一切都是 DP」 | 任何把 `V` 和 `π` 推向彼此一致的方法。 |
| 同步更新（synchronous update） | 「Jacobi 風格」 | 一次掃描全程用舊的 `V`；好分析，但比較慢。 |
| 就地更新 | 「Gauss-Seidel 風格」 | 用正在更新的 `V`；實務上收斂比較快。 |

## Further Reading｜延伸閱讀

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) ——策略迭代和價值迭代的標準講法。
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook_athena.html) ——收縮映射論證的嚴謹處理。
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) ——修正策略迭代和它的收斂分析。
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) ——策略迭代的原始論文。
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) ——從 DP 接到近似 DP／深度 RL 的那座橋，後面每一課都用得到。
