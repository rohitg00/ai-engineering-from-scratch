# 多智能体强化学习（Multi-Agent RL）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 单智能体 RL 假设环境是平稳的。一旦把两个会学习的 agent 放进同一个世界，这个假设就崩了：每个 agent 都是另一方环境的一部分，而双方都在变化。多智能体 RL 就是一套技巧，让在 Markov 假设不再成立时学习仍然能收敛。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 04（Q-learning）、Phase 9 · 06（REINFORCE）、Phase 9 · 07（Actor-Critic）
**Time:** ~45 分钟

## 问题（The Problem）

一个机器人学着在房间里导航是单智能体 RL 问题。一支足球队不是。AlphaStar 对战《星际争霸》对手不是。一群相互竞价的 agent 组成的市场不是。两辆车在四向停车口协商通行权不是。现实世界里大量的「多对多」问题都不是。

在任何多智能体设定中，从任意一个 agent 的视角看，其他 agent *都*是环境的一部分。当这些 agent 学习并改变行为，环境就变得非平稳。Markov 性质——「下一个状态只依赖当前状态和我的动作」——被破坏了，因为下一个状态还依赖于*其他* agent 的选择，而它们的策略是会移动的靶子。

这会让表格法的收敛证明失效（Q-learning 的收敛保证假设环境平稳），朴素的深度 RL 也会失效：agent 们互相追逐进入循环，永远收敛不到稳定策略。你需要多智能体专属的技巧：集中训练 / 分散执行、反事实基线（counterfactual baseline）、联赛对抗（league play）、自对弈（self-play）。

2026 年的应用：机器人集群、交通调度、自动驾驶车队、市场仿真器、基于 LLM 的多智能体系统（Phase 16），以及任何拥有多个智能玩家的游戏。

## 概念（The Concept）

![四种 MARL 范式：indep、centralized critic、self-play、league](../assets/marl.svg)

**形式化：Markov Game。** MDP 的推广：状态 `S`、联合动作 `a = (a_1, …, a_n)`、转移 `P(s' | s, a)`、按 agent 划分的 reward `R_i(s, a, s')`。每个 agent `i` 在自己的策略 `π_i` 下最大化自己的回报。如果所有人的 reward 相同，是**完全合作**；如果是零和，是**对抗**；如果是混合的，是**一般和**（general-sum）。

**核心挑战：**

- **非平稳性。** 从 agent `i` 的视角看，`P(s' | s, a_i)` 依赖于 `π_{-i}`，而后者一直在变。
- **信用分配（credit assignment）。** 共享 reward 时，到底是哪一个 agent 贡献的？
- **探索协调。** 各 agent 必须探索互补策略，而不是冗余地探索同一个状态。
- **可扩展性。** 联合动作空间随 `n` 指数增长。
- **部分可观测。** 每个 agent 只看到自己的观测；全局状态是隐藏的。

**四种主流范式：**

**1. 独立 Q-learning / 独立 PPO（IQL、IPPO）。** 每个 agent 学自己的 Q 或策略，把别人当作环境的一部分。简单，有时也能 work（尤其当 experience replay 像一种「平滑的 agent 建模技巧」时）。理论收敛性：没有。实践中：松耦合任务下还行，紧耦合任务下就糟糕。

**2. 集中训练、分散执行（CTDE，Centralized Training, Decentralized Execution）。** 当下最常见的范式。每个 agent 拥有自己的*策略* `π_i`，仅以本地观测 `o_i` 为条件——部署时是标准的分散执行。但*训练*期间，一个集中式的 critic `Q(s, a_1, …, a_n)` 以全局状态和联合动作为条件。例子：
- **MADDPG**（Lowe 等 2017）：DDPG，但每个 agent 配一个集中式 critic。
- **COMA**（Foerster 等 2017）：反事实基线——问「如果我当时选了动作 `a'`，我的 reward 会是多少？」——以此分离我自己的贡献。
- **MAPPO** / **IPPO** with shared critic（Yu 等 2022）：PPO 加一个集中式价值函数。2026 年合作型 MARL 的主流方案。
- **QMIX**（Rashid 等 2018）：价值分解——`Q_tot(s, a) = f(Q_1(s, a_1), …, Q_n(s, a_n))`，混合函数满足单调性。

**3. 自对弈（Self-play）。** 同一个 agent 的两份拷贝互相对战。对手的策略*就是*我自己过去某个 snapshot 的策略。AlphaGo / AlphaZero / MuZero。OpenAI Five。最适合零和博弈；训练信号是对称的。

**4. 联赛对抗（League play）。** 自对弈在 general-sum / 对抗环境下的扩展：维护一个由历史和当前策略组成的种群，从联赛中采样对手并训练。再加上 exploiter（专门击败当前最强者）和 main exploiter（专门击败 exploiter）。AlphaStar（《星际争霸 II》）。当游戏存在「石头剪刀布」式策略循环时必须这么做。

**通信。** 允许各 agent 互相发送学到的消息 `m_i`。在合作场景下有效。Foerster 等（2016）证明了可微的 agent 间通信能端到端训练。今天基于 LLM 的多智能体系统（Phase 16）本质上就是用自然语言通信。

## 动手实现（Build It）

本课用的是 6×6 的 GridWorld，里面有两个合作 agent。它们从对角的两个角落出发，必须到达共享目标。共享 reward：只要任何一个 agent 还在动就 `-1`/步，两个都到达后 `+10`。见 `code/main.py`。

### Step 1: 多智能体环境

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

*联合*动作空间是 `|A|² = 16`。全局状态是两个位置。

### Step 2: 独立 Q-learning

每个 agent 维护自己的 Q-table，键是联合状态。每一步：双方各自 ε-greedy 选动作，收集联合 transition，各自用共享 reward 更新自己的 Q。

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

它在这个任务上能 work，因为 reward 密集且方向一致。但在紧耦合任务上（比如一个 agent 必须*等*另一个）就会失败。

### Step 3: 带价值分解更新的集中式 Q

用一个 Q 覆盖联合动作 `Q(s, a_1, a_2)`。从共享 reward 更新。执行时通过边缘化（marginalize）实现分散：`π_i(s) = argmax_{a_i} max_{a_{-i}} Q(s, a_1, a_2)`。代价是把指数级联合动作空间换成了一个*正确*的全局视角。

### Step 4: 简单自对弈（对抗的 2-agent）

同一个 agent，两个角色。先训练 agent A 对战 agent B；每过 `K` episode，把 A 的权重复制给 B。对称训练，进展一致。这是 AlphaZero 配方的迷你版本。

## 陷阱（Pitfalls）

- **非平稳的 replay。** 独立 agent 加 experience replay 比单 agent 更糟，因为旧 transition 是由如今已经过时的对手生成的。修法：按时间近期重新打标签或加权。
- **信用分配的歧义。** 长 episode 后给一个共享 reward，没法说清楚是哪个 agent 贡献的。修法：反事实基线（COMA），或者按 agent 做 reward shaping。
- **策略漂移 / 互相追逐。** 每个 agent 的最优响应都随对方更新而变化。修法：集中式 critic、慢学习率，或者「一次冻结一个」。
- **靠协调玩 reward hacking。** agent 们会发现设计者没料到的协同漏洞。竞价 agent 都收敛到出价为 0。修法：精心设计 reward、加行为约束。
- **探索冗余。** 双方探索同一批 state-action 对。修法：按 agent 加 entropy 奖励，或基于角色的条件。
- **联赛循环（league cycles）。** 纯自对弈可能陷入支配循环。修法：用包含多样对手的联赛对抗。
- **样本爆炸。** `n` 个 agent × 状态空间 × 联合动作。用函数近似来近似；用因子化动作空间（每个 agent 一个策略输出头）。

## 用起来（Use It）

2026 年的 MARL 应用版图：

| 领域 | 方法 | 备注 |
|--------|--------|-------|
| 合作导航 / 操控 | MAPPO / QMIX | CTDE；共享 critic + 分散 actor。 |
| 双人游戏（国际象棋、围棋、扑克） | 自对弈 + MCTS（AlphaZero） | 零和；对称训练。 |
| 复杂多人游戏（Dota、《星际争霸》） | 联赛对抗 + 模仿学习预训练 | OpenAI Five、AlphaStar。 |
| 自动驾驶车队 | 带 attention 的 CTDE MAPPO / PPO | 部分观测；车队规模可变。 |
| 拍卖市场 | 博弈论均衡 + RL | 当 `n` → ∞ 时用 mean-field RL。 |
| LLM 多智能体系统（Phase 16） | 自然语言通信 + 角色条件 | RL 循环在 agent 规划层。 |

2026 年，MARL 增长最快的方向是基于 LLM 的：一群语言模型 agent 在协商、辩论、写软件。RL 体现在对*轨迹级*输出做偏好优化，而不是 token 级（见 Phase 16 · 03）。

## 上线部署（Ship It）

存为 `outputs/skill-marl-architect.md`：

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

## 练习（Exercises）

1. **简单。** 在 2-agent 合作 GridWorld 上训练独立 Q-learning。多少 episode 后平均回报 > 0？画出联合学习曲线。
2. **中等。** 加一个「协调」任务：只有当两个 agent 在同一回合同时踏上目标时才算到达。独立 Q 还能收敛吗？是哪里坏掉的？
3. **困难。** 为 MAPPO 风格训练实现集中式 critic，并在协调任务上比较它与独立 PPO 的收敛速度。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 真实含义 |
|------|-----------------|-----------------------|
| Markov game | 「多智能体 MDP」 | `(S, A_1, …, A_n, P, R_1, …, R_n)`；每个 agent 有自己的 reward。 |
| CTDE | 「集中训练、分散执行」 | 训练时用联合 critic；执行时每个 agent 的策略只用本地观测。 |
| IPPO | 「独立 PPO」 | 每个 agent 各自跑 PPO。简单的 baseline；常被低估。 |
| MAPPO | 「多智能体 PPO」 | PPO 加一个以全局状态为条件的集中式价值函数。 |
| QMIX | 「单调价值分解」 | `Q_tot = f_monotone(Q_1, …, Q_n)`，允许分散 argmax。 |
| COMA | 「反事实多智能体」 | advantage = 我的 Q 减去对我的动作做边缘化的期望 Q。 |
| Self-play | 「agent 对战过去的自己」 | 单 agent，两个角色；零和博弈的标准做法。 |
| League play | 「种群训练」 | 缓存历史策略，从池子里采样对手；能处理策略循环。 |

## 延伸阅读（Further Reading）

- [Lowe 等（2017）。Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) —— CTDE 配集中式 critic。
- [Foerster 等（2017）。Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) —— 用于信用分配的反事实基线。
- [Rashid 等（2018）。QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) —— 带单调性的价值分解。
- [Yu 等（2022）。The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955) —— PPO 在 MARL 里出乎意料地强。
- [Vinyals 等（2019）。Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) —— 大规模联赛对抗。
- [Silver 等（2017）。Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) —— 零和博弈中的纯自对弈。
- [Sutton & Barto（2018）。Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) —— 教材里对多智能体设定与非平稳性问题的简短讨论，CTDE 正是为解决后者而生。
- [Zhang、Yang & Başar（2021）。Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) —— 综述，覆盖合作、竞争与混合 MARL，并给出收敛结果。
