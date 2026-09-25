# 时序差分 — Q-Learning 与 SARSA

> Monte Carlo 要等到回合结束才更新。TD 每走一步就通过自举下一个价值估计来更新。Q-learning 是离策略的、乐观的；SARSA 是在策略的、保守的。两者都只需一行代码。它们是本阶段所有深度强化学习方法的基础。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (动态规划), Phase 9 · 03 (Monte Carlo)
**Time:** 约 75 分钟

## 问题所在

Monte Carlo 可行，但它有两个代价高昂的要求：需要会终止的回合，而且只有在最终回报到手后才更新。如果你的回合有 1,000 步，MC 就要等 1,000 步才更新任何东西。它高方差、低偏差，实践中很慢。

动态规划的画像正好相反——零方差的自举回溯——但需要一个已知模型。

时序差分（TD）学习在两者之间取折中。从单次转移 `(s, a, r, s')` 出发，构造一个单步目标 `r + γ V(s')`，并把 `V(s)` 向它挪近一点。不需要模型。不需要完整回合。使用近似值 `V` 于等式右侧会引入偏差，但方差远低于 MC，并且从第一步起就能在线更新。

这是整个现代强化学习——DQN、A2C、PPO、SAC——赖以转动的轴心。Phase 9 的其余部分都是函数近似和技巧的层层堆叠，建立在你在本课要写的单步 TD 更新之上。

## 概念

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**V 的 TD(0) 更新：**

`V(s) ← V(s) + α [r + γ V(s') - V(s)]`

括号中的量就是 TD 误差 `δ = r + γ V(s') - V(s)`。它是 MC 中 `G_t - V(s_t)` 的在线版本。收敛要求 `α` 满足 Robbins-Monro 条件（`Σ α = ∞`、`Σ α² < ∞`），且所有状态被无穷次访问。

**Q-learning。** 一种离策略的 TD 控制方法：

`Q(s, a) ← Q(s, a) + α [r + γ max_{a'} Q(s', a') - Q(s, a)]`

`max` 假设从 `s'` 起将遵循*贪心*策略，而不管智能体实际采取什么动作。这种解耦使 Q-learning 在智能体通过 ε-greedy 探索的同时学习 `Q*`。Mnih 等人（2015）将其转化为 Atari 上的深度 Q-learning（Lesson 05）。

**SARSA。** 一种在策略的 TD 方法：

`Q(s, a) ← Q(s, a) + α [r + γ Q(s', a') - Q(s, a)]`

名字来自元组 `(s, a, r, s', a')`。SARSA 使用智能体*实际*采取的下一个动作 `a'`，而非贪心的 `argmax`。它对当前运行的任何 ε-greedy 策略 `π` 收敛到 `Q^π`，在 `ε → 0` 的极限下变为 `Q*`。

**悬崖行走的差异。** 在经典的悬崖行走任务上（掉下悬崖 = 奖励 -100），Q-learning 学到沿悬崖边缘的最优路径，但探索时偶尔吃到惩罚。SARSA 因为把探索噪声纳入了 Q 值，学到一条离悬崖一步之遥的更安全路径。经过充分训练，两者在 `ε → 0` 时都达到最优。实践中的意义在于：当部署时探索仍在进行，SARSA 的行为更保守。

**Expected SARSA。** 用 `π` 下的期望值替代 `Q(s', a')`：

`Q(s, a) ← Q(s, a) + α [r + γ Σ_{a'} π(a'|s') Q(s', a') - Q(s, a)]`

方差低于 SARSA（不采样 `a'`），同样的在策略目标。现代教材常把它作为默认方法。

**n-step TD 与 TD(λ)。** 在 TD(0) 和 MC 之间插值：等待 `n` 步再自举。`n=1` 就是 TD，`n=∞` 就是 MC。TD(λ) 对所有 `n` 按几何权重 `(1-λ)λ^{n-1}` 取平均。大多数深度强化学习使用 3 到 20 之间的 `n`。

```figure
qlearning-gridworld
```

## 动手实现

### 第 1 步：ε-greedy 策略上的 SARSA

```python
def sarsa(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})

    def choose(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        s = env.reset()
        a = choose(s)
        while True:
            s_next, r, done = env.step(s, a)
            a_next = choose(s_next) if not done else None
            target = r + (gamma * Q[s_next][a_next] if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s, a = s_next, a_next
    return Q
```

八行代码。与 Q-learning *唯一*的区别是目标那一行。

### 第 2 步：Q-learning

```python
def q_learning(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    for _ in range(episodes):
        s = env.reset()
        while True:
            a = choose(s, Q, epsilon)
            s_next, r, done = env.step(s, a)
            target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s = s_next
    return Q
```

`max` 把目标与行为解耦。就是这一个符号区分了在策略与离策略。

### 第 3 步：学习曲线

跟踪每 100 回合的平均回报。在简单的确定性 GridWorld 上 Q-learning 收敛更快；SARSA 在悬崖行走上更保守。在 `code/main.py` 的 4×4 GridWorld 上，设置 `α=0.1, ε=0.1`，两者约 2,000 回合后都接近最优。

### 第 4 步：与 DP 真值比较

运行值迭代（Lesson 02）得到 `Q*`。检查 `max_{s,a} |Q_learned(s,a) - Q*(s,a)|`。健康的表格型 TD 智能体在 10,000 回合后，在 4×4 GridWorld 上的误差应在 `~0.5` 之内。

## 常见陷阱

- **Q 值初始值很重要。** 乐观初始化（负奖励任务用 `Q = 0`）鼓励探索。悲观初始化可能让贪心策略永远困住。
- **α 调度。** 常数 `α` 对非平稳问题没问题。衰减的 `α_n = 1/n` 理论上保证收敛但实践中太慢——把 `α` 固定在 `[0.05, 0.3]` 并监控学习曲线。
- **ε 调度。** 从高（`ε=1.0`）开始，衰减到 `ε=0.05`。"GLIE"（无限探索下极限贪心）是收敛条件。
- **Q-learning 的最大化偏差。** 当 `Q` 有噪声时，`max` 算子有向上偏差。会导致高估——Hasselt 的 Double Q-learning（Lesson 05 中 DDQN 使用）用两张 Q 表修复了这个问题。
- **不终止的回合。** TD 可以在没有终止状态的情况下学习，但你需要在步数上限处截断，或在截断处正确处理自举。标准做法：把截断视为非终止，继续自举。
- **状态哈希。** 如果状态是元组/张量，用可哈希的键（元组而非列表；浮点数先取整再组元组，不要用原始值）。

## 实际应用

2026 年的 TD 格局：

| 任务 | 方法 | 理由 |
|------|--------|--------|
| 小型表格环境 | Q-learning | 直接学习最优策略。 |
| 在策略的安全关键场景 | SARSA / Expected SARSA | 探索期间更保守。 |
| 高维状态 | DQN (Phase 9 · 05) | 带回放和目标网络的神经网络 Q 函数。 |
| 连续动作 | SAC / TD3 (Phase 9 · 07) | 在 Q 网络上做 TD 更新；策略网络输出动作。 |
| LLM RL（基于奖励模型） | PPO / GRPO (Phase 9 · 08, 12) | 通过 GAE 使用 TD 式优势的 actor-critic。 |
| 离线 RL | CQL / IQL (Phase 9 · 08) | 带保守正则化的 Q-learning。 |

2026 年论文里你读到的"RL"，九成是 Q-learning 或 SARSA 的某种变体。在深入阅读之前，先把表格型更新练到手指记熟。

## 交付

保存为 `outputs/skill-td-agent.md`：

```markdown
---
name: td-agent
description: Pick between Q-learning, SARSA, Expected SARSA for a tabular or small-feature RL task.
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

Given a tabular or small-feature environment, output:

1. Algorithm. Q-learning / SARSA / Expected SARSA / n-step variant. One-sentence reason tied to on-policy vs off-policy and variance.
2. Hyperparameters. α, γ, ε, decay schedule.
3. Initialization. Q_0 value (optimistic vs zero) and justification.
4. Convergence diagnostic. Target learning curve, `|Q - Q*|` check if DP is possible.
5. Deployment caveat. How will exploration behave at inference? Is SARSA's conservatism needed?

Refuse to apply tabular TD to state spaces > 10⁶. Refuse to ship a Q-learning agent without a max-bias caveat. Flag any agent trained with ε held at 1.0 throughout (no exploitation phase).
```

## 练习

1. **简单。** 在 4×4 GridWorld 上实现 Q-learning 和 SARSA。绘制 2,000 回合的学习曲线（每 100 回合平均回报）。谁收敛更快？
2. **中等。** 构建一个悬崖行走环境（4×12，最后一行是悬崖，奖励 -100 并重置到起点）。比较 Q-learning 和 SARSA 的最终策略。截图各自走的路径。哪个更靠近悬崖？
3. **困难。** 实现 Double Q-learning。在有噪声奖励的 GridWorld（每步奖励加 σ=5 的高斯噪声）上，证明 Q-learning 以显著的幅度高估 `V*(0,0)`，而 Double Q-learning 不会。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| TD 误差 | "更新信号" | `δ = r + γ V(s') - V(s)`，自举残差。 |
| TD(0) | "单步 TD" | 每次转移后仅用下一状态的估计更新。 |
| Q-learning | "离策略 RL 入门" | 带 `max`（对下一状态动作取 max）的 TD 更新；无论行为策略如何都学习 `Q*`。 |
| SARSA | "在策略的 Q-learning" | 使用实际下一动作的 TD 更新；对当前 ε-greedy π 学习 `Q^π`。 |
| Expected SARSA | "低方差版 SARSA" | 用 π 下的期望替代采样的 `a'`。 |
| GLIE | "正确的探索调度" | Greedy in the Limit with Infinite Exploration；Q-learning 收敛所需的条件。 |
| 自举 | "在目标中使用当前估计" | 区分 TD 与 MC 的关键。是偏差的来源，但大幅降低方差。 |
| 最大化偏差 | "Q-learning 高估" | 对含噪估计取 `max` 有向上偏差；Double Q-learning 可修复。 |

## 延伸阅读

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) — 原始论文及收敛证明。
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) — TD(0)、SARSA、Q-learning、Expected SARSA。
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) — 最大化偏差的修复。
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) — expected SARSA 的动机。
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) — 提出 SARSA（当时叫 "modified connectionist Q-learning"）的论文。
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) — 把 TD(0) 推广到 TD(n)，是从 Q-learning 通向资格迹、进而到 PPO 中 GAE 的路径。