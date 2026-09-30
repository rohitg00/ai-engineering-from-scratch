# 深度 Q 網路（DQN）

> 2013 年：Mnih 用原始像素訓練了一個 Q-learning 網路，在七款 Atari 遊戲上打敗了所有古典強化學習代理程式。2015 年：擴展到 49 款遊戲，登上 Nature，點燃了深度強化學習的時代。DQN 就是 Q-learning 加上三個讓函數近似穩定下來的技巧。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 3 · 03（反向傳播）、階段 9 · 04（Q-learning、SARSA）
**時間：** 約 75 分鐘

## 問題所在

表格式 Q-learning 得為每一組（狀態, 動作）配一個獨立的 Q 值。一盤西洋棋大約有 10⁴³ 個狀態。一張 Atari 畫面是 210×160×3 = 100,800 個特徵。表格式強化學習在幾千個狀態就撐不住了，更別說幾十億個。

事後看來解法很明顯：把 Q 表換成一個神經網路 `Q(s, a; θ)`。但這個「事後很明顯」花了數十年。天真地把函數近似接到 Q-learning 上會發散，原因就是「致命三要素」——函數近似 + 自助法 + 異策略學習。Mnih et al.（2013、2015）點出了三個能穩住學習的工程技巧：

1. **經驗回放**讓轉移之間去相關。
2. **目標網路**把自助目標凍結住。
3. **獎勵裁剪**把梯度大小正規化。

Atari 上的 DQN 是史上第一次，單一架構配上單一組超參數，就從原始像素解掉了數十個控制問題。從那之後所有「深度強化學習」的東西——DDQN、Rainbow、Dueling、Distributional、R2D2、Agent57——都疊在這個三技巧的地基上。

## 核心概念

![DQN 訓練迴圈：環境、回放緩衝區、線上網路、目標網路、貝爾曼 TD 損失](../assets/dqn.svg)

**目標函式。** DQN 在一個神經 Q 函式上最小化單步 TD 損失：

`L(θ) = E_{(s,a,r,s')~D} [ (r + γ max_{a'} Q(s', a'; θ^-) - Q(s, a; θ))² ]`

`θ` = 線上網路，每一步都用梯度下降更新。`θ^-` = 目標網路，週期性地從 `θ` 複製過來（大約每 10,000 步一次）。`D` = 存放過往轉移的回放緩衝區。

**三個技巧，依重要性排序：**

**經驗回放。** 一個容納 `~10⁶` 筆轉移的環形緩衝區。每個訓練步都均勻隨機抽一個小批次。這打斷了時間上的相關性（相鄰的畫面幾乎一模一樣），讓網路能從罕見的有獎勵轉移上反覆學習，也讓連續的梯度更新之間去相關。少了它，同策略 TD 配神經網路在 Atari 上會發散。

**目標網路。** 貝爾曼方程兩邊都用同一個網路 `Q(·; θ)`，會讓目標每次更新都在移動——「追著自己的尾巴跑」。解法是：另外留一個權重凍結的網路 `Q(·; θ^-)`。每 `C` 步，把 `θ → θ^-` 複製一次。這讓回歸目標一次能穩定上千個梯度步。軟更新 `θ^- ← τ θ + (1-τ) θ^-`（DDPG、SAC 在用）則是比較平滑的變體。

**獎勵裁剪。** Atari 的獎勵量級從 1 到 1000 以上都有。裁剪到 `{-1, 0, +1}` 可以避免任何單一遊戲主宰梯度。當獎勵的量級本身有意義時這樣做是錯的；但 Atari 只有正負號有意義，所以沒問題。

**Double DQN。** Hasselt（2016）修掉了最大化偏差：用線上網路來*選*動作，用目標網路來*評估*它。

`target = r + γ Q(s', argmax_{a'} Q(s', a'; θ); θ^-)`

可以直接替換上去，而且穩定地更好。預設就用它。

**其他改進（Rainbow，2017）：** 優先回放（TD 誤差大的轉移抽多一點）、對決架構（把 `V(s)` 與優勢拆成兩個頭）、雜訊網路（把探索學出來）、n 步回報、分布式 Q（C51/QR-DQN）、多步自助。每一項各加個幾個百分點；而且增益大致可以疊加。

```figure
f3-dqn-stability
```

## 動手實作

這裡的程式碼只用標準函式庫、不用 numpy——我們在一個很小的連續 GridWorld 上手刻一個單隱藏層 MLP，所以每個訓練步都在微秒等級跑完。演算法跟大規模的 Atari DQN 完全相同。

### 步驟 1：回放緩衝區

```python
class ReplayBuffer:
    def __init__(self, capacity):
        self.buf = []
        self.capacity = capacity
    def push(self, s, a, r, s_next, done):
        if len(self.buf) == self.capacity:
            self.buf.pop(0)
        self.buf.append((s, a, r, s_next, done))
    def sample(self, batch, rng):
        return rng.sample(self.buf, batch)
```

Atari 大約要 50,000 的容量；我們的玩具環境 5,000 就夠了。

### 步驟 2：一個小小的 Q 網路（手刻 MLP）

```python
class QNet:
    def __init__(self, n_in, n_hidden, n_actions, rng):
        self.W1 = [[rng.gauss(0, 0.3) for _ in range(n_in)] for _ in range(n_hidden)]
        self.b1 = [0.0] * n_hidden
        self.W2 = [[rng.gauss(0, 0.3) for _ in range(n_hidden)] for _ in range(n_actions)]
        self.b2 = [0.0] * n_actions
    def forward(self, x):
        h = [max(0.0, sum(w * xi for w, xi in zip(row, x)) + b) for row, b in zip(self.W1, self.b1)]
        q = [sum(w * hi for w, hi in zip(row, h)) + b for row, b in zip(self.W2, self.b2)]
        return q, h
```

前向傳遞：linear → ReLU → linear。整個網路就這樣。

### 步驟 3：DQN 的更新

```python
def train_step(online, target, batch, gamma, lr):
    grads = zeros_like(online)
    for s, a, r, s_next, done in batch:
        q, h = online.forward(s)
        if done:
            y = r
        else:
            q_next, _ = target.forward(s_next)
            y = r + gamma * max(q_next)
        td_error = q[a] - y
        accumulate_grads(grads, online, s, h, a, td_error)
    apply_sgd(online, grads, lr / len(batch))
```

形狀跟單元 04 的 Q-learning 一樣，差別有兩點：(a) 我們是對一個可微分的 `Q(·; θ)` 做反向傳播，而不是去查表；(b) 目標用的是 `Q(·; θ^-)`。

### 步驟 4：外層迴圈

每個回合裡，對 `Q(·; θ)` 採 ε-貪婪行動，把轉移推進緩衝區，抽一個小批次，走一個梯度步，並週期性地同步 `θ^- ← θ`。模式如下：

```python
for episode in range(N):
    s = env.reset()
    while not done:
        a = epsilon_greedy(online, s, epsilon)
        s_next, r, done = env.step(s, a)
        buffer.push(s, a, r, s_next, done)
        if len(buffer) >= batch:
            train_step(online, target, buffer.sample(batch), gamma, lr)
        if steps % sync_every == 0:
            target = copy(online)
        s = s_next
```

在我們這個用 16 維 one-hot 表示狀態的小 GridWorld 上，代理程式大約 500 個回合就能學到接近最優的策略。放到 Atari，就是把它擴到 2 億幀，再加上一個 CNN 特徵抽取器。

## 常見陷阱

- **致命三要素。** 函數近似 + 異策略 + 自助法有可能發散。DQN 靠目標網路加回放來緩解；兩者都不能拿掉。
- **探索。** ε 一定要衰減，典型做法是在訓練前 10% 左右從 1.0 降到 0.01。前期探索不夠，Q 網路就會收斂進一個局部盆地。
- **高估。** 對帶雜訊的 Q 取 `max` 會往上偏。上線環境一律用 Double DQN。
- **獎勵尺度。** 把獎勵裁剪或正規化；梯度的大小跟獎勵的大小成正比。
- **回放緩衝區冷啟動。** 緩衝區裡沒有幾千筆轉移之前不要開始訓練。只靠 20 筆樣本算出來的早期梯度會過度擬合。
- **目標同步頻率。** 太頻繁 ≈ 等於沒有目標網路；太不頻繁 ≈ 目標過期。Atari DQN 用的是 10,000 個環境步。經驗法則：每訓練期程的 1/100 左右同步一次。
- **觀測預處理。** Atari DQN 會疊 4 幀，好讓狀態具備馬可夫性。任何帶速度資訊的環境都需要疊幀或遞迴狀態。

## 框架應用

到了 2026 年，DQN 很少還是最先進的方法，但它仍是異策略演算法的參考基準：

| 任務 | 首選方法 | 為什麼不用 DQN？ |
|------|------------------|--------------|
| 離散動作、Atari 類 | Rainbow DQN 或 Muesli | 同一套框架，技巧更多。 |
| 連續控制 | SAC / TD3（階段 9 · 07） | DQN 沒有策略網路。 |
| 同策略／高吞吐量 | PPO（階段 9 · 08） | 不需要回放緩衝區；比較好擴展。 |
| 離線強化學習 | CQL / IQL / Decision Transformer | 保守的 Q 目標，不會被自助法炸開。 |
| 大型離散動作空間（推薦系統） | 帶動作嵌入的 DQN，或 IMPALA | 可行；細節的雕琢才是關鍵。 |
| LLM 的強化學習 | PPO / GRPO | 序列層級而非單步層級；損失函式不一樣。 |

但這些教訓還是通用的。回放與目標網路出現在 SAC、TD3、DDPG、SAC-X、AlphaZero 的自我對弈緩衝區，以及每一種離線強化學習方法裡。獎勵裁剪則以 PPO 裡的優勢正規化形式活了下來。這個架構就是藍圖。

## 產出交付

存成 `outputs/skill-dqn-trainer.md`：

```markdown
---
name: dqn-trainer
description: Produce a DQN training config (buffer, target sync, ε schedule, reward clipping) for a discrete-action RL task.
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

Given a discrete-action environment (observation shape, action count, horizon, reward scale), output:

1. Network. Architecture (MLP / CNN / Transformer), feature dim, depth.
2. Replay buffer. Capacity, minibatch size, warmup size.
3. Target network. Sync strategy (hard every C steps or soft τ).
4. Exploration. ε start / end / schedule length.
5. Loss. Huber vs MSE, gradient clip value, reward clipping rule.
6. Double DQN. On by default unless explicit reason to disable.

Refuse to ship a DQN with no target network, no replay buffer, or ε held at 1. Refuse continuous-action tasks (route to SAC / TD3). Flag any reward range > 10× per-step mean as needing clipping or scale normalization.
```

## 練習

1. **簡單。** 跑 `code/main.py`。畫出每回合回報的曲線。要幾個回合，移動平均才會超過 -10？
2. **中等。** 把目標網路關掉（貝爾曼目標兩邊都用線上網路）。量一下訓練的不穩定程度——回報會震盪還是發散？
3. **困難。** 加上 Double DQN：用線上網路挑 `argmax a'`，用目標網路做評估。在一個獎勵帶雜訊的 GridWorld 上跑 1,000 個回合，比較有沒有 Double DQN 時 `Q(s_0, best_a)` 相對於真實 `V*(s_0)` 的偏差。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| DQN | 「深度 Q-learning」 | 帶神經 Q 函式、回放緩衝區與目標網路的 Q-learning。 |
| 經驗回放 | 「打散過的轉移」 | 每個梯度步都均勻抽樣的環形緩衝區；讓資料去相關。 |
| 目標網路 | 「凍結的自助」 | 用在貝爾曼目標裡的 Q 的週期性副本；穩定訓練。 |
| 致命三要素 | 「強化學習為什麼會發散」 | 函數近似 + 自助法 + 異策略 = 沒有收斂保證。 |
| Double DQN | 「最大化偏差的修正」 | 線上網路選動作，目標網路評估它。 |
| Dueling DQN | 「V 與 A 兩個頭」 | 把 Q 拆成 Q = V + A - mean(A)；輸出相同，梯度流更好。 |
| Rainbow | 「所有技巧全上」 | DDQN + PER + dueling + n 步 + 雜訊 + 分布式，一次到位。 |
| PER | 「優先回放」 | 依 TD 誤差的大小按比例抽樣轉移。 |

## 延伸閱讀

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) —— 掀起深度強化學習浪潮的 2013 年 NeurIPS workshop 論文。
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) —— Nature 那篇，49 款遊戲的 DQN。
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) —— DDQN。
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581) —— dueling DQN。
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298) —— 把技巧疊起來的那篇。
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) —— 教科書對「致命三要素」（函數近似 + 自助法 + 異策略）的處理，而 DQN 的目標網路與回放緩衝區正是為了馴服它而設計的。
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) —— 消融研究常用的單檔 DQN 參考實作；適合搭配本單元的從零實作一起讀。
