# 動態規劃 —— 策略迭代與價值迭代

> 動態規劃就是開了外掛的強化學習。狀態轉移函式跟獎勵函式你早就知道了；你只要一直迭代貝爾曼方程，直到 `V` 或 `π` 不再變動為止。它是每一種基於取樣的方法都想逼近的基準。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 9 · 01（MDP）
**時間：** 約 75 分鐘

## 問題所在

你手上有一個模型已知的 MDP：對任何狀態—動作配對，你都能查到 `P(s' | s, a)` 與 `R(s, a, s')`。庫存管理者知道需求的分布。棋盤遊戲有決定性的狀態轉移。一個 gridworld 就四行 Python。你有一個*模型*。

無模型的強化學習（Q-learning、PPO、REINFORCE）是為了「你沒有模型」的情況而發明的——那時你只能從環境取樣。但當你真的有模型時，有更快、更好的方法可用：動態規劃。Bellman 在 1957 年就設計出來了。它們至今仍然定義了什麼叫正確：當人們說「這個 MDP 的最優策略」時，他們指的就是動態規劃會回傳的那個策略。

2026 年你仍然需要它們，理由有三個。第一，強化學習研究裡每一個表格式環境（GridWorld、FrozenLake、CliffWalking）都是用動態規劃解出黃金標準策略的。第二，精確的價值讓你能*除錯*取樣類方法：如果 Q-learning 對 `V*(s_0)` 的估計跟動態規劃的答案差了 30%，那就是你的 Q-learning 有 bug。第三，現代的離線強化學習與規劃方法（MCTS、AlphaZero 的搜尋、階段 9 · 10 的基於模型強化學習）全都是在一個學出來或給定的模型上迭代貝爾曼備份。

## 核心概念

![策略迭代與價值迭代並列對照](../assets/dp.svg)

**兩個演算法，都是在貝爾曼方程上做不動點迭代。**

**策略迭代。** 交替執行兩個步驟，直到策略不再改變。

1. *評估：* 給定策略 `π`，反覆套用 `V(s) ← Σ_a π(a|s) Σ_{s',r} P(s',r|s,a) [r + γ V(s')]` 直到收斂，藉此算出 `V^π`。
2. *改進：* 給定 `V^π`，把 `π` 改成對 `V^π` 貪婪：`π(s) ← argmax_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`。

收斂之所以有保證，是因為 (a) 每一次改進步驟要嘛讓 `π` 保持不變，要嘛讓某些狀態的 `V^π` 嚴格變大，(b) 決定性策略的空間是有限的。就算狀態空間很大，通常也只要 5–20 次外層迭代就會收斂。

**價值迭代。** 把評估與改進塌縮成單一次掃描。套用貝爾曼*最優性*方程：

`V(s) ← max_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`

重複直到 `max_s |V_{new}(s) - V(s)| < ε`。最後再取貪婪動作，把策略萃取出來。每次迭代嚴格更快——沒有內層的評估迴圈——但通常要迭代更多次才會收斂。

**廣義策略迭代（GPI）。** 這是統合一切的觀點。價值函數與策略被鎖在一個雙向的改進迴圈裡；任何把兩者推向彼此一致的方法（非同步價值迭代、修正型策略迭代、Q-learning、actor-critic、PPO）都是 GPI 的一個實例。

**為什麼 `γ < 1` 很重要。** 貝爾曼算子在 sup-norm 下是一個 `γ`-壓縮映射：`||T V - T V'||_∞ ≤ γ ||V - V'||_∞`。壓縮性意味著唯一的不動點與幾何收斂。拿掉 `γ < 1` 你就失去這個保證——那時你需要有限視野，或是一個吸收性的終止狀態。

```figure
value-iteration-gamma
```

## 動手實作

### 步驟 1：建出 GridWorld 的 MDP 模型

沿用單元 01 那個 4×4 的 GridWorld。我們加一個隨機版本：代理程式有 `0.1` 的機率會滑向某個隨機的垂直方向。

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

給定一個策略 `π(s) = {action: prob}`，迭代貝爾曼方程直到 `V` 不再變動：

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

把 `π` 換成對 `V` 貪婪的策略。如果 `π` 沒變，就回傳——我們已經在最優點上了。

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

### 步驟 4：把兩者縫起來

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

4×4 上典型的收斂速度：4–6 次外層迭代。輸出 `V*(0,0) ≈ -6`，以及一個能嚴格降低步數的策略。

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

同一個不動點，程式碼行數更少。

## 常見陷阱

- **忘了處理終止狀態。** 如果你把貝爾曼方程套到吸收狀態上，它還是會挑出一個什麼都不會改變的「最佳動作」。用 `if s == terminal: V[s] = 0` 擋住。
- **sup-norm 而不是 L2 收斂。** 用 `max |V_new - V|`，不要用平均。理論保證是建立在 sup-norm 上的。
- **原地更新與同步更新。** 原地更新 `V[s]`（Gauss-Seidel）會比另外開一個 `V_new` 字典（Jacobi）收斂得更快。正式程式碼都用原地更新。
- **策略平手。** 如果兩個動作的 Q 值相同，`argmax` 每次迭代可能用不同方式打破平手，害「策略已穩定」的檢查一直來回振盪。用一個穩定的平手處理規則（固定順序中的第一個動作）。
- **狀態空間爆炸。** 動態規劃每次掃描是 `O(|S| · |A|)`。撐得到大約 10⁷ 個狀態。再往上你就需要函數近似（階段 9 · 05 起）。

## 框架應用

2026 年，動態規劃是正確性的基準線，也是各種規劃器的內層迴圈：

| 使用情境 | 方法 |
|----------|--------|
| 精確求解一個小型表格式 MDP | 價值迭代（比較簡單）或策略迭代（外層步數比較少） |
| 驗證一份 Q-learning / PPO 實作 | 在玩具環境上跟動態規劃的最優 V* 比對 |
| 基於模型的強化學習（階段 9 · 10） | 在學出來的狀態轉移模型上做貝爾曼備份 |
| AlphaZero / MuZero 裡的規劃 | 蒙地卡羅樹搜尋 = 非同步的貝爾曼備份 |
| 離線強化學習（CQL、IQL） | 保守式 Q 迭代——加上分布外動作懲罰的動態規劃 |

每當有人說「最優價值函數」，他們的意思就是「動態規劃的不動點」。當你在論文裡看到 `V*` 或 `Q*`，腦中就該浮現這個迴圈。

## 產出交付

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

## 練習

1. **簡單。** 在 4×4 的 GridWorld 上用 `γ ∈ {0.9, 0.99}` 跑價值迭代。要掃描幾次 `max |ΔV|` 才會 `< 1e-6`？把 `V*` 印成 4×4 的網格。
2. **中等。** 在*隨機*版的 GridWorld（滑動機率 `0.1`）上比較策略迭代與價值迭代。統計：掃描次數、實際耗時、最終的 `V*(0,0)`。以迭代次數看，哪個收斂比較快？以實際耗時看呢？
3. **困難。** 做出修正型策略迭代：評估步驟裡只跑 `k` 次掃描，而不是跑到收斂。對 `k ∈ {1, 2, 5, 10, 50}` 畫出 `V*(0,0)` 的誤差對 `k` 的曲線。這條曲線告訴你評估與改進之間有什麼取捨？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| 策略迭代 | 「動態規劃演算法」 | 交替做評估（`V^π`）與改進（對 `V^π` 貪婪的 `π`），直到策略不再改變。 |
| 價值迭代 | 「比較快的動態規劃」 | 在單次掃描裡套用貝爾曼最優性備份；以幾何速度收斂到 `V*`。 |
| 貝爾曼算子 | 「那個遞迴」 | `(T V)(s) = max_a Σ P (r + γ V(s'))`；在 sup-norm 下是 `γ`-壓縮映射。 |
| 壓縮映射 | 「動態規劃為什麼會收斂」 | 任何滿足 `\|\|T x - T y\|\| ≤ γ \|\|x - y\|\|` 的算子 `T` 都有唯一的不動點。 |
| GPI | 「什麼都是動態規劃」 | 廣義策略迭代：任何把 `V` 與 `π` 推向彼此一致的方法。 |
| 同步更新 | 「Jacobi 式」 | 整次掃描都用舊的 `V`；分析起來乾淨，但比較慢。 |
| 原地更新 | 「Gauss-Seidel 式」 | 邊更新邊用最新的 `V`；實務上收斂得比較快。 |

## 延伸閱讀

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) —— 策略迭代與價值迭代最經典的呈現。
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook_athena.html) —— 對壓縮映射論證的嚴謹處理。
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) —— 修正型策略迭代及其收斂分析。
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) —— 策略迭代的原始論文。
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) —— 從動態規劃通往近似動態規劃／深度強化學習的橋樑，後續每一單元都用得上。
