# 蒙特卡洛方法——从完整回合中学习

> 动态规划需要模型。蒙特卡洛只需要回合。运行策略，观察回报，取平均。这是 RL 中最简单的想法——也是解锁后续一切的关键。

**类型：** 构建
**语言：** Python
**前置要求：** 阶段 9 · 01（MDP）、阶段 9 · 02（动态规划）
**时间：** ~75 分钟

## 问题

动态规划很优雅，但它假设你可以查询每个状态和动作的 P(s' | s, a)。现实世界中几乎没有事情是这样运作的。机器人无法解析地计算关节力矩后相机像素的分布。定价算法无法对所有可能的客户反应求积分。LLM 无法枚举一个 token 之后所有可能的延续。

你需要一种只需要能够从环境中**采样**的方法。运行策略。获取一条轨迹 s_0, a_0, r_1, s_1, a_1, r_2, …, s_T。用它来估计价值。这就是蒙特卡洛。

从 DP 到 MC 的转变在哲学上很重要：我们从**已知模型 + 精确 backup** 转向**采样 rollout + 平均回报**。方差增加了，但适用性爆炸式增长。本课之后的所有 RL 算法——TD、Q-learning、REINFORCE、PPO、GRPO——本质上都是蒙特卡洛估计器，有时会在其上叠加自助法。

## 概念

![蒙特卡洛：rollout、计算回报、取平均；首次访问 vs 每次访问](../assets/monte-carlo.svg)

**核心思想，用一句话概括：** V^π(s) = E_π[G_t | s_t = s] ≈ (1/N) Σ_i G^{(i)}(s)，其中 G^{(i)}(s) 是在策略 π 下访问状态 s 后观察到的回报。

**首次访问 vs 每次访问 MC。** 给定一个回合多次访问状态 s，首次访问 MC 只计算首次访问的回报；每次访问 MC 计算所有访问的回报。两者在极限下都是无偏的。首次访问更容易分析（iid 样本）。每次访问每个回合使用更多数据，实践中通常收敛更快。

**增量均值。** 不用存储所有回报，而是更新运行平均值：

V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]

重新组织：V_new = V_old + α · (target - V_old)，其中 α = 1/n。将 1/n 替换为常数步长 α ∈ (0, 1)，你就得到了一个可以跟踪 π 变化的非平稳 MC 估计器。这一转变就是从 MC 到 TD 再到所有现代 RL 算法的整个跳跃。

**探索现在成了一个问题。** DP 通过枚举触及每个状态。MC 只看到策略访问的状态。如果 π 是确定性的，整个状态空间的区域永远不会被采样，它们的价值估计将永远保持为零。按历史顺序有三种修复方法：

1. **探索性起点。** 每个回合从随机的 (s, a) 对开始。保证覆盖；实践中不现实（你无法将机器人"重置"到任意状态）。
2. **ε-贪心。** 相对于当前 Q 值采取贪心动作，但以概率 ε 选择随机动作。所有状态-动作对渐近地都会被采样到。
3. **离策略 MC。** 在行为策略 μ 下收集数据，通过重要性采样学习目标策略 π。方差高，但它是通向 DQN 等回放缓冲区方法的桥梁。

**蒙特卡洛控制。** 评估 → 改进 → 评估，就像策略迭代一样，但评估是基于采样的：

1. 运行 π，获取一个回合。
2. 从观察到的回报更新 Q(s, a)。
3. 使 π 相对于 Q 成为 ε-贪心。
4. 重复。

在温和条件下（每个状态-动作对无限频繁访问，α 满足 Robbins-Monro 条件），以概率 1 收敛到 Q* 和 π*。

`igure
epsilon-greedy
`

## 动手构建

### 步骤 1：rollout → (s, a, r) 列表

`python
def rollout(env, policy, max_steps=200):
    trajectory = []
    s = env.reset()
    for _ in range(max_steps):
        a = policy(s)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r))
        s = s_next
        if done:
            break
    return trajectory
`

没有模型，只有 env.reset() 和 env.step(s, a)。与 gym 环境相同的接口但更精简。

### 步骤 2：计算回报（反向扫描）

`python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
`

一次遍历，O(T)。反向递推 G_t = r_{t+1} + γ G_{t+1} 避免了重新求和。

### 步骤 3：首次访问 MC 评估

`python
def mc_policy_evaluation(env, policy, episodes, gamma=0.99):
    V = defaultdict(float)
    counts = defaultdict(int)
    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for t, ((s, _, _), G) in enumerate(zip(trajectory, returns)):
            if s in seen:
                continue
            seen.add(s)
            counts[s] += 1
            V[s] += (G - V[s]) / counts[s]
    return V
`

三行代码完成工作：首次访问时标记状态，增加计数，更新运行均值。

### 步骤 4：ε-贪心 MC 控制（同策略）

`python
def mc_control(env, episodes, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    counts = defaultdict(lambda: {a: 0 for a in ACTIONS})

    def policy(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for (s, a, _), G in zip(trajectory, returns):
            if (s, a) in seen:
                continue
            seen.add((s, a))
            counts[s][a] += 1
            Q[s][a] += (G - Q[s][a]) / counts[s][a]
    return Q, policy
`

### 步骤 5：与 DP 黄金标准比较

你的 V^π 的 MC 估计应该随着回合数 → ∞ 与课程 02 的 DP 结果一致。实践中：在 4×4 GridWorld 上 50,000 个回合能使你达到 DP 答案的 ~0.1 以内。

## 常见陷阱

- **无限回合。** MC 要求回合**终止**。如果你的策略可能无限循环，设置 max_steps 上限并将超时视为隐式失败。随机策略的 GridWorld 经常超时——这是正常的，只要确保正确计数即可。
- **方差。** MC 使用完整回报。在长回合上，方差巨大——末尾一个不幸的奖励会使 V(s_0) 变化相同的量。TD 方法（课程 04）通过自助法来削减这一点。
- **状态覆盖。** 在全新的 Q 值上的贪心 MC 只会尝试一个动作。你**必须**探索（ε-贪心、探索性起点、UCB）。
- **非平稳策略。** 如果 π 发生变化（如在 MC 控制中），旧的回报来自于不同的策略。常数 α 的 MC 可以处理这一点；样本平均 MC 则不能。
- **离策略重要性采样。** 权重 π(a|s)/μ(a|s) 在轨迹上相乘。方差随视野长度爆炸。使用每决策加权 IS 进行限制，或切换到 TD。

## 使用场景

2026 年蒙特卡洛方法的角色：

| 用例 | 为什么用 MC |
|----------|--------|
| 短视野游戏（二十一点、扑克） | 回合自然终止；回报清晰。 |
| 记录策略的离线评估 | 在存储的轨迹上平均折扣回报。 |
| 蒙特卡洛树搜索（AlphaZero） | 从树叶节点的 MC rollout 引导选择。 |
| LLM RL 评估 | 计算给定策略下采样完成的平均奖励。 |
| PPO 中的基线估计 | 优势目标 A_t = G_t - V(s_t) 使用 MC 的 G_t。 |
| 教授 RL | 最简单的实际可用算法——剥离自助法以看到核心。 |

现代深度 RL 算法（PPO、SAC）通过 
-步回报或 GAE 在纯 MC（完整回报）和纯 TD（一步自助法）之间插值。两个端点都是同一个估计器的实例。

## 交付物

保存为 outputs/skill-mc-evaluator.md：

`markdown
---
name: mc-evaluator
description: 通过蒙特卡洛 rollout 评估策略，并在可用时生成与 DP 比较的收敛报告。
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

给定一个环境（回合制，具有 reset+step API）和一个策略，输出：

1. 方法。首次访问 vs 每次访问 MC。理由。
2. 回合预算。目标数量、方差诊断、预期标准误差。
3. 探索计划。ε 调度（如果需要）或探索性起点。
4. 黄金标准比较。表格型则用 DP 最优 V*；否则使用 Q-learning / PPO 基线的边界。
5. 终止检查。最大步数上限、超时、未终止轨迹的处理。

拒绝在没有有限视野上限的情况下在非回合制任务上运行 MC。拒绝在表格型任务上报告少于每个状态 100 个回合的 V^π 估计。标记任何零方差动作的策略为探索风险。
`

## 练习

1. **简单。** 在 4×4 GridWorld 上实现均匀随机策略的首次访问 MC 评估。运行 10,000 个回合。绘制 V(0,0) 随回合数变化并与 DP 答案对比的图。
2. **中等。** 实现 ε ∈ {0.01, 0.1, 0.3} 的 ε-贪心 MC 控制。比较 20,000 个回合后的平均回报。曲线是什么样子？偏差-方差权衡在哪里？
3. **困难。** 实现带重要性采样的**离策略** MC：在均匀随机策略 μ 下收集数据，估计确定性最优策略 π 的 V^π。比较普通 IS、每决策 IS 和加权 IS。哪个方差最低？

## 关键术语

| 术语 | 人们说的 | 实际意思 |
|------|-----------------|-----------------------|
| 蒙特卡洛 | "随机采样" | 通过对分布中的 iid 样本取平均来估计期望。 |
| 回报 G_t | "未来奖励" | 从步骤 	 到回合结束的折扣奖励和：Σ_{k≥0} γ^k r_{t+k+1}。 |
| 首次访问 MC | "每个状态只算一次" | 回合中只有首次访问对价值估计有贡献。 |
| 每次访问 MC | "使用所有访问" | 每次访问都有贡献；略有偏差但样本效率更高。 |
| ε-贪心 | "探索噪声" | 以概率 1-ε 选贪心动作；以概率 ε 选随机动作。 |
| 重要性采样 | "纠正从错误分布采样" | 用 π(a\|s)/μ(a\|s) 乘积重新加权回报，从 μ 数据估计 V^π。 |
| 同策略 | "从自己的数据学习" | 目标策略 = 行为策略。原始 MC、PPO、SARSA。 |
| 离策略 | "从别人的数据学习" | 目标策略 ≠ 行为策略。重要性采样 MC、Q-learning、DQN。 |

## 扩展阅读

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) — 权威论述。
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) — 首次访问 vs 每次访问分析。
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) — 离策略 MC 和方差控制。
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) — 现代低方差 IS 估计器。
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) — 第一个大规模经验证明 MC/TD 自我对弈可达到超人水平；是本阶段后半部分所有课程的概念先驱。