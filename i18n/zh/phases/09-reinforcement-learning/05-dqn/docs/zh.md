# 深度 Q 网络（DQN）

> 2013 年：Mnih 在原始像素上训练了一个 Q-learning 网络，在七款 Atari 游戏上击败了所有经典 RL 智能体。2015 年：扩展到 49 款游戏，发表于《Nature》，开启了深度 RL 时代。DQN 就是 Q-learning 加上三个使函数逼近稳定的技巧。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 03（反向传播），Phase 9 · 04（Q-learning、SARSA）
**Time:** 约 75 分钟

## 问题所在

表格型 Q-learning 需要为每个（状态，动作）对维护一个独立的 Q 值。一个国际象棋棋盘约有 10⁴³ 个状态。一帧 Atari 画面是 210×160×3 = 100,800 个特征。表格型 RL 在几千个状态时就撑不住了，更不用说数十亿了。

事后看来，解决办法显而易见：用神经网络替换 Q 表，`Q(s, a; θ)`。但这个“显而易见”花了几十年。在“致命三要素”下——函数逼近 + 自举 + 离策略学习——朴素地用函数逼近配合 Q-learning 会发散。Mnih 等人（2013, 2015）找出了三个使学习稳定的工程技巧：

1. **经验回放** 去除转移之间的相关性。
2. **目标网络** 冻结自举目标。
3. **奖励裁剪** 归一化梯度幅值。

DQN 在 Atari 上的成功，是首次让单一架构、单一超参数配置从原始像素解决数十个控制问题。此后所有“深度 RL”的成果——DDQN、Rainbow、Dueling、Distributional、R2D2、Agent57——都建立在这个三技巧基础之上。

## 核心概念

![DQN training loop: env, replay buffer, online net, target net, Bellman TD loss](../assets/dqn.svg)

**目标。** DQN 在神经 Q 函数上最小化单步 TD 损失：

`L(θ) = E_{(s,a,r,s')~D} [ (r + γ max_{a'} Q(s', a'; θ^-) - Q(s, a; θ))² ]`

`θ` = 在线网络，每一步都通过梯度下降更新。`θ^-` = 目标网络，定期从 `θ` 复制（约每 10,000 步）。`D` = 存放历史转移的回放缓冲区。

**三个技巧，按重要性排序：**

**经验回放。** 一个容量为 `~10⁶` 的环形缓冲区。每次训练步骤均匀随机采样一个小批量。这打破了时间相关性（相邻帧几乎相同），让网络能多次从稀有的有奖励转移中学习，并去除了连续梯度更新之间的相关性。没有它，在 Atari 上用神经网络做在策略 TD 会发散。

**目标网络。** 在 Bellman 方程两侧使用同一个网络 `Q(·; θ)` 会让目标随每次更新而移动——“追着自己的尾巴跑”。解决办法：保留第二个权重冻结的网络 `Q(·; θ^-)`。每 `C` 步，复制 `θ → θ^-`。这使得回归目标在一次同步之间能稳定数千个梯度步骤。软更新 `θ^- ← τ θ + (1-τ) θ^-`（用于 DDPG、SAC）是其更平滑的变体。

**奖励裁剪。** Atari 奖励幅值从 1 到 1000+ 不等。裁剪到 `{-1, 0, +1}` 可以防止任何单一游戏主导梯度。当奖励幅值重要时这是错的；对 Atari 这种只有符号重要的场景则没问题。

**Double DQN。** Hasselt（2016）修复了最大化偏差：用在线网络*选择*动作，用目标网络*评估*该动作。

`target = r + γ Q(s', argmax_{a'} Q(s', a'; θ); θ^-)`

即插即用的替换，效果始终更好。默认使用它。

**其他改进（Rainbow, 2017）：** 优先级回放（更多采样高 TD 误差的转移）、dueling 架构（分离 `V(s)` 与优势头）、noisy 网络（可学习的探索）、n-step 回报、分布 Q（C51/QR-DQN）、多步自举。每项带来几个百分点的提升，且大致可叠加。

```figure
f3-dqn-stability
```

## 动手实现

这里的代码仅用标准库、不依赖 numpy——我们在一个小型连续 GridWorld 上使用手写的单隐层 MLP，因此每个训练步骤只需微秒级时间。算法与大规模的 Atari DQN 完全一致。

### 第 1 步：回放缓冲区

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

Atari 需要约 50,000 容量；我们的玩具环境 5,000 就够了。

### 第 2 步：一个小型 Q 网络（手写 MLP）

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

前向传播：线性 → ReLU → 线性。这就是整个网络。

### 第 3 步：DQN 更新

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

结构与第 04 课的 Q-learning 相同，只有两处不同：(a) 我们通过可微的 `Q(·; θ)` 做反向传播，而不是索引一张表；(b) 目标使用 `Q(·; θ^-)`。

### 第 4 步：外层循环

对每个 episode，在 `Q(·; θ)` 上执行 ε-greedy 动作，把转移推入缓冲区，采样一个小批量，做一次梯度更新，定期同步 `θ^- ← θ`。模式如下：

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

在我们的 16 维 one-hot 状态的小型 GridWorld 上，智能体在约 500 个 episode 内学得近似最优策略。在 Atari 上，把它扩展到 2 亿帧，并加上 CNN 特征提取器。

## 常见陷阱

- **致命三要素。** 函数逼近 + 离策略 + 自举可能发散。DQN 用目标网络 + 回放来缓解；不要移除其中任何一个。
- **探索。** ε 必须衰减，通常在训练前约 10% 内从 1.0 降到 0.01。早期探索不足时，Q 网络会收敛到局部盆地。
- **过高估计。** 对带噪声的 Q 取 `max` 是向上偏置的。生产环境务必使用 Double DQN。
- **奖励尺度。** 裁剪或归一化奖励；梯度幅值与奖励幅值成正比。
- **回放缓冲区冷启动。** 缓冲区积累几千条转移之前不要训练。仅对约 20 个样本做的早期梯度会过拟合。
- **目标网络同步频率。** 太频繁 ≈ 没有目标网络；太不频繁 ≈ 目标过时。Atari DQN 每 10,000 个环境步同步一次。经验法则：每约训练总时长的 1/100 同步一次。
- **观测预处理。** Atari DQN 堆叠 4 帧以使状态满足马尔可夫性。任何带速度信息的环境都需要帧堆叠或循环状态。

## 应用场景

在 2026 年，DQN 很少是最先进的，但仍是离策略算法的参照基准：

| 任务 | 首选方法 | 为什么不用 DQN？ |
|------|------------------|--------------|
| 离散动作的 Atari 类任务 | Rainbow DQN 或 Muesli | 同一框架，技巧更多。 |
| 连续控制 | SAC / TD3（Phase 9 · 07） | DQN 没有策略网络。 |
| 在策略 / 高吞吐 | PPO（Phase 9 · 08） | 无回放缓冲区；更易扩展。 |
| 离线 RL | CQL / IQL / Decision Transformer | 保守的 Q 目标，没有自举爆炸。 |
| 大型离散动作空间（推荐系统） | 带动作嵌入的 DQN，或 IMPALA | 可以；关键在于修饰。 |
| LLM RL | PPO / GRPO | 序列级而非单步级；损失不同。 |

这些经验仍然通用。回放和目标网络出现在 SAC、TD3、DDPG、SAC-X、AlphaZero 的自我对弈缓冲区以及所有离线 RL 方法中。奖励裁剪以 PPO 中优势归一化的形式延续至今。这个架构就是蓝图。

## 交付

保存为 `outputs/skill-dqn-trainer.md`：

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

## 练习

1. **简单。** 运行 `code/main.py`。绘制每个 episode 的回报曲线。多少个 episode 后滑动平均值超过 -10？
2. **中等。** 禁用目标网络（Bellman 目标两侧都用在线网络）。测量训练的不稳定性——回报是振荡还是发散？
3. **困难。** 加入 Double DQN：用在线网络选取 `argmax a'`，用目标网络评估。在有噪声奖励的 GridWorld 上，比较使用与不使用 Double DQN 时，1,000 个 episode 后 `Q(s_0, best_a)` 相对真实 `V*(s_0)` 的偏差。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| DQN | “深度 Q-learning” | 带神经 Q 函数、回放缓冲区和目标网络的 Q-learning。 |
| 经验回放 | “打乱后的转移” | 每个梯度步骤均匀采样的环形缓冲区；去除数据相关性。 |
| 目标网络 | “冻结的自举” | Bellman 目标中使用的 Q 的定期副本；稳定训练。 |
| 致命三要素 | “RL 为什么发散” | 函数逼近 + 自举 + 离策略 = 无收敛保证。 |
| Double DQN | “最大化偏差的修复” | 在线网络选择动作，目标网络评估它。 |
| Dueling DQN | “V 与 A 两个头” | 分解 Q = V + A - mean(A)；输出相同，梯度流更好。 |
| Rainbow | “所有技巧” | DDQN + PER + dueling + n-step + noisy + distributional 合为一体。 |
| PER | “优先级回放” | 按 TD 误差幅值成比例地采样转移。 |

## 延伸阅读

- [Mnih 等人（2013）。Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) — 开启深度 RL 的 2013 年 NeurIPS workshop 论文。
- [Mnih 等人（2015）。Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) — 《Nature》论文，49 款游戏的 DQN。
- [Hasselt, Guez, Silver（2016）。Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) — DDQN。
- [Wang 等人（2016）。Dueling Network Architectures](https://arxiv.org/abs/1511.06581) — dueling DQN。
- [Hessel 等人（2018）。Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298) — 技巧叠加论文。
- [OpenAI Spinning Up — DQN](https://spinningup.openai.com/en/latest/algorithms/dqn.html) — 清晰的现代阐述。
- [Sutton & Barto（2018）。第 9 章 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) — 关于“致命三要素”（函数逼近 + 自举 + 离策略）的教科书式论述，DQN 的目标网络与回放缓冲区正是为驯服它而设计的。
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) — 消融实验中使用的单文件参考 DQN 实现，适合与本课的从零实现对照阅读。