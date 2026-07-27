# 多智能体 RL

> 单智能体 RL 假设环境是平稳的。将两个学习智能体放在同一个世界中，这个假设就被打破了：每个智能体都是其他智能体环境的一部分，而且都在变化。多智能体 RL 是在马尔可夫假设不再成立时使学习收敛的一系列技巧。

**类型：** 构建
**语言：** Python
**前置要求：** 阶段 9 · 04（Q-learning）、阶段 9 · 06（REINFORCE）、阶段 9 · 07（Actor-Critic）
**时间：** ~45 分钟

## 问题

一个学习在房间中导航的机器人是单智能体 RL 问题。一个足球队不是。AlphaStar vs StarCraft 对手不是。一个竞价代理的市场不是。两辆车在四向停车标志处协商不是。多对多的现实世界问题都不是。

在每个多智能体设置中，从任何单个智能体的角度来看，其他智能体**就是**环境的一部分。当它们学习并改变行为时，环境变得非平稳。马尔可夫性质——"下一个状态只取决于当前状态和我的动作"——被违反，因为下一个状态还取决于**其他**智能体选择什么，而它们的策略是移动的目标。

这破坏了表格型收敛证明（Q-learning 的保证假设环境是平稳的）。它也破坏了朴素的深度 RL：智能体相互追逐循环，永远无法收敛到稳定策略。你需要多智能体特定的技术：集中式训练 / 分散式执行、反事实基线、联赛玩法、自我对弈。

2026 年的应用：机器人群体、交通路由、自动驾驶车队、市场模拟器、多智能体 LLM 系统（阶段 16）以及任何有多个智能玩家的游戏。

## 概念

![四种 MARL 模式：独立、集中式评论家、自我对弈、联赛](../assets/marl.svg)

**形式化：马尔可夫博弈。** MDP 的推广：状态 S，联合动作  = (a_1, …, a_n)，转移 P(s' | s, a)，以及每个智能体的奖励 R_i(s, a, s')。每个智能体 i 在其自己的策略 π_i 下最大化自己的回报。如果奖励相同，则是**完全合作**的。如果是零和的，则是**对抗性**的。如果是混合的，则是**一般和**的。

**核心挑战：**

- **非平稳性。** 从智能体 i 的视角看的 P(s' | s, a_i) 依赖于 π_{-i}，而后者正在变化。
- **信用分配。** 如果奖励是共享的，是哪个智能体导致了它？
- **探索协调。** 智能体必须探索互补的策略，而不是冗余探索相同的状态。
- **可扩展性。** 联合动作空间随 
 指数增长。
- **部分可观测性。** 每个智能体只看到自己的观测；全局状态是隐藏的。

**四种主导模式：**

**1. 独立 Q-learning / 独立 PPO（IQL、IPPO）。** 每个智能体学习自己的 Q 或策略，将其他智能体视为环境的一部分。简单，有时有效（特别是当经验回放起到平滑智能体建模的作用时）。理论收敛：无。在实践中：对松散耦合的任务没问题，对紧密耦合的任务效果差。

**2. 集中式训练、分散式执行（CTDE）。** 最常见的现代范式。每个智能体有自己的**策略** π_i，以局部观测 o_i 为条件——部署时是标准的分散式执行。在**训练**期间，集中式评论家 Q(s, a_1, …, a_n) 以完整全局状态和联合动作为条件。示例：
- **MADDPG**（Lowe 等人 2017）：每个智能体带集中式评论家的 DDPG。
- **COMA**（Foerster 等人 2017）：反事实基线——问"如果我采取了动作 ' 而不是，我的奖励会是什么？"——分离出我的贡献。
- **MAPPO** / **IPPO** 带共享评论家（Yu 等人 2022）：带集中式价值函数的 PPO。2026 年在合作型 MARL 中占主导地位。
- **QMIX**（Rashid 等人 2018）：价值分解——Q_tot(s, a) = f(Q_1(s, a_1), …, Q_n(s, a_n)) 带单调混合。

**3. 自我对弈。** 同一个智能体的两个副本相互对弈。对手的策略**就是**我过去某个快照的策略。AlphaGo / AlphaZero / MuZero。OpenAI Five。对零和游戏效果最好；训练信号是对称的。

**4. 联赛玩法。** 自我对弈在一般和 / 对抗性环境中的扩展：保留过去和当前策略的种群，从联赛中采样对手，针对它们进行训练。添加利用者（专门击败当前最佳策略）和主利用者（专门击败利用者）。AlphaStar（StarCraft II）。当游戏存在"石头-剪刀-布"策略循环时需要。

**通信。** 允许智能体相互发送学习到的消息 m_i。在合作设置中有效。Foerster 等人（2016）展示了可微的智能体间通信可以端到端训练。今天的基于 LLM 的多智能体系统（阶段 16）本质上用自然语言通信。

## 动手构建

本课使用一个 6×6 的 GridWorld，有两个合作智能体。它们从对角开始，必须到达一个共享目标。共享奖励：任一智能体仍在移动时每步 -1，两个都到达时 +10。参见 code/main.py。

### 步骤 1：多智能体环境

`python
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
`

**联合**动作空间是 |A|² = 16。全局状态是两个位置。

### 步骤 2：独立 Q-learning

每个智能体运行自己的 Q 表，以联合状态为键。每一步：两者都选择 ε-贪心动作，收集联合转移，每个用自己的 Q 更新共享奖励。

`python
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
`

在这个任务上有效，因为奖励密集且对齐。在紧密耦合的任务上（例如，一个智能体必须**等待**另一个）会失败。

### 步骤 3：带分解价值更新的集中式 Q

在联合动作上使用一个 Q Q(s, a_1, a_2)。从共享奖励更新。执行时通过边缘化来分散：π_i(s) = argmax_{a_i} max_{a_{-i}} Q(s, a_1, a_2)。用指数级的联合动作空间换取**正确的**全局视图。

### 步骤 4：简单的自我对弈（对抗性双智能体）

同一个智能体，两个角色。训练智能体 A 对抗智能体 B；K 个回合后，将 A 的权重复制到 B。对称训练，一致的进展。AlphaZero 配方的缩微版。

## 常见陷阱

- **非平稳回放。** 独立智能体的经验回放比单智能体更差，因为旧的转移是由现已过时的对手生成的。修复方法：重新标记或按新近程度加权。
- **信用分配模糊性。** 长回合后的共享奖励；没有明确的方法说明哪个智能体贡献了什么。修复方法：反事实基线（COMA），或每个智能体的奖励塑形。
- **策略漂移 / 追逐。** 每个智能体的最佳响应随着其他智能体的更新而变化。修复方法：集中式评论家、慢速学习率或逐个冻结。
- **通过协作的奖励破解。** 智能体找到设计师未预料到的协作利用。拍卖智能体收敛到出价为零。修复方法：仔细的奖励设计、行为约束。
- **探索冗余。** 两个智能体探索相同的状态-动作对。修复方法：每个智能体的熵奖励，或角色条件化。
- **联赛循环。** 纯自我对弈可能陷入主导循环。修复方法：带多样化对手的联赛玩法。
- **样本爆炸。** 
 个智能体 × 状态空间 × 联合动作。用函数近似近似；分解动作空间（每个智能体一个策略输出头）。

## 使用场景

2026 年 MARL 应用地图：

| 领域 | 方法 | 备注 |
|--------|--------|-------|
| 合作导航 / 操作 | MAPPO / QMIX | CTDE；共享评论家 + 分散执行者。 |
| 双人游戏（国际象棋、围棋、扑克） | 带 MCTS 的自我对弈（AlphaZero） | 零和；对称训练。 |
| 复杂多人游戏（Dota、StarCraft） | 联赛玩法 + 模仿预训练 | OpenAI Five、AlphaStar。 |
| 自动驾驶车队 | 带注意力的 CTDE MAPPO / PPO | 部分观测；可变团队规模。 |
| 拍卖市场 | 博弈论均衡 + RL | 当 
 → ∞ 时的平均场 RL。 |
| LLM 多智能体系统（阶段 16） | 自然语言通信 + 角色条件化 | 智能体规划层的 RL 循环。 |

在 2026 年，MARL 最大的增长领域是基于 LLM 的：语言模型智能体的群体进行协商、辩论、构建软件。RL 以对**轨迹级别**输出的偏好优化的形式出现，而不是 token 级别（阶段 16 · 03）。

## 交付物

保存为 outputs/skill-marl-architect.md：

`markdown
---
name: marl-architect
description: 为给定任务选择正确的多智能体 RL 模式（IPPO、CTDE、自我对弈、联赛）。
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

给定一个包含 
 个智能体的任务，输出：

1. 模式分类。合作 / 对抗 / 一般和。附带理由。
2. 算法。IPPO / MAPPO / QMIX / 自我对弈 / 联赛。理由与耦合紧密度和奖励结构相关。
3. 信息访问。集中式训练（什么全局信息进入评论家）？分散式执行？
4. 信用分配。反事实基线、价值分解或奖励塑形。
5. 探索计划。每个智能体的熵、基于种群的训练或联赛。

拒绝在紧密耦合的合作任务上使用独立 Q-learning。拒绝推荐在带有循环风险的一般和问题上使用自我对弈。标记任何没有固定对手评估的 MARL 流程（精心挑选的自我对弈数字很常见）。
`

## 练习

1. **简单。** 在 2 智能体合作 GridWorld 上训练独立 Q-learning。需要多少个回合直到平均回报 > 0？绘制联合学习曲线。
2. **中等。** 添加一个"协调"任务：只有当两个智能体在同一回合踏到目标上时才达到目标。独立 Q 还能收敛吗？哪里出了问题？
3. **困难。** 实现 MAPPO 风格的集中式评论家，并在协调任务上与独立 PPO 比较收敛速度。

## 关键术语

| 术语 | 人们说的 | 实际意思 |
|------|-----------------|-----------------------|
| 马尔可夫博弈 | "多智能体 MDP" | (S, A_1, …, A_n, P, R_1, …, R_n)；每个智能体有自己的奖励。 |
| CTDE | "集中式训练、分散式执行" | 训练时的联合评论家；每个智能体的策略只使用局部观测。 |
| IPPO | "独立 PPO" | 每个智能体独立运行 PPO。简单的基线；常常被低估。 |
| MAPPO | "多智能体 PPO" | 带以全局状态为条件的集中式价值函数的 PPO。 |
| QMIX | "单调价值分解" | Q_tot = f_monotone(Q_1, …, Q_n) 允许分散式 argmax。 |
| COMA | "反事实多智能体" | 优势 = 我的 Q 减去边缘化我动作后的期望 Q。 |
| 自我对弈 | "智能体 vs 过去的自己" | 单个智能体，两个角色；零和游戏的标准。 |
| 联赛玩法 | "种群训练" | 缓存过去的策略，从池中采样对手；处理策略循环。 |

## 扩展阅读

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) — 带集中式评论家的 CTDE。
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) — 用于信用分配的反事实基线。
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) — 带单调性的价值分解。
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955) — PPO 在 MARL 中出奇地强大。
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) — 大规模联赛玩法。
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) — 零和游戏中的纯自我对弈。
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) — 包括教材对多智能体设置和 CTDE 旨在解决的非平稳性问题的简短论述。
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) — 涵盖合作、竞争和混合 MARL 及其收敛结果的综述。