# 10 · 多智能体强化学习

> 单智能体强化学习假设环境是平稳的。把两个会学习的智能体放进同一个世界，这个假设就破裂了：每个智能体都是对方环境的一部分，而双方都在不断变化。多智能体强化学习就是一套技巧，用来在「马尔可夫（Markov）」假设不再成立时让学习收敛。

**类型：** 构建
**语言：** Python
**前置：** 阶段 9 · 04（Q 学习）、阶段 9 · 06（REINFORCE）、阶段 9 · 07（Actor-Critic）
**时长：** 约 45 分钟

## 问题所在

一个机器人学习在房间里导航，是单智能体强化学习问题。一支足球队不是。AlphaStar 对阵《星际争霸》对手不是。一个由竞价智能体构成的市场不是。两辆车在四向停车口协商通行不是。多对多的真实世界问题都不是。

在每一个多智能体场景中，从任何一个智能体的视角看，其他智能体*就是*环境的一部分。随着它们学习并改变自身行为，环境就变成了「非平稳（non-stationary）」。「马尔可夫性质（Markov property）」——「下一状态只取决于当前状态和我的动作」——被打破了，因为下一状态还取决于*其他*智能体的选择，而它们的策略是移动的靶子。

这打破了表格法的收敛证明（Q 学习的收敛保证依赖于平稳环境），也打破了朴素的深度强化学习：智能体彼此追逐、陷入循环，永远收敛不到稳定策略。你需要多智能体专用的技术：集中式训练／分布式执行、反事实基线、联赛对战、自我对弈。

2026 年的应用：机器人集群、交通路由、自动驾驶车队、市场模拟器、多智能体 LLM 系统（阶段 16），以及任何参与者多于一个的智能博弈。

## 核心概念

〔图：四种 MARL 范式：独立学习、集中式 critic、自我对弈、联赛〕

**形式化：马尔可夫博弈（Markov Game）。** 它是 MDP 的推广：状态 `S`、联合动作 `a = (a_1, …, a_n)`、转移 `P(s' | s, a)`，以及每个智能体各自的奖励 `R_i(s, a, s')`。每个智能体 `i` 在自己的策略 `π_i` 下最大化自己的回报。如果奖励完全相同，就是**完全合作（fully cooperative）**；如果是零和，就是**对抗性（adversarial）**；如果两者混合，就是**一般和（general-sum）**。

**核心挑战：**

- **非平稳性。** 从智能体 `i` 的视角看，`P(s' | s, a_i)` 取决于 `π_{-i}`，而后者一直在变。
- **信用分配（Credit assignment）。** 在共享奖励下，到底是哪个智能体造成的？
- **探索协调。** 各智能体必须探索互补的策略，而不是冗余地探索同一个状态。
- **可扩展性。** 联合动作空间随 `n` 呈指数增长。
- **部分可观测性。** 每个智能体只能看到自己的观测；全局状态是隐藏的。

**四种主导范式：**

**1. 独立 Q 学习／独立 PPO（IQL、IPPO）。** 每个智能体学习自己的 Q 或策略，把其他智能体当作环境的一部分。简单，有时奏效（尤其是当经验回放充当一种平滑的「智能体建模」技巧时）。理论收敛性：没有。实践中：对松耦合任务尚可，对紧耦合任务表现糟糕。

**2. 集中式训练、分布式执行（CTDE）。** 当下最常见的范式。每个智能体有自己的*策略* `π_i`，它以局部观测 `o_i` 为条件——这就是部署时标准的分布式执行。在*训练*阶段，一个集中式 critic `Q(s, a_1, …, a_n)` 以完整的全局状态和联合动作为条件。例子：
- **MADDPG**（Lowe 等，2017）：为每个智能体配一个集中式 critic 的 DDPG。
- **COMA**（Foerster 等，2017）：反事实基线——问「如果我当时改选动作 `a'` 会怎样？」——以此隔离出我的贡献。
- 带共享 critic 的 **MAPPO** / **IPPO**（Yu 等，2022）：带集中式价值函数的 PPO。在 2026 年合作型 MARL 中占主导地位。
- **QMIX**（Rashid 等，2018）：价值分解——`Q_tot(s, a) = f(Q_1(s, a_1), …, Q_n(s, a_n))`，采用单调混合。

**3. 自我对弈（Self-play）。** 同一个智能体的两个副本互相对战。对手的策略*就是*我过去某个快照的策略。AlphaGo / AlphaZero / MuZero。OpenAI Five。对零和博弈效果最好；训练信号是对称的。

**4. 联赛对战（League play）。** 自我对弈在一般和／对抗性环境下的扩展：维护一个由过去和当前策略组成的种群，从联赛中采样一个对手，并与之对战训练。还会加入「克制者（exploiters）」（专门击败当前最强者）和「主克制者（main exploiters）」（专门击败克制者）。AlphaStar（《星际争霸 II》）。当博弈存在「石头剪刀布」式的策略循环时就需要它。

**通信（Communication）。** 允许智能体相互发送学习得到的消息 `m_i`。在合作场景中有效。Foerster 等（2016）证明，可微的智能体间通信可以端到端训练。当今基于 LLM 的多智能体系统（阶段 16）本质上是用自然语言进行通信。

## 动手构建

本课使用一个 6×6 的 GridWorld，里面有两个合作的智能体。它们从对角起步，必须到达一个共享目标。共享奖励：只要任一智能体仍在移动，每步 `-1`；两者都到达时 `+10`。见 `code/main.py`。

### 步骤 1：多智能体环境

```python
class CoopGridWorld:
    def __init__(self):
        self.size = 6
        self.goal = (5, 5)

    def reset(self):
        return ((0, 0), (5, 0))  # 两个智能体

    def step(self, state, actions):
        a1, a2 = state
        new1 = move(a1, actions[0])
        new2 = move(a2, actions[1])
        done = (new1 == self.goal) and (new2 == self.goal)
        reward = 10.0 if done else -1.0
        return (new1, new2), reward, done
```

*联合*动作空间是 `|A|² = 16`。全局状态是两个位置。

### 步骤 2：独立 Q 学习

每个智能体维护自己的 Q 表，以联合状态为键。每一步：双方都按 ε-贪心选择动作，收集联合转移，各自用共享奖励更新自己的 Q。

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

在本任务上有效，因为奖励稠密且对齐。在紧耦合任务上会失败（例如某个智能体必须*等待*另一个的场景）。

### 步骤 3：带价值分解更新的集中式 Q

使用一个覆盖联合动作的 Q：`Q(s, a_1, a_2)`。用共享奖励更新。在执行时通过边缘化来实现分布式：`π_i(s) = argmax_{a_i} max_{a_{-i}} Q(s, a_1, a_2)`。用指数级的联合动作空间换来一个*正确*的全局视角。

### 步骤 4：简单自我对弈（对抗性双智能体）

同一个智能体，两种角色。训练智能体 A 对抗智能体 B；每隔 `K` 个回合，把 A 的权重复制给 B。对称训练，进步稳定。这是 AlphaZero 配方的微缩版。

## 常见陷阱

- **非平稳回放。** 独立智能体下的经验回放比单智能体更糟，因为旧的转移是由如今已过时的对手生成的。修复：按新近度重新标注或加权。
- **信用分配的模糊性。** 长回合之后才给共享奖励；无法明确说出是哪个智能体做了贡献。修复：反事实基线（COMA），或为每个智能体做奖励塑形。
- **策略漂移／追逐。** 每个智能体的最优响应都会随着对方的更新而改变。修复：集中式 critic、放慢学习率，或一次只冻结一个。
- **借协调进行的奖励作弊。** 智能体找到设计者未曾预料的协同漏洞。竞价智能体会收敛到出价为零。修复：精心设计奖励、施加行为约束。
- **探索冗余。** 两个智能体探索相同的状态-动作对。修复：为每个智能体加熵奖励，或做角色条件化。
- **联赛循环。** 纯自我对弈可能陷入支配循环。修复：用多样化对手做联赛对战。
- **样本爆炸。** `n` 个智能体 × 状态空间 × 联合动作。用函数逼近来近似；采用分解式动作空间（每个智能体一个策略输出头）。

## 实际应用

2026 年 MARL 应用图谱：

| 领域 | 方法 | 备注 |
|--------|--------|-------|
| 合作式导航／操作 | MAPPO / QMIX | CTDE；共享 critic + 分布式 actor。 |
| 双人博弈（国际象棋、围棋、扑克） | 带 MCTS 的自我对弈（AlphaZero） | 零和；对称训练。 |
| 复杂多人博弈（Dota、星际争霸） | 联赛对战 + 模仿预训练 | OpenAI Five、AlphaStar。 |
| 自动驾驶车队 | 带注意力的 CTDE MAPPO / PPO | 部分可观测；队伍规模可变。 |
| 拍卖市场 | 博弈论均衡 + RL | 当 `n` → ∞ 时用平均场 RL。 |
| LLM 多智能体系统（阶段 16） | 自然语言通信 + 角色条件化 | RL 循环位于智能体规划层。 |

2026 年，MARL 增长最快的领域是基于 LLM 的：成群的语言模型智能体协商、辩论、构建软件。这里的 RL 表现为在*轨迹级（trajectory-level）*输出而非 token 级输出上的偏好优化（阶段 16 · 03）。

## 交付产物

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

1. **简单。** 在双智能体合作 GridWorld 上训练独立 Q 学习。需要多少个回合平均回报才能 > 0？画出联合学习曲线。
2. **中等。** 增加一个「协调」任务：只有当两个智能体在同一回合同时踏上目标时才算到达。独立 Q 还能收敛吗？哪里会失效？
3. **困难。** 为 MAPPO 风格的训练实现一个集中式 critic，并在协调任务上比较它与独立 PPO 的收敛速度。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 马尔可夫博弈（Markov game） | 「多智能体 MDP」 | `(S, A_1, …, A_n, P, R_1, …, R_n)`；每个智能体有自己的奖励。 |
| CTDE | 「集中式训练、分布式执行」 | 训练时用联合 critic；每个智能体的策略只用局部观测。 |
| IPPO | 「独立 PPO」 | 每个智能体各自独立运行 PPO。简单基线；常被低估。 |
| MAPPO | 「多智能体 PPO」 | 带集中式价值函数（以全局状态为条件）的 PPO。 |
| QMIX | 「单调价值分解」 | `Q_tot = f_monotone(Q_1, …, Q_n)`，允许分布式 argmax。 |
| COMA | 「反事实多智能体」 | 优势 = 我的 Q 减去对我的动作边缘化后的期望 Q。 |
| 自我对弈（Self-play） | 「智能体对阵过去的自己」 | 单个智能体，两种角色；零和博弈的标准做法。 |
| 联赛对战（League play） | 「种群训练」 | 缓存过去的策略，从池中采样对手；应对策略循环。 |

## 延伸阅读

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) —— 带集中式 critic 的 CTDE。
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) —— 用于信用分配的反事实基线。
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) —— 带单调性的价值分解。
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955) —— PPO 在 MARL 中出人意料地强。
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) —— 大规模联赛对战。
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) —— 零和博弈中的纯自我对弈。
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) —— 包含教材对多智能体场景的简短论述，以及 CTDE 旨在解决的非平稳性问题。
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) —— 涵盖合作、竞争与混合 MARL 并附收敛结果的综述。
