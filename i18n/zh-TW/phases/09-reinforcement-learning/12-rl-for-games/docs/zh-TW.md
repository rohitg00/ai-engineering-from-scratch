# 遊戲上的強化學習（reinforcement learning）——AlphaZero、MuZero，與語言模型推理的時代

> 1992：TD-Gammon 用純 TD，在西洋雙陸棋上打贏人類冠軍。2016：AlphaGo 打贏李世乭。2017：AlphaZero 從零開始，在西洋棋、將棋、圍棋上勝過。2024：DeepSeek-R1 證明同一份配方——把 PPO 換成 GRPO——在推理上能運作。遊戲是這個階段每一次突破的基準（benchmark）。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 05 (DQN), Phase 9 · 08 (PPO), Phase 9 · 09 (RLHF), Phase 9 · 10 (MARL)
**Time:** ~120 minutes

## The Problem｜問題

遊戲擁有 RL 想要的一切。乾淨的獎勵（贏／輸）。無限回合（自我對弈重設）。完美模擬（遊戲*就是*模擬器）。離散，或很小的連續動作空間。多 agent 結構，能提升對抗環境中的穩健性。

而且各項重大的 RL 突破，都以遊戲作為測試場域。TD-Gammon（西洋雙陸棋，1992）。Atari-DQN（2013）。AlphaGo（2016）。AlphaZero（2017）。OpenAI Five（Dota 2，2019）。AlphaStar（StarCraft II，2019）。MuZero（學到的模型，2019）。AlphaTensor（矩陣乘法，2022）。AlphaDev（排序演算法，2023）。DeepSeek-R1（數學推理，2025）——最新一次顯示，遊戲 RL 的技術在文字上能運作。

這堂收尾課以同一個觀點統整三個里程碑架構——AlphaZero、MuZero、GRPO：**自我對弈（self-play）+ 搜尋（search）+ 策略改進**。每一個都推廣前一個方法；GRPO 尤其是把 AlphaZero 的配方用到語言模型推理上，token 是動作，數學驗證是贏的訊號（signal）。

## The Concept｜核心概念

![AlphaZero ↔ MuZero ↔ GRPO: same loop, different environments](../assets/rl-games.svg)

**把它們收進同一個迴圈。**

```
while True:
    trajectory = self_play(current_policy, search)     # play game against self
    policy_target = search.improved_policy(trajectory) # search improves raw policy
    policy_net.update(policy_target, value_target)     # supervised on search output
```

**AlphaZero（2017）。** Silver 等人。給一個規則已知的遊戲（西洋棋、將棋、圍棋）：

- 策略－價值網路：單一主幹（tower）`f_θ(s) → (p, v)`。`p` 是合法走法上的先驗（prior）。`v` 是期望的對局結果。
- 蒙地卡羅樹搜尋（Monte Carlo Tree Search，MCTS）：每一步展開可能的後續路徑樹。以 `(p, v)` 作為先驗與自助估計。用 UCB（PUCT）選節點：`a* = argmax Q(s, a) + c · p(a|s) · √N(s) / (1 + N(s, a))`。
- 自我對弈：agent 對 agent 下棋。第 `t` 步，MCTS 的造訪分布 `π_t` 成為策略的訓練目標。
- 損失：`L = (v - z)² - π · log p + c · ||θ||²`。`z` 是對局結果（+1／0／-1）。

零人類知識。零手工啟發式。同一份配方，各自經過幾千萬盤自我對弈後，就精通西洋棋、將棋、圍棋。

**MuZero（2019）。** Schrittwieser 等人。拿掉「規則已知」這個要求。

- 不靠固定環境，改學一個*潛在動態模型* `(h, g, f)`：
  - `h(s)`：把觀測編成潛在（latent）狀態。
  - `g(s_latent, a)`：預測下一個潛在狀態，加上獎勵。
  - `f(s_latent)`：預測策略先驗，加上價值。
- MCTS 跑在*學到的潛在空間（latent space）*裡。同一個搜尋，同一個訓練迴圈（training loop）。
- 圍棋、西洋棋、將棋*和* Atari 都能運作——一個演算法，不需規則知識。

**隨機 MuZero（2022）。** 加上隨機動態和機會節點（chance node）；擴展至西洋雙陸棋這一類遊戲。

**Muesli、Gumbel MuZero（2022–2024）。** 在樣本效率和確定性搜尋上的改進。

**GRPO（2024–2025）。** DeepSeek-R1 的配方。同一個 AlphaZero 式迴圈，用在語言模型推理上：

- 「遊戲」：回答一道數學／程式／推理題。「贏」= 驗證器（verifier；測試通過，或數值答案對上）回傳 1。
- 策略：那個 LLM。動作：token。狀態：prompt 加上寫到一半的回應。
- 沒有評論者（PPO 那種 V_φ）。改成對每個 prompt，從策略抽 `G` 個完成結果。各自算獎勵。用**組內相對優勢** `A_i = (r_i - mean_r) / std_r` 當 REINFORCE 式更新的訊號。
- 對參考策略的 KL 懲罰，防止漂移（和 RLHF 一樣）。
- 完整損失：

  `L_GRPO(θ) = -E_{q, {o_i}} [ (1/G) Σ_i A_i · log π_θ(o_i | q) ] + β · KL(π_θ || π_ref)`

沒有獎勵模型，沒有評論者，沒有 MCTS。組內相對基準（group-relative baseline）把這三個都換掉。推理基準上打平或勝過 PPO-RLHF 的品質，只需部分運算資源。

**完整的 R1 配方。** DeepSeek-R1（DeepSeek，2025）是一篇論文裡的兩個模型：

- **R1-Zero。** 從 DeepSeek-V3 基模型開始。沒有 SFT。直接套 GRPO，獎勵有兩塊：*正確性獎勵*（規則式——最終答案有沒有解成正確的數字／程式有沒有通過單元測試）和*格式獎勵*（完成結果有沒有把思維鏈（chain of thought）包在 `<think>…</think>` 標籤裡）。幾千步之後，平均回應長度從約 100 個 token 增至約 1 萬個，數學基準分數升至接近 o1-preview。模型從零學會推理。缺點是思維鏈常常難以閱讀、會中途換語言，文體也未經潤飾。
- **R1。** 用四階段管線改善 R1-Zero 可讀性不足的問題：
  1. **冷啟動 SFT（cold-start）。** 蒐集幾千筆格式乾淨的長思維鏈（chain-of-thought）示範。拿它們來 fine-tune 基模型。這樣有一個讀得懂的起點。
  2. **朝向推理的 GRPO。** 套 GRPO，獎勵是正確性加格式，再加一個*語言一致*獎勵，防止中途換語言。
  3. **拒絕取樣（rejection sampling）+ 第二輪 SFT。** 從 RL 檢查點抽大約 60 萬條推理軌跡（trajectory），只留最終答案正確、思維鏈讀得懂的，再混上大約 20 萬筆非推理的 SFT 例子（寫作、問答、自我認知）。再把基模型 fine-tune 一次。
  4. **全光譜 GRPO。** 再做一輪 RL，同時涵蓋推理（規則式獎勵）與一般對齊（有幫助、無害的偏好獎勵）。

結果在開放權重上，AIME 和 MATH-500 打平 o1，而且小到可以蒸餾。同一篇論文還放出六個蒸餾出來的稠密模型（從 Qwen-1.5B 到 Llama-70B），做法是以 R1 的推理軌跡作為 SFT 訓練資料——學生端不做 RL。把一個強的 RL 教師蒸餾下來，穩定優於在學生模型規模下從零做 RL。

**為什麼推理用 GRPO，不用 PPO。** DeepSeekMath 論文（2024 年 2 月）給三個理由：(1) 不用訓練價值網路，記憶體減半；(2) 組內基準自然適用於推理任務中、軌跡結尾才給的稀疏獎勵；(3) 依 prompt 正規化，讓難度差異極大的題目，優勢仍能相互比較，PPO 的單一評論者做不到。

**有搜尋與無搜尋。** 遊戲分為兩類：

- *長視野的完美資訊（perfect information）遊戲*（圍棋、西洋棋）：仍然靠搜尋。AlphaZero／MuZero 是主流。
- *語言模型推理*：正式環境裡還沒有 MCTS；GRPO 跑完整展開，推論算力用 best-of-N。過程獎勵模型（PRM）暗示，逐步搜尋會被加回來。

```figure
f3-selfplay-ladder
```

## Build It｜動手實作

`code/main.py` 裡的程式實作**縮小示範的 GRPO**——一個有多組樣本的多臂老虎機（bandit）。演算法和大語言模型上一樣；只有策略和環境比較簡單。它教的是*損失*和*組內相對優勢*，那是 2025 年的新東西。

### 步驟 1：一個很小的驗證器環境

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

真實的 GRPO 裡，驗證器跑單元測試，或檢查數學等式是否成立。

### 步驟 2：策略：每個 prompt 在 K 個答案 token 上做 softmax

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

等價於一個 LLM 在 prompt 條件下、最後一層的輸出。

### 步驟 3：組內抽樣，和組內相對優勢

```python
def grpo_step(theta, p_idx, G=8, beta=0.01, lr=0.1, rng=None):
    probs = policy_probs(theta, p_idx)
    samples = [sample(probs, rng) for _ in range(G)]
    rewards = [verify(p_idx, s) for s in samples]
    mean_r = sum(rewards) / G
    std_r = stddev(rewards) + 1e-8
    advs = [(r - mean_r) / std_r for r in rewards]

    for a, A in zip(samples, advs):
        grad = onehot(a) - probs
        for i in range(len(probs)):
            theta[p_idx][i] += lr * A * grad[i]
    # KL penalty: pull theta toward reference
    for i in range(len(probs)):
        theta[p_idx][i] -= beta * (theta[p_idx][i] - reference[p_idx][i])
```

組內相對優勢是 2024 年 DeepSeek 提出的做法。不需要評論者。「基準」是組平均，正規化用組標準差。

### 步驟 4：和 REINFORCE 基準比較（沒有價值函數）

在相同設定與運算量下，和單純的 REINFORCE 比較：GRPO 收斂更快、更穩。

### 步驟 5：看熵和 KL

診斷和 RLHF 一樣：對參考的平均 KL、策略熵、獎勵隨時間。這些指標穩定後，訓練即告完成。

## Pitfalls｜容易踩的坑

- **鑽驗證器的獎勵操弄（reward hacking）。** GRPO 繼承 RLHF 的風險：驗證器如果有錯誤或存在可利用的漏洞，LLM 就會找到那個漏洞。穩健的驗證器（多組測試、形式證明）很重要。
- **組太小。** 組基準的變異大約是 `1/√G`。低於 `G = 4`，優勢訊號雜訊就很大；標準選擇是 `G = 8` 到 `64`。
- **長度偏差。** 不同長度的 LLM 完成結果，對數機率不一樣。依 token 數正規化，或用序列層級的對數機率，或截到最大長度。
- **純自我對弈的循環。** AlphaZero 風格的訓練，在一般和遊戲上可能卡在支配循環裡。用多樣的對手池緩解（聯賽對戰，第 10 課）。
- **搜尋和策略不合。** AlphaZero 訓練策略去模仿搜尋的輸出。策略網路如果小到表示不了搜尋的分布，訓練就會停滯。
- **算力門檻。** MuZero／AlphaZero 要很大的算力。一次消融（ablation）常常是幾百個 GPU 小時。學習用的縮小示範是有的（例如在四連棋上跑 AlphaZero）。
- **驗證器覆蓋不到。** 有 bug 的解法也能通過的單元測試，會強化這個錯誤。驗證器要抓得到邊界情況。

## Use It｜實際應用

2026 年的遊戲 RL，依領域：

| 領域 | 主流方法 |
|------|----------|
| 雙人零和棋類（圍棋、西洋棋、將棋） | AlphaZero／MuZero／KataGo |
| 不完美資訊的牌類（撲克） | CFR + 深度學習（DeepStack、Libratus、Pluribus） |
| Atari／像素遊戲 | Muesli／MuZero／IMPALA-PPO |
| 大型多人策略（Dota、StarCraft） | PPO + 自我對弈 + 聯賽（OpenAI Five、AlphaStar） |
| 語言模型的數學／程式推理 | GRPO（DeepSeek-R1、Qwen-RL、開放的複現） |
| 語言模型對齊 | DPO／RLHF-PPO（不是 GRPO；驗證器是偏好，不是可驗證的） |
| 機器人 | PPO + DR（不是遊戲 RL，但用同一套策略梯度工具） |
| 組合問題 | AlphaZero 的變體（AlphaTensor、AlphaDev） |

這份*配方*——自我對弈、用搜尋加強的改進、策略蒸餾——跨過文字、像素、實體控制。GRPO 是最年輕的一個；後面還會有。

## Ship It｜交付成果

存成 `outputs/skill-game-rl-designer.md`：

```markdown
---
name: game-rl-designer
description: Design a game-RL or reasoning-RL training pipeline (AlphaZero / MuZero / GRPO) for a given domain.
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

Given a target (perfect-info game / imperfect-info / Atari / LLM reasoning / combinatorial), output:

1. Environment fit. Known rules? Markov? Stochastic? Multi-agent? Informs AlphaZero vs MuZero vs GRPO.
2. Search strategy. MCTS (PUCT with learned prior), Gumbel-sampled, best-of-N, or none.
3. Self-play plan. Symmetric self-play / league / offline data / verifier-generated.
4. Target signal. Game outcome / verifier reward / preference / learned model. Include robustness plan.
5. Diagnostics. Win rate vs baseline, ELO curve, verifier pass rate, KL to reference.

Refuse AlphaZero on imperfect-info games (route to CFR). Refuse GRPO without a trusted verifier. Refuse any game-RL pipeline without a fixed baseline opponent set (self-play ELO is uncalibrated otherwise).
```

## Exercises｜練習

1. **簡單。** 在 `code/main.py` 實作 GRPO 多臂老虎機。在 2 個 prompt、各 4 個答案 token 上訓練。用 `G=8`，不到 1 千次更新就收斂。
2. **中等。** 接上 PPO（截斷版）和原味 REINFORCE。在同一個老虎機上，和 GRPO 比樣本效率與獎勵變異。
3. **困難。** 擴成長度 2 的「推理鏈」：agent 吐出兩個 token，驗證器獎勵這一對。量 GRPO 怎麼處理兩步序列上的功勞分配。（提示：依*完整序列（full sequence）*算組優勢，再傳回兩個 token 位置。）

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| MCTS | 「使用已學得網路的樹搜尋」 | 蒙地卡羅樹搜尋；用學到的 `(p, v)` 先驗做 UCB1／PUCT 選擇。 |
| AlphaZero | 「自我對弈 + MCTS」 | 策略－價值網路，訓練去模仿 MCTS 的造訪分布與對局結果。 |
| MuZero | 「學了模型的 AlphaZero」 | 同一個迴圈，但經由學到的動態，跑在潛在空間裡。 |
| GRPO | 「沒有評論者的 PPO」 | 群組相對策略最佳化（Group Relative Policy Optimization）；帶組平均基準加 KL 的 REINFORCE。 |
| PUCT | 「AlphaZero 的 UCB」 | `Q + c · p · √N / (1 + N_a)`——在價值估計和先驗之間取平衡。 |
| 自我對弈 | 「agent 對上過去的自己」 | 零和的標準做法；訓練訊號是對稱的。 |
| 聯賽對戰 | 「以族群為本的自我對弈」 | 過去的、現在的、專攻者，都抽來當對手。 |
| 驗證器獎勵 | 「可驗證的 RL」 | 獎勵來自確定性的檢查器（測試通過、答案對上）。 |
| 過程獎勵 | 「PRM」 | 給每一步推理打分，不只看最終答案。 |

## Further Reading｜延伸閱讀

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270)。
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404)。
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4)。
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z)。
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300) ——引出 GRPO 和組內相對基準的那篇。
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) ——完整的四階段 R1 配方，加上 R1-Zero 的消融。
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400) ——大規模的 CFR 加深度學習。
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343) ——一切從這篇開始。
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer) ——用自訂獎勵函數跑 GRPO 的上線參考。
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math) ——多個規模上、對 R1 配方的開放複現。
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf) ——教科書怎麼框自我對弈、搜尋、和「設計過的獎勵」；R1 是把它做到 LLM 規模。
