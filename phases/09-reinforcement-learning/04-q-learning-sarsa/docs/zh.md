# 时序差分 — Q-Learning 与 SARSA

> 蒙特卡洛（Monte Carlo）等待回合结束。时序差分通过自举下一个价值估计，每步后都进行更新。Q-learning 是离策略（off-policy）且乐观的；SARSA 是在策略（on-policy）且谨慎的。两者都只需一行代码。两者都是本阶段所有深度强化学习方法的基础。

**类型：** 构建
**语言：** Python
**先修知识：** 第9阶段 · 01（马尔可夫决策过程），第9阶段 · 02（动态规划），第9阶段 · 03（蒙特卡洛）
**时间：** 约75分钟

## 问题

蒙特卡洛方法有效，但它有两个昂贵的需求。它需要能够终止的回合，并且只在最终回报确定后才进行更新。如果你的回合有1000步，蒙特卡洛会等待1000步才进行任何更新。在实践中，它具有高方差、低偏差且速度慢的特点。

动态规划则具有相反的特性——零方差的自举备份——但需要已知模型。

时序差分（Temporal Difference, TD）学习折中了两者。从单个转换 `(s, a, r, s')` 出发，形成一个单步目标 `r + γ V(s')`，并将 `V(s)` 向该目标调整。无需模型，无需完整回合。由于在右侧使用近似 `V` 而产生偏差，但方差比蒙特卡洛低得多，并且从第一步就开始在线更新。

这是所有现代强化学习——DQN、A2C、PPO、SAC——的支点。第9阶段的其余部分都是基于本课程将要编写的单步TD更新的函数近似层和技巧。

## 概念

![Q-learning vs SARSA: 离策略最大值 vs 在策略 Q(s', a')](../assets/td.svg)

**V的TD(0)更新：**

`V(s) ← V(s) + α [r + γ V(s') - V(s)]`

方括号中的量是TD误差 `δ = r + γ V(s') - V(s)`。它是蒙特卡洛中 `G_t - V(s_t)` 的在线对应物。收敛需要满足Robbins-Monro条件（`Σ α = ∞`，`Σ α² < ∞`）并且所有状态都被无限次访问。

**Q-learning。** 一种用于控制的离策略TD方法：

`Q(s, a) ← Q(s, a) + α [r + γ max_{a'} Q(s', a') - Q(s, a)]`

`max` 假设从 `s'` 开始将遵循*贪婪*（greedy）策略，无论智能体实际采取什么行动。这种解耦使Q-learning能够在智能体通过ε-贪婪探索的同时学习 `Q*`。Mnih等人（2015）将其转换为Atari上的深度Q学习（课程05）。

**SARSA。** 一种在策略TD方法：

`Q(s, a) ← Q(s, a) + α [r + γ Q(s', a') - Q(s, a)]`

名称是元组 `(s, a, r, s', a')`。SARSA使用智能体*实际*接下来采取的动作 `a'`，而不是贪婪的 `argmax`。收敛到当前运行的ε-贪婪策略 `π` 的 `Q^π`，在极限 `ε → 0` 时变为 `Q*`。

**悬崖行走差异。** 在经典的悬崖行走任务中（掉下悬崖=奖励-100），Q-learning学习沿着悬崖边缘的最优路径，但在探索过程中偶尔会接受惩罚。SARSA学习距离悬崖一步的安全路径，因为它将探索噪声纳入其Q值计算。经过训练，两者在 `ε → 0` 时都达到最优。在实践中这很重要：当部署时实际发生探索，SARSA的行为更为保守。

**期望SARSA。** 用 `π` 下的期望值替换 `Q(s', a')`：

`Q(s, a) ← Q(s, a) + α [r + γ Σ_{a'} π(a'|s') Q(s', a') - Q(s, a)]`

方差比SARSA低（没有 `a'` 的样本），相同的在策略目标。在现代教科书中通常是默认选择。

**n步TD和TD(λ)。** 通过在自举前等待 `n` 步，在TD(0)和蒙特卡洛之间插值。`n=1` 是TD，`n=∞` 是蒙特卡洛。TD(λ)对所有 `n` 进行加权平均，权重为几何权重 `(1-λ)λ^{n-1}`。大多数深度强化学习使用 `n` 在3到20之间。

## 构建它

### 步骤1：在ε-贪婪策略上的SARSA

```python
def sarsa(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})

    def choose(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        s = env.reset()
        a = choose(s)
        while True:
            s_next, r, done = env.step(s, a)
            a_next = choose(s_next) if not done else None
            target = r + (gamma * Q[s_next][a_next] if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s, a = s_next, a_next
    return Q
```

八行代码。与Q-learning的*唯一*区别在于目标行。

### 步骤2：Q-learning

```python
def q_learning(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    for _ in range(episodes):
        s = env.reset()
        while True:
            a = choose(s, Q, epsilon)
            s_next, r, done = env.step(s, a)
            target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s = s_next
    return Q
```

`max` 将目标与行为解耦。这个符号就是在策略与离策略之间的区别。

### 步骤3：学习曲线

跟踪每100个回合的平均回报。在简单的确定性GridWorld上，Q-learning收敛更快；在悬崖行走任务上，SARSA更为保守。在 `code/main.py` 中的4×4 GridWorld上，使用 `α=0.1, ε=0.1`，两者在约2000个回合后都接近最优。

### 步骤4：与DP真实值比较

运行值迭代（课程02）得到 `Q*`。检查 `max_{s,a} |Q_learned(s,a) - Q*(s,a)|`。在4×4 GridWorld上，一个健康的表格TD智能体在10000个回合后误差在 `~0.5` 以内。

## 陷阱

- **初始Q值很重要。** 乐观初始化（对于负奖励任务 `Q = 0`）鼓励探索。悲观初始化可能会使贪婪策略永远陷入困境。
- **α调度。** 对于非平稳问题，恒定 `α` 没问题。衰减的 `α_n = 1/n` 在理论上能收敛，但在实践中太慢——将 `α` 固定在 `[0.05, 0.3]` 并监控学习曲线。
- **ε调度。** 从高值开始（`ε=1.0`），衰减到 `ε=0.05`。"GLIE"（在无限探索下贪婪）是收敛条件。
- **Q-learning中的最大偏差。** 当 `Q` 有噪声时，`max` 算子向上偏置。导致高估——Hasselt的Double Q-learning（课程05中DDQN使用）通过两个Q表解决这个问题。
- **非终止回合。** TD可以在没有终止条件的情况下学习，但你需要限制步数或在限制处正确处理自举。标准做法：将限制视为非终止，继续自举。
- **状态哈希。** 如果状态是元组/张量，使用可哈希的键（元组，不是列表；浮点数四舍五入后的元组，不是原始值）。

## 使用它

2026年TD学习格局：

| 任务 | 方法 | 原因 |
|------|--------|--------|
| 小型表格环境 | Q-learning | 直接学习最优策略。 |
| 在策略安全关键任务 | SARSA / 期望SARSA | 在探索过程中保持保守。 |
| 高维状态 | DQN（第9阶段 · 05） | 带有回放和目标网络的神经网络Q函数。 |
| 连续动作 | SAC / TD3（第9阶段 · 07） | 在Q网络上进行TD更新；策略网络输出动作。 |
| LLM RL（基于奖励模型） | PPO / GRPO（第9阶段 · 08, 12） | 通过GAE使用TD风格的优化的参与者-评论者。 |
| 离线RL | CQL / IQL（第9阶段 · 08） | 带有保守正则化的Q-learning。 |

2026年论文中你读到的90%的"RL"都是Q-learning或SARSA的某种变体。在深入学习之前，先理解你指尖上的表格更新。

## 部署它

保存为 `outputs/skill-td-agent.md`：

```markdown
---
name: td-agent
description: 为表格或小特征RL任务选择Q-learning、SARSA或期望SARSA。
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

给定表格或小特征环境，输出：

1. 算法。Q-learning / SARSA / 期望SARSA / n步变体。一句话理由，关联在策略与离策略以及方差。
2. 超参数。α、γ、ε、衰减调度。
3. 初始化。Q_0值（乐观vs零）及理由。
4. 收敛诊断。目标学习曲线，如果可能进行 `|Q - Q*|` 检查。
5. 部署注意事项。探索在推理时将如何表现？是否需要SARSA的保守性？

拒绝将表格TD应用于状态空间 > 10⁶ 的环境。拒绝部署没有最大偏差警告的Q-learning智能体。标记任何在整个训练过程中ε保持为1.0的智能体（没有利用阶段）。
```

## 练习

1. **简单。** 在4×4 GridWorld上实现Q-learning和SARSA。绘制2000个回合的学习曲线（每100个回合的平均回报）。谁收敛更快？
2. **中等。** 构建一个悬崖行走环境（4×12，最后一行是悬崖，奖励-100并重置到起点）。比较Q-learning和SARSA的最终策略。截图它们各自采取的路径。哪个更接近悬崖？
3. **困难。** 实现Double Q-learning。在有噪声奖励的GridWorld上（每步奖励添加高斯噪声σ=5），展示Q-learning如何显著高估 `V*(0,0)` 而Double Q-learning不会。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| TD误差 | "更新信号" | `δ = r + γ V(s') - V(s)`，自举残差。 |
| TD(0) | "单步TD" | 仅使用下一个状态的估计，在每个转换后更新。 |
| Q-learning | "离策略RL 101" | 对下一状态动作使用 `max` 的TD更新；无论行为策略如何都学习 `Q*`。 |
| SARSA | "在策略Q-learning" | 使用实际下一个动作的TD更新；为当前ε-贪婪π学习 `Q^π`。 |
| 期望SARSA | "低方差SARSA" | 将采样的 `a'` 替换为π下的期望值。 |
| GLIE | "正确探索调度" | 在无限探索下贪婪（Greedy in the Limit with Infinite Exploration）；Q-learning收敛所需。 |
| 自举 | "在目标中使用当前估计" | 区分TD与MC的特性。偏差的来源，但大幅降低方差。 |
| 最大化偏差 | "Q-learning高估" | 对噪声估计取 `max` 是向上偏置的；通过Double Q-learning修复。 |

## 进一步阅读

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) — 原始论文及收敛证明。
- [Sutton & Barto (2018). 第6章 — 时序差分学习](http://incompleteideas.net/book/RLbook2020.pdf) — TD(0)、SARSA、Q-learning、期望SARSA。
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) — 最大化偏差的修复方法。
- [Seijen, Hasselt, Whiteson, Wiering (2009). 期望SARSA的理论和实证分析](https://ieeexplore.ieee.org/document/4927542) — 期望SARSA的动机。
- [Rummery & Niranjan (1994). 使用连接主义系统的在线Q-learning](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) — 首次提出SARSA的论文（当时称为"修改的连接主义Q-learning"）。
- [Sutton & Barto (2018). 第7章 — n步自举](http://incompleteideas.net/book/RLbook2020.pdf) — 将TD(0)推广到TD(n)，从Q-learning到资格迹，再到PPO中GAE的路径。