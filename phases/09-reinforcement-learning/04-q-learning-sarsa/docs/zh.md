# 04 · 时序差分——Q-Learning 与 SARSA

> 蒙特卡洛（Monte Carlo）要等到回合结束才更新。时序差分（Temporal Difference, TD）则在每一步之后，通过自举（bootstrapping）下一状态的价值估计来更新。Q-learning 是离策略（off-policy）且乐观的；SARSA 是在策略（on-policy）且谨慎的。两者都只需一行代码，也都是本阶段每一种深度强化学习方法的根基。

**类型：** 构建
**语言：** Python
**前置：** 阶段 9 · 01（MDP）、阶段 9 · 02（动态规划）、阶段 9 · 03（蒙特卡洛）
**时长：** 约 75 分钟

## 问题所在

蒙特卡洛能用，但有两项昂贵的前提。它需要能够终止的回合，而且只有在拿到最终回报之后才会更新。如果你的回合有 1000 步，MC 就要等 1000 步才能更新任何东西。它是高方差、低偏差的，实践中也很慢。

动态规划（Dynamic Programming）则恰好相反——零方差的自举式回溯——但要求已知模型。

时序差分（TD）学习取了两者的折中。从单个转移 `(s, a, r, s')` 出发，构造一步目标 `r + γ V(s')`，并把 `V(s)` 朝它微调。无需模型，也无需完整回合。由于在等式右边用到了近似的 `V`，会引入偏差，但方差比 MC 大幅降低，而且从第一步起就能在线更新。

这正是整个现代强化学习——DQN、A2C、PPO、SAC——所围绕的枢轴。阶段 9 余下的内容，都是在你本课将要写下的这条一步 TD 更新之上，叠加的函数逼近与各种技巧。

## 核心概念

〔图：Q-learning 与 SARSA 对比——离策略取 max 对在策略用 Q(s', a')〕

**针对 V 的 TD(0) 更新：**

`V(s) ← V(s) + α [r + γ V(s') - V(s)]`

方括号内的量就是 TD 误差（TD error）`δ = r + γ V(s') - V(s)`。它是 MC 中 `G_t - V(s_t)` 的在线对应物。收敛要求 `α` 满足罗宾斯-门罗（Robbins-Monro）条件（`Σ α = ∞`，`Σ α² < ∞`），且所有状态都被无限次访问。

**Q-learning。** 一种用于控制的离策略 TD 方法：

`Q(s, a) ← Q(s, a) + α [r + γ max_{a'} Q(s', a') - Q(s, a)]`

`max` 假定从 `s'` 起会沿用*贪婪*策略，而不管智能体实际采取了什么动作。正是这种解耦，让 Q-learning 在智能体通过 ε-贪婪（ε-greedy）探索的同时，仍能学到 `Q*`。Mnih 等人（2015）将其转化为 Atari 上的深度 Q-learning（第 05 课）。

**SARSA。** 一种在策略 TD 方法：

`Q(s, a) ← Q(s, a) + α [r + γ Q(s', a') - Q(s, a)]`

这个名字来自元组 `(s, a, r, s', a')`。SARSA 使用智能体*实际*采取的下一动作 `a'`，而非贪婪的 `argmax`。它收敛到当前所运行的那个 ε-贪婪策略 `π` 的 `Q^π`，在 `ε → 0` 的极限下即为 `Q*`。

**悬崖行走的差异。** 在经典的悬崖行走（cliff-walking）任务中（掉下悬崖 = 奖励 -100），Q-learning 学到沿悬崖边缘的最优路径，但在探索过程中偶尔会触发惩罚。SARSA 则学到一条离悬崖一步之遥的更安全路径，因为它把探索噪声纳入了 Q 值的考量。经过充分训练，两者在 `ε → 0` 时都能达到最优。但在实践中这一点很重要：当部署时确实仍在进行探索，SARSA 的行为更为保守。

**期望 SARSA（Expected SARSA）。** 把 `Q(s', a')` 替换为它在 `π` 下的期望值：

`Q(s, a) ← Q(s, a) + α [r + γ Σ_{a'} π(a'|s') Q(s', a') - Q(s, a)]`

方差比 SARSA 更低（不再采样 `a'`），但在策略目标相同。现代教材中常将其作为默认选择。

**n 步 TD 与 TD(λ)。** 通过等待 `n` 步再自举，在 TD(0) 与 MC 之间插值。`n=1` 是 TD，`n=∞` 是 MC。TD(λ) 以几何权重 `(1-λ)λ^{n-1}` 对所有 `n` 取平均。大多数深度强化学习使用介于 3 到 20 之间的 `n`。

## 动手构建

### 步骤 1：在 ε-贪婪策略上运行 SARSA

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

八行代码。与 Q-learning *唯一*的区别就是 target 那一行。

### 步骤 2：Q-learning

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

`max` 把目标与行为解耦。这一个符号，就是在策略与离策略之间的全部区别。

### 步骤 3：学习曲线

跟踪每 100 个回合的平均回报。在简单的确定性 GridWorld 上，Q-learning 收敛更快；在悬崖行走上，SARSA 更保守。在 `code/main.py` 中的 4×4 GridWorld 上，使用 `α=0.1, ε=0.1`，两者在约 2000 个回合后都接近最优。

### 步骤 4：与 DP 真值对比

运行价值迭代（第 02 课）以得到 `Q*`。检查 `max_{s,a} |Q_learned(s,a) - Q*(s,a)|`。一个健康的表格式 TD 智能体，在 4×4 GridWorld 上经过 10000 个回合后，误差应落在 `~0.5` 以内。

## 常见陷阱

- **初始 Q 值很重要。** 乐观初始化（对一个负奖励任务设 `Q = 0`）会鼓励探索。悲观初始化则可能让贪婪策略永远陷入困境。
- **α 调度。** 对非平稳问题，固定 `α` 没问题。衰减式 `α_n = 1/n` 在理论上能保证收敛，但实践中太慢——把 `α` 钉在 `[0.05, 0.3]` 之间并监控学习曲线。
- **ε 调度。** 从高处起步（`ε=1.0`），衰减到 `ε=0.05`。「GLIE」（极限处贪婪且无限探索，greedy in the limit with infinite exploration）是收敛条件。
- **Q-learning 中的最大化偏差。** 当 `Q` 带噪声时，`max` 算子会向上偏置，导致高估——Hasselt 的双 Q-learning（Double Q-learning，第 05 课中 DDQN 所用）用两张 Q 表来修正它。
- **不终止的回合。** TD 即便没有终止态也能学习，但你需要给步数设上限，或在到达上限时正确处理自举。标准做法：把上限视为非终止，继续自举。
- **状态哈希。** 如果状态是元组/张量，要使用可哈希的键（用 tuple 而非 list；用四舍五入后的浮点元组而非原始值）。

## 实战应用

2026 年的 TD 全景：

| 任务 | 方法 | 原因 |
|------|--------|--------|
| 小型表格式环境 | Q-learning | 直接学习最优策略。 |
| 在策略、安全攸关 | SARSA / Expected SARSA | 探索期间更保守。 |
| 高维状态 | DQN（阶段 9 · 05） | 带回放（replay）与目标网络（target net）的神经网络 Q 函数。 |
| 连续动作 | SAC / TD3（阶段 9 · 07） | 在 Q 网络上做 TD 更新；策略网络输出动作。 |
| LLM 强化学习（基于奖励模型） | PPO / GRPO（阶段 9 · 08、12） | 演员-评论家（actor-critic），通过 GAE 得到 TD 风格的优势估计。 |
| 离线强化学习 | CQL / IQL（阶段 9 · 08） | 带保守正则化的 Q-learning。 |

你在 2026 年论文里读到的「RL」，九成都是 Q-learning 或 SARSA 的某种演化。在深入之前，先把表格式更新练到熟稔于手。

## 交付产物

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

1. **简单。** 在 4×4 GridWorld 上实现 Q-learning 和 SARSA。绘制 2000 个回合的学习曲线（每 100 个回合的平均回报）。谁收敛得更快？
2. **中等。** 构建一个悬崖行走环境（4×12，最后一行是悬崖，奖励 -100 并重置到起点）。对比 Q-learning 与 SARSA 的最终策略。截图记录各自走的路径。哪个更靠近悬崖？
3. **困难。** 实现双 Q-learning。在一个带噪声奖励的 GridWorld 上（每步奖励叠加高斯噪声 σ=5），证明 Q-learning 对 `V*(0,0)` 有显著程度的高估，而双 Q-learning 没有。

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|-----------------|-----------------------|
| TD 误差 | 「更新信号」 | `δ = r + γ V(s') - V(s)`，自举式残差。 |
| TD(0) | 「一步 TD」 | 每次转移之后，仅用下一状态的估计来更新。 |
| Q-learning | 「离策略 RL 入门」 | 对下一状态动作取 `max` 的 TD 更新；无论行为策略如何，都学习 `Q*`。 |
| SARSA | 「在策略 Q-learning」 | 使用实际的下一动作做 TD 更新；学习当前 ε-贪婪 π 的 `Q^π`。 |
| 期望 SARSA | 「低方差版 SARSA」 | 把采样得到的 `a'` 替换为它在 π 下的期望。 |
| GLIE | 「正确的探索调度」 | 极限处贪婪且无限探索；是 Q-learning 收敛的必要条件。 |
| 自举 | 「在目标中使用当前估计」 | 区分 TD 与 MC 的关键。偏差的来源，但能大幅降低方差。 |
| 最大化偏差 | 「Q-learning 会高估」 | 对带噪声的估计取 `max` 会向上偏置；由双 Q-learning 修正。 |

## 延伸阅读

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) —— 原始论文与收敛性证明。
- [Sutton & Barto (2018). 第 6 章 —— 时序差分学习](http://incompleteideas.net/book/RLbook2020.pdf) —— TD(0)、SARSA、Q-learning、期望 SARSA。
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) —— 对最大化偏差的修正。
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) —— 期望 SARSA 的动机。
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) —— 提出 SARSA 的论文（当时称为「modified connectionist Q-learning」）。
- [Sutton & Barto (2018). 第 7 章 —— n 步自举](http://incompleteideas.net/book/RLbook2020.pdf) —— 把 TD(0) 推广到 TD(n)，从 Q-learning 通向资格迹（eligibility traces），再到后来 PPO 中的 GAE。
