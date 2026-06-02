# 时序差分——Q-Learning 与 SARSA

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Monte Carlo 要等到 episode 结束才更新。TD 则每走一步就 bootstrap 下一个 value 估计来更新。Q-learning 是 off-policy、乐观派；SARSA 是 on-policy、谨慎派。两者都只要一行代码，却撑起本阶段所有 deep-RL 方法。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## 问题（The Problem）

Monte Carlo 能用，但有两个昂贵的前提。它需要可终止的 episode，并且只有在最终回报到手后才更新。如果一个 episode 长 1,000 步，MC 就要等够 1,000 步才能更新任何东西。它高方差、低偏置，实践中很慢。

动态规划（dynamic programming）正好相反——零方差的 bootstrap 回溯——但要求模型已知。

时序差分（temporal difference, TD）learning 折中。从一次单步转移 `(s, a, r, s')` 出发，构造一步目标 `r + γ V(s')`，把 `V(s)` 朝它推一下。不需要模型，不需要完整 episode。代价是右边用了近似 `V` 带来的偏置，但比 MC 方差小得多，而且从第一步就能在线更新。

这是现代 RL 的支点——DQN、A2C、PPO、SAC 全都围绕它转。Phase 9 后续内容只是在你这节课写下的这一步 TD 更新之上，叠加 function approximation 和各种工程 trick。

## 概念（The Concept）

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**V 的 TD(0) 更新：**

`V(s) ← V(s) + α [r + γ V(s') - V(s)]`

方括号里的量就是 TD error `δ = r + γ V(s') - V(s)`，它是 MC 中 `G_t - V(s_t)` 的在线版本。收敛要求 `α` 满足 Robbins-Monro 条件（`Σ α = ∞`，`Σ α² < ∞`），并且所有 state 都被无限次访问。

**Q-learning。** 一种 off-policy 的 TD 控制方法：

`Q(s, a) ← Q(s, a) + α [r + γ max_{a'} Q(s', a') - Q(s, a)]`

`max` 假设从 `s'` 起将走 *greedy* 策略，无论 agent 实际做了什么动作。这个解耦让 Q-learning 能在 agent 用 ε-greedy 探索的同时学到 `Q*`。Mnih 等人（2015）把这套搬到 Atari 上做成了 deep Q-learning（见 Lesson 05）。

**SARSA。** 一种 on-policy 的 TD 方法：

`Q(s, a) ← Q(s, a) + α [r + γ Q(s', a') - Q(s, a)]`

名字就是元组 `(s, a, r, s', a')`。SARSA 用的是 agent *实际*选下一步的动作 `a'`，不是 greedy 的 `argmax`。它会收敛到当前 ε-greedy `π` 对应的 `Q^π`，在 `ε → 0` 的极限下就是 `Q*`。

**cliff-walking 上的差别。** 在经典 cliff-walking 任务里（掉下悬崖 = reward -100），Q-learning 学到的是沿悬崖边的最优路径，但探索时偶尔会吃到那个 -100 的惩罚。SARSA 则学到一条离悬崖一步远的更安全路径，因为它把探索噪声算进了 Q 值里。训练充分、`ε → 0` 时两者都到最优；但实务中差别要紧：当部署时仍在做探索，SARSA 的行为会更保守。

**Expected SARSA。** 把 `Q(s', a')` 替换成它在 `π` 下的期望值：

`Q(s, a) ← Q(s, a) + α [r + γ Σ_{a'} π(a'|s') Q(s', a') - Q(s, a)]`

方差比 SARSA 更低（不再采样 `a'`），但目标依然是 on-policy 的。现代教材里它经常是默认选项。

**n-step TD 与 TD(λ)。** 在 bootstrap 之前先等 `n` 步，就能在 TD(0) 和 MC 之间插值。`n=1` 是 TD，`n=∞` 是 MC。TD(λ) 用几何权重 `(1-λ)λ^{n-1}` 在所有 `n` 上做平均。多数 deep-RL 把 `n` 选在 3 到 20 之间。

## 动手实现（Build It）

### Step 1: SARSA on ε-greedy policy

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

八行代码。它和 Q-learning *唯一*的区别就在 target 那一行。

### Step 2: Q-learning

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

`max` 把 target 与行为解耦了。这个符号就是 on-policy 与 off-policy 之间的全部差别。

### Step 3: 学习曲线

按每 100 个 episode 一组追踪平均 return。在简单的确定性 GridWorld 上 Q-learning 收敛更快；在 cliff-walking 上 SARSA 更保守。在 `code/main.py` 里的 4×4 GridWorld 上，用 `α=0.1, ε=0.1` 训练大约 2,000 个 episode 后两者都接近最优。

### Step 4: 与 DP 真值对比

跑一遍 value iteration（Lesson 02）拿到 `Q*`。检查 `max_{s,a} |Q_learned(s,a) - Q*(s,a)|`。一个健康的 tabular TD agent 在 4×4 GridWorld 上跑 10,000 个 episode 后会落在 `~0.5` 以内。

## 常见坑（Pitfalls）

- **Q 的初值很重要。** 乐观初始化（在负 reward 任务里把 `Q = 0`）会鼓励探索；悲观初始化能让 greedy 策略永远困住。
- **α 调度。** 非平稳问题用常数 `α` 就行。`α_n = 1/n` 这样的衰减理论上能保证收敛，但实践中太慢——把 `α` 钉在 `[0.05, 0.3]` 区间，盯着学习曲线看就行。
- **ε 调度。** 起步高（`ε=1.0`），衰减到 `ε=0.05`。"GLIE"（greedy in the limit with infinite exploration，极限下贪心 + 无穷次探索）是收敛条件。
- **Q-learning 的 max 偏置。** 当 `Q` 带噪时，`max` 算子会带正向偏置，导致高估——Hasselt 的 Double Q-learning（Lesson 05 中的 DDQN 用了这一招）用两张 Q 表来修。
- **不终止的 episode。** TD 在没有 terminal 的情况下也能学，但你要么给步数封顶，要么在封顶处正确处理 bootstrap。标准做法：把封顶当作非终止，继续 bootstrap。
- **state 哈希。** 如果 state 是 tuple/tensor，用一个可哈希的 key（用 tuple 而不是 list；浮点数要先 round 再装进 tuple，不要原始浮点）。

## 用起来（Use It）

2026 年的 TD 全景图：

| 任务 | 方法 | 原因 |
|------|--------|--------|
| 小规模 tabular 环境 | Q-learning | 直接学到最优策略。 |
| On-policy 安全敏感 | SARSA / Expected SARSA | 探索期间更保守。 |
| 高维 state | DQN (Phase 9 · 05) | 神经网络 Q 函数，配 replay 和 target net。 |
| 连续动作 | SAC / TD3 (Phase 9 · 07) | 在 Q-network 上做 TD 更新；策略网络输出动作。 |
| LLM RL（基于 reward model） | PPO / GRPO (Phase 9 · 08, 12) | actor-critic，通过 GAE 得到 TD 风格的 advantage。 |
| Offline RL | CQL / IQL (Phase 9 · 08) | 带保守正则化的 Q-learning。 |

2026 年论文里你看到的 "RL" 有九成都是 Q-learning 或 SARSA 的某种延伸。在读后续内容前，先让 tabular 更新真正长在你手指里。

## 上线部署（Ship It）

存到 `outputs/skill-td-agent.md`：

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

## 练习（Exercises）

1. **Easy。** 在 4×4 GridWorld 上实现 Q-learning 与 SARSA。画出 2,000 个 episode 的学习曲线（每 100 个 episode 的平均 return）。谁先收敛？
2. **Medium。** 搭一个 cliff-walking 环境（4×12，最后一行是悬崖，reward -100 并重置回起点）。对比 Q-learning 和 SARSA 最终策略，把各自的路径截图保存。哪条更靠近悬崖？
3. **Hard。** 实现 Double Q-learning。在一个加了高斯噪声 σ=5 的 GridWorld（每步 reward 上叠加噪声）里，证明 Q-learning 会显著高估 `V*(0,0)`，而 Double Q-learning 不会。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| TD error | "更新信号" | `δ = r + γ V(s') - V(s)`，bootstrap 后的残差。 |
| TD(0) | "一步 TD" | 每次转移后用下一个 state 的估计就立即更新。 |
| Q-learning | "Off-policy RL 入门" | 在下一 state 的动作上取 `max` 的 TD 更新；不论行为策略是什么，都学到 `Q*`。 |
| SARSA | "On-policy 版 Q-learning" | 用实际的下一动作做 TD 更新；学到当前 ε-greedy π 对应的 `Q^π`。 |
| Expected SARSA | "低方差版 SARSA" | 把采样的 `a'` 换成它在 π 下的期望。 |
| GLIE | "正确的探索调度" | Greedy in the Limit with Infinite Exploration；Q-learning 收敛所需。 |
| Bootstrapping | "在 target 里用当前估计" | TD 与 MC 的根本差别。带来偏置，但方差大幅下降。 |
| Maximization bias | "Q-learning 会高估" | 在带噪估计上取 `max` 会带向上偏置；Double Q-learning 修这个。 |

## 延伸阅读（Further Reading）

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) — 原始论文与收敛证明。
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) — TD(0)、SARSA、Q-learning、Expected SARSA。
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) — 修正 maximization bias。
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) — Expected SARSA 的动机。
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) — 给 SARSA 起名的论文（当时叫 "modified connectionist Q-learning"）。
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) — 把 TD(0) 推广到 TD(n)，从 Q-learning 一路通往 eligibility traces，再到 PPO 里的 GAE。
