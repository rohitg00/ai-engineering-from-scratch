# 深度Q网络 (DQN)

> 2013年:Mnih在原始像素上训练了一种Q学习网络,在七款Atari游戏中击败了每一个经典RL代理. 2015年:扩展到49个游戏,发表在Nature上,引发了深度RL时代.DQN是Q学习加上三个技巧,使函数近似稳定.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 04 (Q-learning, SARSA)
**Time:** ~75 minutes

## 问题

图表 Q-学习需要每个 (状态,行动) 双的单独Q-值.棋牌板上有1043个状态.阿塔利框架为210×160×3 =100800个特征.图表 RL在数千个状态中死亡,更不用说数十亿.

后面看来,解决方案很明显:用神经网络取代Q表,$Q(s, a; \theta)$,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,

1. **Experience replay**调整过渡.
2. **Target network**结了启动线的目标.
3. **Reward clipping**它们的度大小是正常化的.

亚塔利的DQN是唯一一个架构的首次,一个单一的超参数组解决了数十个控制问题.从 DDQN,彩虹,双斗,分销,R2D2,Agent57 以来构建的所有"深度RL"都堆叠在这个三招基础上.

## 概念

![DQN training loop: env, replay buffer, online net, target net, Bellman TD loss](../assets/dqn.svg)

**The objective.**通过 DQN 降低神经 Q 函数的单步 TD 损失:

```math
L(\theta) = \mathbb{E}_{(s,a,r,s') \sim D}[ (r + \gamma \max_{a'} Q(s', a'; \theta^-) - Q(s, a; \theta))^2 ]
```

$\theta$网络,每一步都会随着梯度下降更新.$\theta^-$网址: 网址: 网址: 网址: 网址:$\theta$它们的位置是很小的.$D$= 过去的过渡的重播缓冲器.

**The three tricks, in order of importance:**

**Experience replay.**的环保器`~10⁶`通过此,网络可以从罕见的有益转型中学习,并将连续的梯度更新进行调整.没有它,在政策上,TD与神经网络分离在Atari上.

**Target network.**通过同一个网络$Q(\cdot; \theta)$通过Bellman方程的两侧,目标每次更新都会移动 "追逐自己的尾巴".$Q(\cdot; \theta^-)$结的重量.$C$步骤,复制$\theta \to \theta^-$这使得反归目标稳定,$\theta^- \leftarrow \tau \theta + (1-\tau) \theta^-$(用于DDPG,SAC) 是一个更平滑的变体.

**Reward clipping.**亚塔利奖励大小从1到1000+之间.$\lbrace-1, 0, +1 \rbrace$错误的是奖励大小重要,但Atari只需要签字.

**Double DQN.**哈塞尔特 (2016) 修复了最大化偏见:使用在线网络来*选择*行动,目标网络来*评估*它.

```math
\text{target} = r + \gamma Q(s', \arg\max_{a'} Q(s', a'; \theta); \theta^-)
```

随时更好,默认使用.

**Other improvements (Rainbow, 2017):**优先重播 (样本高TD错误过渡更多),对决架构 (分开 $V(s)$它们的数量和优势是多少? 它们的数量和优势是多少?

```figure
f3-dqn-stability
```

## 建立它

我们使用一个手动滚动的单层隐藏MLP在一个微小的连续 GridWorld,所以每个训练步骤运行在微秒.算法是相同的阿塔利DQN规模.

### 步骤1:重播缓冲器

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

作为原始DQN,Atari的容量为106次 (学习开始之前收集5万次转型);我们的玩具环境5000次.

### 步骤2:一个小的Q网络 (手动MLP)

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

线性 → 线性 → 线性.

### 步骤3:DQN更新

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

形状是从04课程中学习Q,有两个区别:$Q(\cdot; \theta)$目标使用的方法$Q(\cdot; \theta^-)$现在,我们要去.

### 步骤4:外环

对于每一集,都做一个贪的行为.$Q(\cdot; \theta)$按,按,按,按,按,按,按,按.$\theta^- \leftarrow \theta$模式:

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

在我们的小小的GridWorld中,有16维的单热状态,代理在500集中学习了近乎最佳的政策.在Atari上,将这扩大到200万个框架,并添加一个CNN特色提取器.

## 陷

- **Deadly triad.**函数近似+非政策+启动可能会分歧.DQN通过目标网+重播减轻;不要删除任何一个.
- **Exploration.**由于网的度较高,而网的度较高,所以网的度较高.
- **Overestimation.** `max`总是使用双DQN在生产中.
- **Reward scale.**剪辑或正常化奖励;梯度大小与奖励大小相对.
- **Replay buffer coldstart.**在缓冲器有几千次过渡之前不要训练.
- **Target sync frequency.**太频繁 ≈ 没有目标网;太少 ≈ 过时目标. 雅塔利 DQN 使用10,000个env步骤. 指规则:每1/100个训练视野同步.
- **Observation preprocessing.**任何具有速度信息的环境都需要框架堆或复发状态.

## 用它

在2026年,DQN很少是最先进的,但仍然是参考的非政策算法:

| Task | Method of choice | Why not DQN? |
|------|------------------|--------------|
| Discrete-action Atari-like | Rainbow DQN or Muesli | Same framework, more tricks. |
| Continuous control | SAC / TD3 (Phase 9 · 07) | DQN has no policy network. |
| On-policy / high-throughput | PPO (Phase 9 · 08) | No replay buffer; easier to scale. |
| Offline RL | CQL / IQL / Decision Transformer | Conservative Q targets, no bootstrapping blowups. |
| Large discrete action spaces (recommender) | DQN with action embedding, or IMPALA | Fine; decoration matters. |
| LLM RL | PPO / GRPO | Sequence-level, not step-level; different loss. |

课程仍然在进行.重播和目标网络出现在SAC,TD3,DDPG,SAC-X,AlphaZero的自动播放缓冲器和每个离线RL方法中.奖励剪辑作为PPO中的优势正常化继续存在.架构是蓝图.

## 运送它

保存如`outputs/skill-dqn-trainer.md`其他:

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

## 运动

1. **Easy.**跑步`code/main.py`运行平均值超过 -10之前,多少集?
2. **Medium.**禁用目标网络 (使用网络网络对贝尔曼目标的两侧). 测量训练不稳定性?
3. **Hard.**添加双DQN:使用网上网来选择`argmax a'`分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,分析,`Q(s_0, best_a)`实际情况$V^{\ast}(s_0)$在一个杂的奖励格里德世界上,

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DQN | "Deep Q-learning" | Q-learning with a neural Q-function, replay buffer, and target network. |
| Experience replay | "Shuffled transitions" | Ring buffer sampled uniformly each gradient step; decorrelates data. |
| Target network | "Frozen bootstrap" | Periodic copy of Q used in the Bellman target; stabilizes training. |
| Deadly triad | "Why RL diverges" | Function approximation + bootstrapping + off-policy = no convergence guarantee. |
| Double DQN | "Fix for maximization bias" | Online net selects action, target net evaluates it. |
| Dueling DQN | "V and A heads" | Decompose Q = V + A - mean(A); same output, better gradient flow. |
| Rainbow | "All the tricks" | DDQN + PER + dueling + n-step + noisy + distributional in one. |
| PER | "Prioritized Replay" | Sample transitions proportional to TD-error magnitude. |

## 进一步阅读

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602)2013年"NeurIPS"研讨会论文,
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236)"自然"论文,49场DQN.
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) DDQN
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581)     
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298)堆的刺纸.
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf)教科书处理"致命三位一体" (函数接近+启动+非政策) 目标网络和DQN的重播缓冲器旨在制.
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/)用于除研究的参考单档DQN;好在此课程的从头开始版本旁边阅读.
