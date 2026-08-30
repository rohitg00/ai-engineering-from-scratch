# 深度 Q 网络（DQN）

> 2013 年：Mnih 用一个 Q-learning 网络在原始像素上训练，在七个 Atari 游戏上击败了所有经典 RL 智能体。2015 年：扩展到 49 个游戏，发表在 Nature 上，开启了深度 RL 时代。DQN 是 Q-learning 加上三个使函数近似稳定的技巧。

**类型：** 构建
**语言：** Python
**前置知识：** 第三阶段 · 03（反向传播），第九阶段 · 04（Q-learning、SARSA）
**时间：** ~75 分钟

## 问题

表格 Q-learning 需要为每个（状态，动作）对存储一个单独的 Q 值。一个国际象棋棋盘有约 10⁴³ 个状态。一帧 Atari 图像是 210×160×3 = 100,800 个特征。表格 RL 在数千个状态时就失效了，更不用说数十亿个。

修复方法在事后看来是显而易见的：用神经网络替换 Q 表，`Q(s, a; θ)`。但"事后看来显而易见"花了数十年。朴素的 Q-learning 函数近似在"致命三元组"——函数近似 + 自举 + 离线策略学习——下会发散。Mnih 等人（2013、2015）确定了三个稳定学习的工程技巧：

1. **经验回放** 去相关转移。
2. **目标网络** 冻结自举目标。
3. **奖励裁剪** 归一化梯度幅度。

Atari 上的 DQN 是第一次，单一架构用单一超参数集解决了来自原始像素的数十个控制问题。此后构建的所有"深度 RL"——DDQN、Rainbow、Dueling、Distributional、R2D2、Agent57——都是在这个三技巧基础之上堆叠的。

## 概念

![DQN 训练循环：环境、回放缓冲区、在线网络、目标网络、贝尔曼 TD 损失](../assets/dqn.svg)

**目标。** DQN 最小化神经 Q 函数上的单步 TD 损失：

`L(θ) = E_{(s,a,r,s')~D} [ (r + γ max_{a'} Q(s', a'; θ^-) - Q(s, a; θ))² ]`

`θ` = 在线网络，每步通过梯度下降更新。`θ^-` = 目标网络，定期从 `θ` 复制（约每 10,000 步）。`D` = 过去转移的回放缓冲区。

**三个技巧，按重要性排序：**

**经验回放。** 约 `10⁶` 个转移的环形缓冲区。每个训练步骤均匀随机采样一个小批量。这打破了时间相关性（连续帧几乎相同），让网络多次从稀有奖励转移中学习，并去相关连续梯度更新。没有它，在线策略 TD 与神经网络在 Atari 上会发散。

**目标网络。** 在贝尔曼方程两边使用同一个网络 `Q(·; θ)` 会使目标每次更新都移动——"追着自己的尾巴跑"。修复方法：保留第二个网络 `Q(·; θ^-)` 并冻结权重。每 `C` 步复制 `θ → θ^-`。这稳定了数千个梯度步骤的回归目标。软更新 `θ^- ← τ θ + (1-τ) θ^-`（DDPG、SAC 中使用）是更平滑的变体。

**奖励裁剪。** Atari 奖励幅度从 1 到 1000+ 不等。裁剪到 `{-1, 0, +1}` 阻止任何单个游戏主导梯度。当奖励幅度重要时这是错误的；对 Atari 没问题，因为只有符号重要。

**双 DQN。** Hasselt（2016）修复最大化偏差：使用在线网络*选择*动作，目标网络*评估*它。

`target = r + γ Q(s', argmax_{a'} Q(s', a'; θ); θ^-)`

即插即用，始终更好。默认使用它。

**其他改进（Rainbow，2017）：** 优先回放（更多地采样高 TD 误差转移）、Dueling 架构（分离 `V(s)` 和优势头）、噪声网络（学习到的探索）、n 步回报、分布式 Q（C51/QR-DQN）、多步自举。每个增加几个百分点；收益大致是可加的。

## 构建

这里的代码是仅标准库的 numpy-free 版本——我们在一个微小的连续 GridWorld 上使用手写的单隐藏层 MLP，因此每个训练步骤在微秒内运行。算法与大规模 Atari DQN 相同。

### 第一步：回放缓冲区

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

Atari 约 50,000 容量；我们的玩具环境 5,000 就够了。

### 第二步：一个微小的 Q 网络（手动 MLP）

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

### 第三步：DQN 更新

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

形状是第 04 课的 Q-learning，有两个区别：(a) 我们通过可微的 `Q(·; θ)` 反向传播，而不是索引表，(b) 目标使用 `Q(·; θ^-)`。

### 第四步：外层循环

对于每个回合，在 `Q(·; θ)` 上执行 ε-贪婪，将转移推入缓冲区，采样小批量，采取梯度步，定期同步 `θ^- ← θ`。模式：

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

在我们的微小 GridWorld 上，使用 16 维 one-hot 状态，智能体在约 500 回合内学习接近最优的策略。在 Atari 上，将其扩展到 2 亿帧并添加 CNN 特征提取器。

## 陷阱

- **致命三元组。** 函数近似 + 离线策略 + 自举可能发散。DQN 用目标网络 + 回放来缓解；不要移除任何一个。
- **探索。** ε 必须衰减，通常从 1.0 到 0.01，在前 ~10% 的训练过程中。没有足够的早期探索，Q 网络会收敛到局部盆地。
- **高估。** 对噪声 Q 的 `max` 向上偏差。生产中始终使用双 DQN。
- **奖励尺度。** 裁剪或归一化奖励；梯度幅度与奖励幅度成正比。
- **回放缓冲区冷启动。** 在缓冲区有几千个转移之前不要训练。~20 个样本上的早期梯度会过拟合。
- **目标同步频率。** 太频繁 ≈ 没有目标网络；太不频繁 ≈ 陈旧目标。Atari DQN 使用 10,000 环境步。经验法则：每约训练视界的 1/100 同步一次。
- **观察预处理。** Atari DQN 堆叠 4 帧以使状态马尔可夫。任何有速度信息的环境都需要帧堆叠或循环状态。

## 应用

在 2026 年，DQN 很少是最先进的，但仍然是参考离线策略算法：

| 任务 | 首选方法 | 为什么不用 DQN？ |
|------|------------------|--------------|
| 离散动作 Atari 类 | Rainbow DQN 或 Muesli | 相同框架，更多技巧。 |
| 连续控制 | SAC / TD3（第九阶段 · 07） | DQN 没有策略网络。 |
| 在线策略 / 高吞吐 | PPO（第九阶段 · 08） | 没有回放缓冲区；更容易扩展。 |
| 离线 RL | CQL / IQL / Decision Transformer | 保守 Q 目标，没有自举爆炸。 |
| 大型离散动作空间（推荐） | 带动作嵌入的 DQN，或 IMPALA | 没问题；装饰很重要。 |
| LLM RL | PPO / GRPO | 序列级别，不是步级别；不同的损失。 |

经验教训仍然适用。回放和目标网络出现在 SAC、TD3、DDPG、SAC-X、AlphaZero 的自对弈缓冲区以及每个离线 RL 方法中。奖励裁剪作为 PPO 中的优势归一化继续存在。架构是蓝图。

## 交付

保存为 `outputs/skill-dqn-trainer.md`：

```markdown
---
name: dqn-trainer
description: 为离散动作 RL 任务生成 DQN 训练配置（缓冲区、目标同步、ε 时间表、奖励裁剪）。
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

给定一个离散动作环境（观察形状、动作数量、视界、奖励尺度），输出：

1. 网络。架构（MLP / CNN / Transformer）、特征维度、深度。
2. 回放缓冲区。容量、小批量大小、预热大小。
3. 目标网络。同步策略（每 C 步硬同步或软 τ）。
4. 探索。ε 起始 / 结束 / 时间表长度。
5. 损失。Huber vs MSE、梯度裁剪值、奖励裁剪规则。
6. 双 DQN。默认开启，除非有明确理由关闭。

拒绝交付没有目标网络、没有回放缓冲区或 ε 保持为 1 的 DQN。拒绝连续动作任务（路由到 SAC / TD3）。标记任何奖励范围 > 10× 每步均值的需要裁剪或尺度归一化。
```

## 练习

1. **简单。** 运行 `code/main.py`。绘制每回合回报曲线。运行均值超过 -10 需要多少回合？
2. **中等。** 禁用目标网络（对贝尔曼目标的两边使用在线网络）。测量训练不稳定性——回报是否振荡或发散？
3. **困难。** 添加双 DQN：使用在线网络选择 `argmax a'`，目标网络评估。在有噪声奖励的 GridWorld 上，比较有无双 DQN 的 `Q(s_0, best_a)` 与真实 `V*(s_0)` 的偏差。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| DQN | "深度 Q-learning" | 带有神经 Q 函数、回放缓冲区和目标网络的 Q-learning。 |
| 经验回放 | "打乱的转移" | 每个梯度步骤均匀采样的环形缓冲区；去相关数据。 |
| 目标网络 | "冻结的自举" | Q 的定期复制用于贝尔曼目标；稳定训练。 |
| 致命三元组 | "为什么 RL 发散" | 函数近似 + 自举 + 离线策略 = 没有收敛保证。 |
| 双 DQN | "最大化偏差的修复" | 在线网络选择动作，目标网络评估它。 |
| Dueling DQN | "V 和 A 头" | 分解 Q = V + A - mean(A)；相同输出，更好的梯度流。 |
| Rainbow | "所有技巧" | DDQN + PER + dueling + n-step + 噪声 + 分布式合一。 |
| PER | "优先回放" | 按 TD 误差幅度比例采样转移。 |

## 延伸阅读

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) — 开启深度 RL 的 2013 年 NeurIPS 研讨会论文。
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) — Nature 论文，49 游戏 DQN。
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) — DDQN。
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581) — Dueling DQN。
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298) — 堆叠技巧论文。
- [OpenAI Spinning Up — DQN](https://spinningup.openai.com/en/latest/algorithms/dqn.html) — 清晰的现代阐述。
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) — DQN 的目标网络和回放缓冲区旨在驯服的"致命三元组"（函数近似 + 自举 + 离线策略）的教科书处理。
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) — 消融研究中使用的参考单文件 DQN；与本课的从零开始版本一起阅读很好。
