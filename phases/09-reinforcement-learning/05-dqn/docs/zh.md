# 05 · 深度 Q 网络（DQN）

> 2013 年：Mnih 在原始像素上训练了一个 Q-learning 网络，在七款 Atari 游戏上击败了所有经典强化学习智能体。2015 年：扩展到 49 款游戏，发表于《Nature》，开启了深度强化学习时代。DQN 就是 Q-learning 加上三个让函数逼近变得稳定的小技巧。

**类型：** 构建
**语言：** Python
**前置：** 阶段 3 · 03（反向传播）、阶段 9 · 04（Q-learning、SARSA）
**时长：** 约 75 分钟

## 问题所在

表格型 Q-learning（tabular Q-learning）需要为每一个（状态，动作）对单独存储一个 Q 值。一个国际象棋棋盘有约 10⁴³ 种状态。一帧 Atari 画面是 210×160×3 = 100,800 个特征。表格型强化学习在数千个状态时就崩溃了，更别提数十亿个状态。

事后看修复方法显而易见：把 Q 表换成一个神经网络 `Q(s, a; θ)`。但这个"事后显而易见"的方法花了几十年才出现。把朴素的函数逼近（function approximation）与 Q-learning 结合会发散，原因在于"致命三要素（deadly triad）"——函数逼近 + 自举（bootstrapping）+ 离策略学习（off-policy learning）。Mnih 等人（2013、2015）识别出三个能稳定学习的工程技巧：

1. **经验回放（experience replay）** 去除转移之间的相关性。
2. **目标网络（target network）** 冻结自举目标。
3. **奖励裁剪（reward clipping）** 归一化梯度幅度。

DQN 在 Atari 上的表现，是单一架构搭配单一超参数集，首次从原始像素出发解决了数十个控制问题。此后所有"深度强化学习"的成果——DDQN、Rainbow、Dueling、Distributional、R2D2、Agent57——都是在这三技巧基座之上叠加的。

## 核心概念

〔图：DQN 训练循环——环境、回放缓冲、在线网络、目标网络、贝尔曼 TD 损失〕

**优化目标。** DQN 在神经 Q 函数上最小化单步 TD 损失：

`L(θ) = E_{(s,a,r,s')~D} [ (r + γ max_{a'} Q(s', a'; θ^-) - Q(s, a; θ))² ]`

`θ` = 在线网络（online network），每一步通过梯度下降更新。`θ^-` = 目标网络，周期性地从 `θ` 复制而来（约每 10,000 步一次）。`D` = 存储过往转移的回放缓冲（replay buffer）。

**三个技巧，按重要性排序：**

**经验回放。** 一个容纳约 `10⁶` 条转移的环形缓冲区。每个训练步从中均匀随机采样一个小批量（minibatch）。这打破了时间相关性（相邻帧几乎完全相同），让网络能多次从稀有的奖励转移中学习，并去除连续梯度更新之间的相关性。没有它，神经网络的在线策略（on-policy）TD 会在 Atari 上发散。

**目标网络。** 在贝尔曼方程两侧使用同一个网络 `Q(·; θ)`，会让目标随每次更新而移动——就像"追着自己的尾巴跑"。修复方法：维护第二个权重冻结的网络 `Q(·; θ^-)`。每隔 `C` 步，把 `θ → θ^-` 复制一次。这能在每次数千个梯度步内稳定回归目标。软更新（soft update）`θ^- ← τ θ + (1-τ) θ^-`（在 DDPG、SAC 中使用）是一种更平滑的变体。

**奖励裁剪。** Atari 的奖励幅度从 1 到 1000 以上不等。裁剪到 `{-1, 0, +1}` 可以防止任何单个游戏主导梯度。当奖励幅度本身重要时这样做是错的；但对 Atari 这种只有符号重要的场景没问题。

**双重 DQN（Double DQN）。** Hasselt（2016）修复了最大化偏差（maximization bias）：用在线网络来*选择*动作，用目标网络来*评估*它。

`target = r + γ Q(s', argmax_{a'} Q(s', a'; θ); θ^-)`

可直接替换，效果稳定更优。建议默认使用。

**其他改进（Rainbow，2017）：** 优先经验回放（prioritized replay，更多地采样高 TD 误差的转移）、对决架构（dueling architecture，分离 `V(s)` 头和优势头）、噪声网络（noisy networks，习得式探索）、n 步回报（n-step returns）、分布式 Q（distributional Q，C51/QR-DQN）、多步自举。每一项各带来几个百分点的提升；这些增益大致可叠加。

## 动手构建

这里的代码只用标准库、不依赖 numpy——我们在一个微型连续 GridWorld 上手写了一个单隐藏层 MLP，因此每个训练步在微秒级内完成。这套算法与规模化的 Atari DQN 完全一致。

### 第 1 步：回放缓冲

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

Atari 用约 50,000 容量；我们的玩具环境用 5,000 就够了。

### 第 2 步：一个微型 Q 网络（手写 MLP）

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

前向传播：linear → ReLU → linear。这就是整个网络。

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

其形态就是第 04 课的 Q-learning，但有两处不同：(a) 我们通过一个可微的 `Q(·; θ)` 进行反向传播，而不是去索引一张表；(b) 目标使用 `Q(·; θ^-)`。

### 第 4 步：外层循环

每个回合中，按 ε-贪婪（ε-greedy）在 `Q(·; θ)` 上行动，把转移推入缓冲，采样一个小批量，做一次梯度步，并周期性地同步 `θ^- ← θ`。模式如下：

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

在我们这个使用 16 维 one-hot 状态的微型 GridWorld 上，智能体约 500 个回合就能学到接近最优的策略。在 Atari 上，把它扩展到 2 亿帧，并加一个 CNN 特征提取器即可。

## 常见陷阱

- **致命三要素。** 函数逼近 + 离策略 + 自举可能发散。DQN 用目标网络 + 回放来缓解；二者都不要去掉。
- **探索。** ε 必须衰减，通常在训练前约 10% 的过程中从 1.0 降到 0.01。早期探索不足时，Q 网络会收敛到一个局部盆地。
- **过估计。** 对带噪声的 Q 取 `max` 会产生向上的偏差。生产环境中务必使用双重 DQN。
- **奖励尺度。** 裁剪或归一化奖励；梯度幅度与奖励幅度成正比。
- **回放缓冲冷启动。** 缓冲区中尚未累积几千条转移之前不要训练。在约 20 个样本上做的早期梯度会过拟合。
- **目标同步频率。** 太频繁 ≈ 没有目标网络；太不频繁 ≈ 目标陈旧。Atari DQN 使用 10,000 个环境步。经验法则：约每训练周期的 1/100 同步一次。
- **观测预处理。** Atari DQN 堆叠 4 帧以使状态满足马尔可夫性。任何包含速度信息的环境都需要帧堆叠或循环状态。

## 实战应用

在 2026 年，DQN 很少再是当前最优（state-of-the-art），但它仍是离策略算法的参照基准：

| 任务 | 首选方法 | 为什么不用 DQN？ |
|------|------------------|--------------|
| 离散动作的类 Atari 任务 | Rainbow DQN 或 Muesli | 同一框架，更多技巧。 |
| 连续控制 | SAC / TD3（阶段 9 · 07） | DQN 没有策略网络。 |
| 在线策略 / 高吞吐 | PPO（阶段 9 · 08） | 无回放缓冲；更易扩展。 |
| 离线强化学习 | CQL / IQL / Decision Transformer | 保守 Q 目标，无自举爆炸。 |
| 大规模离散动作空间（推荐系统） | 带动作嵌入的 DQN，或 IMPALA | 可行；细节装饰很重要。 |
| LLM 强化学习 | PPO / GRPO | 序列级而非步级；损失不同。 |

这些经验仍然适用。回放与目标网络出现在 SAC、TD3、DDPG、SAC-X、AlphaZero 的自对弈缓冲，以及每一种离线强化学习方法中。奖励裁剪以 PPO 中的优势归一化（advantage normalization）形式延续下来。这套架构就是蓝图。

## 交付产物

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

1. **简单。** 运行 `code/main.py`。绘制每回合回报曲线。运行平均值超过 -10 需要多少个回合？
2. **中等。** 禁用目标网络（在贝尔曼目标两侧都使用在线网络）。测量训练不稳定性——回报是震荡还是发散？
3. **困难。** 加入双重 DQN：用在线网络挑选 `argmax a'`，用目标网络评估。在一个带噪声奖励的 GridWorld 上，分别在使用与不使用双重 DQN 的情况下训练 1,000 个回合后，比较 `Q(s_0, best_a)` 相对于真实 `V*(s_0)` 的偏差。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| DQN | "深度 Q-learning" | 带神经 Q 函数、回放缓冲与目标网络的 Q-learning。 |
| 经验回放 | "打乱的转移" | 每个梯度步均匀采样的环形缓冲；去除数据相关性。 |
| 目标网络 | "冻结的自举" | 用于贝尔曼目标的 Q 的周期性副本；稳定训练。 |
| 致命三要素 | "强化学习为何发散" | 函数逼近 + 自举 + 离策略 = 无收敛保证。 |
| 双重 DQN | "最大化偏差的修复" | 在线网络选动作，目标网络评估它。 |
| 对决 DQN | "V 头与 A 头" | 分解 Q = V + A - mean(A)；输出相同，梯度流更好。 |
| Rainbow | "所有技巧" | DDQN + PER + dueling + n-step + noisy + distributional 合而为一。 |
| PER | "优先回放" | 按 TD 误差幅度成比例地采样转移。 |

## 延伸阅读

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) —— 开启深度强化学习的 2013 年 NeurIPS workshop 论文。
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) —— 《Nature》论文，49 款游戏的 DQN。
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) —— DDQN。
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581) —— 对决 DQN。
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298) —— 技巧叠加论文。
- [OpenAI Spinning Up — DQN](https://spinningup.openai.com/en/latest/algorithms/dqn.html) —— 清晰的现代讲解。
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) —— 教科书对"致命三要素"（函数逼近 + 自举 + 离策略）的论述，而 DQN 的目标网络与回放缓冲正是为驯服它而设计。
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) —— 用于消融研究的参考单文件 DQN 实现；适合与本课的从零实现对照阅读。
