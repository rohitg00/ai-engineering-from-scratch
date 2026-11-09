# 时间差异 Q学习和SARSA

> 蒙特卡洛等到集结束.TD每一步都会通过启动下一个值估计进行更新.Q-学习是非政策和乐观的;SARSA是政策和谨慎的.这两条都是一个代码线.这两条都支持了这个阶段的每种深度RL方法.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## 问题

蒙特卡洛工作,但它有两个昂贵的要求.它需要结束的集,并且只有在最后的回报后更新.如果你的集是1000步,MC等待1000步更新任何东西.它是高变异,低偏见,并缓慢的实践.

动态编程具有相反的配置文件,但需要已知的模型.

时间差异 (TD) 学习将差异分开.$(s, a, r, s')$形成一个步骤的目标$r + \gamma V(s')$着着$V(s)$没有模型,没有完整的集,使用近似的偏见.$V$在RHS上,但与MC和在线更新相比,

现在,我们在第9阶段的基础上将使用一个步骤的TD更新,然后再进行一个步骤的TD更新.

## 概念

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**The TD(0) update for V:**

```math
V(s) \leftarrow V(s) + \alpha [r + \gamma V(s') - V(s)]
```

括数量是TD错误$\delta = r + \gamma V(s') - V(s)$它是网上模拟的$G_t - V(s_t)$在MC. 融合需要$\alpha$满足罗宾斯-蒙罗的需求 ($\sum \alpha = \infty$现在$\sum \alpha^2 < \infty$许多国家都经常访问.

**Q-learning.**控制的非政策TD方法:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \max_{a'} Q(s', a') - Q(s, a)]
```

其他`max`假设从$s'$无论代理人做什么,这种脱而出,使Q学习学习.$Q^{\ast}$在Atari (课程05) 上,Mnih et al. (2015) 将这转化为深度Q学习.

**SARSA.**政策上的TD方法:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma Q(s', a') - Q(s, a)]
```

现在,这个叫""$(s, a, r, s', a')$ SARSA使用该行动$a'$现在,那个代理人是接下来的,而不是贪的人.`argmax`合到$Q^\pi$为了什么是贪的$\pi$现在,它正在运行,$\epsilon \to 0$成为$Q^{\ast}$现在,我们要去.

**The cliff-walking difference.**在经典的悬崖行走任务 (落下悬崖 = 奖励 -100),Q-学习学习沿悬崖边缘的最佳路径,但偶尔在探索过程中承担罚款.SARSA学习一个更安全的路径,因为它将探索噪音纳入其Q值.$\epsilon \to 0$在实践中,这很重要:当探索实际发生在部署时,SARSA的行为更保守.

**Expected SARSA.**取代$Q(s', a')$预期值低于$\pi$其他:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \sum_{a'} \pi(a' \mid s') Q(s', a') - Q(s, a)]
```

较 SARSA较低的变异性 (没有样本$a'$常常是现代教科书中的默认.

**n-step TD and TD(λ).**通过等待来间隔TD(0) 和MC$n$起步前的步骤.$n=1$是TD,$n=\infty$是 MC. TD(λ) 平均值$n$具有几何权重$(1-\lambda)\lambda^{n-1}$大多数深度RL使用$n$在3到20之间.

```figure
qlearning-gridworld
```

## 建立它

### 步骤1:关于利政策的SARS

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

只有一个区别与Q学习是目标线.

### 步骤2:Q学习

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

其他`max`目标与行为分离. 这一符号是政策和非政策之间的区别.

### 步骤3:学习曲线

追踪平均回报每100集.Q学习在简单的确定性格里德世界上更快地融合;SARSA在悬崖行走上更保守.在4×4格里德世界上`code/main.py`两部都在2000集后接近最佳$\alpha=0.1, \epsilon=0.1$现在,我们要去.

### 步骤4:与DP真相相比较

运行值回复 (课程02) 得到$Q^{\ast}$查看$\max_{s,a} \lvert Q_{\text{learned}}(s,a) - Q^{\ast}(s,a) \rvert$一个健康的表表表TD代理落地在`~0.5`在4×4格林世界上,经过1万集.

## 陷

- **Initial Q values matter.**乐观的初步 ($Q = 0$悲观的初步可以永远陷入贪的政治陷.
- **α schedule.**持续$\alpha$对于非静态问题来说,很好.$\alpha_n = 1/n$在理论上,它能实现相近性,但在实践中却太慢了.$\alpha$在`[0.05, 0.3]`监视学习曲线.
- **ε schedule.**开始高 ($\epsilon=1.0$), 衰退到$\epsilon=0.05$利 (贪在极限的探索) 是化条件.
- **Max bias in Q-learning.**其他`max`操作员偏向上升时$Q$导致过度估值 哈塞尔特的双重Q学习 (DDQN在05课中使用) 用两个Q表来解决这一问题.
- **Non-terminating episodes.**标准:把作为非终端,继续启动.
- **State hashing.**如果状态是体/体,请使用可的键 (体,而不是列表;体圆,而不是原始).

## 用它

2026年特工技术景观:

| Task | Method | Reason |
|------|--------|--------|
| Small tabular environments | Q-learning | Learns optimal policy directly. |
| On-policy safety-critical | SARSA / Expected SARSA | Conservative during exploration. |
| High-dimensional state | DQN (Phase 9 · 05) | Neural-net Q-function with replay and target net. |
| Continuous actions | SAC / TD3 (Phase 9 · 07) | TD update on a Q-network; policy net emits actions. |
| LLM RL (reward-model-based) | PPO / GRPO (Phase 9 · 08, 12) | Actor-critic with TD-style advantage via GAE. |
| Offline RL | CQL / IQL (Phase 9 · 08) | Q-learning with conservative regularization. |

在2026年报纸中,你读到的"RL"中90%是Q学习或SARSA的精细化.

## 运送它

保存如`outputs/skill-td-agent.md`其他:

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

## 运动

1. **Easy.**实现Q学习和SARSA在4×4格林世界. 绘制学习曲线 (每100集的平均回报) 进行2000集.谁更快地融合?
2. **Medium.**建立一个悬崖走路环境 (4×12,最后一行是悬崖,奖励 -100,重新设置开始).比较Q学习和SARSA最终政策.截图每个路径.哪个离悬崖更近?
3. **Hard.**实现双重Q学习. 在一个噪音奖励的网格世界 (高斯噪音)$\sigma=5$增加到每步奖励),显示Q学习过度估值$V^{\ast}(0,0)$双重Q学习没有.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TD error | "The update signal" | $\delta = r + \gamma V(s') - V(s)$, the bootstrapped residual. |
| TD(0) | "One-step TD" | Update after every transition using only the next state's estimate. |
| Q-learning | "Off-policy RL 101" | TD update with `max` over next-state actions; learns $Q^{\ast}$ regardless of behavior policy. |
| SARSA | "On-policy Q-learning" | TD update using the actual next action; learns $Q^\pi$ for current ε-greedy π. |
| Expected SARSA | "The low-variance SARSA" | Replace sampled $a'$ with its expectation under π. |
| GLIE | "Correct exploration schedule" | Greedy in the Limit with Infinite Exploration; needed for Q-learning convergence. |
| Bootstrapping | "Using current estimate in the target" | What distinguishes TD from MC. Source of bias but massive variance reduction. |
| Maximization bias | "Q-learning overestimates" | `max` over noisy estimates is upward-biased; fixed by Double Q-learning. |

## 进一步阅读

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698)原始文件和相近性证明.
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) TD(0),SARSA,Q学习,预期SARSA.
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html)对最大化偏见的修正.
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542)预期 SARSA动机.
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems)创建了SARSA的论文 (当时被称为"修改的连接性Q学习").
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf)将TD(0) 概括为TD(n),从Q学习到资格追踪的路径,后来,在PPO中GAE.
