# 02 · 动态规划——策略迭代与价值迭代

> 动态规划是「开了挂」的强化学习。你已经知道转移函数和奖励函数，只需反复迭代贝尔曼方程，直到 `V` 或 `π` 不再变化。它是每一种基于采样的方法都试图逼近的基准。

**类型：** 实战构建
**语言：** Python
**前置：** 阶段 9 · 01（马尔可夫决策过程）
**时长：** 约 75 分钟

## 问题所在

你有一个模型已知的「马尔可夫决策过程（MDP, Markov Decision Process）」：对任意状态-动作对，你都能查询 `P(s' | s, a)` 和 `R(s, a, s')`。库存管理者知道需求分布；棋盘游戏拥有确定性的转移；网格世界（gridworld）只需四行 Python。你手里有一个*模型*。

「无模型强化学习（model-free RL）」（Q-learning、PPO、REINFORCE）是为没有模型的场景发明的——你只能从环境中采样。但当你确实有模型时，存在更快、更好的方法：动态规划。贝尔曼（Bellman）在 1957 年设计了它们。直到今天，它们仍然定义着「正确性」：当人们说「这个 MDP 的最优策略」时，指的就是动态规划会返回的那个策略。

到 2026 年，你依然需要它们，原因有三。第一，强化学习研究中的每一个表格型环境（GridWorld、FrozenLake、CliffWalking）都用动态规划求解，以产出黄金标准策略。第二，精确的价值能让你*调试*采样方法：如果 Q-learning 对 `V*(s_0)` 的估计与动态规划答案相差 30%，那你的 Q-learning 有 bug。第三，现代离线强化学习与规划方法（MCTS、AlphaZero 的搜索、阶段 9 · 10 的基于模型强化学习）全都在一个学到的或给定的模型上迭代贝尔曼回溯。

## 核心概念

〔图：策略迭代与价值迭代并列对比〕

**两种算法，本质上都是对贝尔曼方程做不动点迭代。**

**策略迭代（policy iteration）。** 交替执行两个步骤，直到策略不再变化。

1. *评估：* 给定策略 `π`，通过反复应用 `V(s) ← Σ_a π(a|s) Σ_{s',r} P(s',r|s,a) [r + γ V(s')]` 直到收敛，从而计算出 `V^π`。
2. *改进：* 给定 `V^π`，令 `π` 对 `V^π` 取贪心：`π(s) ← argmax_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`。

收敛之所以有保证，是因为：(a) 每一步改进要么保持 `π` 不变，要么对某些状态严格提升 `V^π`；(b) 确定性策略的空间是有限的。即使状态空间很大，通常也只需约 5–20 次外层迭代即可收敛。

**价值迭代（value iteration）。** 将评估和改进合并为一次扫描。直接应用贝尔曼*最优性*方程：

`V(s) ← max_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`

反复执行直到 `max_s |V_{new}(s) - V(s)| < ε`。结束时通过取贪心动作来提取策略。每次迭代严格更快——没有内层的评估循环——但通常需要更多次迭代才能收敛。

**广义策略迭代（GPI, Generalized Policy Iteration）。** 这是统一各种方法的框架。价值函数与策略被锁定在一个双向改进循环中；任何驱动二者趋于相互一致的方法（异步价值迭代、修改版策略迭代、Q-learning、actor-critic、PPO）都是 GPI 的一个实例。

**为什么 `γ < 1` 很重要。** 贝尔曼算子在「上确界范数（sup-norm）」下是一个 `γ`-压缩映射：`||T V - T V'||_∞ ≤ γ ||V - V'||_∞`。压缩性意味着唯一的不动点和几何级数式收敛。一旦放弃 `γ < 1`，你就失去了这个保证——此时你需要有限时域，或者一个吸收性的终止状态。

## 动手构建

### 第 1 步：构建 GridWorld 的 MDP 模型

沿用第 01 课中相同的 4×4 GridWorld。我们加入一个随机变体：以概率 `0.1`，智能体会滑向某个随机的垂直方向。

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

`transitions(s, a)` 返回一个 `(s', r, p)` 列表。这就是模型的全部。

### 第 2 步：策略评估

给定策略 `π(s) = {action: prob}`，迭代贝尔曼方程直到 `V` 不再变化：

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

### 第 3 步：策略改进

用对 `V` 取贪心后的策略替换 `π`。如果 `π` 没有变化，就返回——我们已经到达最优。

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

### 第 4 步：把它们拼起来

```python
def policy_iteration(gamma=0.99):
    policy = {s: "up" for s in states()}   # 任意的初始策略
    for _ in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma)
        new_policy = policy_improvement(V, gamma)
        if new_policy == policy:
            return V, policy
        policy = new_policy
```

在 4×4 网格上的典型收敛：4–6 次外层迭代。输出 `V*(0,0) ≈ -6`，以及一个严格减少步数的策略。

### 第 5 步：价值迭代（单循环版本）

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

相同的不动点，更少的代码行。

## 常见陷阱

- **忘记处理终止状态。** 如果你对吸收性状态也应用贝尔曼方程，它仍然会选出一个什么都改变不了的「最佳动作」。用 `if s == terminal: V[s] = 0` 来加以保护。
- **上确界范数 vs L2 收敛。** 使用 `max |V_new - V|`，而不是平均值。理论保证是建立在上确界范数之上的。
- **原地更新 vs 同步更新。** 原地更新 `V[s]`（Gauss-Seidel 高斯-赛德尔法）比使用一个单独的 `V_new` 字典（Jacobi 雅可比法）收敛更快。生产代码使用原地更新。
- **策略并列。** 如果两个动作的 Q 值相等，`argmax` 每次迭代可能以不同方式打破平局，导致「策略稳定」检查发生振荡。请使用稳定的平局打破规则（按固定顺序取第一个动作）。
- **状态空间爆炸。** 动态规划每次扫描的复杂度是 `O(|S| · |A|)`。可处理约 10⁷ 个状态。超过这个量级，你就需要函数逼近（从阶段 9 · 05 开始）。

## 实际应用

到 2026 年，动态规划既是正确性基线，也是各类规划器的内层循环：

| 应用场景 | 方法 |
|----------|--------|
| 精确求解一个小规模表格型 MDP | 价值迭代（更简单）或策略迭代（外层步数更少） |
| 验证 Q-learning / PPO 实现 | 在玩具环境上与动态规划的最优 V* 作对比 |
| 基于模型的强化学习（阶段 9 · 10） | 在学到的转移模型上做贝尔曼回溯 |
| AlphaZero / MuZero 中的规划 | 蒙特卡洛树搜索（MCTS）= 异步贝尔曼回溯 |
| 离线强化学习（CQL、IQL） | 保守 Q 迭代——对分布外（OOD）动作施加惩罚的动态规划 |

每当有人说「最优价值函数」时，他们指的就是「动态规划的不动点」。当你在论文中看到 `V*` 或 `Q*` 时，脑海里浮现的应该就是这个循环。

## 交付产出

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

1. **简单。** 在 4×4 GridWorld 上以 `γ ∈ {0.9, 0.99}` 运行价值迭代。需要多少次扫描才能让 `max |ΔV| < 1e-6`？把 `V*` 打印成一个 4×4 网格。
2. **中等。** 在*随机版* GridWorld（滑动概率 `0.1`）上对比策略迭代与价值迭代。统计：扫描次数、墙钟时间、最终的 `V*(0,0)`。哪个在迭代次数上收敛更快？在墙钟时间上呢？
3. **困难。** 构建修改版策略迭代：在评估步骤中，只运行 `k` 次扫描而非迭代至收敛。对 `k ∈ {1, 2, 5, 10, 50}` 绘制 `V*(0,0)` 误差与 `k` 的关系曲线。这条曲线告诉了你关于「评估/改进权衡」的什么信息？

## 关键术语

| 术语 | 人们口头怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 策略迭代（Policy iteration） | 「DP 算法」 | 交替进行评估（`V^π`）与改进（对 `V^π` 取贪心的 `π`），直到策略不再变化。 |
| 价值迭代（Value iteration） | 「更快的 DP」 | 在一次扫描中应用贝尔曼最优性回溯；以几何级数收敛到 `V*`。 |
| 贝尔曼算子（Bellman operator） | 「那个递归式」 | `(T V)(s) = max_a Σ P (r + γ V(s'))`；在上确界范数下是一个 `γ`-压缩。 |
| 压缩映射（Contraction） | 「DP 为何收敛」 | 任何满足 `\|\|T x - T y\|\| ≤ γ \|\|x - y\|\|` 的算子 `T` 都有唯一的不动点。 |
| GPI | 「一切皆是 DP」 | 广义策略迭代：任何驱动 `V` 和 `π` 趋于相互一致的方法。 |
| 同步更新（Synchronous update） | 「Jacobi 风格」 | 整次扫描中都使用旧的 `V`；分析上更干净，但更慢。 |
| 原地更新（In-place update） | 「Gauss-Seidel 风格」 | 边更新边使用 `V`；实践中收敛更快。 |

## 延伸阅读

- [Sutton & Barto (2018). 第 4 章——动态规划](http://incompleteideas.net/book/RLbook2020.pdf) ——策略迭代与价值迭代的经典阐述。
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook.html) ——对压缩映射论证的严谨处理。
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) ——修改版策略迭代及其收敛性分析。
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) ——策略迭代的原始论文。
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) ——从 DP 通往近似 DP / 深度强化学习的桥梁，后续每一课都会用到。
