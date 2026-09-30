# MDP、狀態、動作與獎勵

> 馬可夫決策過程就是五樣東西：狀態、動作、狀態轉移、獎勵、折扣因子。強化學習裡的一切——Q-learning、PPO、DPO、GRPO——都是在這個形狀上做最佳化。學會這一次，剩下的強化學習就等於免費送你。

**類型：** 學習
**程式語言：** Python
**先修單元：** 階段 1 · 06（機率與分布）、階段 2 · 01（機器學習分類法）
**時間：** 約 45 分鐘

## 問題所在

你正在寫一支西洋棋機器人。或是一個庫存規劃器。或是一個交易代理程式。又或是訓練推理模型的那個 PPO 迴圈。四個完全不同的領域，卻有一個出人意料的事實：這四者都會塌縮成同一個數學物件。

監督式學習給你 `(x, y)` 配對，要你去擬合一個函式。強化學習不給你標籤——只給你一串狀態、你採取過的動作，以及一個純量獎勵。這步棋贏了嗎？這次補貨的決策省到錢了嗎？這筆交易有賺嗎？LLM 剛吐出來的那個詞元，有讓評審給出更高的獎勵嗎？

在你把這串東西形式化之前，你沒辦法從它學到任何事情。「我看到了什麼」、「我做了什麼」、「接下來發生什麼」、「那有多好」——每一項都得變成一個你能拿來推導的物件。這個形式化的結果就是馬可夫決策過程。本階段的每一個強化學習演算法，包括最後面的 RLHF 與 GRPO 迴圈，都是在這個形狀上做最佳化。

## 核心概念

![馬可夫決策過程：狀態、動作、狀態轉移、獎勵、折扣因子](../assets/mdp.svg)

**五個物件。**

- **狀態** `S`。代理程式做決策所需要的一切。在 GridWorld 裡是格子。在西洋棋裡是棋盤。在 LLM 裡是上下文視窗加上任何記憶。
- **動作** `A`。可以做的選擇。上／下／左／右移動。下一步棋。吐出一個詞元。
- **狀態轉移** `P(s' | s, a)`。給定狀態 `s` 與動作 `a`，下一個狀態的分布。西洋棋是決定性的，庫存是隨機的，LLM 解碼則近乎決定性。
- **獎勵** `R(s, a, s')`。那個純量訊號。贏 = +1，輸 = -1。營收減成本。GRPO 裡的對數概似比項。
- **折扣因子** `γ ∈ [0, 1)`。未來的獎勵相對於當下值多少。`γ = 0.99` 買到的視野大約是 100 步；`γ = 0.9` 大約是 10 步。

**馬可夫性質** `P(s_{t+1} | s_t, a_t) = P(s_{t+1} | s_0, a_0, …, s_t, a_t)`。未來只取決於當前狀態。如果不是這樣，那就是狀態的表徵不完整——這不是方法的失敗，是狀態的失敗。

**策略與回報。** 策略 `π(a | s)` 把狀態映射到動作的分布。回報 `G_t = r_t + γ r_{t+1} + γ² r_{t+2} + …` 是未來獎勵的折扣總和。價值函數 `V^π(s) = E[G_t | s_t = s]` 是在策略 `π` 之下、從 `s` 出發的期望回報。動作價值函數 `Q^π(s, a) = E[G_t | s_t = s, a_t = a]` 則是從 `s` 出發、且第一個動作指定為 `a` 的期望回報。每一個強化學習演算法都在估計這兩者之一，然後據此改進 `π`。

**貝爾曼方程。** 本階段所有東西都用得到的不動點方程：

`V^π(s) = Σ_a π(a|s) Σ_{s', r} P(s', r | s, a) [r + γ V^π(s')]`
`Q^π(s, a) = Σ_{s', r} P(s', r | s, a) [r + γ Σ_{a'} π(a'|s') Q^π(s', a')]`

它們把期望回報拆成「這一步的獎勵」加上「你落腳處的折扣後價值」。是遞迴的。階段 9 裡的每個演算法，不是把這條方程迭代到收斂（動態規劃），就是從它取樣（蒙地卡羅），再不然就是拿它往前自助（bootstrapping）一步（時序差分）。

```figure
discount-horizon
```

## 動手實作

### 步驟 1：一個超小的決定性 MDP

一個 4×4 的 GridWorld。代理程式從左上角出發，終止狀態在右下角，每走一步獎勵 -1，動作是 `{up, down, left, right}`。見 `code/main.py`。

```python
GRID = 4
TERMINAL = (3, 3)
ACTIONS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}

def step(state, action):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = ACTIONS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL
```

五行。整個環境就這樣。決定性的狀態轉移、固定的每步懲罰、一個吸收性的終止狀態。

### 步驟 2：跑一次策略

策略是一個從狀態到動作分布的函式。最簡單的那種：均勻隨機。

```python
def uniform_policy(state):
    return {a: 0.25 for a in ACTIONS}

def rollout(policy, max_steps=200):
    s, total, steps = (0, 0), 0.0, 0
    for _ in range(max_steps):
        a = sample(policy(s))
        s, r, done = step(s, a)
        total += r
        steps += 1
        if done:
            break
    return total, steps
```

把隨機策略跑 1000 次。在這張 4×4 的板子上，平均回報大概落在 -60 到 -80 之間。最優回報是 -6（一條往右下走的直線路徑）。把這個差距補起來，就是階段 9 的全部內容。

### 步驟 3：用貝爾曼方程精確算出 `V^π`

對小型的 MDP 來說，貝爾曼方程就是一個線性系統。把狀態列舉出來，套用期望值，然後迭代到價值不再變動為止。

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in all_states()}
    while True:
        delta = 0.0
        for s in all_states():
            if s == TERMINAL:
                continue
            v = 0.0
            for a, pi_a in policy(s).items():
                s_next, r, _ = step(s, a)
                v += pi_a * (r + gamma * V[s_next])
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

這就是迭代式策略評估。它是 Sutton & Barto 書裡的第一個演算法，也是後續每一個強化學習方法的理論基礎。

### 步驟 4：`γ` 是一個有物理意義的超參數

有效視野大約是 `1 / (1 - γ)`。`γ = 0.9` → 10 步。`γ = 0.99` → 100 步。`γ = 0.999` → 1000 步。

太低，代理程式會變得短視。太高，功勞分配就會變得很吵，因為很多早期的步驟都得共同為遙遠未來的獎勵負責。LLM 的 RLHF 通常用 `γ = 1`，因為回合又短又有界。控制類任務用 `0.95–0.99`。長視野的策略遊戲則用 `0.999`。

## 常見陷阱

- **非馬可夫的狀態。** 如果你得看最近三次觀測才能做決定，那「狀態」就不只是當前那次觀測。解法：堆疊畫格（Atari 上的 DQN 疊 4 格），或改用循環式的狀態（在觀測上跑 LSTM/GRU）。
- **稀疏獎勵。** 只在贏的時候給獎勵，會讓大型狀態空間裡的學習幾乎不可能發生。改用塑形獎勵（中間訊號），或用模仿學習來啟動（階段 9 · 09）。
- **獎勵駭客。** 對代理獎勵做最佳化，常常會生出病態的行為。OpenAI 那個賽艇代理程式就一直在原地繞圈撿道具，永遠不去完賽。獎勵一定要照著目標結果來定義，而不是照著代理指標。
- **折扣因子設錯。** 在無限視野的任務上用 `γ = 1`，會讓每個價值都變成無限大。一定要用有限視野或 `γ < 1` 把它壓住。
- **獎勵的尺度。** {+100, -100} 跟 {+1, -1} 這兩組獎勵會給出完全一樣的最優策略，梯度的量級卻天差地遠。丟進 PPO/DQN 之前，先正規化到 `[-1, 1]` 上下的範圍。

## 框架應用

2026 年的技術堆疊，在動任何程式碼之前都會先把每一條強化學習流程化約成一個 MDP：

| 情境 | 狀態 | 動作 | 獎勵 | γ |
|-----------|-------|--------|--------|---|
| 控制（運動、操作） | 關節角度 + 速度 | 連續力矩 | 任務專屬的塑形獎勵 | 0.99 |
| 遊戲（西洋棋、圍棋、撲克） | 棋盤 + 歷史 | 合法著手 | 贏=+1 / 輸=-1 | 1.0（有限） |
| 庫存／定價 | 庫存 + 需求 | 訂購量 | 營收 - 成本 | 0.95 |
| LLM 的 RLHF | 上下文詞元 | 下一個詞元 | 結尾處的獎勵模型分數 | 1.0（一回合約 200 詞元） |
| 推理用的 GRPO | 提示詞 + 部分回應 | 下一個詞元 | 結尾處驗證器給的 0/1 | 1.0 |

在寫任何訓練迴圈之前，先把這五元組寫出來。大部分「強化學習不管用」的錯誤回報，追溯回去都是 MDP 的表述在紙上就已經壞掉了。

## 產出交付

存成 `outputs/skill-mdp-modeler.md`：

```markdown
---
name: mdp-modeler
description: Given a task description, produce a Markov Decision Process spec and flag formulation risks before training.
version: 1.0.0
phase: 9
lesson: 1
tags: [rl, mdp, modeling]
---

Given a task (control / game / recommendation / LLM fine-tuning), output:

1. State. Exact feature vector or tensor spec. Justify Markov property.
2. Action. Discrete set or continuous range. Dimensionality.
3. Transition. Deterministic, stochastic-with-known-model, or sample-only.
4. Reward. Function and source. Sparse vs shaped. Terminal vs per-step.
5. Discount. Value and horizon justification.

Refuse to ship any MDP where the state is non-Markovian without explicit mention of frame-stacking or recurrent state. Refuse any reward that was not defined in terms of the target outcome. Flag any `γ ≥ 1.0` on an infinite-horizon task. Flag any reward range >100x the typical step reward as a likely gradient-explosion source.
```

## 練習

1. **簡單。** 在 `code/main.py` 裡實作 4×4 的 GridWorld 與隨機策略的 rollout。跑 10,000 個回合。回報平均值與標準差。跟最優回報（-6）比較。
2. **中等。** 對均勻隨機策略，用 `γ ∈ {0.5, 0.9, 0.99}` 跑 `policy_evaluation`。把每一種的 `V` 印成 4×4 的網格。說明為什麼終止狀態附近的狀態價值會隨著 `γ` 變大而長得更快。
3. **困難。** 把 GridWorld 改成隨機的：每個動作都有 `p = 0.1` 的機率滑向相鄰的方向。重新評估均勻策略。`V[start]` 是變好還是變差？為什麼？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| MDP | 「強化學習的設定」 | 滿足馬可夫性質的五元組 `(S, A, P, R, γ)`。 |
| 狀態 | 「代理程式看到的東西」 | 在選定的策略類別下，足以決定未來動態的充分統計量。 |
| 策略 | 「代理程式的行為」 | 條件分布 `π(a \| s)`，或決定性的映射 `s → a`。 |
| 回報 | 「總獎勵」 | 從當前這一步算起的折扣總和 `Σ γ^t r_t`。 |
| 價值函數 | 「一個狀態有多好」 | 在 `π` 之下、從 `s` 出發的期望回報。 |
| 動作價值函數 | 「一個動作有多好」 | 在 `π` 之下、從 `s` 出發且第一個動作是 `a` 的期望回報。 |
| 貝爾曼方程 | 「動態規劃的遞迴式」 | 把價值／Q 拆解成單步獎勵加上後繼狀態折扣後價值的不動點分解。 |
| 折扣因子 `γ` | 「未來與當下的權衡」 | 加在遙遠未來獎勵上的幾何權重；有效視野約為 `1/(1-γ)`。 |

## 延伸閱讀

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf) —— 那本教科書。第 3 章講 MDP 與貝爾曼方程；第 1 章講清楚了後續每一單元都倚賴的獎勵假說。
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) —— 貝爾曼方程的源頭。
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) —— 從深度強化學習角度切入的簡潔 MDP 入門。
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) —— 作業研究界關於 MDP 與精確解法的參考書。
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://cs.brown.edu/media/filer_public/d1/a6/d1a6f66a-289a-4b81-9596-417114843489/littman.pdf) —— 把 MDP 推導成動態規劃特例最乾淨的一份。
