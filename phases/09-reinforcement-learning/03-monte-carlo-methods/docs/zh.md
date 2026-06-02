# Monte Carlo 方法 —— 从完整 episode 中学习

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 动态规划需要模型，Monte Carlo 只需要 episode。跑策略、看回报、求平均。这是 RL 里最朴素的想法 —— 也是后面一切的钥匙。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming)
**Time:** ~75 minutes

## 问题（The Problem）

动态规划很优雅，但它假设你能查询任意状态和动作下的 `P(s' | s, a)`。现实世界几乎没有任何场景满足这一点。机器人无法解析地算出关节施加力矩之后摄像头像素的分布。定价算法无法对每一种可能的客户反应做积分。LLM 无法穷举一个 token 之后所有可能的延续。

你需要一种方法，它只要能从环境里 *采样* 就行。跑策略、得到一条轨迹（trajectory）`s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`，用它来估计价值。这就是 Monte Carlo。

从 DP 到 MC 的转变在哲学层面意义重大：我们从 *已知模型 + 精确回溯* 走到了 *采样 rollout + 平均回报*。方差变大了，但适用范围爆炸式扩张。本课之后的每个 RL 算法 —— TD、Q-learning、REINFORCE、PPO、GRPO —— 本质上都是 Monte Carlo 估计器，只是有些在上面叠了一层 bootstrapping。

## 概念（The Concept）

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**核心思想，一句话：** `V^π(s) = E_π[G_t | s_t = s] ≈ (1/N) Σ_i G^{(i)}(s)`，其中 `G^{(i)}(s)` 是策略 `π` 下访问到 `s` 之后观测到的回报。

**first-visit 与 every-visit MC。** 给定一个多次访问到状态 `s` 的 episode，first-visit MC 只统计第一次访问之后的回报；every-visit MC 把每次访问都算上。在极限下两者都是无偏的。first-visit 更易分析（样本独立同分布）；every-visit 每个 episode 用到的数据更多，实践中通常收敛更快。

**增量平均（incremental mean）。** 不必存下所有回报，直接更新滑动平均：

`V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]`

整理一下：`V_new = V_old + α · (target - V_old)`，其中 `α = 1/n`。把 `1/n` 换成一个常数步长 `α ∈ (0, 1)`，你就得到了一个非平稳的 MC 估计器，可以追踪 `π` 的变化。这一步，就是从 MC 到 TD、再到所有现代 RL 算法的全部跳跃。

**探索成了一个新问题。** DP 通过枚举触及每个状态。MC 只能看到策略实际访问到的状态。如果 `π` 是确定性的，状态空间里大片区域永远不会被采样，它们的价值估计将永远停留在零。按历史顺序有三种修复方案：

1. **Exploring starts。** 让每个 episode 都从随机的 (s, a) 对出发。能保证覆盖；但实践中不现实（你没法把机器人「reset」到一个任意状态）。
2. **ε-greedy。** 对当前 Q 贪心，但以概率 `ε` 随机选动作。所有状态-动作对在渐近意义下都会被采样到。
3. **Off-policy MC。** 在行为策略 `μ` 下采集数据，通过 importance sampling 学习目标策略 `π`。方差很大，但它是通向 DQN 这类 replay-buffer 方法的桥梁。

**Monte Carlo Control。** 评估 → 改进 → 评估，和策略迭代一样，但评估靠采样：

1. 跑 `π`，得到一个 episode。
2. 用观测到的回报更新 `Q(s, a)`。
3. 让 `π` 对 `Q` 做 ε-greedy。
4. 重复。

在温和条件下（每个对都被无限多次访问，`α` 满足 Robbins-Monro），它以概率 1 收敛到 `Q*` 与 `π*`。

## 动手实现（Build It）

### Step 1：rollout → (s, a, r) 列表

```python
def rollout(env, policy, max_steps=200):
    trajectory = []
    s = env.reset()
    for _ in range(max_steps):
        a = policy(s)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r))
        s = s_next
        if done:
            break
    return trajectory
```

不需要模型，只要 `env.reset()` 和 `env.step(s, a)`。和 gym 环境同款接口，去掉了多余的部分。

### Step 2：计算回报（反向扫一遍）

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

一遍过，`O(T)`。反向递推 `G_t = r_{t+1} + γ G_{t+1}` 避免了重复求和。

### Step 3：first-visit MC 评估

```python
def mc_policy_evaluation(env, policy, episodes, gamma=0.99):
    V = defaultdict(float)
    counts = defaultdict(int)
    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for t, ((s, _, _), G) in enumerate(zip(trajectory, returns)):
            if s in seen:
                continue
            seen.add(s)
            counts[s] += 1
            V[s] += (G - V[s]) / counts[s]
    return V
```

三行就把活干了：首次访问标记一下、计数加一、更新滑动均值。

### Step 4：ε-greedy MC control（on-policy）

```python
def mc_control(env, episodes, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    counts = defaultdict(lambda: {a: 0 for a in ACTIONS})

    def policy(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for (s, a, _), G in zip(trajectory, returns):
            if (s, a) in seen:
                continue
            seen.add((s, a))
            counts[s][a] += 1
            Q[s][a] += (G - Q[s][a]) / counts[s][a]
    return Q, policy
```

### Step 5：与 DP 黄金标准对比

当 episodes → ∞ 时，你的 `V^π` MC 估计应当与第 02 课里的 DP 结果一致。实测：在 4×4 GridWorld 上跑 50,000 个 episode，能逼近 DP 答案到 `~0.1` 以内。

## 坑（Pitfalls）

- **无穷 episode。** MC 要求 episode 能 *终止*。如果你的策略可能永远循环下去，给 `max_steps` 设一个上限，把触顶视作隐式失败。在 GridWorld 上跑随机策略经常会超时 —— 这是正常的，只要确保你统计正确。
- **方差。** MC 用的是完整回报。在长 episode 上方差非常大 —— episode 末尾一个倒霉的 reward 就能把 `V(s_0)` 拉走同样幅度。TD 方法（第 04 课）通过 bootstrapping 把这个砍掉。
- **状态覆盖率。** 在新鲜 Q 上做 greedy MC 而存在 ties 时，永远只会试一个动作。你 *必须* 探索（ε-greedy、exploring starts、UCB）。
- **非平稳策略。** 如果 `π` 在变化（比如 MC control 里），旧的回报来自不同的策略。常数 α 的 MC 能处理这个；样本平均的 MC 不行。
- **Off-policy importance sampling。** 权重 `π(a|s)/μ(a|s)` 沿轨迹连乘。方差随 horizon 爆炸。可以用 per-decision 加权 IS 做封顶，或者干脆切到 TD。

## 用起来（Use It）

2026 年 Monte Carlo 方法的角色：

| 应用场景 | 为什么用 MC |
|----------|--------|
| 短 horizon 游戏（blackjack、扑克） | episode 自然终止；回报干净。 |
| 已记录策略的 offline 评估 | 在存好的轨迹上对折扣回报做平均。 |
| Monte Carlo Tree Search（AlphaZero） | 从树叶子做 MC rollout，引导选择。 |
| LLM RL 评估 | 在给定策略下采样完成，计算平均 reward。 |
| PPO 中的 baseline 估计 | advantage 目标 `A_t = G_t - V(s_t)` 中的 `G_t` 就是 MC。 |
| 教学 RL | 真正能跑的最简单算法 —— 把 bootstrapping 剥掉，看核心。 |

现代深度 RL 算法（PPO、SAC）通过 `n`-step return 或 GAE 在纯 MC（完整回报）和纯 TD（一步 bootstrap）之间插值。两个端点都是同一个估计器的实例。

## 上线部署（Ship It）

存为 `outputs/skill-mc-evaluator.md`：

```markdown
---
name: mc-evaluator
description: Evaluate a policy via Monte Carlo rollouts and produce a convergence report with DP-comparison if available.
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

Given an environment (episodic, with reset+step API) and a policy, output:

1. Method. First-visit vs every-visit MC. Reason.
2. Episode budget. Target number, variance diagnostic, expected standard error.
3. Exploration plan. ε schedule (if needed) or exploring starts.
4. Gold-standard comparison. DP-optimal V* if tabular; otherwise a bound from a Q-learning / PPO baseline.
5. Termination check. Max-step cap, timeouts, handling of non-terminating trajectories.

Refuse to run MC on non-episodic tasks without a finite horizon cap. Refuse to report V^π estimates from fewer than 100 episodes per state for tabular tasks. Flag any policy with zero-variance actions as an exploration risk.
```

## 练习（Exercises）

1. **简单。** 在 4×4 GridWorld 上对均匀随机策略做 first-visit MC 评估。跑 10,000 个 episode。把 `V(0,0)` 随 episode 数变化的曲线和 DP 答案画在一起。
2. **中等。** 实现 ε-greedy MC control，分别取 `ε ∈ {0.01, 0.1, 0.3}`。比较 20,000 个 episode 之后的平均回报。曲线长什么样？bias-variance 权衡发生在哪里？
3. **困难。** 实现 *off-policy* MC + importance sampling：在均匀随机策略 `μ` 下采集数据，对确定性最优策略 `π` 估计 `V^π`。比较 plain IS、per-decision IS 与 weighted IS。哪个方差最低？

## 关键术语（Key Terms）

| 术语 | 大家会怎么说 | 它实际是什么 |
|------|-----------------|-----------------------|
| Monte Carlo | 「随机采样」 | 通过对分布做独立同分布采样、再求均值来估计期望。 |
| 回报 `G_t` | 「未来 reward」 | 从第 `t` 步到 episode 末尾的折扣 reward 之和：`Σ_{k≥0} γ^k r_{t+k+1}`。 |
| first-visit MC | 「每个状态只数一次」 | 一个 episode 中只有第一次访问对价值估计有贡献。 |
| every-visit MC | 「所有访问都用」 | 每次访问都贡献；略有偏差但样本效率更高。 |
| ε-greedy | 「探索噪声」 | 以 `1-ε` 概率选 greedy 动作；以 `ε` 概率选随机动作。 |
| importance sampling | 「修正『从错误分布采样』」 | 用 `π(a\|s)/μ(a\|s)` 的连乘对回报重加权，从 `μ` 的数据里估计 `V^π`。 |
| on-policy | 「学我自己的数据」 | 目标策略 = 行为策略。原版 MC、PPO、SARSA 都是这种。 |
| off-policy | 「学别人的数据」 | 目标策略 ≠ 行为策略。importance sampling 版 MC、Q-learning、DQN。 |

## 延伸阅读（Further Reading）

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) —— 经典教材式处理。
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) —— first-visit 与 every-visit 的分析。
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) —— off-policy MC 与方差控制。
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) —— 现代低方差 IS 估计器。
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) —— MC/TD 自我对弈收敛到超人水平的首次大规模实证；本阶段后半所有课程的概念前身。
