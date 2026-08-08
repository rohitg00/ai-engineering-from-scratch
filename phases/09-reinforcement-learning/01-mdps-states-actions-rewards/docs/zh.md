# 01 · 马尔可夫决策过程：状态、动作与奖励

> 一个「马尔可夫决策过程（Markov Decision Process，MDP）」由五样东西构成：状态、动作、转移、奖励、折扣。强化学习里的一切——Q-learning、PPO、DPO、GRPO——都在这个结构之上做优化。学会它一次，剩下的强化学习内容便可顺理成章地读懂。

**类型：** 学习
**语言：** Python
**前置：** 阶段 1 · 06（概率与分布）、阶段 2 · 01（机器学习分类法）
**时长：** 约 45 分钟

## 问题所在

你正在写一个国际象棋机器人。或者一个库存计划器。或者一个交易智能体。又或者是训练推理模型的那个 PPO 循环。四个不同的领域，却有一个出人意料的事实：这四者最终都坍缩为同一个数学对象。

「监督学习（supervised learning）」给你 `(x, y)` 对，让你拟合一个函数。「强化学习（reinforcement learning）」不给你任何标签——只有一串状态、你采取的动作，以及一个标量奖励。这步棋赢了棋局吗？这次补货决策省钱了吗？这笔交易盈利了吗？大语言模型（LLM）刚刚产出的那个 token 是否带来了评判者给出的更高奖励？

在把这串信息形式化之前，你无法从中学习。「我看到了什么」「我做了什么」「接下来发生了什么」「那有多好」——每一项都必须变成一个你可以推理的对象。这种形式化就是马尔可夫决策过程。本阶段的每一个强化学习算法，包括末尾的 RLHF 与 GRPO 循环，都在这个结构之上做优化。

## 核心概念

〔图：马尔可夫决策过程——状态、动作、转移、奖励、折扣〕

**五个对象。**

- **状态（States）** `S`。智能体做决策所需的一切。在 GridWorld 中是格子；在国际象棋中是棋盘；在 LLM 中是上下文窗口加上任何记忆。
- **动作（Actions）** `A`。可做的选择。上/下/左/右移动。走一步棋。吐出一个 token。
- **转移（Transitions）** `P(s' | s, a)`。给定状态 `s` 和动作 `a`，下一状态的分布。在国际象棋中是确定性的，在库存中是随机的，在 LLM 解码中则近乎确定。
- **奖励（Rewards）** `R(s, a, s')`。标量信号。赢 = +1，输 = -1。收入减成本。GRPO 中的对数似然比项。
- **折扣（Discount）** `γ ∈ [0, 1)`。未来奖励相对于当下的权重。`γ = 0.99` 给出约 100 步的视野；`γ = 0.9` 给出约 10 步。

**马尔可夫性质（Markov property）** `P(s_{t+1} | s_t, a_t) = P(s_{t+1} | s_0, a_0, …, s_t, a_t)`。未来只依赖于当前状态。如果不是这样，那是状态表示不完整——这不是方法的失败，而是状态的失败。

**策略与回报。** 「策略（policy）」`π(a | s)` 把状态映射到动作分布。「回报（return）」`G_t = r_t + γ r_{t+1} + γ² r_{t+2} + …` 是未来奖励的折扣和。「价值（value）」`V^π(s) = E[G_t | s_t = s]` 是在策略 `π` 下从 `s` 出发的期望回报。「Q 值（Q-value）」`Q^π(s, a) = E[G_t | s_t = s, a_t = a]` 是以某个特定动作开始的期望回报。每个强化学习算法都在估计这两者之一，然后据此改进 `π`。

**贝尔曼方程（Bellman equations）。** 本阶段所用一切的不动点方程：

`V^π(s) = Σ_a π(a|s) Σ_{s', r} P(s', r | s, a) [r + γ V^π(s')]`
`Q^π(s, a) = Σ_{s', r} P(s', r | s, a) [r + γ Σ_{a'} π(a'|s') Q^π(s', a')]`

它们把期望回报拆成「这一步的奖励」加上「你落脚之处的折扣价值」。递归式。阶段 9 中的每个算法，要么把这个方程迭代到收敛（动态规划），要么从中采样（蒙特卡洛），要么对它做一步自举（时序差分）。

## 动手实现

### 第 1 步：一个微型确定性 MDP

一个 4×4 的 GridWorld。智能体从左上角出发，终点在右下角，每走一步奖励为 -1，动作为 `{up, down, left, right}`。见 `code/main.py`。

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

五行。这就是整个环境。确定性转移，恒定的步惩罚，吸收态的终止状态。

### 第 2 步：滚动展开一个策略

策略是一个从状态到动作分布的函数。最简单的：均匀随机。

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

把随机策略运行 1000 次。对于这个 4×4 棋盘，平均回报约为 -60 到 -80。最优回报是 -6（沿右下方的直线路径）。弥合这个差距，正是阶段 9 的全部内容。

### 第 3 步：通过贝尔曼方程精确计算 `V^π`

对于小型 MDP，贝尔曼方程就是一个线性系统。枚举状态，应用期望，迭代直到价值不再变化。

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

这就是「迭代式策略评估（iterative policy evaluation）」。它是 Sutton & Barto 一书中的第一个算法，也是其后每一个强化学习方法的理论基础。

### 第 4 步：`γ` 是一个有物理意义的超参数

有效视野大致为 `1 / (1 - γ)`。`γ = 0.9` → 10 步。`γ = 0.99` → 100 步。`γ = 0.999` → 1000 步。

太低，智能体会目光短浅地行动。太高，「信用分配（credit assignment）」会变得嘈杂，因为许多早期步骤共同为遥远未来的奖励负责。LLM 的 RLHF 通常使用 `γ = 1`，因为回合短且有界。控制任务用 `0.95–0.99`。长视野策略游戏用 `0.999`。

## 常见陷阱

- **非马尔可夫状态。** 如果你需要最近三次观测才能决策，那么「状态」就不只是当前观测。修复办法：堆叠帧（Atari 上的 DQN 堆叠 4 帧）或使用循环状态（在观测上做 LSTM/GRU）。
- **稀疏奖励。** 只有「赢」才给奖励，会让大状态空间中的学习几乎不可能。对奖励做塑形（提供中间信号），或用模仿来自举（阶段 9 · 09）。
- **奖励黑客（reward hacking）。** 优化一个代理奖励常常产生病态行为。OpenAI 的赛艇智能体曾原地打转、无止境地收集加成道具，而不去完成比赛。永远要从目标结果而非代理来定义奖励。
- **折扣设错。** 在无限视野任务上用 `γ = 1` 会让每个价值都变成无穷大。永远要用有限视野或 `γ < 1` 来封顶。
- **奖励尺度。** {+100, -100} 与 {+1, -1} 给出完全相同的最优策略，但梯度幅度天差地别。在接入 PPO/DQN 之前，先归一化到 `[-1, 1]` 量级。

## 实战运用

2026 年的技术栈在动代码之前，会把每条强化学习流水线都化简为一个 MDP：

| 场景 | 状态 | 动作 | 奖励 | γ |
|-----------|-------|--------|--------|---|
| 控制（运动、操控） | 关节角度 + 速度 | 连续力矩 | 任务专属的塑形奖励 | 0.99 |
| 游戏（国际象棋、围棋、扑克） | 棋盘 + 历史 | 合法走子 | 赢=+1 / 输=-1 | 1.0（有限） |
| 库存 / 定价 | 库存 + 需求 | 订货量 | 收入 - 成本 | 0.95 |
| LLM 的 RLHF | 上下文 token | 下一个 token | 末尾的奖励模型评分 | 1.0（回合约 200 token） |
| 推理任务的 GRPO | 提示词 + 部分回复 | 下一个 token | 末尾的验证器 0/1 | 1.0 |

在写任何训练循环之前，先把这五元组写出来。大多数「强化学习不起作用」的 bug 报告，追根溯源都是纸面上就已经写坏的 MDP 形式化。

## 交付产出

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

1. **简单。** 在 `code/main.py` 中实现 4×4 GridWorld 和随机策略的滚动展开。运行 10,000 个回合。报告回报的均值与标准差。与最优回报（-6）作对比。
2. **中等。** 对均匀随机策略，分别用 `γ ∈ {0.5, 0.9, 0.99}` 运行 `policy_evaluation`。把每种情况下的 `V` 打印为 4×4 网格。解释为什么终点附近的状态价值会随着 `γ` 增大而增长得更快。
3. **困难。** 把 GridWorld 改成随机性的：每个动作以概率 `p = 0.1` 滑向相邻方向。重新评估均匀策略。`V[start]` 是变好还是变差？为什么？

## 关键术语

| 术语 | 人们怎么说 | 它实际上的含义 |
|------|-----------------|-----------------------|
| MDP | 「强化学习的设定」 | 满足马尔可夫性质的元组 `(S, A, P, R, γ)`。 |
| 状态 | 「智能体看到的东西」 | 在所选策略类下，对未来动态而言的充分统计量。 |
| 策略 | 「智能体的行为」 | 条件分布 `π(a \| s)` 或确定性映射 `s → a`。 |
| 回报 | 「总奖励」 | 从当前步起的折扣和 `Σ γ^t r_t`。 |
| 价值 | 「一个状态有多好」 | 在 `π` 下从 `s` 出发的期望回报。 |
| Q 值 | 「一个动作有多好」 | 在 `π` 下从 `s` 出发、首个动作为 `a` 的期望回报。 |
| 贝尔曼方程 | 「动态规划递归」 | 将价值 / Q 分解为一步奖励加折扣后继价值的不动点分解。 |
| 折扣 `γ` | 「未来 vs 当下」 | 对遥远未来奖励的几何权重；有效视野 `~1/(1-γ)`。 |

## 延伸阅读

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf) —— 这本教科书。第 3 章讲 MDP 与贝尔曼方程；第 1 章引出贯穿后续每一课的奖励假设。
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) —— 贝尔曼方程的起源。
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) —— 从深度强化学习视角出发的简明 MDP 入门。
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) —— 关于 MDP 与精确求解方法的运筹学参考。
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://www.cs.rutgers.edu/~mlittman/papers/thesis-main.pdf) —— 把 MDP 作为动态规划之特例的最清晰推导。
