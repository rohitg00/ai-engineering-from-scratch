# 动态编程 政策反复和值反复

> 动态编程是与欺骗的RL. 你已经知道过渡和奖励函数; 你只是重复贝尔曼方程直到$V$或$\pi$采样方法都试图接近的基准.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 minutes

## 问题

您有已知模型的MDP:您可以查询$P(s' \mid s, a)$其他$R(s, a, s')$对于任何状态动作对.库存管理员知道需求分布.一个板游戏有确定性过渡.一个网格世界是四行Python.你有一个 *模型*.

无模型RL (Q-learning,PPO,REINFORCE) 是为没有模型的情况下发明的.但当你有一个时,有更快,更好的方法:动态编程.贝尔曼在1957年设计它们.他们仍然定义了正确性:当人们说"最佳政策为这个MDP",他们意味着政策DP将返回.

首先,在RL研究中每个表格环境 (GridWorld,FrozenLake,CliffWalking) 都被DP解决以制造金标准政策.$V^{\ast}(s_0)$第三,现代的离线RL和规划方法 (MCTS,AlphaZero的搜索,9 · 10阶段的模型基于RL) 都会反复对学习或给定的模型进行贝尔曼备份.

## 概念

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**Two algorithms, both fixed-point iteration on Bellman.**

**Policy iteration.**交替两步,直到政策停止变化.

1. *评估:* 给定政策$\pi$计算$V^\pi$通过多次应用$V(s) \leftarrow \sum_a \pi(a \mid s) \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$直到它融合.
2. *改善:* 提供$V^\pi$制造$\pi$贪的子$V^\pi$其他$\pi(s) \leftarrow \arg\max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$现在,我们要去.

由于 (a) 每个改进步骤都保持了$\pi$相同或严格增加$V^\pi$对于某些状态, (b) 确定性政策的空间是有限的. 通常,即使是大型状态空间,也会在520外表代中融合.

**Value iteration.**运用贝尔曼 *优化*方程:

```math
V(s) \leftarrow \max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]
```

重复到$\max_s \lvert V_{\text{new}}(s) - V(s) \rvert < \epsilon$通过采取贪的行动,将政策提取到最后. 严格速度每次代 没有内部评估循环,但通常需要更多的代来融合.

**Generalized policy iteration (GPI).**统一框架. 价值函数和政策锁定在双向改进循环中;任何驱动两者对相互一致性 (异步值代,修改政策代,Q-学习,演员批评,PPO) 的方法都是GPI的一个实例.

**Why $\gamma < 1$ matters.**贝尔曼操作员是$\gamma$- 标准中的缩减:$\lVert T V - T V' \rVert_\infty \le \gamma \lVert V - V' \rVert_\infty$缩小意味着独特的固定点和几何融合.$\gamma < 1$您需要一个有限的视界或吸收终端状态.

```figure
value-iteration-gamma
```

## 建立它

### 步骤1:构建GridWorldMDP模型

我们将一个性变体添加到:与概率`0.1`机器人滑向一个随机垂直方向.

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

`transitions(s, a)`返回列表`(s', r, p)`这就是整个模型.

### 步骤2:政策评估

考虑到政策`π(s) = {action: prob}`求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求求$V$停止移动:

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

### 第三步:政策改进

取代$\pi$随着贪的政策,$V$如果$\pi$没有改变,返回我们处于最佳状态.

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

### 步骤 4: 它们在一起

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

典型的4×4:46外表代.输出$V^{\ast}(0,0) \approx -6$政策将严格减少步骤数量.

### 步骤5:值回复 (单循环版本)

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

只有一个定点,更少的代码.

## 陷

- **Forgetting to handle terminals.**如果把贝尔曼应用到吸收状态,它仍然会采取"最佳行动",`if s == terminal: V[s] = 0`现在,我们要去.
- **Sup-norm vs L2 convergence.**使用`max |V_new - V|`理论上,保证是根据标准.
- **In-place vs synchronous updates.**更新`V[s]`现场 (高斯-西德尔) 趋于比单独的相近速度更快.`V_new`产品代码使用现场.
- **Policy ties.**如果两个动作的Q值等,`argmax`每次代可能会不同地打破联系,导致"政策稳定"检查振荡. 使用稳定打破 (按固定顺序的第一步).
- **State-space explosion.**士是$O(\lvert S \rvert \cdot \lvert A \rvert)$通过扫描,可达到107个状态.除此之外,需要函数近似 (9 · 05 阶段及以上).

## 用它

在2026年,DP是规划者的正确性基线和内部循环:

| Use case | Method |
|----------|--------|
| Solve a small tabular MDP exactly | Value iteration (simpler) or policy iteration (fewer outer steps) |
| Verify a Q-learning / PPO implementation | Compare to DP-optimal $V^{\ast}$ on a toy environment |
| Model-based RL (Phase 9 · 10) | Bellman backup on a learned transition model |
| Planning in AlphaZero / MuZero | Monte Carlo Tree Search = async Bellman backup |
| Offline RL (CQL, IQL) | Conservative Q-iteration — DP with a penalty on OOD actions |

每当有人说"最佳值函数",他们都指"DP固定点".$V^{\ast}$或$Q^{\ast}$在一张纸上,想象一下这个循环.

## 运送它

保存如`outputs/skill-dp-solver.md`其他:

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

## 运动

1. **Easy.**在 4×4 GridWorld 上运行值代$\gamma \in \lbrace 0.9, 0.99 \rbrace$几次扫描到$\max \lvert \Delta V \rvert < 10^{-6}$打印$V^{\ast}$作为一个4×4格.
2. **Medium.**根据 * 静态* 格里德世界 (滑动概率) 的政策反复反复反复值`0.1`计数:扫描,墙钟时间,最后$V^{\ast}(0,0)$它们在反复中更快地融合?
3. **Hard.**构建修改的政策代:在评估阶段,仅运行$k$它们的位置是的,而不是的.$V^{\ast}(0,0)$错误与$k$为了$k \in \lbrace 1, 2, 5, 10, 50 \rbrace$评估/改进的交易比较是什么?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy iteration | "DP algorithm" | Alternating evaluation ($V^\pi$) and improvement (greedy $\pi$ w.r.t. $V^\pi$) until the policy stops changing. |
| Value iteration | "Faster DP" | Bellman optimality backup applied in one sweep; converges to $V^{\ast}$ geometrically. |
| Bellman operator | "The recursion" | $(T V)(s) = \max_a \sum P (r + \gamma V(s'))$; a $\gamma$-contraction in sup-norm. |
| Contraction | "Why DP converges" | Any operator $T$ with $\lVert T x - T y \rVert \le \gamma \lVert x - y \rVert$ has a unique fixed point. |
| GPI | "Everything is DP" | Generalized Policy Iteration: any method driving $V$ and $\pi$ to mutual consistency. |
| Synchronous update | "Jacobi-style" | Use old $V$ throughout a sweep; cleanly analyzable but slower. |
| In-place update | "Gauss-Seidel-style" | Use $V$ as it's being updated; converges faster in practice. |

## 进一步阅读

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf)政策代和价值代的常规表述.
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook_athena.html)严格处理缩减绘图论点.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887)修改政策反复和其化分析.
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/)原始政策反复论文.
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html)从DP到大约DP/深度RL的桥梁,每次课程都使用.
