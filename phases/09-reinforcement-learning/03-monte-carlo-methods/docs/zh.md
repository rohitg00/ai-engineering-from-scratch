# 03 · 蒙特卡洛方法——从完整回合中学习

> 动态规划需要模型，蒙特卡洛只需要回合（episodes）。运行策略，观察回报，求平均。这是强化学习中最简单的思想——也是解锁后续一切的那把钥匙。

**类型：** 构建
**语言：** Python
**前置：** 阶段 9 · 01（马尔可夫决策过程），阶段 9 · 02（动态规划）
**时长：** 约 75 分钟

## 问题所在

动态规划很优雅，但它假定你能对每个状态和动作查询 `P(s' | s, a)`。然而现实世界中几乎没有什么是这样运作的。机器人无法解析地计算关节施加力矩后摄像头像素的分布；定价算法无法对每一种可能的客户反应做积分；大语言模型也无法在某个 token 之后枚举所有可能的续写。

你需要一种只依赖「采样（sample）」环境能力的方法。运行策略，得到一条轨迹 `s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`，用它来估计价值。这就是蒙特卡洛。

从动态规划（DP）到蒙特卡洛（MC）的转变在理念上很重要：我们从「已知模型 + 精确回溯」转向「采样推演（rollout）+ 平均回报」。方差骤增，但适用范围爆发式扩大。这一课之后的每一个强化学习算法——TD、Q-learning、REINFORCE、PPO、GRPO——本质上都是蒙特卡洛估计器，有时只是在其之上叠加了自举（bootstrapping）。

## 核心概念

〔图：蒙特卡洛——推演、计算回报、求平均；首次访问 vs 每次访问〕

**一句话讲清核心思想：** `V^π(s) = E_π[G_t | s_t = s] ≈ (1/N) Σ_i G^{(i)}(s)`，其中 `G^{(i)}(s)` 是在策略 `π` 下访问 `s` 之后所观测到的回报。

**首次访问（first-visit）与每次访问（every-visit）MC。** 给定一个多次访问状态 `s` 的回合，首次访问 MC 只统计第一次访问之后的回报；每次访问 MC 则统计所有访问。两者在极限意义下都是无偏的。首次访问更易于分析（独立同分布样本）；每次访问每个回合利用了更多数据，实践中通常收敛更快。

**增量均值（incremental mean）。** 不必存储所有回报，而是更新移动平均：

`V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]`

重新整理：`V_new = V_old + α · (target - V_old)`，其中 `α = 1/n`。把 `1/n` 换成一个常数步长 `α ∈ (0, 1)`，你就得到一个非平稳的 MC 估计器，它能跟踪 `π` 的变化。正是这一步，构成了从 MC 到 TD 再到每一个现代强化学习算法的整个跨越。

**探索如今成了一个问题。** DP 通过枚举触及每一个状态，MC 只能看到策略所访问的状态。如果 `π` 是确定性的，整片状态空间区域就永远不会被采样到，它们的价值估计将永远停留在零。三种修补方法，按历史顺序排列：

1. **探索性起点（Exploring starts）。** 每个回合从随机的 (s, a) 对开始。能保证覆盖；但实践中不现实（你无法把机器人「重置」到任意状态）。
2. **ε-贪婪（ε-greedy）。** 相对当前 Q 采取贪婪动作，但以概率 `ε` 选取随机动作。所有状态-动作对在渐近意义下都会被采样到。
3. **离策略（Off-policy）MC。** 在行为策略（behavior policy）`μ` 下采集数据，通过重要性采样（importance sampling）来学习目标策略（target policy）`π`。方差很高，但它是通往 DQN 等回放缓冲区（replay-buffer）方法的桥梁。

**蒙特卡洛控制（Monte Carlo Control）。** 评估 → 改进 → 评估，与策略迭代（policy iteration）一样，只是评估基于采样：

1. 运行 `π`，得到一个回合。
2. 从观测到的回报更新 `Q(s, a)`。
3. 让 `π` 相对 `Q` 变为 ε-贪婪。
4. 重复。

在温和条件下（每个对都被无限次访问、`α` 满足 Robbins-Monro 条件），它以概率 1 收敛到 `Q*` 和 `π*`。

## 动手构建

### 第 1 步：推演 → (s, a, r) 列表

```python
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
```

没有模型，只有 `env.reset()` 和 `env.step(s, a)`。接口与 gym 环境相同，但做了精简。

### 第 2 步：计算回报（反向扫描）

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

单趟遍历，`O(T)`。反向递推 `G_t = r_{t+1} + γ G_{t+1}` 避免了重复求和。

### 第 3 步：首次访问 MC 评估

```python
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
```

核心工作由三行完成：首次访问时标记状态为已见、计数加一、更新移动均值。

### 第 4 步：ε-贪婪 MC 控制（在策略，on-policy）

```python
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
```

### 第 5 步：与 DP 黄金标准对比

随着回合数 → ∞，你的 MC 估计 `V^π` 应当与第 02 课的 DP 结果一致。实践中：在 4×4 GridWorld 上跑 50,000 个回合，可让你逼近 DP 答案到 `~0.1` 以内。

## 常见陷阱

- **无限回合。** MC 要求回合「终止」。如果你的策略可能永远循环下去，就给 `max_steps` 设上限，并把触顶视为隐式失败。采用随机策略的 GridWorld 经常超时——这很正常，只要确保你正确地统计了它。
- **方差。** MC 使用完整回报。在长回合上，方差极大——结尾处一个倒霉的奖励就会让 `V(s_0)` 偏移同样的量。TD 方法（第 04 课）通过自举来削减这一点。
- **状态覆盖。** 对一个全新且存在并列项的 Q 采取贪婪 MC，将永远只尝试一个动作。你「必须」探索（ε-贪婪、探索性起点、UCB）。
- **非平稳策略。** 如果 `π` 发生变化（如在 MC 控制中），旧的回报来自一个不同的策略。常数-α 的 MC 能处理这种情况，而样本平均（sample-average）的 MC 不能。
- **离策略重要性采样。** 权重 `π(a|s)/μ(a|s)` 会沿整条轨迹连乘。方差随时间跨度（horizon）爆炸式增长。用逐决策（per-decision）的加权 IS 来封顶，或者改用 TD。

## 实际应用

蒙特卡洛方法在 2026 年所扮演的角色：

| 应用场景 | 为何用 MC |
|----------|--------|
| 短时跨度游戏（21 点、扑克） | 回合自然终止；回报很干净。 |
| 对已记录策略的离线评估 | 在已存储的轨迹上对折扣回报求平均。 |
| 蒙特卡洛树搜索（AlphaZero） | 从树叶节点出发的 MC 推演引导选择。 |
| 大语言模型强化学习评估 | 对给定策略采样的补全计算平均奖励。 |
| PPO 中的基线估计 | 优势目标 `A_t = G_t - V(s_t)` 使用了 MC 的 `G_t`。 |
| 强化学习教学 | 真正能跑通的最简单算法——剥去自举即可看到内核。 |

现代深度强化学习算法（PPO、SAC）通过 `n` 步回报或 GAE，在纯 MC（完整回报）与纯 TD（单步自举）之间进行插值。两个端点都是同一个估计器的实例。

## 交付物

保存为 `outputs/skill-mc-evaluator.md`：

```markdown
---
name: mc-evaluator
description: Evaluate a policy via Monte Carlo rollouts and produce a convergence report with DP-comparison if available.
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

Given an environment (episodic, with reset+step API) and a policy, output:

1. Method. First-visit vs every-visit MC. Reason.
2. Episode budget. Target number, variance diagnostic, expected standard error.
3. Exploration plan. ε schedule (if needed) or exploring starts.
4. Gold-standard comparison. DP-optimal V* if tabular; otherwise a bound from a Q-learning / PPO baseline.
5. Termination check. Max-step cap, timeouts, handling of non-terminating trajectories.

Refuse to run MC on non-episodic tasks without a finite horizon cap. Refuse to report V^π estimates from fewer than 100 episodes per state for tabular tasks. Flag any policy with zero-variance actions as an exploration risk.
```

## 练习

1. **简单。** 在 4×4 GridWorld 上对均匀随机策略实现首次访问 MC 评估。运行 10,000 个回合。绘制 `V(0,0)` 随回合数变化的曲线，并与 DP 答案对比。
2. **中等。** 实现 ε-贪婪 MC 控制，取 `ε ∈ {0.01, 0.1, 0.3}`。比较 20,000 个回合后的平均回报。曲线长什么样？偏差-方差权衡（bias-variance tradeoff）出现在哪里？
3. **困难。** 实现带重要性采样的「离策略」MC：在均匀随机策略 `μ` 下采集数据，为确定性最优策略 `π` 估计 `V^π`。比较普通 IS、逐决策 IS 与加权 IS。哪种方差最低？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 蒙特卡洛 | 「随机采样」 | 通过对来自该分布的独立同分布样本求平均，来估计期望。 |
| 回报 `G_t` | 「未来奖励」 | 从步 `t` 到回合结束的折扣奖励之和：`Σ_{k≥0} γ^k r_{t+k+1}`。 |
| 首次访问 MC | 「每个状态只计一次」 | 一个回合中只有首次访问对价值估计有贡献。 |
| 每次访问 MC | 「用上所有访问」 | 每次访问都有贡献；略有偏差但样本效率更高。 |
| ε-贪婪 | 「探索噪声」 | 以概率 `1-ε` 选贪婪动作；以概率 `ε` 选随机动作。 |
| 重要性采样 | 「校正从错误分布采样」 | 用 `π(a\|s)/μ(a\|s)` 连乘来重新加权回报，从 `μ` 的数据估计 `V^π`。 |
| 在策略（On-policy） | 「从我自己的数据中学习」 | 目标策略 = 行为策略。原味 MC、PPO、SARSA。 |
| 离策略（Off-policy） | 「从别人的数据中学习」 | 目标策略 ≠ 行为策略。重要性采样 MC、Q-learning、DQN。 |

## 延伸阅读

- [Sutton & Barto (2018). 第 5 章——蒙特卡洛方法](http://incompleteideas.net/book/RLbook2020.pdf) —— 经典权威论述。
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) —— 首次访问与每次访问的分析。
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) —— 离策略 MC 与方差控制。
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) —— 现代低方差 IS 估计器。
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) —— 首个大规模实证地展示 MC/TD 自博弈收敛到超人水平的工作；是本阶段后半部分每一课的概念先驱。
