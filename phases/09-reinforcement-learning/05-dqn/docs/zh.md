# 深度Q网络（Deep Q-Networks, DQN）

> 2013年：Mnih团队用原始像素训练了一个Q学习网络，在七款Atari游戏上击败了所有经典强化学习智能体。2015年：扩展到49款游戏，发表在《自然》杂志上，开启了深度强化学习时代。DQN是Q学习加上三个使函数逼近稳定的技巧。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段3 · 03（反向传播（Backpropagation）），阶段9 · 04（Q学习，SARSA）
**时间：** 约75分钟

## 问题

表格型Q学习需要为每个（状态，动作）对存储一个单独的Q值。国际象棋棋盘约有10⁴³种状态。Atari游戏画面是210×160×3 = 100,800个特征。表格型强化学习在数千个状态时就会失效，更不用说数十亿了。

事后看来，解决方案显而易见：用神经网络`Q(s, a; θ)`替换Q表。但这个"事后显而易见"花费了几十年。使用Q学习进行朴素的函数逼近会在"致命三元组"（致命三元组（Deadly Triad））——函数逼近（Function Approximation）+ 自举（Bootstrapping）+ 离策略学习（Off-Policy Learning）——下发散。Mnih等人（2013, 2015）找到了三种能够稳定学习的工程技巧：

1. **经验回放（Experience Replay）** 去相关转移样本。
2. **目标网络（Target Network）** 冻结自举目标。
3. **奖励裁剪（Reward Clipping）** 归一化梯度幅值。

Atari上的DQN是第一个使用单一架构和单一超参数集从原始像素解决数十个控制问题的方法。此后构建的所有"深度强化学习"方法——双DQN（DDQN）、彩虹（Rainbow）、决斗（Dueling）、分布（Distributional）、R2D2、Agent57——都是建立在这三个技巧的基础之上。

## 概念

![DQN训练循环：环境、回放缓冲区、在线网络、目标网络、贝尔曼TD损失](../assets/dqn.svg)

**目标函数。** DQN在神经Q函数上最小化单步TD损失：

`L(θ) = E_{(s,a,r,s')~D} [ (r + γ max_{a'} Q(s', a'; θ^-) - Q(s, a; θ))² ]`

`θ` = 在线网络，每步通过梯度下降更新。`θ^-` = 目标网络，每约10,000步从`θ`复制。`D` = 过去转移样本的回放缓冲区。

**三个技巧，按重要性排序：**

**经验回放。** 一个约10⁶个转移样本的环形缓冲区。每个训练步骤均匀随机采样一个小批量。这打破了时间相关性（连续帧几乎相同），让网络多次从稀有的奖励转移中学习，并去相关连续的梯度更新。如果没有它，在策略TD与神经网络在Atari上会发散。

**目标网络。** 在贝尔曼方程两边使用同一个网络`Q(·; θ)`会使目标每步都移动——"追自己的尾巴"。解决方法：保留第二个网络`Q(·; θ^-)`，其权重冻结。每`C`步，复制`θ → θ^-`。这使回归目标在数千个梯度步骤中保持稳定。软更新`θ^- ← τ θ + (1-τ) θ^-`（用于DDPG、SAC）是一种更平滑的变体。

**奖励裁剪。** Atari奖励幅度从1到1000+不等。裁剪到`{-1, 0, +1}`可以防止任何单个游戏主导梯度。当奖励幅度重要时是错误的；对于Atari来说，只有符号重要，所以没问题。

**双DQN。** Hasselt（2016）修复了最大化偏差：使用在线网络来选择动作，使用目标网络来评估它。

`target = r + γ Q(s', argmax_{a'} Q(s', a'; θ); θ^-)`

直接替换，效果始终更好。默认情况下使用它。

**其他改进（Rainbow，2017）：** 优先回放（更频繁地采样高TD误差的转移）、决斗架构（分离`V(s)`和优势头）、噪声网络（学习探索）、n步回报、分布Q（C51/QR-DQN）、多步自举。每个改进提升几个百分点，增益大致可加。

## 构建它

这里的代码是只使用标准库、不依赖numpy的——我们使用手动实现的单隐藏层MLP在一个小型连续网格世界上运行，因此每个训练步骤只需微秒。算法与大规模Atari DQN相同。

### 步骤1：回放缓冲区

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

Atari约为50,000容量；对于我们的玩具环境，5,000就足够了。

### 步骤2：小型Q网络（手动MLP）

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

### 步骤3：DQN更新

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

其形式与第四课中的Q学习相同，但有两个区别：(a) 我们通过可微的`Q(·; θ)`进行反向传播，而不是索引表格；(b) 目标使用`Q(·; θ^-)`。

### 步骤4：外层循环

每个回合，根据`Q(·; θ)`执行ε-贪心动作，将转移样本推入缓冲区，采样一个小批量，进行梯度更新，定期同步`θ^- ← θ`。模式如下：

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

在我们的小型网格世界上，使用16维独热状态，智能体在约500回合后学会接近最优策略。在Atari上，将这个规模扩展到2亿帧并添加CNN特征提取器。

## 陷阱

- **致命三元组（Deadly Triad）。** 函数逼近 + 离策略 + 自举可能导致发散。DQN通过目标网络和回放来缓解；不要移除两者中的任何一个。
- **探索。** ε必须衰减，通常在前约10%的训练中从1.0衰减到0.01。如果没有足够的前期探索，Q网络会收敛到局部盆地。
- **过高估计。** 对噪声Q取`max`会有向上偏差。生产环境中始终使用双DQN。
- **奖励尺度。** 裁剪或归一化奖励；梯度的幅度与奖励幅度成正比。
- **回放缓冲区冷启动。** 在缓冲区有几千个转移样本之前不要训练。基于约20个样本的早期梯度会导致过拟合。
- **目标同步频率。** 太频繁 ≈ 没有目标网络；太不频繁 ≈ 目标陈旧。Atari DQN使用10,000个环境步。经验法则：大约每训练范围的1/100同步一次。
- **观察预处理。** Atari DQN堆叠4帧使状态符合马尔可夫性质。任何包含速度信息的环境都需要帧堆叠或循环状态。

## 使用它

在2026年，DQN很少是最先进的，但仍然是离策略算法的参考：

| 任务 | 首选方法 | 为什么不用DQN？ |
|------|----------|----------------|
| 离散动作Atari类环境 | Rainbow DQN 或 Muesli | 相同框架，更多技巧。 |
| 连续控制 | SAC / TD3（阶段9 · 07） | DQN没有策略网络。 |
| 在策略 / 高吞吐量 | PPO（阶段9 · 08） | 没有回放缓冲区；更容易扩展。 |
| 离线强化学习 | CQL / IQL / Decision Transformer | 保守的Q目标，没有自举爆炸。 |
| 大型离散动作空间（推荐系统） | 带动作嵌入的DQN，或IMPALA | 可以；装饰很重要。 |
| 大语言模型强化学习 | PPO / GRPO | 序列级别，不是步级别；不同的损失。 |

这些经验仍然适用。回放和目标网络出现在SAC、TD3、DDPG、SAC-X、AlphaZero的自博弈缓冲区以及所有离线强化学习方法中。奖励裁剪以PPO中优势归一化的形式存在。这个架构就是蓝图。

## 发布它

保存为 `outputs/skill-dqn-trainer.md`：

```markdown
---
name: dqn-trainer
description: 为离散动作强化学习任务生成DQN训练配置（缓冲区、目标同步、ε调度、奖励裁剪）。
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

给定一个离散动作环境（观察形状、动作数量、训练周期、奖励尺度），输出：

1. 网络。架构（MLP / CNN / Transformer）、特征维度、深度。
2. 回放缓冲区。容量、小批量大小、预热大小。
3. 目标网络。同步策略（硬复制每隔C步或软更新τ）。
4. 探索。ε起始值/结束值/调度长度。
5. 损失。Huber vs MSE、梯度裁剪值、奖励裁剪规则。
6. 双DQN。默认开启，除非有明确的理由禁用。

拒绝发布没有目标网络、没有回放缓冲区或ε保持为1的DQN。拒绝连续动作任务（引导到SAC / TD3）。标记任何每步奖励范围超过10倍均值的情况，需要裁剪或尺度归一化。
```

## 练习

1. **简单。** 运行 `code/main.py`。绘制每回合回报曲线。需要多少个回合直到运行均值超过-10？
2. **中等。** 禁用目标网络（使用在线网络作为贝尔曼目标的两侧）。测量训练不稳定性——回报是否振荡或发散？
3. **困难。** 添加双DQN：使用在线网络选择 `argmax a'`，目标网络评估。在带有噪声奖励的网格世界上，比较有/无双DQN的情况下，1000回合后 `Q(s_0, best_a)` 与真实 `V*(s_0)` 的偏差。

## 关键术语

| 术语 | 人们常说的意思 | 实际含义 |
|------|----------------|----------|
| DQN | "深度Q学习" | 具有神经Q函数、回放缓冲区和目标网络的Q学习。 |
| 经验回放 | "打乱的转移样本" | 每次梯度步骤均匀采样的环形缓冲区；去相关数据。 |
| 目标网络 | "冻结的自举" | 用于贝尔曼目标中Q的定期副本；稳定训练。 |
| 致命三元组 | "为什么强化学习发散" | 函数逼近 + 自举 + 离策略 = 没有收敛保证。 |
| 双DQN | "修复最大化偏差" | 在线网络选择动作，目标网络评估它。 |
| 决斗DQN | "V和A头" | 将Q分解为V + A - mean(A)；相同输出，更好的梯度流动。 |
| 彩虹 | "所有技巧" | 双DQN + 优先回放 + 决斗 + n步 + 噪声 + 分布，集于一身。 |
| 优先回放 | "优先回放" | 根据TD误差幅度按比例采样转移样本。 |

## 进一步阅读

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) —— 2013年NeurIPS workshop论文，开启了深度强化学习。
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) —— 《自然》杂志论文，49款游戏的DQN。
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) —— 双DQN。
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581) —— 决斗DQN。
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298) —— 堆叠技巧的论文。
- [OpenAI Spinning Up — DQN](https://spinningup.openai.com/en/latest/algorithms/dqn.html) —— 清晰的现代阐释。
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) —— 教科书对"致命三元组"（函数逼近 + 自举 + 离策略）的处理，DQN的目标网络和回放缓冲区正是为了驯服它而设计的。
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) —— 用于消融研究的参考单文件DQN；与本节课的从头实现版本一起阅读效果很好。