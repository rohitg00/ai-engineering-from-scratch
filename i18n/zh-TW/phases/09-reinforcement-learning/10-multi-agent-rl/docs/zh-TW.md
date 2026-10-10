# 多 agent 強化學習（multi-agent RL）

> 單 agent 的 RL 假設環境是平穩的。把兩個正在學習的 agent 放進同一個世界，此假設不再成立：每個 agent 都是對方環境的一部分，而且兩邊都在變。多 agent RL 是一套技巧，讓馬可夫假設不再成立時，學習還能收斂。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 04 (Q-learning), Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~45 minutes

## The Problem｜問題

機器人學著在房間裡走，是單 agent 的 RL 問題。一支足球隊不是。AlphaStar 對上 StarCraft 的對手不是。一群出價 agent 的市場不是。兩輛車在四向停車的路口協商誰先走，也不是。很多真實世界的多對多問題都不是。

在每個多 agent 設定裡，從任何一個 agent 來看，其他 agent *就是*環境的一部分。他們學習、改變行為，環境就變成非定態（non-stationary）的。馬可夫性質（Markov property）——「下一個狀態只依賴現在的狀態和我的動作」——被打破，因為下一個狀態也依賴*其他* agent 選了什麼，而他們的策略（policy）是持續變動的目標。

這打破表格式收斂證明（Q-learning 的保證假設環境平穩）。單純的深度 RL 同樣會失效：agent 互相追逐，無法收斂到穩定策略。你需要多 agent 專用的技術：集中訓練（centralized training）／分散執行（decentralized execution）、反事實基準（counterfactual baseline）、聯賽對戰（league play）、自我對弈（self-play）。

2026 年的應用：機器人群、交通路由、自駕車隊、市場模擬器、多 agent 的 LLM 系統（第 16 階段），以及任何超過一個智慧玩家的遊戲。

## The Concept｜核心概念

![Four MARL regimes: indep, centralized critic, self-play, league](../assets/marl.svg)

**形式化：馬可夫賽局（Markov game）。** MDP 的推廣：狀態 `S`、聯合動作（joint action） `a = (a_1, …, a_n)`、轉移 `P(s' | s, a)`，以及每個 agent 的獎勵 `R_i(s, a, s')`。每個 agent `i` 在自己的策略 `π_i` 下，最大化自己的回報。獎勵相同，就是**完全合作（fully cooperative）**。零和，就是**對抗**。混合，就是**一般和（general-sum）**。

**核心難題：**

- **非定態。** 從 agent `i` 的角度看，`P(s' | s, a_i)` 依賴正在改變的 `π_{-i}`。
- **功勞分配（credit assignment）。** 獎勵是共享的，如何將其歸因於個別 agent？
- **探索的協調。** agent 必須探索互補的策略，不要重複探索同一個狀態。
- **可擴展性。** 聯合動作空間隨 `n` 指數長大。
- **部分可觀測。** 每個 agent 只看得到自己的觀測；全域狀態無法直接觀測。

**四種主流體制：**

**1. 獨立 Q-learning／獨立 PPO（IQL、IPPO）。** 每個 agent 學自己的 Q 或策略，把其他人當成環境的一部分。單純，有時有效（尤其經驗重放可用來緩和對手策略變動的影響）。理論上沒有收斂保證。實務上：鬆耦合的任務還可以，緊耦合的很糟。

**2. 集中訓練、分散執行（centralized training, decentralized execution，CTDE）。** 現代最常見的範式。每個 agent 有自己的*策略* `π_i`，只看局部觀測 `o_i`——部署時就是標準的分散執行。*訓練*期間，集中式評論者 `Q(s, a_1, …, a_n)` 看完整的全域狀態和聯合動作。例子：
- **MADDPG**（Lowe 等人，2017）：每個 agent 一個集中式評論者的 DDPG。
- **COMA**（Foerster 等人，2017）：反事實基準（counterfactual baseline）——問「如果我改走動作 `a'`，獎勵會是多少？」——把我的貢獻隔離出來。
- **MAPPO**／帶共享評論者的 **IPPO**（Yu 等人，2022）：帶集中式價值函數的 PPO。2026 年合作式 MARL 的主流。
- **QMIX**（Rashid 等人，2018）：價值分解（value decomposition）——`Q_tot(s, a) = f(Q_1(s, a_1), …, Q_n(s, a_n))`，混合是單調的。

**3. 自我對弈（self-play）。** 同一個 agent 的兩個副本互相對戰。對手的策略*就是*我過去某個快照的策略。AlphaGo／AlphaZero／MuZero。OpenAI Five。零和遊戲最好用；訓練訊號是對稱的。

**4. 聯賽對戰（league play）。** 把自我對弈推到一般和／對抗環境：保留過去與目前的策略族群，從聯賽中抽一個對手來打。再加上專攻者（exploiter，專門打當前最強）和主專攻者（main exploiter，專門打專攻者）。AlphaStar（StarCraft II）。遊戲會出現「剪刀石頭布」策略循環時，就需要這個。

**溝通。** 允許 agent 彼此傳遞學得的訊息 `m_i`。合作設定裡有用。Foerster 等人（2016）顯示，可微的 agent 間溝通可以端到端訓練。今天以 LLM 為基礎的多 agent 系統（第 16 階段）本質上是用自然語言溝通。

```figure
f3-marl-orbit
```

## Build It｜動手實作

這一課用 6×6 的 GridWorld，兩個合作的 agent。他們從對角開始，要到達同一個目標。共享獎勵：任一個還在移動，每步 `-1`；兩個都到了，`+10`。見 `code/main.py`。

### 步驟 1：多 agent 環境

```python
class CoopGridWorld:
    def __init__(self):
        self.size = 6
        self.goal = (5, 5)

    def reset(self):
        return ((0, 0), (5, 0))  # two agents

    def step(self, state, actions):
        a1, a2 = state
        new1 = move(a1, actions[0])
        new2 = move(a2, actions[1])
        done = (new1 == self.goal) and (new2 == self.goal)
        reward = 10.0 if done else -1.0
        return (new1, new2), reward, done
```

*聯合*動作空間是 `|A|² = 16`。全域狀態是兩個位置。

### 步驟 2：獨立 Q-learning

每個 agent 跑自己的 Q 表，鍵是聯合狀態。每一步：兩者都挑 ε-貪婪動作，蒐集聯合轉移，各自用共享獎勵更新自己的 Q。

```python
def independent_q(env, episodes, alpha, gamma, epsilon):
    Q1, Q2 = defaultdict(default_q), defaultdict(default_q)
    for _ in range(episodes):
        s = env.reset()
        while not done:
            a1 = epsilon_greedy(Q1, s, epsilon)
            a2 = epsilon_greedy(Q2, s, epsilon)
            s_next, r, done = env.step(s, (a1, a2))
            target1 = r + gamma * max(Q1[s_next].values())
            target2 = r + gamma * max(Q2[s_next].values())
            Q1[s][a1] += alpha * (target1 - Q1[s][a1])
            Q2[s][a2] += alpha * (target2 - Q2[s][a2])
            s = s_next
```

這個任務能運作，因為獎勵密、而且彼此對齊。緊耦合的任務會失敗（例如其中一個 agent 必須*等*另一個）。

### 步驟 3：集中式 Q，用分解後的價值來更新

用一個蓋在聯合動作上的 Q，`Q(s, a_1, a_2)`。用共享獎勵更新。執行時用邊緣化來分散：`π_i(s) = argmax_{a_i} max_{a_{-i}} Q(s, a_1, a_2)`。以指數成長的聯合動作空間為代價，換取*正確*的全域視角。

### 步驟 4：簡單的自我對弈（對抗的雙 agent）

同一個 agent，兩個角色。用 agent A 打 agent B；`K` 個回合之後，把 A 的權重複製進 B。對稱訓練，進度一致。縮小版的 AlphaZero 配方。

## 容易踩的坑

- **非定態的重放。** 獨立 agent 的經驗重放比單 agent 更糟，因為舊轉移是現在已經過時的對手產生的。解法：重新標註，或依新近程度加權。
- **功勞分配含糊。** 長回合之後才給共享獎勵，說不清哪個 agent 有貢獻。解法：反事實基準（COMA），或依 agent 塑形獎勵。
- **策略漂移／互相追。** 每個 agent 的最佳回應都跟著對方的更新在變。解法：集中式評論者、放慢學習率，或一次只凍結一個。
- **協同式獎勵操弄。** agent 找出設計者沒料到的協同漏洞。拍賣 agent 收斂到出價零。解法：小心設計獎勵，加上行為限制條件。
- **探索重複。** 兩個 agent 探索同一組狀態－動作配對。解法：每個 agent 自己的熵獎勵，或依角色調節。
- **聯賽循環。** 純自我對弈可能卡在支配循環裡。解法：用多樣對手的聯賽對戰。
- **樣本爆炸。** `n` 個 agent × 狀態空間 × 聯合動作。用函數近似來應對；動作空間分解（每個 agent 一個策略輸出頭）。

## Use It｜實際應用

2026 年的 MARL 應用地圖：

| 領域 | 方法 | 筆記 |
|------|------|------|
| 合作導航／操作 | MAPPO／QMIX | CTDE；共享評論者 + 分散的行動者。 |
| 雙人遊戲（西洋棋、圍棋、撲克） | 帶 MCTS 的自我對弈（AlphaZero） | 零和；對稱訓練。 |
| 複雜多人（Dota、StarCraft） | 聯賽對戰 + 模仿預訓練 | OpenAI Five、AlphaStar。 |
| 自駕車隊 | 帶注意力的 CTDE MAPPO／PPO | 部分觀測；隊伍大小會變。 |
| 拍賣市場 | 賽局均衡 + RL | `n` → ∞ 時用平均場（mean-field）RL。 |
| LLM 多 agent 系統（第 16 階段） | 自然語言溝通 + 角色調節 | RL 迴圈在 agent 規劃那一層。 |

2026 年，MARL 成長最快的是以 LLM 為基礎的：一群語言模型 agent 在協商、辯論、寫軟體。RL 出現在*軌跡層級*輸出的偏好調校，不是 token 層級（第 16 階段 · 03）。

## Ship It｜交付成果

存成 `outputs/skill-marl-architect.md`：

```markdown
---
name: marl-architect
description: Pick the right multi-agent RL regime (IPPO, CTDE, self-play, league) for a given task.
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

Given a task with `n` agents, output:

1. Regime classification. Cooperative / adversarial / general-sum. Justify.
2. Algorithm. IPPO / MAPPO / QMIX / self-play / league. Reason tied to coupling tightness and reward structure.
3. Information access. Centralized training (what global info goes to the critic)? Decentralized execution?
4. Credit assignment. Counterfactual baseline, value decomposition, or reward shaping.
5. Exploration plan. Per-agent entropy, population-based training, or league.

Refuse independent Q-learning on tightly-coupled cooperative tasks. Refuse to recommend self-play for general-sum with cycle risks. Flag any MARL pipeline without a fixed-opponent eval (cherry-picked self-play numbers are common).
```

## Exercises｜練習

1. **簡單。** 在雙 agent 合作 GridWorld 上訓練獨立 Q-learning。平均回報大於 0 要幾個回合？畫聯合學習曲線（learning curve）。
2. **中等。** 加一個「協調」任務：兩個 agent 必須在同一回合踏上目標，才算到達。獨立 Q 是否仍能收斂？問題出在哪裡？
3. **困難。** 為 MAPPO 風格的訓練實作集中式評論者，在協調任務上和獨立 PPO 比收斂速度。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 馬可夫賽局 | 「多 agent 的 MDP」 | `(S, A_1, …, A_n, P, R_1, …, R_n)`；每個 agent 有自己的獎勵。 |
| CTDE | 「集中訓練、分散執行」 | 訓練時用聯合評論者；每個 agent 的策略只用局部觀測。 |
| IPPO | 「獨立 PPO」 | 每個 agent 各自跑 PPO。單純的基準；常常被低估。 |
| MAPPO | 「多 agent PPO」 | 帶集中式價值函數、以全域狀態為條件的 PPO。 |
| QMIX | 「單調價值分解」 | `Q_tot = f_monotone(Q_1, …, Q_n)`，因此可以分散地做 argmax。 |
| COMA | 「反事實多 agent」 | 優勢 = 我的 Q，減掉把我的動作邊緣化之後的期望 Q。 |
| 自我對弈 | 「agent 對上過去的自己」 | 一個 agent、兩個角色；零和遊戲的標準做法。 |
| 聯賽對戰 | 「族群訓練」 | 把過去的策略存起來，從池子裡抽對手；處理策略循環。 |

## Further Reading｜延伸閱讀

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) ——帶集中式評論者的 CTDE。
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) ——功勞分配用的反事實基準。
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) ——帶單調性的價值分解。
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955) ——PPO 在 MARL 中的表現出人意料地好。
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) ——大規模的聯賽對戰。
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) ——零和遊戲裡的純自我對弈。
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) ——教科書對多 agent 設定和非定態問題的短處理；CTDE 就是為了處理這個問題而提出的。
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) ——涵蓋合作、競爭、混合 MARL 和收斂結果的綜述。
