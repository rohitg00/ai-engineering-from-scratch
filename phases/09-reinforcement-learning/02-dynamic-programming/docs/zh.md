# 动态规划——策略迭代与价值迭代

> 动态规划是作弊的强化学习。你已经知道转移函数和奖励函数；你只需要不断迭代贝尔曼方程，直到 `V` 或 `π` 不再变化。它是所有基于采样的方法试图接近的基准。

**类型：** 构建
**语言：** Python
**前置知识：** 第9阶段 · 01（马尔可夫决策过程）
**预计用时：** ~75分钟

## 问题

你有一个已知模型的马尔可夫决策过程（MDP，Markov Decision Process）：你可以查询任意状态-动作对的 `P(s' | s, a)` 和 `R(s, a, s')`。库存管理者知道需求分布。棋盘游戏的转移是确定性的。网格世界（GridWorld）用四行 Python 代码就能实现。你拥有一个*模型*。

无模型强化学习（Q学习、PPO、REINFORCE）是为没有模型的情况而发明的——你只能从环境中采样。但当你拥有模型时，存在更快、更好的方法：动态规划。贝尔曼在 1957 年设计了它们。它们至今仍定义着正确性：当人们说"这个 MDP 的最优策略"时，他们指的是动态规划算法会返回的策略。

你在 2026 年需要它们，原因有三。第一，强化学习研究中的所有表格环境（GridWorld、FrozenLake、CliffWalking）都使用动态规划求解，以产生黄金标准策略。第二，精确值能让你*调试*采样方法：如果 Q 学习对 `V*(s_0)` 的估计与动态规划答案相差 30%，说明你的 Q 学习有 bug。第三，现代离线强化学习和规划方法（MCTS、AlphaZero 的搜索、第9阶段 · 10中的基于模型的强化学习）都在学习到的或给定的模型上迭代贝尔曼备份。

## 概念

![策略迭代和价值迭代，并排对比](../assets/dp.svg)

**两种算法，都是对贝尔曼方程的不动点迭代。**

**策略迭代。** 交替执行两个步骤，直到策略不再变化。

1. *评估：* 给定策略 `π`，重复应用 `V(s) ← Σ_a π(a|s) Σ_{s',r} P(s',r|s,a) [r + γ V(s')]` 直到收敛，从而计算 `V^π`。
2. *改进：* 给定 `V^π`，使 `π` 相对于 `V^π` 贪心：`π(s) ← argmax_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`。

收敛性有保证，因为 (a) 每个改进步骤要么保持 `π` 不变，要么严格增加某些状态的 `V^π`，(b) 确定性策略的空间是有限的。即使在大的状态空间下，通常也只需要约 5–20 次外部迭代即可收敛。

**价值迭代。** 将评估和改进合并到一次遍历中。应用贝尔曼*最优*方程：

`V(s) ← max_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`

重复直到 `max_s |V_{新}(s) - V(s)| < ε`。最后通过选取贪心动作来提取策略。每次迭代严格更快——没有内部评估循环——但通常需要更多迭代才能收敛。

**广义策略迭代（GPI，Generalized Policy Iteration）。** 统一框架。价值函数和策略被锁定在一个双向改进循环中；任何驱动两者走向相互一致的方法（异步价值迭代、修正策略迭代、Q学习、演员-评论家、PPO）都是 GPI 的实例。

**为什么 `γ < 1` 很重要。** 贝尔曼算子在无穷范数下是一个 `γ`-收缩（Contraction）：`||T V - T V'||_∞ ≤ γ ||V - V'||_∞`。收缩意味着唯一的不动点和几何收敛。去掉 `γ < 1` 你就会失去这个保证——你需要有限时域或吸收终止状态。

## 构建实现

### 第1步：构建GridWorld MDP模型

使用与第01课相同的 4×4 GridWorld。我们添加一个随机变体：以概率 `0.1` 智能体会滑向一个随机的垂直方向。

```python
SLIP = 0.1

def transitions(state, action):
    if state == TERMINAL:
        return [(state, 0.0, 1.0)]
    outcomes = []
    for direction, prob in action_probs(action):
        outcomes.append((apply_move(state, direction), -1.0, prob))
    return outcomes
```

`transitions(s, a)` 返回一个 `(s', r, p)` 列表。这就是整个模型。

### 第2步：策略评估

给定一个策略 `π(s) = {action: prob}`，迭代贝尔曼方程直到 `V` 不再变化：

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = sum(pi_a * sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a))
                   for a, pi_a in policy(s).items())
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

### 第3步：策略改进

将 `π` 替换为相对于 `V` 的贪心策略。如果 `π` 没有变化，则返回——我们已经达到最优。

```python
def policy_improvement(V, gamma=0.99):
    new_policy = {}
    for s in states():
        best_a = max(
            ACTIONS,
            key=lambda a: sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a)),
        )
        new_policy[s] = best_a
    return new_policy
```

### 第4步：将它们组合起来

```python
def policy_iteration(gamma=0.99):
    policy = {s: "up" for s in states()}   # 任意起始策略
    for _ in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma)
        new_policy = policy_improvement(V, gamma)
        if new_policy == policy:
            return V, policy
        policy = new_policy
```

在 4×4 上的典型收敛：4–6 次外部迭代。输出 `V*(0,0) ≈ -6` 和一个严格减少步数的策略。

### 第5步：价值迭代（单循环版本）

```python
def value_iteration(gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = max(sum(p * (r + gamma * V[s_prime])
                       for s_prime, r, p in transitions(s, a))
                   for a in ACTIONS)
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            break
    policy = policy_improvement(V, gamma)
    return V, policy
```

相同的不动点，更少的代码行数。

## 陷阱

- **忘记处理终止状态。** 如果你对吸收状态应用贝尔曼方程，它会选取一个"最佳动作"但实际上什么都不会改变。用 `if s == terminal: V[s] = 0` 加以保护。
- **无穷范数收敛 vs L2 收敛。** 使用 `max |V_新 - V|`，而不是平均值。理论保证是基于无穷范数的。
- **就地更新 vs 同步更新。** 就地更新 `V[s]`（高斯-赛德尔）比单独使用 `V_新` 字典（雅可比）收敛更快。生产代码使用就地更新。
- **策略平局。** 如果两个动作的 Q 值相等，`argmax` 可能在每次迭代中以不同方式打破平局，导致"策略稳定"检查发生振荡。使用稳定的平局打破规则（固定顺序中的第一个动作）。
- **状态空间爆炸。** 动态规划每遍扫描的复杂度为 `O(|S| · |A|)`。最多适用于约 10⁷ 个状态。超过这个规模，你需要函数近似（从第9阶段 · 05 开始）。

## 使用场景

在 2026 年，动态规划是正确性基准和规划器的内部循环：

| 使用场景 | 方法 |
|----------|------|
| 精确求解小型表格 MDP | 价值迭代（更简单）或策略迭代（更少外部步骤） |
| 验证 Q 学习 / PPO 实现 | 在玩具环境上对比动态规划最优的 V* |
| 基于模型的强化学习（第9阶段 · 10） | 在学习到的转移模型上做贝尔曼备份 |
| AlphaZero / MuZero 中的规划 | 蒙特卡洛树搜索 = 异步贝尔曼备份 |
| 离线强化学习（CQL、IQL） | 保守 Q 迭代——带 OOD 动作惩罚的动态规划 |

每当有人说"最优价值函数"时，他们指的是"动态规划的不动点"。当你在论文中看到 `V*` 或 `Q*` 时，想象这个循环。

## 交付要求

保存为 `outputs/skill-dp-solver.md`：

```markdown
---
name: dp-solver
description: 通过策略迭代或价值迭代精确求解小型表格 MDP。报告收敛行为。
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

给定一个具有已知模型的 MDP，输出：

1. 选择。策略迭代 vs 价值迭代。原因与 |S|、|A|、γ 相关。
2. 初始化。V_0，起始策略。收敛敏感性。
3. 停止。无穷范数容差 ε。预期的扫描次数。
4. 验证。精确计算 V*(s_0)。提取贪心策略。
5. 用途。该基线将如何用于调试/评估基于采样的方法。

拒绝在状态空间 > 10⁷ 的情况下运行动态规划。拒绝在没有无穷范数检查的情况下声称收敛。对于无穷时域任务，标记任何 γ ≥ 1 的情况为保证违规。
```

## 练习

1. **简单。** 在 4×4 GridWorld 上运行价值迭代，γ 分别取 `0.9` 和 `0.99`。需要多少次扫描直到 `max |ΔV| < 1e-6`？将 `V*` 打印为 4×4 网格。
2. **中等。** 在*随机版* GridWorld（滑移概率 `0.1`）上比较策略迭代和价值迭代。统计：扫描次数、墙钟时间、最终 `V*(0,0)`。哪个在迭代次数上收敛更快？在墙钟时间上呢？
3. **困难。** 构建修正策略迭代：在评估步骤中，只运行 `k` 次扫描而不是直到收敛。绘制 `V*(0,0)` 误差关于 `k` 的曲线，`k ∈ {1, 2, 5, 10, 50}`。这条曲线告诉了你关于评估/改进权衡的什么？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 策略迭代 (Policy iteration) | "动态规划算法" | 交替进行评估（`V^π`）和改进（相对于 `V^π` 的贪心 `π`），直到策略不再变化。 |
| 价值迭代 (Value iteration) | "更快的动态规划" | 一次扫描中应用贝尔曼最优备份；几何收敛到 `V*`。 |
| 贝尔曼算子 (Bellman operator) | "递归" | `(T V)(s) = max_a Σ P (r + γ V(s'))`；在无穷范数下是 `γ`-收缩。 |
| 收缩 (Contraction) | "为什么动态规划收敛" | 任何满足 `||T x - T y|| ≤ γ ||x - y||` 的算子 `T` 都有唯一的不动点。 |
| 广义策略迭代 (GPI) | "一切都是动态规划" | 广义策略迭代：任何驱动 `V` 和 `π` 走向相互一致的方法。 |
| 同步更新 (Synchronous update) | "雅可比风格" | 一次扫描中全部使用旧的 `V`；易于分析但较慢。 |
| 就地更新 (In-place update) | "高斯-赛德尔风格" | 使用正在更新的 `V`；实践中收敛更快。 |

## 延伸阅读

- [Sutton & Barto (2018). 第4章 — 动态规划](http://incompleteideas.net/book/RLbook2020.pdf) — 策略迭代和价值迭代的经典介绍。
- [Bertsekas (2019). 强化学习与最优控制](http://www.athenasc.com/rlbook.html) — 对收缩映射论证的严谨处理。
- [Puterman (2005). 马尔可夫决策过程](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) — 修正策略迭代及其收敛性分析。
- [Howard (1960). 动态规划与马尔可夫过程](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) — 原始的策略迭代论文。
- [Bertsekas & Tsitsiklis (1996). 神经-动态规划](http://www.athenasc.com/ndpbook.html) — 从动态规划到近似动态规划/深度强化学习的桥梁，后续所有课程都会用到。