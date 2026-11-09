# 发展目标,国家,行动和奖励

> 马科夫决策过程是五件事:状态,行动,转型,奖励,折扣.RL  Q-学习,PPO,DPO,GRPO 中的一切都优化了这个形式.一遍学习,免费阅读其他强化学习.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Probability & Distributions), Phase 2 · 01 (ML Taxonomy)
**Time:** ~45 minutes

## 问题

你写着一个棋牌机器人,或者一个库存规划师,或者一个交易代理,或者一个训练推理模型的PPO循环.四个不同的领域,一个令人惊的事实:四个都崩到同一个数学对象.

监督学习给你`(x, y)`强化学习给你没有标签,只有一个流量的状态,你采取的行动,和一个 skalar 奖励. 这一举动赢得了比赛吗? 补充决定节省了钱吗? 贸易带来了利吗? 士刚刚生产的代币导致了更高的奖励吗?

您不能从这个流中学习,直到您正式化. "我看到的", "我做了什么", "接下来发生了什么", "这么好" 每个都必须成为一个可以推理的对象.这种形式化是马科夫决策过程.这个阶段的每个RL算法,包括RLHF和GRPO循环在最后,优化了这个形状.

## 概念

![Markov decision process: states, actions, transitions, rewards, discount](../assets/mdp.svg)

**The five objects.**

- **States** $S$在格里德世界,细胞,象棋,板块,在法学,文本窗口和任何记忆.
- **Actions** $A$选择,向上/下/左/右,玩动,发行令牌.
- **Transitions** $P(s' \mid s, a)$根据国家$s$行动$a$在棋牌中确定性,在库存中稳定性,在LLM解码中几乎确定性.
- **Rewards** $R(s, a, s')$收益减成本,日志概率比率在GRPO中.
- **Discount** $\gamma \in [0, 1)$未来的奖励与现在的奖励有多少?$\gamma = 0.99$购买一个水平的 ~ 100 步; $\gamma = 0.9$买了10个.

**The Markov property** $P(s_{t+1} \mid s_t, a_t) = P(s_{t+1} \mid s_0, a_0, \ldots, s_t, a_t)$如果没有,国家代表性是不完整的,不是方法的失败,是国家的失败.

**Policies and returns.**一个政策$\pi(a \mid s)$图表状态到行动分布. 返回$G_t = r_t + \gamma r_{t+1} + \gamma^2 r_{t+2} + \ldots$价值: 未来奖励的折扣金额.$V^\pi(s) = \mathbb{E}[G_t \mid s_t = s]$是从 开始的预期回报$s$政策$\pi$值$Q^\pi(s, a) = \mathbb{E}[G_t \mid s_t = s, a_t = a]$每个RL算法估计其中一个,然后改进$\pi$根据此.

**The Bellman equations.**在这个阶段使用的固定点方程:

```math
\begin{aligned}
V^\pi(s) &= \sum_a \pi(a \mid s) \sum_{s', r} P(s', r \mid s, a) [r + \gamma V^\pi(s')] \\
Q^\pi(s, a) &= \sum_{s', r} P(s', r \mid s, a) [r + \gamma \sum_{a'} \pi(a' \mid s') Q^\pi(s', a')]
\end{aligned}
```

这些预期的分化返回为"这个步骤的奖励"加上"你降落的地方的折扣值".反复性. 9 阶段的每个算法要么重复这个方程到融合 (动态编程),从它 (蒙特卡洛) 样本,或者将它启动一步 (时间差异).

```figure
discount-horizon
```

## 建立它

### 步骤1:一个小的确定性MDP

代理从左上开始,终端在右下,每步的奖励为 -1 个,行动`{up, down, left, right}`看到`code/main.py`现在,我们要去.

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

五条线,就是整个环境,确定性过渡,恒定的步骤惩罚,吸收终端状态.

### 步骤2:制定政策

政策是从状态到行动分布的函数.

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

运行随机策略1000次.这个4×4板的平均回报率为 -60至 -80左右.最佳回报率是 -6 (直线路向右).关闭这一差距是9阶段的一切.

### 步骤3:计算`V^π`通过贝尔曼方程

对于小 MDP 来说,贝尔曼方程是一个线性系统. 列出状态,应用预期,再重复直到值停止变化.

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

这是一个反复的政策评估.这是萨顿和巴托的第一个算法,也是每种RL方法的理论基础.

### 步骤4:`γ`是一个具有物理意义的超参数

实际水平大概是$1 / (1 - \gamma)$现在,我们要去.$\gamma = 0.9$十个步骤.$\gamma = 0.99$百步.$\gamma = 0.999$千个步骤.

由于许多早期步骤都承担了远期奖励的责任,因此信用分配变得很杂.$\gamma = 1$控制任务使用`0.95–0.99`长视野战略游戏使用`0.999`现在,我们要去.

## 陷

- **Non-Markovian state.**如果您需要最后三个观察来决定,"状态"不仅仅是当前的观察. 修复:堆框架 (DQN在Atari堆 4) 或使用复制状态 (LSTM/GRU在观测上).
- **Sparse rewards.**只有获奖奖使在大型状态空间中学习几乎不可能.
- **Reward hacking.**优化代理奖励通常会产生病态行为.OpenAI的船只比赛代理在圈子里旋转,以收集力量而不是永远完成比赛.总是根据目标结果定义奖励,而不是代理.
- **Discount mis-spec.** $\gamma = 1$在一个无限视野任务上,每个值都是无限的.$\gamma < 1$现在,我们要去.
- **Reward scale.**奖励 {+100, -100} vs {+1, -1} 给出相同的最佳政策,但截然不同的梯度大小.`[-1, 1]`- 在连接到PPO/DQN之前.

## 用它

2026堆将每一个RL管道降低到MDP,然后触摸代码:

| Situation | State | Action | Reward | γ |
|-----------|-------|--------|--------|---|
| Control (locomotion, manipulation) | Joint angles + velocities | Continuous torques | Task-specific shaped | 0.99 |
| Games (chess, Go, poker) | Board + history | Legal move | Win=+1 / loss=-1 | 1.0 (finite) |
| Inventory / pricing | Stock + demand | Order qty | Revenue - cost | 0.95 |
| RLHF for LLMs | Context tokens | Next token | Reward-model score at end | 1.0 (episode ~200 tokens) |
| GRPO for reasoning | Prompt + partial response | Next token | Verifier 0/1 at end | 1.0 |

在写任何训练循环之前,写出五个.大多数"RL不工作"错误报告追溯到纸上被打破的MDP公式.

## 运送它

保存如`outputs/skill-mdp-modeler.md`其他:

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

## 运动

1. **Easy.**实现4×4格式世界和随机政策推广`code/main.py`运行1万集,报告回报的平均值和STD.
2. **Medium.**跑步`policy_evaluation`随着$\gamma \in \lbrace 0.5, 0.9, 0.99 \rbrace$对于统一随机政策.`V`解释为什么终端附近的状态值越来越快$\gamma$现在,我们要去.
3. **Hard.**转换格里德世界到静止状态:每个动作都会与概率相邻方向滑动$p = 0.1$重新评估制服政策.`V[start]`变得更好还是更糟?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MDP | "Reinforcement learning setup" | Tuple $(S, A, P, R, \gamma)$ satisfying the Markov property. |
| State | "What the agent sees" | Sufficient statistic for future dynamics under the chosen policy class. |
| Policy | "Agent's behavior" | Conditional distribution $\pi(a \mid s)$ or deterministic map $s \to a$. |
| Return | "Total reward" | Discounted sum $\sum \gamma^t r_t$ from the current step. |
| Value | "How good a state is" | Expected return under $\pi$ starting from $s$. |
| Q-value | "How good an action is" | Expected return under $\pi$ starting from $s$ with first action $a$. |
| Bellman equation | "Dynamic programming recursion" | Fixed-point decomposition of value / Q into one-step reward plus discounted successor value. |
| Discount $\gamma$ | "Future vs present" | Geometric weight on far-future reward; effective horizon $\approx 1/(1-\gamma)$. |

## 进一步阅读

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf)课本.第3章涵盖MDP和贝尔曼方程;第1章激励了每次课程的奖励假设.
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming)贝尔曼方程的起源.
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html)从深度RL角度来看简洁的MDP.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887)关于MDP和精确解决方法的操作研究参考.
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://cs.brown.edu/media/filer_public/d1/a6/d1a6f66a-289a-4b81-9596-417114843489/littman.pdf)作为动态编程专业化的MDP最清洁的衍生.
