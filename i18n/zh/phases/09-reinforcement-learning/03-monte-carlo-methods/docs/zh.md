# 蒙特卡罗方法 从完整的剧集中学习

> 动态编程需要一个模型.蒙特卡罗只需要一段时间. 运行政策,观察收益,平均它们. 在RL 中最简单的想法,并解锁下游的想法.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming)
**Time:** ~75 minutes

## 问题

动态编程是优雅的,但它假设你可以查询$P(s' \mid s, a)$实际上,几乎没有什么都能这样做. 机器人不能分析地计算相机像素的分布,在合并扭矩之后. 定价算法不能整合每一个可能的客户反应.

需要一种方法,只需要从环境中*样本*的能力.`s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`运用它来估计价值.这是蒙特卡罗.

从DP到MC的转变是哲学上重要的:我们从*已知模型+精确备份*转移到*样本推出+平均回报*.差异跳跃,但可用性爆炸.此课后的每一个RL算法T,Q-学习,REINFORCE,PPO,GRPO都是蒙特卡罗估计器,有时在上面有层次的启动.

## 概念

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**The core idea, in one line:** $V^\pi(s) = \mathbb E_\pi[G_t \mid s_t = s] \approx (1/N) \sum_i G^{(i)}(s)$在哪里$G^{(i)}(s)$访问后的回报$s$政策$\pi$现在,我们要去.

**First-visit vs every-visit MC.**考虑到一个访问国家事件$s$许多次,第一次访问MC只计算出第一次访问的回报;每次访问MC都计算出所有访问.第一次访问MC是无偏见的.每次访问MC可以在有限数集后略有偏见,因为它平均每集的随机回报数量,并且该数量可以与回报相对而相结合,但两者都相近.$V^\pi(s)$访问数量将会增加到无限.第一次访问更容易分析 (iid样本).每次访问每集都使用更多数据,并且通常在实践中更快地趋同.

**Incremental mean.**更新运行平均值:

```math
V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]
```

重新组织:$V_{\text{new}} = V_{\text{old}} + \alpha \cdot (\text{target} - V_{\text{old}})$随着$\alpha = 1/n$换个$1/n$对于一个恒定的步骤尺寸$\alpha \in (0, 1)$并且你得到一个非静止的MC估计器,$\pi$这一举动是从MC到TD到每一个现代的RL算法的全部跳跃.

**Exploration is now a problem.**根据统计,DP 通过统计查询接触到每个州.$\pi$总是说,在一个特定的位置上,整个区域的状态空间从来没有得到样本,

1. **Exploring starts.**开始每一集从一个随机对 (s, a). 保障覆盖; 实际上不现实 (你不能"重置"机器人到任意状态).
2. **ε-greedy.**现在,我会做什么?$\epsilon$随机行动,所有状态行动对均被抽样.
3. **Off-policy MC.**根据行为政策收集数据$\mu$了解目标政策$\pi$通过重点样本采集. 差异很高,但它是重播缓冲方法的桥梁,比如DQN.

**Monte Carlo Control.**评估 →改善 →评估,就像政策代一样,但评估是基于样本:

1. 跑步$\pi$让我们看一段话.
2. 更新$Q(s, a)$根据观察到的回报.
3. 造$\pi$贪的子.$Q$现在,我们要去.
4. 复制.

向$Q^{\ast}$其他$\pi^{\ast}$在温和条件下,每对都会无限频繁访问,$\alpha$为了满足罗宾斯-蒙罗的需求.

```figure
epsilon-greedy
```

## 建立它

### 步骤1:推出 →列表 (s, a, r)

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

没有模型,只有`env.reset()`其他`env.step(s, a)`接口与健身房环境相同,但被剥离.

### 步骤2:计算返回 (反扫)

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

一个通行,$O(T)$逆转复发$G_t = r_{t+1} + \gamma G_{t+1}$避免再总结.

### 步骤3:第一次访问的MC评估

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

工作的三个行:标记状态,如第一次访问,增量数量,更新运行平均.

### 步骤4: ε贪的MC控制 (政策)

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

### 步骤5:与DP黄金标准进行比较

你的 MC估计$V^\pi$实际上:4×4格里德世界上5万集让你进入了`~0.1`答案的答案.

## 陷

- **Infinite episodes.**如果你的政策可以永远循环,`max_steps`格里德世界随机政策经常出,这是正常的,只是确保你正确计算它.
- **Variance.**在长期的节目中,差异很大.$V(s_0)$通过启动,TD方法 (课4) 减少了这一点.
- **State coverage.**贪的MC在新鲜的Q带领只会尝试一个行动.你必须*探索 (ε-贪,探索开始,UCB).
- **Non-stationary policies.**如果$\pi$常数α MC处理这个问题;样本平均MC不.
- **Off-policy importance sampling.**体重$\pi(a \mid s)/\mu(a \mid s)$变量随着视界爆炸. 顶随着每决策权重的IS或转换为TD.

## 用它

蒙特卡罗方法的2026年作用:

| Use case | Why MC |
|----------|--------|
| Short-horizon games (blackjack, poker) | Episodes terminate naturally; returns are clean. |
| Offline evaluation of a logged policy | Average discounted returns over stored trajectories. |
| Monte Carlo Tree Search (AlphaZero) | MC rollouts from tree leaves guide selection. |
| LLM RL evaluation | Compute average reward over sampled completions for a given policy. |
| Baseline estimation in PPO | The advantage target $A_t = G_t - V(s_t)$ uses an MC $G_t$. |
| Teaching RL | Simplest algorithm that actually works — strip bootstrapping to see the core. |

现代深度RL算法 (PPO,SAC) 通过纯 MC (完全返回) 和纯 TD (单步启动) 间进行间接$n$两种终点都是同一估计器的实例.

## 运送它

保存如`outputs/skill-mc-evaluator.md`其他:

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

## 运动

1. **Easy.**执行第一次访问 MC 评估4×4格林世界的统一随机政策. 运行10,000集.$V(0,0)$根据事件数与DP答案的函数.
2. **Medium.**执行 ε-贪的 MC控制$\epsilon \in \lbrace 0.01, 0.1, 0.3 \rbrace$现在,我们在20000集后的平均回报.
3. **Hard.**实施*非政策* MC与重要样本采集:根据统一随机政策收集数据$\mu$估计$V^\pi$对于确定性最佳政策$\pi$根据决定与权重 IS. 哪个有最低差异?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Monte Carlo | "Random sampling" | Estimate expectations by averaging over iid samples from the distribution. |
| Return $G_t$ | "Future reward" | Sum of discounted rewards from step $t$ to episode end: $\sum_{k\ge 0} \gamma^k r_{t+k+1}$. |
| First-visit MC | "Count each state once" | Only the first visit in an episode contributes to the value estimate. |
| Every-visit MC | "Use all visits" | Every visit contributes; slightly biased for finite samples, consistent in the limit, and more sample-efficient. |
| ε-greedy | "Exploration noise" | Pick greedy action with prob $1-\epsilon$; random action with prob $\epsilon$. |
| Importance sampling | "Correcting for sampling from the wrong distribution" | Reweight returns by $\pi(a \mid s)/\mu(a \mid s)$ products to estimate $V^\pi$ from $\mu$ data. |
| On-policy | "Learn from my own data" | Target policy = behavior policy. Vanilla MC, PPO, SARSA. |
| Off-policy | "Learn from someone else's data" | Target policy ≠ behavior policy. Importance-sampled MC, Q-learning, DQN. |

## 进一步阅读

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf)法典治疗.
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726)第一次访问与每次访问分析.
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf)非政策 MC和变化控制.
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362)现代低变量IS估计器.
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343)第一次大规模实验性演示 MC/TD自动游戏融合到超人游戏;在这个阶段下半段的每个课程的概念前.
