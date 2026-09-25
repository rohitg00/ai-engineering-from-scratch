# 动态规划 —— 策略迭代与价值迭代

> 动态规划是“作弊”的强化学习。你已经知道转移函数和奖励函数；只需迭代 Bellman 方程，直到 `V` 或 `π` 不再变化。它是每种基于采样的方法都在努力逼近的基准。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 分钟

## 问题所在

你有一个模型已知的 MDP：对任意“状态-动作”对都可以查询 `P(s' | s, a)` 和 `R(s, a, s')`。库存管理者知道需求分布。棋盘游戏具有确定性转移。一个 gridworld 只需四行 Python 代码。你拥有一个*模型*。

无模型强化学习（Q-learning、PPO、REINFORCE）正是为没有模型的场景而发明的——你只能从环境中采样。但当你确实拥有模型时，就有更快、更好的方法：动态规划。Bellman 在 1957 年设计了它们。它们至今仍定义着“正确性”：当人们说“这个 MDP 的最优策略”时，指的就是 DP 会返回的那个策略。

在 2026 年你仍需要它们，理由有三。第一，RL 研究中的每个表格型环境（GridWorld、FrozenLake、CliffWalking）都用 DP 求解，以产生黄金标准的策略。第二，精确值让你能够*调试*采样方法：如果 Q-learning 对 `V*(s_0)` 的估计与 DP 的答案相差 30%，说明你的 Q-learning 有 bug。第三，现代离线强化学习与规划方法（MCTS、AlphaZero 的搜索、Phase 9 · 10 中基于模型的 RL）都在学习到的或给定的模型上迭代 Bellman backup。

## 核心概念

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**两种算法，本质上都是对 Bellman 方程的不动点迭代。**

**策略迭代。** 交替执行两个步骤，直到策略不再变化。

1. *评估：* 给定策略 `π`，通过反复应用 `V(s) ← Σ_a π(a|s) Σ_{s',r} P(s',r|s,a) [r + γ V(s')]` 直到收敛，计算 `V^π`。
2. *改进：* 给定 `V^π`，使 `π` 对 `V^π` 贪心：`π(s) ← argmax_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`。

收敛是有保证的，因为 (a) 每次改进步骤要么使 `π` 保持不变，要么严格提高某些状态上的 `V^π`；(b) 确定性策略的空间是有限的。即使对于大规模状态空间，通常也只需约 5–20 次外层迭代即可收敛。

**价值迭代。** 将评估和改进压缩为一轮扫描。应用 Bellman *最优性*方程：

`V(s) ← max_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`

重复直到 `max_s |V_{new}(s) - V(s)| < ε`。最后通过选择贪心动作来提取策略。每次迭代严格更快——没有内层评估循环——但通常需要更多次迭代才能收敛。

**广义策略迭代（GPI）。** 统一的框架。价值函数和策略处于一个双向改进的循环中；任何促使两者趋于相互一致的方法（异步价值迭代、改进的策略迭代、Q-learning、actor-critic、PPO）都是 GPI 的实例。

**为什么 `γ < 1` 很重要。** Bellman 算子在 sup-范数下是 `γ`-压缩映射：`||T V - T V'||_∞ ≤ γ ||V - V'||_∞`。压缩映射意味着唯一的不动点和几何级收敛。去掉 `γ < 1`，保证就消失了——你需要有限时域或吸收型终止状态。

```figure
value-iteration-gamma
```

## 动手构建

### 步骤 1：构建 GridWorld MDP 模型

使用与第 01 课相同的 4×4 GridWorld。我们添加一个随机变体：以概率 `0.1`，智能体会滑向一个随机的垂直方向。

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

`transitions(s, a)` 返回一个 `(s', r, p)` 列表。这就是完整的模型。

### 步骤 2：策略评估

给定策略 `π(s) = {action: prob}`，迭代 Bellman 方程，直到 `V` 不再变化：

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

### 步骤 3：策略改进

用对 `V` 贪心的策略替换 `π`。如果 `π` 没有变化，返回——我们已处于最优。

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

### 步骤 4：将它们拼接起来

```python
def policy_iteration(gamma=0.99):
    policy = {s: "up" for s in states()}   # arbitrary start
    for _ in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma)
        new_policy = policy_improvement(V, gamma)
        if new_policy == policy:
            return V, policy
        policy = new_policy
```

在 4×4 上的典型收敛：4–6 次外层迭代。输出 `V*(0,0) ≈ -6` 和一个严格减少步数的策略。

### 步骤 5：价值迭代（单循环版本）

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

同样的不动点，更少的代码行数。

## 常见陷阱

- **忘记处理终止状态。** 如果你对吸收状态应用 Bellman 方程，它仍会选出一个毫无改变的“最佳动作”。用 `if s == terminal: V[s] = 0` 加以防护。
- **Sup-范数与 L2 收敛。** 使用 `max |V_new - V|`，而不是平均值。理论保证是基于 sup-范数的。
- **原地更新与同步更新。** 原地更新 `V[s]`（Gauss-Seidel 风格）比使用单独的 `V_new` 字典（Jacobi 风格）收敛更快。生产代码使用原地更新。
- **策略平局。** 如果两个动作的 Q 值相等，`argmax` 每次迭代可能以不同方式打破平局，导致“策略稳定”检查来回震荡。使用稳定的平局处理方式（固定顺序中的第一个动作）。
- **状态空间爆炸。** DP 每轮扫描的复杂度为 `O(|S| · |A|)`。适用于最多约 10⁷ 个状态。超过这个规模，你需要函数逼近（Phase 9 · 05 及之后）。

## 实际应用

在 2026 年，DP 是正确性基线，也是规划器的内层循环：

| 使用场景 | 方法 |
|----------|--------|
| 精确求解小型表格型 MDP | 价值迭代（更简单）或策略迭代（外层步骤更少） |
| 验证 Q-learning / PPO 实现 | 在玩具环境中与 DP 最优的 V* 比较 |
| 基于模型的 RL（Phase 9 · 10） | 在学习到的转移模型上执行 Bellman backup |
| AlphaZero / MuZero 中的规划 | Monte Carlo Tree Search = 异步 Bellman backup |
| 离线强化学习（CQL、IQL） | 保守 Q 迭代——带 OOD 动作惩罚的 DP |

每当有人说“最优价值函数”时，他们指的就是“DP 的不动点”。当你在论文中看到 `V*` 或 `Q*` 时，请在脑海中想象这个循环。

## 交付成果

保存为 `outputs/skill-dp-solver.md`：

```markdown
---
name: dp-solver
description: Solve a small tabular MDP exactly via policy iteration or value iteration. Report convergence behavior.
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

Given an MDP with a known model, output:

1. Choice. Policy iteration vs value iteration. Reason tied to |S|, |A|, γ.
2. Initialization. V_0, starting policy. Convergence sensitivity.
3. Stopping. Sup-norm tolerance ε. Expected number of sweeps.
4. Verification. V*(s_0) computed exactly. Greedy policy extracted.
5. Use. How this baseline will be used to debug/evaluate sampling-based methods.

Refuse to run DP on state spaces > 10⁷. Refuse to claim convergence without a sup-norm check. Flag any γ ≥ 1 on an infinite-horizon task as a guarantee violation.
```

## 练习

1. **简单。** 在 4×4 GridWorld 上以 `γ ∈ {0.9, 0.99}` 运行价值迭代。多少次扫描后 `max |ΔV| < 1e-6`？将 `V*` 打印为 4×4 网格。
2. **中等。** 在*随机* GridWorld（滑动概率 `0.1`）上比较策略迭代与价值迭代。统计：扫描次数、实际运行时间、最终的 `V*(0,0)`。哪种方法在迭代次数上收敛更快？在实际运行时间上呢？
3. **困难。** 构建改进的策略迭代：在评估步骤中，只运行 `k` 次扫描，而不是运行到收敛。针对 `k ∈ {1, 2, 5, 10, 50}`，绘制 `V*(0,0)` 误差随 `k` 变化的曲线。这条曲线告诉你评估/改进之间怎样的权衡？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 策略迭代 | “DP 算法” | 交替执行评估（`V^π`）和改进（对 `V^π` 贪心的 `π`），直到策略不再变化。 |
| 价值迭代 | “更快的 DP” | 一轮扫描中应用 Bellman 最优性 backup；以几何级速度收敛到 `V*`。 |
| Bellman 算子 | “递归式” | `(T V)(s) = max_a Σ P (r + γ V(s'))`；在 sup-范数下是 `γ`-压缩映射。 |
| 压缩映射 | “DP 为何收敛” | 任何满足 `\|\|T x - T y\|\| ≤ γ \|\|x - y\|\|` 的算子 `T` 都有唯一的不动点。 |
| GPI | “一切皆 DP” | 广义策略迭代：任何促使 `V` 和 `π` 趋于相互一致的方法。 |
| 同步更新 | “Jacobi 风格” | 整轮扫描使用旧的 `V`；便于理论分析但更慢。 |
| 原地更新 | “Gauss-Seidel 风格” | 在 `V` 被更新的同时使用它；实践中收敛更快。 |

## 延伸阅读

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) —— 策略迭代与价值迭代的经典论述。
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook.html) —— 对压缩映射论证的严谨处理。
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) —— 改进的策略迭代及其收敛性分析。
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) —— 策略迭代的原始论文。
- [Bertsekas & Tsitsikis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) —— 从 DP 到近似 DP / 深度强化学习的桥梁，为后续所有课程所用。