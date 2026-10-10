# 馬可夫決策過程（Markov Decision Process）、狀態、動作與獎勵

> 馬可夫決策過程是五件事：狀態（state）、動作（action）、轉移（transition）、獎勵（reward）、折扣（discount）。強化學習（reinforcement learning）裡的一切——Q-learning、PPO、DPO、GRPO——都可用同一個數學框架描述。學一次，後面的強化學習就不用再另外學一套。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 1 · 06 (Probability & Distributions), Phase 2 · 01 (ML Taxonomy)
**Time:** ~45 minutes

## The Problem｜問題

你在寫一個西洋棋程式。或一個庫存規劃器。或一個交易 agent。或那個訓練推理模型的 PPO 迴圈。四個不同的領域，一件讓人不舒服的事實：都可形式化為同一種數學物件。

監督式學習（supervised learning）給你 `(x, y)` 配對，請你擬合一個函式。強化學習不給標籤——只有一串狀態、你採取的動作，以及一個純量（scalar）獎勵。這步棋有沒有贏？補貨的決定有沒有省錢？這筆交易有沒有賺？語言模型剛剛吐出的那個 token，有沒有讓評判給出更高的獎勵？

這串東西要先形式化，否則沒辦法從它學習。「我看到什麼」、「我做了什麼」、「後續發生的結果」、「那樣有多好」——每一個都得變成你可以推理的物件。那個形式化就是馬可夫決策過程。這個階段的每個 RL 演算法，包含最後的 RLHF 和 GRPO 迴圈，都可用同一個數學框架描述。

## The Concept｜核心概念

![Markov decision process: states, actions, transitions, rewards, discount](../assets/mdp.svg)

**五個物件。**

- **狀態** `S`。agent 做決定所需要的一切。GridWorld 是那一格。西洋棋是棋盤。語言模型是上下文視窗，加上任何記憶。
- **動作** `A`。那些選項。往上、往下、往左、往右。走一步棋。吐出一個 token。
- **轉移** `P(s' | s, a)`。給定狀態 `s` 和動作 `a`，下一個狀態的分布（distribution）。西洋棋是確定的（deterministic），庫存是隨機的（stochastic），語言模型解碼幾乎是確定的。
- **獎勵** `R(s, a, s')`。那個純量訊號。贏 = +1，輸 = -1。收入減成本。或是 GRPO 裡的對數概似比（log-likelihood ratio）。
- **折扣** `γ ∈ [0, 1)`。未來獎勵相對現在算多少。`γ = 0.99` 買到大約 100 步的視野（horizon）；`γ = 0.9` 買到大約 10 步。

**馬可夫性質（Markov property）** `P(s_{t+1} | s_t, a_t) = P(s_{t+1} | s_0, a_0, …, s_t, a_t)`。未來只依賴現在的狀態。如果不是這樣，是狀態表示不完整——不是方法失敗，是狀態失敗。

**策略／隨機策略與回報（return）。** 策略／隨機策略（policy）`π(a | s)` 將狀態映射至動作分布。回報（return）`G_t = r_t + γ r_{t+1} + γ² r_{t+2} + …` 是未來獎勵的折扣加總。價值（value）`V^π(s) = E[G_t | s_t = s]` 是從 `s` 出發、在策略／隨機策略 `π` 下的期望回報。Q 值（Q-value）`Q^π(s, a) = E[G_t | s_t = s, a_t = a]` 是從某一個特定動作出發的期望回報。每個 RL 演算法都在估計這兩個其中一個，再據此改進 `π`。

**Bellman 方程式。** 這個階段全都在用的不動點方程式：

`V^π(s) = Σ_a π(a|s) Σ_{s', r} P(s', r | s, a) [r + γ V^π(s')]`
`Q^π(s, a) = Σ_{s', r} P(s', r | s, a) [r + γ Σ_{a'} π(a'|s') Q^π(s', a')]`

它們把期望回報拆成「這一步的獎勵」，加上「到達狀態的折扣價值」。這是遞迴的。第 9 階段的每個演算法，要麼把這個方程式迭代到收斂（動態規劃，dynamic programming），要麼從它抽樣（蒙地卡羅，Monte Carlo），要麼往前自助一步（時序差分，temporal difference）。

```figure
discount-horizon
```

## Build It｜動手實作

### 步驟 1：一個很小的確定性 MDP

4×4 的 GridWorld。agent 從左上角開始，終點在右下角，每一步獎勵 -1，動作是 `{up, down, left, right}`。見 `code/main.py`。

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

五行。這就是整個環境。確定性（deterministic）的轉移、固定的每步懲罰、吸收性（absorbing）的終止狀態。

### 步驟 2：把一個策略／隨機策略展開

策略／隨機策略是從狀態到動作分布的函式。最簡單的：均勻隨機。

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

把隨機策略執行 1000 個回合。這張 4×4 棋盤的平均回報大約是 -60 到 -80。最佳回報是 -6（往右下的直線）。把這個差距補上，就是第 9 階段的全部。

### 步驟 3：用 Bellman 方程式精確算出 `V^π`

小的 MDP 裡，Bellman 方程式是一個線性系統。列舉狀態並套用期望運算，迭代至數值收斂。

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

這是迭代式的策略／隨機策略評估（policy evaluation）。它是 Sutton 與 Barto 的第一個演算法，也是後面每個 RL 方法的理論基礎。

### 步驟 4：`γ` 是一個有物理意義的超參數（hyperparameter）

有效視野（effective horizon）大約是 `1 / (1 - γ)`。`γ = 0.9` → 10 步。`γ = 0.99` → 100 步。`γ = 0.999` → 1000 步。

太低，agent 會過於短視。太高，功勞分配（credit assignment）的雜訊會變大，因為很多早期步驟一起為遙遠的未來獎勵負責。語言模型的 RLHF 通常用 `γ = 1`，因為回合短而且有界。控制任務用 `0.95–0.99`。長視野的策略遊戲用 `0.999`。

## 容易踩的坑

- **非馬可夫的狀態。** 如果做決定得看最近三個觀測，「狀態」就不只是當下這個觀測。解法：把幀疊起來（Atari 上的 DQN 疊 4 幀），或用循環狀態（在觀測上跑 LSTM／GRU）。
- **稀疏獎勵。** 只有贏才給獎勵，在大的狀態空間裡幾乎學不會。把獎勵塑形（中間訊號），或以模仿示範來做自助（第 9 階段 · 09）。
- **獎勵操弄（reward hacking）。** 把代理獎勵往上推，常會導致病態行為。OpenAI 的賽船 agent 一直轉圈撿道具，永遠不完成比賽。獎勵一定要依目標結果來定義，不要依那個代理。
- **折扣設錯。** 無限視野的任務若用 `γ = 1`，每個價值都會變成無限大。一定要加上限：可以用有限視野，或設定 `γ < 1`。
- **獎勵尺度。** 獎勵用 {+100, -100} 或 {+1, -1}，最佳策略／隨機策略一樣，梯度（gradient）的大小卻差異極大。接進 PPO／DQN 之前，先正規化到大約 `[-1, 1]` 的範圍。

## Use It｜實際應用

2026 年的做法，是在動手寫程式之前，先把每條 RL 管線（pipeline）形式化為一個 MDP：

| 情境 | 狀態 | 動作 | 獎勵 | γ |
|------|------|------|------|---|
| 控制（移動、操作） | 關節角度 + 速度 | 連續力矩 | 依任務塑形 | 0.99 |
| 遊戲（西洋棋、圍棋、撲克） | 棋盤 + 歷史 | 合法的一步 | 贏=+1／輸=-1 | 1.0（有限） |
| 庫存／定價 | 存量 + 需求 | 訂購數量 | 收入 - 成本 | 0.95 |
| 給語言模型的 RLHF | 上下文 token | 下一個 token | 回合結束時的獎勵模型分數 | 1.0（回合約 200 個 token） |
| 給推理的 GRPO | prompt + 部分回應 | 下一個 token | 結尾的驗證器 0／1 | 1.0 |

寫任何訓練迴圈之前，先把這五元組（five-tuple）寫下來。大多數「RL 不會動」的問題回報，MDP 的定義本身就有問題。

## Ship It｜交付成果

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

## Exercises｜練習

1. **簡單。** 在 `code/main.py` 實作 4×4 GridWorld，以及隨機策略／隨機策略的展開。跑 1 萬個回合。寫出回報的平均和標準差。和最佳回報（-6）比較。
2. **中等。** 在均勻隨機策略／隨機策略上，用 `γ ∈ {0.5, 0.9, 0.99}` 跑 `policy_evaluation`。每一組都把 `V` 印成 4×4 網格。解釋為什麼越靠近終點，狀態價值在較大的 `γ` 下長得越快。
3. **困難。** 把 GridWorld 改成隨機的：每個動作有機率 `p = 0.1` 滑到相鄰方向。重新評估均勻策略／隨機策略。`V[start]` 變好還是變差？為什麼？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| MDP | 「強化學習的問題設定」 | 滿足馬可夫性質的元組 `(S, A, P, R, γ)`。 |
| 狀態 | 「agent 看到的」 | 在所選的策略／隨機策略類別下，未來動態的充分統計量。 |
| 策略／隨機策略 | 「agent 的行為」 | 條件分布 `π(a \| s)`，或確定性對應 `s → a`。 |
| 回報 | 「總獎勵」 | 從當下時間步開始的折扣回報總和 `Σ γ^t r_t`。 |
| 價值 | 「一個狀態有多好」 | 從 `s` 出發、在 `π` 下的期望回報。 |
| Q 值 | 「一個動作有多好」 | 從 `s` 出發、第一個動作是 `a`、在 `π` 下的期望回報。 |
| Bellman 方程式 | 「動態規劃的遞迴」 | 價值／Q 的不動點分解：一步獎勵，加上折扣後的後繼價值。 |
| 折扣 `γ` | 「未來對上現在」 | 加在遙遠未來獎勵上的幾何權重；有效視野 `~1/(1-γ)`。 |

## Further Reading｜延伸閱讀

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf) ——教科書。第 3 章講 MDP 和 Bellman 方程式；第 1 章說明獎勵假說，後續每一課都以它為基礎。
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) ——Bellman 方程式的源頭。
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) ——從深度 RL 角度看的精簡 MDP 入門。
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) ——作業研究裡，講 MDP 和精確解法的參考。
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://cs.brown.edu/media/filer_public/d1/a6/d1a6f66a-289a-4b81-9596-417114843489/littman.pdf) ——把 MDP 推成動態規劃的特化，最乾淨的那一份推導。
