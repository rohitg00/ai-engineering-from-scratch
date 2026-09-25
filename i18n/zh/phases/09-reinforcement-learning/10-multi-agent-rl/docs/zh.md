# 多智能体强化学习

> 单智能体强化学习假设环境是平稳的。把两个学习智能体放进同一个世界，这个假设就不再成立：每个智能体都是对方环境的一部分，而且两者都在不断变化。多智能体强化学习就是在马尔可夫假设失效时让学习收敛的一系列技巧。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 04（Q-learning）、Phase 9 · 06（REINFORCE）、Phase 9 · 07（Actor-Critic）
**Time:** 约 45 分钟

## 问题所在

一个学习在房间里导航的机器人是单智能体强化学习问题。足球队不是。AlphaStar 对战 StarCraft 对手不是。由竞价智能体组成的市场不是。两辆车在四方停牌路口协商通行不是。多对多的现实世界问题都不是。

在每一个多智能体场景中，从任意一个智能体的视角来看，其他智能体*就是*环境的一部分。随着它们学习并改变行为，环境变得非平稳。马尔可夫性质——“下一状态只取决于当前状态和我的动作”——被打破了，因为下一状态还取决于*其他*智能体的选择，而它们的策略是移动的目标。

这破坏了表格型方法的收敛性证明（Q-learning 的保证假设环境平稳）。它也破坏了朴素的深度强化学习：智能体在循环中互相追逐，永远无法收敛到稳定策略。你需要多智能体特有的技术：集中式训练 / 分布式执行、反事实基线、联盟训练、自博弈。

2026 年的应用：机器人集群、交通路由、自动驾驶车队、市场模拟器、多智能体 LLM 系统（Phase 16），以及任何有多个智能参与者的博弈。

## 核心概念

![Four MARL regimes: indep, centralized critic, self-play, league](../assets/marl.svg)

**形式化：马尔可夫博弈。** MDP 的推广：状态 `S`、联合动作 `a = (a_1, …, a_n)`、转移 `P(s' | s, a)`，以及各智能体各自的奖励 `R_i(s, a, s')`。每个智能体 `i` 在自己的策略 `π_i` 下最大化自己的回报。如果奖励相同，就是**完全合作型**。如果是零和的，就是**对抗型**。如果是混合的，就是**一般和博弈**。

**核心挑战：**

- **非平稳性。** 从智能体 `i` 的视角看，`P(s' | s, a_i)` 取决于 `π_{-i}`，而后者在不断变化。
- **信用分配。** 奖励是共享的，那么是哪个智能体促成的？
- **探索协调。** 各智能体必须探索互补的策略，而不是冗余地探索同一个状态。
- **可扩展性。** 联合动作空间随 `n` 呈指数增长。
- **部分可观测性。** 每个智能体只能看到自己的观测；全局状态是隐藏的。

**四种主流范式：**

**1. 独立 Q-learning / 独立 PPO（IQL、IPPO）。** 每个智能体学习自己的 Q 或策略，把其他智能体当作环境的一部分。简单，有时有效（尤其是经验回放起到了平滑智能体建模的作用）。理论收敛性：没有。实践中：对松耦合任务效果尚可，对紧耦合任务则很差。

**2. 集中式训练、分布式执行（CTDE）。** 目前最常见的现代范式。每个智能体有自己的*策略* `π_i`，以局部观测 `o_i` 为条件——部署时是标准的分布式执行。在*训练*时，一个集中式 critic `Q(s, a_1, …, a_n)` 以完整的全局状态和联合动作为条件。示例：
- **MADDPG**（Lowe et al. 2017）：为每个智能体配备一个集中式 critic 的 DDPG。
- **COMA**（Foerster et al. 2017）：反事实基线——问“如果我当初采取动作 `a'` 而不是现在的动作，我的奖励会是什么？”——从而隔离出我自己的贡献。
- **MAPPO** / **IPPO** 加共享 critic（Yu et al. 2022）：带集中式价值函数的 PPO。在 2026 年主导合作型 MARL。
- **QMIX**（Rashid et al. 2018）：价值分解——用单调混合实现 `Q_tot(s, a) = f(Q_1(s, a_1), …, Q_n(s, a_n))`。

**3. 自博弈。** 同一个智能体的两份副本互相对弈。对手的策略*就是*我过去某个快照的策略。AlphaGo / AlphaZero / MuZero。OpenAI Five。最适合零和博弈；训练信号是对称的。

**4. 联盟训练。** 自博弈向一般和 / 对抗环境的扩展：保留一个由过去和当前策略组成的种群，从联盟中采样一个对手，针对它训练。加入 exploiter（专门击败当前最强者）和 main exploiter（专门击败 exploiter）。AlphaStar（StarCraft II）。当博弈存在“石头剪刀布”式的策略循环时，这是必需的。

**通信。** 允许智能体互相发送学习到的消息 `m_i`。在合作场景中有效。Foerster et al.（2016）证明智能体间的可微分通信可以端到端训练。如今基于 LLM 的多智能体系统（Phase 16）本质上是用自然语言通信的。

```figure
f3-marl-orbit
```

## 动手实现

本课使用一个 6×6 的 GridWorld，包含两个合作智能体。它们从相对的角落出发，必须到达一个共享目标。共享奖励：任一智能体仍在移动时每步为 `-1`，两者都到达时为 `+10`。参见 `code/main.py`。

### 第 1 步：多智能体环境

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

*联合*动作空间为 `|A|² = 16`。全局状态就是两个位置。

### 第 2 步：独立 Q-learning

每个智能体维护自己的、以联合状态为键的 Q 表。每一步：两者都以 ε-greedy 选择动作，收集联合转移，各自用共享奖励更新自己的 Q。

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

在本任务上有效，因为奖励是稠密且一致的。在紧耦合任务上会失败（例如，一个智能体必须*等待*另一个）。

### 第 3 步：带分解价值更新的集中式 Q

对联合动作使用一个 Q `Q(s, a_1, a_2)`。用共享奖励更新。执行时通过边缘化进行分布式化：`π_i(s) = argmax_{a_i} max_{a_{-i}} Q(s, a_1, a_2)`。用指数级增长的联合动作空间换取*正确的*全局视角。

### 第 4 步：简单自博弈（对抗型双智能体）

同一个智能体，扮演两个角色。让智能体 A 对抗智能体 B 进行训练；每 `K` 个 episode 后，把 A 的权重复制到 B。对称的训练，稳定的进展。AlphaZero 配方的微缩版。

## 常见陷阱

- **非平稳的经验回放。** 独立智能体使用经验回放比单智能体更糟，因为旧转移是由现已过时的对手生成的。解决方法：按新近度重标注或加权。
- **信用分配模糊。** 长 episode 后的共享奖励；无法明确判断哪个智能体做出了贡献。解决方法：反事实基线（COMA），或按智能体进行奖励塑形。
- **策略漂移 / 互相追逐。** 每个智能体的最优响应随其他智能体的更新而变化。解决方法：集中式 critic、较慢的学习率，或一次冻结一个。
- **通过协调进行奖励作弊。** 智能体找到设计者没有预料到的协调性漏洞。拍卖智能体收敛到出价为零。解决方法：仔细的奖励设计、行为约束。
- **探索冗余。** 两个智能体探索相同的状态-动作对。解决方法：按智能体加熵奖励，或角色条件化。
- **联盟循环。** 纯自博弈可能陷入支配循环。解决方法：用多样化对手进行联盟训练。
- **样本爆炸。** `n` 个智能体 × 状态空间 × 联合动作。用函数逼近来近似；或采用分解动作空间（每个智能体一个策略输出头）。

## 应用

2026 年的 MARL 应用地图：

| 领域 | 方法 | 说明 |
|--------|--------|-------|
| 合作导航 / 操作 | MAPPO / QMIX | CTDE；共享 critic + 分布式 actor。 |
| 双人博弈（国际象棋、围棋、扑克） | 带 MCTS 的自博弈（AlphaZero） | 零和；对称训练。 |
| 复杂多人博弈（Dota、StarCraft） | 联盟训练 + 模仿预训练 | OpenAI Five、AlphaStar。 |
| 自动驾驶车队 | 带注意力的 CTDE MAPPO / PPO | 部分可观测；队伍规模可变。 |
| 拍卖市场 | 博弈论均衡 + RL | 当 `n` → ∞ 时使用平均场 RL。 |
| LLM 多智能体系统（Phase 16） | 自然语言通信 + 角色条件化 | RL 循环位于智能体规划层。 |

2026 年，MARL 最大的增长领域是基于 LLM 的：语言模型智能体集群进行协商、辩论、构建软件。RL 以*轨迹层面*输出的偏好优化形式出现，而非 token 层面（Phase 16 · 03）。

## 交付

保存为 `outputs/skill-marl-architect.md`：

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

## 练习

1. **简单。** 在双智能体合作 GridWorld 上训练独立 Q-learning。多少个 episode 后平均回报 > 0？绘出联合学习曲线。
2. **中等。** 加入一个“协调”任务：只有当两个智能体在同一回合都踩上目标时才算到达。独立 Q 还能收敛吗？什么会失效？
3. **困难。** 为 MAPPO 风格的训练实现一个集中式 critic，并在协调任务上与独立 PPO 比较收敛速度。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 马尔可夫博弈 | “多智能体 MDP” | `(S, A_1, …, A_n, P, R_1, …, R_n)`；每个智能体有自己的奖励。 |
| CTDE | “集中式训练、分布式执行” | 训练时使用联合 critic；每个智能体的策略只使用局部观测。 |
| IPPO | “独立 PPO” | 每个智能体独立运行 PPO。简单的基线；常被低估。 |
| MAPPO | “多智能体 PPO” | 以全局状态为条件的集中式价值函数的 PPO。 |
| QMIX | “单调价值分解” | `Q_tot = f_monotone(Q_1, …, Q_n)` 允许分布式 argmax。 |
| COMA | “反事实多智能体” | 优势 = 我的 Q 减去对我的动作边缘化后的期望 Q。 |
| 自博弈 | “智能体对抗过去的自己” | 单个智能体，两个角色；零和博弈的标准做法。 |
| 联盟训练 | “种群训练” | 缓存过去的策略，从池中采样对手；可处理策略循环。 |

## 延伸阅读

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) — 带集中式 critic 的 CTDE。
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) — 用于信用分配的反事实基线。
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) — 带单调性的价值分解。
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955) — PPO 在 MARL 中出人意料地强大。
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) — 大规模联盟训练。
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) — 零和博弈中的纯自博弈。
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) — 包含教科书对多智能体场景及 CTDE 所要解决的非平稳性问题的简要论述。
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) — 综述，涵盖合作型、竞争型和混合型 MARL 及其收敛结果。