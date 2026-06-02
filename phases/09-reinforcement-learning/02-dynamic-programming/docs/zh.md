# 动态规划 —— 策略迭代与值迭代（Dynamic Programming — Policy Iteration & Value Iteration）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 动态规划是「开了挂的 RL」。你已经知道转移函数和奖励函数，剩下的事就是反复迭代 Bellman 方程，直到 `V` 或 `π` 不再动。它是所有基于采样的方法都试图逼近的基准。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 minutes

## 问题（The Problem）

你手头有一个**模型已知**的 MDP：对任意状态-动作对，你都可以查询 `P(s' | s, a)` 和 `R(s, a, s')`。库存管理员知道需求分布；棋类游戏的转移是确定性的；gridworld 不过四行 Python。你拥有一个 *model*（模型）。

无模型（model-free）RL（Q-learning、PPO、REINFORCE）是为「没有模型，只能从环境采样」的场景而发明的。可一旦你**有**模型，就有更快、更好的方法可用：动态规划。Bellman 在 1957 年就设计好了，它们至今仍是「正确性」的定义本身——当人们说「这个 MDP 的最优策略」时，他们指的就是 DP 会返回的那个策略。

到 2026 年，你需要它，原因有三。第一，RL 研究里的每一个表格化环境（GridWorld、FrozenLake、CliffWalking）都是用 DP 求解出黄金标准策略的。第二，精确的值函数让你能 *debug*（调试）采样方法：如果 Q-learning 给出的 `V*(s_0)` 估计与 DP 答案差了 30%，那一定是你的 Q-learning 有 bug。第三，现代离线 RL 与规划方法（MCTS、AlphaZero 的搜索、Phase 9 · 10 的基于模型的 RL）全都在某个学到的或给定的模型上迭代 Bellman backup（贝尔曼回溯）。

## 概念（The Concept）

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**两套算法，本质都是 Bellman 上的不动点迭代。**

**策略迭代（Policy iteration）。** 交替执行两步，直到策略不再变化。

1. *评估（Evaluation）：* 给定策略 `π`，反复施加 `V(s) ← Σ_a π(a|s) Σ_{s',r} P(s',r|s,a) [r + γ V(s')]` 直至收敛，得到 `V^π`。
2. *改进（Improvement）：* 给定 `V^π`，把 `π` 替换为关于 `V^π` 的贪心策略：`π(s) ← argmax_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`。

收敛性有保证，原因是：(a) 每一步改进要么让 `π` 不变，要么让某些状态的 `V^π` 严格增大；(b) 确定性策略空间是有限的。即使状态空间很大，通常 ~5–20 次外层迭代就能收敛。

**值迭代（Value iteration）。** 把评估和改进折叠进同一次扫描。直接施加 Bellman *最优性*方程：

`V(s) ← max_a Σ_{s',r} P(s',r|s,a) [r + γ V(s')]`

不断重复直到 `max_s |V_{new}(s) - V(s)| < ε`。最后取贪心动作即可得到策略。每次迭代严格更快——没有内层评估循环——但通常需要更多迭代次数才能收敛。

**广义策略迭代（Generalized policy iteration, GPI）。** 这是统一框架。值函数和策略被锁在双向改进的循环里；任何把二者推向相互一致的方法（异步值迭代、modified policy iteration、Q-learning、actor-critic、PPO）都是 GPI 的一个实例。

**为什么 `γ < 1` 很重要。** Bellman 算子在 sup-norm（上确界范数）下是 `γ`-收缩：`||T V - T V'||_∞ ≤ γ ||V - V'||_∞`。收缩意味着唯一不动点和几何收敛。一旦丢掉 `γ < 1`，保证就没了——你必须有有限时间视界或一个吸收型终止状态来兜底。

## 动手实现（Build It）

### Step 1: build the GridWorld MDP model

沿用 Lesson 01 中那个 4×4 GridWorld。这次加一个随机变体：以概率 `0.1`，agent 滑向某个垂直方向。

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

`transitions(s, a)` 返回一个 `(s', r, p)` 的列表。这就是模型的全部。

### Step 2: policy evaluation

给定策略 `π(s) = {action: prob}`，迭代 Bellman 方程直到 `V` 不再动：

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

### Step 3: policy improvement

把 `π` 换成关于 `V` 的贪心策略。如果 `π` 没变化，就返回——我们已经到达最优。

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

### Step 4: stitch them together

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

4×4 上的典型收敛：4–6 次外层迭代。输出 `V*(0,0) ≈ -6`，得到的策略严格降低步数。

### Step 5: value iteration (the one-loop version)

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

同一个不动点，代码行数更少。

## 坑点（Pitfalls）

- **忘了处理终止状态。** 若把 Bellman 算子施加到吸收态上，它仍会挑出一个「最优动作」——尽管什么都没改变。用 `if s == terminal: V[s] = 0` 守住。
- **Sup-norm 而不是 L2 收敛。** 用 `max |V_new - V|`，不是平均值。理论保证写在 sup-norm 上。
- **In-place 与同步更新。** 原地更新 `V[s]`（Gauss-Seidel）比另开一个 `V_new` 字典（Jacobi）收敛更快。生产代码用 in-place。
- **策略平局。** 如果两个动作 Q 值相等，`argmax` 每次迭代可能打破平局的方式不同，导致「policy stable」检查反复振荡。用稳定的平局规则（按固定顺序取第一个动作）。
- **状态空间爆炸。** DP 每次扫描的复杂度是 `O(|S| · |A|)`。能撑到 ~10⁷ 个状态。再大就需要函数近似（从 Phase 9 · 05 起）。

## 用起来（Use It）

到了 2026 年，DP 是正确性基线，也是各种规划器的内层循环：

| 用途 | 方法 |
|----------|--------|
| 精确求解小型表格 MDP | 值迭代（更简单）或策略迭代（外层步数更少） |
| 验证 Q-learning / PPO 实现 | 在玩具环境上与 DP 最优 V* 对比 |
| 基于模型的 RL（Phase 9 · 10） | 在学到的转移模型上做 Bellman backup |
| AlphaZero / MuZero 中的规划 | 蒙特卡洛树搜索 = 异步 Bellman backup |
| 离线 RL（CQL、IQL） | 保守 Q 迭代——带 OOD 动作惩罚的 DP |

每当有人说「最优值函数」，他们指的就是「DP 的不动点」。当你在论文里看到 `V*` 或 `Q*`，脑中浮现的就该是这个循环。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **Easy.** 在 4×4 GridWorld 上跑值迭代，分别取 `γ ∈ {0.9, 0.99}`。要扫多少次才能让 `max |ΔV| < 1e-6`？把 `V*` 打印成 4×4 网格。
2. **Medium.** 在*随机*版 GridWorld（滑动概率 `0.1`）上对比策略迭代和值迭代。统计：扫描次数、墙钟时间、最终的 `V*(0,0)`。哪个在迭代次数上更快？哪个在墙钟时间上更快？
3. **Hard.** 实现 modified policy iteration：评估步只跑 `k` 次扫描，而不是到收敛。绘制 `V*(0,0)` 误差对 `k` 的曲线，`k ∈ {1, 2, 5, 10, 50}`。这条曲线告诉你评估/改进之间的权衡是什么？

## 关键术语（Key Terms）

| 术语 | 人们怎么说 | 实际意思 |
|------|-----------------|-----------------------|
| Policy iteration | 「DP 算法」 | 交替执行评估（`V^π`）和改进（`V^π` 上的贪心 `π`），直到策略不再变化。 |
| Value iteration | 「更快的 DP」 | 一次扫描里直接施加 Bellman 最优性回溯；几何收敛到 `V*`。 |
| Bellman operator | 「那个递推式」 | `(T V)(s) = max_a Σ P (r + γ V(s'))`；在 sup-norm 下是 `γ`-收缩。 |
| Contraction | 「DP 为何收敛」 | 任何满足 `\|\|T x - T y\|\| ≤ γ \|\|x - y\|\|` 的算子 `T` 都有唯一不动点。 |
| GPI | 「一切皆 DP」 | Generalized Policy Iteration：任何把 `V` 和 `π` 推向相互一致的方法。 |
| Synchronous update | 「Jacobi 式」 | 整次扫描都用旧的 `V`；分析干净但更慢。 |
| In-place update | 「Gauss-Seidel 式」 | 边更新边用最新的 `V`；实践中收敛更快。 |

## 延伸阅读（Further Reading）

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) — 策略迭代和值迭代的经典阐述。
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook.html) — 收缩映射论证的严谨处理。
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) — modified policy iteration 及其收敛性分析。
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) — 策略迭代的原始论文。
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) — 从 DP 通往近似 DP / 深度 RL 的桥梁，后续每节课都要用到。
