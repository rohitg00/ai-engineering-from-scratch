# MDP、状态、动作与奖励

> 马尔可夫决策过程由五个要素构成：状态、动作、转移、奖励、折扣因子。强化学习中的一切——Q-learning、PPO、DPO、GRPO——都是在这个结构上进行优化。学会一次，就能免费读懂其余的强化学习内容。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 1 · 06（概率与分布）、Phase 2 · 01（机器学习分类）
**Time:** ~45 分钟

## 问题所在

你正在编写一个国际象棋机器人。或者库存规划器。或者交易代理。或者训练推理模型的 PPO 循环。四个不同的领域，却有一个令人惊讶的事实：它们全部可以归结为同一个数学对象。

监督学习给你 `(x, y)` 数据对，让你拟合一个函数。强化学习不给你标签——只给你一串状态流、你采取的动作以及标量奖励。这步棋赢了吗？补货决策省钱了吗？这笔交易盈利了吗？LLM 刚刚生成的那个 token 是否带来了裁判给出的更高奖励？

在将这个数据流形式化之前，你无法从中学习。“我看到了什么”、“我做了什么”、“接下来发生了什么”、“那有多好”——每一个都必须成为你可以推理的对象。这个形式化就是马尔可夫决策过程。本阶段中的每一个 RL 算法，包括最后的 RLHF 和 GRPO 循环，都是在这个结构上进行优化。

## 概念

![Markov decision process: states, actions, transitions, rewards, discount](../assets/mdp.svg)

**五个对象。**

- **状态** `S`。代理做决策所需的全部信息。在 GridWorld 中，是格子。在国际象棋中，是棋盘。在 LLM 中，是上下文窗口加任何记忆。
- **动作** `A`。可选的决策。上/下/左/右移动。走一步棋。生成一个 token。
- **转移** `P(s' | s, a)`。给定状态 `s` 和动作 `a`，下一状态的概率分布。在国际象棋中是确定性的，在库存问题中是随机的，在 LLM 解码中近似确定。
- **奖励** `R(s, a, s')`。标量信号。赢 = +1，输 = -1。收入减去成本。GRPO 中的对数似然比项。
- **折扣** `γ ∈ [0, 1)`。未来奖励相对于当前奖励的重要程度。`γ = 0.99` 对应约 100 步的有效视野；`γ = 0.9` 对应约 10 步。

**马尔可夫性质** `P(s_{t+1} | s_t, a_t) = P(s_{t+1} | s_0, a_0, …, s_t, a_t)`。未来只依赖于当前状态。如果不满足，说明状态表示不完整——这不是方法的失败，而是状态设计的失败。

**策略与回报。** 策略 `π(a | s)` 将状态映射到动作分布。回报 `G_t = r_t + γ r_{t+1} + γ² r_{t+2} + …` 是未来奖励的折扣和。价值 `V^π(s) = E[G_t | s_t = s]` 是在策略 `π` 下从 `s` 出发的期望回报。Q 值 `Q^π(s, a) = E[G_t | s_t = s, a_t = a]` 是从特定动作出发的期望回报。每个 RL 算法都估计这两者之一，然后据此改进 `π`。

**贝尔曼方程。** 本阶段所有内容都会用到的定点方程：

`V^π(s) = Σ_a π(a|s) Σ_{s', r} P(s', r | s, a) [r + γ V^π(s')]`
`Q^π(s, a) = Σ_{s', r} P(s', r | s, a) [r + γ Σ_{a'} π(a'|s') Q^π(s', a')]`

它们将期望回报拆分为“这一步的奖励”加上“落点的折扣价值”。递归形式。Phase 9 中的每个算法要么迭代这个方程直至收敛（动态规划），要么从中采样（蒙特卡洛），要么对其进行一步自举（时序差分）。

```figure
discount-horizon
```

## 动手构建

### 步骤 1：一个微型确定性 MDP

一个 4×4 的 GridWorld。代理从左上角出发，终点在右下角，每步奖励为 -1，动作有 `{up, down, left, right}`。参见 `code/main.py`。

```python
GRID = 4
TERMINAL = (3, 3)
ACTIONS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}

def step(state, action):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = ACTIONS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL
```

五行代码。这就是整个环境。确定性转移，固定的步数惩罚，吸收态终点。

### 步骤 2： rollout 一个策略

策略是从状态到动作分布的函数。最简单的是：均匀随机。

```python
def uniform_policy(state):
    return {a: 0.25 for a in ACTIONS}

def rollout(policy, max_steps=200):
    s, total, steps = (0, 0), 0.0, 0
    for _ in range(max_steps):
        a = sample(policy(s))
        s, r, done = step(s, a)
        total += r
        steps += 1
        if done:
            break
    return total, steps
```

运行随机策略 1000 次。在这个 4×4 棋盘上，平均回报大约在 -60 到 -80 之间。最优回报是 -6（沿右下方向的直线路径）。缩小这个差距就是 Phase 9 的全部内容。

### 步骤 3：通过贝尔曼方程精确计算 `V^π`

对于小型 MDP，贝尔曼方程是一个线性系统。枚举状态，应用期望，迭代直到值不再变化。

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in all_states()}
    while True:
        delta = 0.0
        for s in all_states():
            if s == TERMINAL:
                continue
            v = 0.0
            for a, pi_a in policy(s).items():
                s_next, r, _ = step(s, a)
                v += pi_a * (r + gamma * V[s_next])
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

这就是迭代策略评估。它是 Sutton & Barto 中的第一个算法，也是后续所有 RL 方法的理论基础。

### 步骤 4：`γ` 是一个具有物理意义的超参数

有效视野大约为 `1 / (1 - γ)`。`γ = 0.9` → 10 步。`γ = 0.99` → 100 步。`γ = 0.999` → 1000 步。

太低，代理会表现得短视。太高，信用分配会变得嘈杂，因为许多早期步骤要为遥远的未来奖励共同负责。LLM RLHF 通常使用 `γ = 1`，因为回合短且有界。控制任务使用 `0.95–0.99`。长视野策略游戏使用 `0.999`。

## 常见陷阱

- **非马尔可夫状态。** 如果你需要最近三个观测才能做出决策，那么“状态”就不只是当前观测。修复方法：堆叠帧（DQN 在 Atari 上堆叠 4 帧）或使用循环状态（对观测使用 LSTM/GRU）。
- **稀疏奖励。** 只有输赢的奖励使得在大状态空间中学习几乎不可能。对奖励塑形（提供中间信号）或用模仿学习自举（Phase 9 · 09）。
- **奖励作弊。** 优化代理奖励常常产生病态行为。OpenAI 的赛船代理不停地转圈收集道具，而不是完成比赛。始终从目标结果定义奖励，而不是代理指标。
- **折扣因子误设。** 在无限视野任务上使用 `γ = 1` 会使所有值变为无穷大。始终用有限视野或 `γ < 1` 来截断。
- **奖励尺度。** {+100, -100} 与 {+1, -1} 的奖励给出完全相同的最优策略，但梯度大小差异巨大。在输入 PPO/DQN 之前，归一化到 `[-1, 1]` 左右。

## 应用场景

2026 年的技术栈在动手写代码之前，会先把每一个 RL 管道归结为一个 MDP：

| 场景 | 状态 | 动作 | 奖励 | γ |
|-----------|-------|--------|--------|---|
| 控制（运动、操作） | 关节角度 + 速度 | 连续力矩 | 任务相关的塑形奖励 | 0.99 |
| 游戏（国际象棋、围棋、扑克） | 棋盘 + 历史 | 合法走法 | 赢=+1 / 输=-1 | 1.0（有限） |
| 库存 / 定价 | 库存 + 需求 | 订货量 | 收入 - 成本 | 0.95 |
| LLM 的 RLHF | 上下文 token | 下一个 token | 结束时奖励模型的分数 | 1.0（回合约 200 个 token） |
| 用于推理的 GRPO | 提示 + 部分回复 | 下一个 token | 结束时验证器 0/1 | 1.0 |

在编写任何训练循环之前，先写出这五元组。大多数“RL 不管用”的 bug 报告都可以追溯到在纸面上就出错的 MDP 形式化。

## 交付

保存为 `outputs/skill-mdp-modeler.md`：

```markdown
---
name: mdp-modeler
description: Given a task description, produce a Markov Decision Process spec and flag formulation risks before training.
version: 1.0.0
phase: 9
lesson: 1
tags: [rl, mdp, modeling]
---

Given a task (control / game / recommendation / LLM fine-tuning), output:

1. State. Exact feature vector or tensor spec. Justify Markov property.
2. Action. Discrete set or continuous range. Dimensionality.
3. Transition. Deterministic, stochastic-with-known-model, or sample-only.
4. Reward. Function and source. Sparse vs shaped. Terminal vs per-step.
5. Discount. Value and horizon justification.

Refuse to ship any MDP where the state is non-Markovian without explicit mention of frame-stacking or recurrent state. Refuse any reward that was not defined in terms of the target outcome. Flag any `γ ≥ 1.0` on an infinite-horizon task. Flag any reward range >100x the typical step reward as a likely gradient-explosion source.
```

## 练习

1. **简单。** 在 `code/main.py` 中实现 4×4 GridWorld 和随机策略 rollout。运行 10,000 个回合。报告回报的均值和标准差。与最优回报（-6）比较。
2. **中等。** 用 `γ ∈ {0.5, 0.9, 0.99}` 为均匀随机策略运行 `policy_evaluation`。将每个 `V` 打印为 4×4 网格。解释为什么较大的 `γ` 会使靠近终点的状态值增长更快。
3. **困难。** 将 GridWorld 变为随机的：每个动作有概率 `p = 0.1` 滑向相邻方向。重新评估均匀策略。`V[start]` 变好还是变坏了？为什么？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| MDP | “强化学习的设定” | 满足马尔可夫性质的元组 `(S, A, P, R, γ)`。 |
| 状态 | “代理看到的东西” | 在所选策略类下关于未来动力学的充分统计量。 |
| 策略 | “代理的行为” | 条件分布 `π(a \| s)` 或确定性映射 `s → a`。 |
| 回报 | “总奖励” | 从当前步开始的折扣和 `Σ γ^t r_t`。 |
| 价值 | “一个状态有多好” | 在 `π` 下从 `s` 出发的期望回报。 |
| Q 值 | “一个动作有多好” | 在 `π` 下从 `s` 出发、首个动作为 `a` 的期望回报。 |
| 贝尔曼方程 | “动态规划递归” | 将价值 / Q 分解为一步奖励加上后继状态折扣价值的定点分解。 |
| 折扣因子 `γ` | “未来 vs 现在” | 对遥远未来奖励的几何权重；有效视野 `~1/(1-γ)`。 |

## 延伸阅读

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf) —— 教科书。第 3 章讲解 MDP 与贝尔曼方程；第 1 章论证了支撑后续每一课的奖励假说。
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) —— 贝尔曼方程的起源。
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) —— 从深度 RL 角度出发的简明 MDP 入门。
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) —— 关于 MDP 与精确求解方法的运筹学参考书。
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://www.cs.rutgers.edu/~mlittman/papers/thesis-main.pdf) —— 将 MDP 作为动态规划特例的最清晰推导。