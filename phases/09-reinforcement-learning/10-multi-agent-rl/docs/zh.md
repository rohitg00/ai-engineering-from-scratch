# 多智能体强化学习 (Multi-Agent RL)

> 单智能体强化学习假设环境是平稳的。当将两个学习智能体放入同一个世界时，这一假设就被打破了：每个智能体都是其他智能体环境的一部分，并且两者都在变化。多智能体强化学习是一系列使学习在马尔可夫假设不再成立时仍能收敛的技巧集。

**类型：** 构建（Build）
**语言：** Python
**前置条件：** 阶段9 · 04（Q学习），阶段9 · 06（REINFORCE），阶段9 · 07（演员-评论家）
**预计时间：** 约45分钟

## 问题

一个机器人在房间里导航是单智能体强化学习问题。一支足球队则不是。AlphaStar对阵星际争霸对手也不是。一个由竞价智能体组成的市场也不是。两辆车在四向停车路口协商也不是。许多对许多的现实世界问题都不是。

在每个多智能体设定中，从任何一个智能体的视角来看，其他智能体 *是* 环境的一部分。随着它们学习和改变其行为，环境变得非平稳。马尔可夫性质——“下一个状态仅取决于当前状态和我的动作”——被违反，因为下一个状态还取决于 *其他* 智能体选择了什么，而它们的策略是移动目标。

这会破坏表格收敛性证明（Q学习的保证假设环境是平稳的）。它也会破坏天真的深度强化学习：智能体相互追逐形成环路，从未收敛到稳定策略。你需要多智能体特定的技术：集中式训练/分散式执行、反事实基线、联盟训练、自我对弈。

2026年的应用：机器人集群、交通路由、自动驾驶车队、市场模拟器、多智能体LLM系统（阶段16），以及任何包含一个以上智能玩家的游戏。

## 概念

![四种MARL模式：独立、集中式评论家、自我对弈、联盟](../assets/marl.svg)

**形式化：马尔可夫博弈（Markov Game）。** MDP的泛化：状态 `S`，联合动作 `a = (a_1, …, a_n)`，转移 `P(s' | s, a)`，以及每个智能体的奖励 `R_i(s, a, s')`。每个智能体 `i` 在其自身策略 `π_i` 下最大化其自身回报。如果奖励相同，则它是 **完全合作的**。如果为零和，则是 **对抗性的**。如果混合，则是 **一般和（General-sum）**。

**核心挑战：**

- **非平稳性（Non-stationarity）。** 从智能体 `i` 的视角看，`P(s' | s, a_i)` 依赖于 `π_{-i}`，而 `π_{-i}` 正在变化。
- **信用分配（Credit assignment）。** 当奖励共享时，是哪个智能体导致了奖励？
- **探索协调（Exploration coordination）。** 智能体必须探索互补策略，而不是冗余探索同一状态。
- **可扩展性（Scalability）。** 联合动作空间随 `n` 呈指数增长。
- **部分可观测性（Partial observability）。** 每个智能体仅能看到自身观测；全局状态是隐藏的。

**四种主导模式：**

**1. 独立Q学习/独立PPO（IQL, IPPO）。** 每个智能体学习其自身的Q函数或策略，将其他智能体视为环境的一部分。简单，有时有效（尤其是经验回放充当平滑的智能体建模技巧）。理论收敛性：无。实际中：对松散耦合任务尚可，对紧密耦合任务较差。

**2. 集中式训练，分散式执行（CTDE）。** 最常用的现代范式。每个智能体拥有自己的 *策略* `π_i`，该策略以局部观测 `o_i` 为条件——部署时是标准的分散式执行。在 *训练* 期间，一个集中式评论家 `Q(s, a_1, …, a_n)` 以全局状态和联合动作为条件。例子：
- **MADDPG**（Lowe 等人，2017）：每个智能体具有集中式评论家的DDPG。
- **COMA**（Foerster 等人，2017）：反事实基线——询问“如果我执行了动作 `a'`，我的奖励会是多少？”——隔离我的贡献。
- **MAPPO / IPPO** 搭配共享评论家（Yu 等人，2022）：带有集中式价值函数PPO。在2026年对合作式MARL中占主导地位。
- **QMIX**（Rashid 等人，2018）：价值分解——`Q_tot(s, a) = f(Q_1(s, a_1), …, Q_n(s, a_n))` 具有单调混合。

**3. 自我对弈（Self-play）。** 同一个智能体的两份副本相互博弈。对手的策略 *是* 我过去某个快照的策略。AlphaGo / AlphaZero / MuZero。OpenAI Five。最适合零和博弈；训练信号是对称的。

**4. 联盟训练（League play）。** 自我对弈扩展到一般和/对抗性环境：保留一个由过去和当前策略组成的种群，从联盟中采样一个对手，并针对其进行训练。添加探索者（专攻击败当前最优策略）和主探索者（专攻击败探索者）。AlphaStar（星际争霸II）。当游戏存在“石头-剪刀-布”策略循环时需要。

**通信（Communication）。** 允许智能体相互发送学习到的消息 `m_i`。在合作设定中有效。Foerster 等人（2016）表明，可微的智能体间通信可以通过端到端训练得到。如今基于LLM的多智能体系统（阶段16）本质上以自然语言通信。

## 构建它

本课使用一个6×6的网格世界（GridWorld），包含两个合作智能体。它们从对角角落出发，必须到达一个共享目标。共享奖励：当任一智能体仍在移动时，每一步得 `-1`；当两者都到达时得 `+10`。见 `code/main.py`。

### 第一步：多智能体环境

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

*联合* 动作空间为 `|A|² = 16`。全局状态是两个位置。

### 第二步：独立Q学习

每个智能体维护一个以联合状态为键的Q表。每一步：两者都选择ε-贪心动作，收集联合转移，每个智能体用共享奖励更新其自身的Q。

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

此方法在该任务上有效，因为奖励密集且对齐。在紧密耦合任务上失败（例如，一个智能体必须 *等待* 另一个智能体）。

### 第三步：集中式Q与分解值更新

使用一个联合动作的Q函数 `Q(s, a_1, a_2)`。从共享奖励更新。在执行时通过边际化分散：`π_i(s) = argmax_{a_i} max_{a_{-i}} Q(s, a_1, a_2)`。用指数级联合动作空间换取了 *正确的* 全局视图。

### 第四步：简单自我对弈（对抗性双智能体）

同一个智能体，两个角色。训练智能体A对抗智能体B；经过 `K` 幕之后，将A的权重复制到B。对称训练，一致的进步。这是AlphaZero配方的缩影。

## 陷阱

- **非平稳回放（Non-stationary replay）。** 独立智能体的经验回放比单智能体更差，因为旧的转移是由现已过时的对手生成的。修复：重新标记或根据新鲜度加权。
- **信用分配模糊性（Credit assignment ambiguity）。** 长时间幕后的共享奖励；没有清晰的方法判断哪个智能体贡献了奖励。修复：反事实基线（COMA），或每个智能体的奖励塑形。
- **策略漂移/追逐（Policy drift / chasing）。** 每个智能体的最佳响应随着其他智能体的更新而变化。修复：集中式评论家、慢学习率，或一次冻结一个。
- **通过协调进行奖励黑客（Reward hacking via coordination）。** 智能体发现设计者未预料到的协调漏洞。拍卖智能体收敛到出价为零。修复：仔细设计奖励、行为约束。
- **探索冗余（Exploration redundancy）。** 两个智能体探索相同的状态-动作对。修复：每个智能体的熵奖励，或角色条件化。
- **联盟循环（League cycles）。** 纯自我对弈可能陷入支配循环。修复：带有不同对手的联盟训练。
- **样本爆炸（Sample explosion）。** `n` 个智能体 × 状态空间 × 联合动作。使用函数近似逼近；因子化动作空间（每个智能体一个策略输出头）。

## 使用它

2026年MARL应用图谱：

| 领域 | 方法 | 备注 |
|--------|--------|-------|
| 合作导航/操作 | MAPPO / QMIX | CTDE；共享评论家 + 分散演员。 |
| 双人游戏（国际象棋、围棋、扑克） | 自我对弈 + MCTS（AlphaZero） | 零和；对称训练。 |
| 复杂多玩家（Dota、星际争霸） | 联盟训练 + 模仿预训练 | OpenAI Five, AlphaStar。 |
| 自动驾驶车队 | CTDE MAPPO / 带注意力的PPO | 部分观测；可变团队规模。 |
| 拍卖市场 | 博弈论均衡 + 强化学习 | 当 `n` → ∞ 时的平均场强化学习。 |
| 基于LLM的多智能体系统（阶段16） | 自然语言通信 + 角色条件化 | 在智能体规划层上的强化学习循环。 |

在2026年，MARL最大的增长领域是基于LLM的：由语言模型智能体组成的集群进行协商、辩论、构建软件。强化学习以 *轨迹级* 输出的偏好优化的形式出现，而不是标记级（阶段16 · 03）。

## 交付它

保存为 `outputs/skill-marl-architect.md`：

```markdown
---
name: marl-architect
description: 为给定任务选择合适的多智能体强化学习模式（IPPO、CTDE、自我对弈、联盟训练）。
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

给定具有 `n` 个智能体的任务，输出：

1. 模式分类。合作 / 对抗 / 一般和。给出理由。
2. 算法。IPPO / MAPPO / QMIX / 自我对弈 / 联盟训练。理由与耦合紧密度和奖励结构相关。
3. 信息访问。集中式训练（哪些全局信息进入评论家）？分散式执行？
4. 信用分配。反事实基线、价值分解或奖励塑形。
5. 探索计划。每个智能体的熵、基于种群的训练或联盟训练。

拒绝在紧密耦合的合作任务中使用独立Q学习。拒绝在存在循环风险的一般和任务中推荐自我对弈。对任何没有固定对手评估的MARL流水线（常见的挑选过的自我对弈数字）提出标记。

```

## 练习

1. **简单。** 在双智能体合作网格世界上训练独立Q学习。需要多少幕才能使平均回报 > 0？绘制联合学习曲线。
2. **中等。** 添加一个“协调”任务：只有当两个智能体在同一时间步都踩到目标时才到达目标。独立Q学习还能收敛吗？什么会失效？
3. **困难。** 实现一个用于MAPPO风格训练的集中式评论家，并在协调任务上将其收敛速度与独立PPO进行比较。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| 马尔可夫博弈 (Markov game) | “多智能体MDP” | `(S, A_1, …, A_n, P, R_1, …, R_n)`；每个智能体有其自身的奖励。 |
| CTDE | “集中式训练，分散式执行” | 训练时联合评论家；每个智能体的策略仅使用局部观测。 |
| IPPO | “独立PPO” | 每个智能体独立运行PPO。简单基线；常常被低估。 |
| MAPPO | “多智能体PPO” | 带有以全局状态为条件的集中式价值函数的PPO。 |
| QMIX | “单调价值分解” | `Q_tot = f_monotone(Q_1, …, Q_n)` 允许分散式argmax。 |
| COMA | “反事实多智能体” | 优势 = 我的Q减去边际化我动作的期望Q。 |
| 自我对弈 (Self-play) | “智能体对阵过去的自己” | 单一智能体，两个角色；零和博弈的标准做法。 |
| 联盟训练 (League play) | “种群训练” | 缓存过去策略，从池中采样对手；处理策略循环。 |

## 延伸阅读

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) — 带有集中式评论家的CTDE。
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) — 用于信用分配的反事实基线。
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) — 带有单调性的价值分解。
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955) — PPO在MARL中出奇地强大。
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) — 大规模联盟训练。
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) — 零和博弈中的纯自我对弈。
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) — 包括教科书对多智能体设定的简短处理，以及CTDE旨在解决的非平稳性问题。
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) — 涵盖合作、竞争和混合MARL及其收敛结果的综述。