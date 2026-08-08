# 时序差分 —— Q-Learning 与 SARSA

> 蒙特卡洛等到回合结束。TD 每步之后通过自举下一个价值估计来更新。Q-learning 是离线策略且乐观的；SARSA 是在线策略且谨慎的。两者都是一行代码。两者都是本阶段每个深度 RL 方法的基础。

**类型：** 构建
**语言：** Python
**前置知识：** 第九阶段 · 01（MDPs），第九阶段 · 02（动态规划），第九阶段 · 03（蒙特卡洛）
**时间：** ~75 分钟

## 问题

蒙特卡洛有效但它有两个昂贵的需求。它需要终止的回合，而且只在最终回报到来后才更新。如果你的回合是 1,000 步，MC 等待 1,000 步才更新任何东西。它是高方差、低偏差、实践中慢的。

动态规划有相反的特征——零方差自举备份——但需要已知模型。

时序差分（TD）学习取中间值。从单个转移 `(s, a, r, s')`，形成单步目标 `r + γ V(s')` 并将 `V(s)` 推向它。不需要模型。不需要完整回合。使用 RHS 上近似的 `V` 带来偏差，但方差比 MC 低得多，而且从第一步就在线更新。

这是现代 RL 的支点——DQN、A2C、PPO、SAC——转向的地方。本阶段第九课的其余部分是在你将在本课中编写的单步 TD 更新之上构建的函数近似和技巧层。

## 概念

![Q-learning vs SARSA：离线策略 max vs 在线策略 Q(s', a')](../assets/td.svg)

**V 的 TD(0) 更新：**

`V(s) ← V(s) + α [r + γ V(s') - V(s)]`

括号中的量是 TD 误差 `δ = r + γ V(s') - V(s)`。它是 MC 中 `G_t - V(s_t)` 的在线类比。收敛需要满足 Robbins-Monro（`Σ α = ∞`，`Σ α² < ∞`）的 `α` 和所有状态被无限次访问。

**Q-learning。** 一种离线策略 TD 控制方法：

`Q(s, a) ← Q(s, a) + α [r + γ max_{a'} Q(s', a') - Q(s, a)]`

`max` 假设从 `s'` 开始将遵循*贪婪*策略，无论智能体实际采取什么动作。这种解耦使 Q-learning 在通过 ε-贪婪探索的同时学习 `Q*`。Mnih 等人（2015）将其转化为 Atari 上的深度 Q-learning（第 05 课）。

**SARSA。** 一种在线策略 TD 方法：

`Q(s, a) ← Q(s, a) + α [r + γ Q(s', a') - Q(s, a)]`

这个名字是元组 `(s, a, r, s', a')`。SARSA 使用智能体*实际*采取的下一个动作 `a'`，而不是贪婪的 `argmax`。收敛到当前运行的任何 ε-贪婪 `π` 的 `Q^π`，在极限 `ε → 0` 时变为 `Q*`。

**悬崖行走的差异。** 在经典的悬崖行走任务上（掉下悬崖 = 奖励 -100），Q-learning 学习沿悬崖边缘的最优路径，但在探索期间偶尔会受到惩罚。SARSA 学习离悬崖一步的安全路径，因为它将探索噪声纳入其 Q 值。随着训练，两者在 `ε → 0` 时都达到最优。在实践中这很重要：当探索在部署期间实际发生时，SARSA 的行为更保守。

**Expected SARSA。** 用其在 `π` 下的期望值替换 `Q(s', a')`：

`Q(s, a) ← Q(s, a) + α [r + γ Σ_{a'} π(a'|s') Q(s', a') - Q(s, a)]`

比 SARSA 方差更低（不采样 `a'`），相同的在线策略目标。通常是现代教科书中的默认选择。

**n-step TD 和 TD(λ)。** 通过在自举前等待 `n` 步来在 TD(0) 和 MC 之间插值。`n=1` 是 TD，`n=∞` 是 MC。TD(λ) 用几何权重 `(1-λ)λ^{n-1}` 对所有 `n` 取平均。大多数深度 RL 使用 3 到 20 之间的 `n`。

## 构建

### 第一步：ε-贪婪策略上的 SARSA

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

八行。*唯一*与 Q-learning 的区别是目标行。

### 第二步：Q-learning

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

`max` 将目标与行为解耦。那一个符号就是在线策略和离线策略之间的区别。

### 第三步：学习曲线

跟踪每 100 回合的平均回报。Q-learning 在简单确定性 GridWorld 上收敛更快；SARSA 在悬崖行走上更保守。在 `code/main.py` 的 4×4 GridWorld 上，两者在 `α=0.1, ε=0.1` 下约 2,000 回合后接近最优。

### 第四步：与 DP 真值比较

运行值迭代（第 02 课）以获得 `Q*`。检查 `max_{s,a} |Q_learned(s,a) - Q*(s,a)|`。一个健康的表格 TD 智能体在 10,000 回合后在 4×4 GridWorld 上落在 `~0.5` 以内。

## 陷阱

- **初始 Q 值很重要。** 乐观初始化（负奖励任务的 `Q = 0`）鼓励探索。悲观初始化可能永远困住贪婪策略。
- **α 时间表。** 常数 `α` 对非平稳问题没问题。理论上衰减的 `α_n = 1/n` 给出收敛，但实践中太慢——将 `α` 固定在 `[0.05, 0.3]` 并监控学习曲线。
- **ε 时间表。** 从高开始（`ε=1.0`），衰减到 `ε=0.05`。"GLIE"（极限贪婪且无限探索）是收敛条件。
- **Q-learning 中的 max 偏差。** 当 `Q` 有噪声时，`max` 算子向上偏差。导致高估——Hasselt 的双 Q-learning（第 05 课的 DDQN 使用）用两个 Q 表修复这一点。
- **非终止回合。** TD 可以在没有终止的情况下学习，但你需要要么设置步数上限，要么正确处理上限处的自举。标准：将上限视为非终止，继续自举。
- **状态哈希。** 如果状态是元组/张量，使用可哈希的键（元组，不是列表；四舍五入的浮点元组，不是原始值）。

## 应用

2026 年的 TD 格局：

| 任务 | 方法 | 理由 |
|------|--------|--------|
| 小型表格环境 | Q-learning | 直接学习最优策略。 |
| 在线策略安全关键 | SARSA / Expected SARSA | 探索期间保守。 |
| 高维状态 | DQN（第九阶段 · 05） | 带回放缓冲和目标网络的神经网络 Q 函数。 |
| 连续动作 | SAC / TD3（第九阶段 · 07） | Q 网络上的 TD 更新；策略网络输出动作。 |
| LLM RL（基于奖励模型） | PPO / GRPO（第九阶段 · 08, 12） | 通过 GAE 进行 TD 风格优势的 Actor-critic。 |
| 离线 RL | CQL / IQL（第九阶段 · 08） | 带保守正则化的 Q-learning。 |

你在 2026 年论文中读到的 90% 的"RL"是 Q-learning 或 SARSA 的某种 elaboration。在深入阅读之前，先在手指中理解表格更新。

## 交付

保存为 `outputs/skill-td-agent.md`：

```markdown
---
name: td-agent
description: 为表格或小型特征 RL 任务选择 Q-learning、SARSA、Expected SARSA。
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

给定一个表格或小型特征环境，输出：

1. 算法。Q-learning / SARSA / Expected SARSA / n-step 变体。一句话理由，与在线/离线策略和方差相关。
2. 超参数。α、γ、ε、衰减时间表。
3. 初始化。Q_0 值（乐观 vs 零）和论证。
4. 收敛诊断。目标学习曲线、`|Q - Q*|` 检查（如果 DP 可能）。
5. 部署注意事项。探索在推理时如何表现？需要 SARSA 的保守性吗？

拒绝将表格 TD 应用于状态空间 > 10⁶。拒绝没有 max 偏差警告的 Q-learning 智能体。标记任何在整个过程中 ε 保持为 1.0 的智能体（没有利用阶段）。
```

## 练习

1. **简单。** 在 4×4 GridWorld 上实现 Q-learning 和 SARSA。为 2,000 回合绘制学习曲线（每 100 回合平均回报）。谁收敛更快？
2. **中等。** 构建一个悬崖行走环境（4×12，最后一行是悬崖，奖励 -100 并重置到起点）。比较 Q-learning 和 SARSA 的最终策略。截图每个采取的路径。谁离悬崖更近？
3. **困难。** 实现双 Q-learning。在有噪声奖励的 GridWorld（每步奖励添加高斯噪声 σ=5）上，展示 Q-learning 高估 `V*(0,0)` 一个有意义量，而双 Q-learning 不这样做。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| TD 误差 | "更新信号" | `δ = r + γ V(s') - V(s)`，自举残差。 |
| TD(0) | "单步 TD" | 每次转移后使用仅下一个状态估计的更新。 |
| Q-learning | "离线策略 RL 101" | 带有对下一状态动作 `max` 的 TD 更新；无论行为策略如何都学习 `Q*`。 |
| SARSA | "在线策略 Q-learning" | 使用实际下一个动作的 TD 更新；学习当前 ε-贪婪 π 的 `Q^π`。 |
| Expected SARSA | "低方差 SARSA" | 用其在 π 下的期望替换采样的 `a'`。 |
| GLIE | "正确的探索时间表" | 极限贪婪且无限探索；Q-learning 收敛所需。 |
| 自举 | "在当前估计中使用目标" | 区分 TD 和 MC 的东西。偏差的来源但巨大的方差减少。 |
| 最大化偏差 | "Q-learning 高估" | 对噪声估计的 `max` 向上偏差；双 Q-learning 修复。 |

## 延伸阅读

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) — 原始论文和收敛证明。
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) — TD(0)、SARSA、Q-learning、Expected SARSA。
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) — 最大化偏差的修复。
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) — expected SARSA 动机。
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) — 创造 SARSA 的论文（当时称为"modified connectionist Q-learning"）。
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) — 将 TD(0) 推广到 TD(n)，从 Q-learning 到资格迹再到后来 PPO 中 GAE 的路径。
