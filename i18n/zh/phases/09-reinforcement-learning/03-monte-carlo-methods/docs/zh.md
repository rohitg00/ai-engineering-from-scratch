# 蒙特卡洛方法 — 从完整回合中学习

> 动态规划需要一个模型。蒙特卡洛什么都不需要，只要有回合就行。运行策略，观察回报，取平均。这是强化学习中最简单的想法——也是解锁后续所有内容的关键。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (动态规划)
**Time:** ~75 分钟

## 问题所在

动态规划很优雅，但它假设你可以对每个状态和动作查询 `P(s' | s, a)`。现实世界中几乎没有东西是这样运作的。机器人无法解析地计算出关节施加力矩后相机像素的分布。定价算法无法对所有可能的客户反应进行积分。LLM 无法枚举一个 token 之后所有可能的续写。

你需要一种只需要能够从环境中*采样*的方法。运行策略，得到一条轨迹 `s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`，用它来估计价值。这就是蒙特卡洛。

从 DP 到 MC 的转变在哲学上非常重要：我们从*已知模型 + 精确回溯*转向*采样轨迹 + 平均回报*。方差变大了，但适用范围爆炸式增长。本课之后的每个强化学习算法——TD、Q-learning、REINFORCE、PPO、GRPO——本质上都是蒙特卡洛估计器，有时在其上叠加自举（bootstrapping）。

## 核心概念

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**一句话概括核心思想：** `V^π(s) = E_π[G_t | s_t = s] ≈ (1/N) Σ_i G^{(i)}(s)` 其中 `G^{(i)}(s)` 是在策略 `π` 下访问 `s` 之后观测到的回报。

**首次访问 vs 每次访问 MC。** 给定一个多次访问状态 `s` 的回合，首次访问 MC 只统计第一次访问的回报；每次访问 MC 统计所有访问。两者在极限意义下都是无偏的。首次访问更易于分析（iid 样本）。每次访问每回合利用更多数据，实践中通常收敛更快。

**增量均值。** 不必存储所有回报，而是更新滑动平均：

`V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]`

重写为：`V_new = V_old + α · (target - V_old)` 其中 `α = 1/n`。把 `1/n` 换成常数步长 `α ∈ (0, 1)`，就得到一个能跟踪 `π` 变化的非平稳 MC 估计器。这一步就是从 MC 到 TD 再到所有现代强化学习算法的整个跨越。

**探索现在成了问题。** DP 通过枚举触及每个状态。MC 只看到策略访问的状态。如果 `π` 是确定性的，状态空间的整片区域永远不被采样，其价值估计永远停留在零。三种修复方法，按历史顺序：

1. **探索性起始（exploring starts）。** 从随机的 (s, a) 对开始每个回合。保证覆盖；但实践中不现实（你无法把机器人“重置”到任意状态）。
2. **ε-greedy。** 相对当前 Q 贪心行动，但以概率 `ε` 选择随机动作。所有状态-动作对渐近地被采样到。
3. **Off-policy MC。** 在行为策略 `μ` 下采集数据，通过重要性采样学习目标策略 `π`。方差很高，但它是通往 DQN 这类经验回放方法的桥梁。

**蒙特卡洛控制。** 评估 → 改进 → 评估，就像策略迭代一样，但评估基于采样：

1. 运行 `π`，得到一个回合。
2. 用观测到的回报更新 `Q(s, a)`。
3. 使 `π` 相对于 `Q` 采用 ε-greedy。
4. 重复。

在温和条件下（每个状态-动作对被访问无穷多次，`α` 满足 Robbins-Monro 条件），以概率 1 收敛到 `Q*` 和 `π*`。

```figure
epsilon-greedy
```

## 动手实现

### 第 1 步：rollout → (s, a, r) 列表

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

一遍扫描，`O(T)`。反向递推 `G_t = r_{t+1} + γ G_{t+1}` 避免了重复求和。

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

三行代码完成工作：在首次访问时标记状态为已见、计数加一、更新滑动均值。

### 第 4 步：ε-greedy MC 控制（on-policy）

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

你对 `V^π` 的 MC 估计应与第 02 课的 DP 结果一致（当回合数 → ∞）。实践中：在 4×4 GridWorld 上跑 50,000 个回合，可以接近 DP 答案到 `~0.1` 以内。

## 常见陷阱

- **无限回合。** MC 要求回合*终止*。如果策略可能永远循环，为 `max_steps` 设置上限，并把触顶视为隐式失败。随机策略下的 GridWorld 经常超时——这是正常的，只要确保正确计数即可。
- **方差。** MC 使用完整回报。在长回合上，方差巨大——末尾一次不走运的奖励会把 `V(s_0)` 移动相同的幅度。TD 方法（第 04 课）通过自举来削减这一点。
- **状态覆盖。** 对初始化为平局的全新 Q 使用贪心 MC 只会尝试一个动作。你*必须*探索（ε-greedy、exploring starts、UCB）。
- **非平稳策略。** 如果 `π` 在变化（如 MC 控制中），旧回报来自不同的策略。常数 α 的 MC 可以处理；样本平均 MC 不行。
- **Off-policy 重要性采样。** 权重 `π(a|s)/μ(a|s)` 沿轨迹连乘。方差随时间范围爆炸。用 per-decision weighted IS 截断，或改用 TD。

## 应用场景

蒙特卡洛方法在 2026 年的角色：

| 用例 | 为什么用 MC |
|----------|--------|
| 短时程游戏（二十一点、扑克） | 回合自然终止；回报干净。 |
| 已记录策略的离线评估 | 对存储的轨迹求平均折扣回报。 |
| 蒙特卡洛树搜索（AlphaZero） | 从树叶节点出发的 MC 模拟指导选择。 |
| LLM 强化学习评估 | 对给定策略的采样补全计算平均奖励。 |
| PPO 中的基线估计 | 优势目标 `A_t = G_t - V(s_t)` 使用 MC `G_t`。 |
| 强化学习教学 | 最简单的真正有效的算法——去掉自举即可看到核心。 |

现代深度强化学习算法（PPO、SAC）通过 `n`-step 回报或 GAE 在纯 MC（完整回报）和纯 TD（单步自举）之间插值。两个端点是同一估计器的实例。

## 交付

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

1. **简单。** 在 4×4 GridWorld 上实现均匀随机策略的首次访问 MC 评估。运行 10,000 个回合。绘制 `V(0,0)` 随回合数变化的曲线，并与 DP 答案对比。
2. **中等。** 使用 `ε ∈ {0.01, 0.1, 0.3}` 实现 ε-greedy MC 控制。比较 20,000 个回合后的平均回报。曲线是什么形状？偏差-方差权衡体现在哪里？
3. **困难。** 实现带重要性采样的 *off-policy* MC：在均匀随机策略 `μ` 下采集数据，为确定性最优策略 `π` 估计 `V^π`。比较普通 IS、per-decision IS 和 weighted IS。哪个方差最低？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 蒙特卡洛 | “随机采样” | 通过对来自该分布的 iid 样本取平均来估计期望。 |
| 回报 `G_t` | “未来奖励” | 从第 `t` 步到回合结束的折扣奖励之和：`Σ_{k≥0} γ^k r_{t+k+1}`。 |
| 首次访问 MC | “每个状态只计一次” | 只有回合内的首次访问对价值估计有贡献。 |
| 每次访问 MC | “使用所有访问” | 每次访问都有贡献；略微有偏但样本效率更高。 |
| ε-greedy | “探索噪声” | 以概率 `1-ε` 选择贪心动作；以概率 `ε` 选择随机动作。 |
| 重要性采样 | “纠正从错误分布采样的偏差” | 用 `π(a\|s)/μ(a\|s)` 的乘积对回报重加权，以便从 `μ` 数据估计 `V^π`。 |
| On-policy | “从自己的数据学习” | 目标策略 = 行为策略。标准 MC、PPO、SARSA。 |
| Off-policy | “从别人的数据学习” | 目标策略 ≠ 行为策略。重要性采样 MC、Q-learning、DQN。 |

## 延伸阅读

- [Sutton & Barto (2018). 第 5 章 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) — 经典论述。
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) — 首次访问与每次访问的分析。
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) — off-policy MC 与方差控制。
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) — 现代低方差 IS 估计器。
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) — MC/TD 自我对弈收敛到超人类水平的首个大规模实证演示；本阶段后半部分每节课的概念先声。