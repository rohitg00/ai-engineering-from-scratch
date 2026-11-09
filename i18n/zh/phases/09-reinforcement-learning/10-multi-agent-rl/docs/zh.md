# 多代理的RL

> 单代理RL假设环境静止.把两个学习代理放在同一世界,这个假设就会破裂:每个代理是另一个环境的一部分,两者都在改变.多代理RL是让学习融合的技巧,当马科夫假设不再适用时.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (Q-learning), Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~45 minutes

## 问题

机器人学习导航一个房间是一个单机机器人RL问题.一个足球队不是.阿尔法星vs星际飞行器对手不是.一个竞标代理的市场不是.两个汽车谈判四方停车不是.许多现实世界的问题不是.

在每一个多代理环境中,从任何一个代理人的角度来看,其他代理人都是环境的一部分. 随着他们学习和改变行为,环境变得不稳定. 马科夫的属性"下一个状态只取决于当前状态和我的行动"被侵犯,因为下一个状态也取决于其他代理选择什么,

这打破了表式融合证明 (Q-学习的保证假设是一个静止的环境).它打破了天真的深度RL:代理人在循环中追逐彼此,从来没有收到稳定的政策.你需要多代理特定技术:集中训练/分散执行,反事实基线,联赛比赛,自动比赛.

2026年应用:机器人群,交通路由,自动驾驶车队,市场模拟器,多代理的LLM系统 (16期),以及任何游戏中多个智能玩家.

## 概念

![Four MARL regimes: indep, centralized critic, self-play, league](../assets/marl.svg)

**Formalism: Markov Game.**总体化MDP:国家$S$共同行动$a = (a_1, \ldots, a_n)$过渡$P(s' \mid s, a)$并且每位代理人收取奖励$R_i(s, a, s')$每个代理人$i$根据自己的政策,最大化自己的回报.$\pi_i$如果奖励是相同的,那么它是**fully cooperative**如果是零和,那就算是**adversarial**如果混合,它是**general-sum**现在,我们要去.

**Core challenges:**

- **Non-stationarity.** $P(s' \mid s, a_i)$经纪人$i$视角取决于$\pi_{-i}$现在,我们正在改变.
- **Credit assignment.**谁造成了这个?
- **Exploration coordination.**代理人必须探索互补的策略,而不是冗余地探索同一个状态.
- **Scalability.**共同行动空间在$n$现在,我们要去.
- **Partial observability.**每个代理只能看到自己的观察; 全球状态是隐藏的.

**Four dominant regimes:**

**1. Independent Q-learning / independent PPO (IQL, IPPO).**每个代理学习自己的Q或政策,把他人视为环境的一部分.简单,有时它会发挥作用 (特别是经验重演作为一个平滑的代理模型技巧).理论融合:没有.实践中:宽松关联任务很好,密切关联任务很糟糕.

**2. Centralized training, decentralized execution (CTDE).**现在,我们要做什么?$\pi_i$地方观察的条件$o_i$标准的分散执行在部署. 在*培训*期间,一个集中批评者$Q(s, a_1, \ldots, a_n)$关于全球全面状态和联合行动的条件.
- **MADDPG**(Lowe et al. 2017):每位代理人均有集中批评者.
- **COMA**问问"如果我采取行动,我的奖励会是什么?"$a'$分离了我的贡献.
- **MAPPO**现在,**IPPO**具有共享批评者 (Yu及其他2022):具有集中价值功能的PPO.2026年为合作社MARL占主导地位.
- **QMIX**值分解  $Q_{\text{tot}}(s, a) = f(Q_1(s, a_1), \ldots, Q_n(s, a_n))$的混合.

**3. Self-play.**两个副本的同一代理玩彼此.对手的政策是我从过去的快照的政策.AlphaGo / AlphaZero / MuZero.OpenAI五.最适合零总数游戏;训练信号是对称.

**4. League play.**扩展自动游戏到总和/对抗环境:保持过去和当前政策的人口,从联盟中样本对手,训练对抗他们. 增加剥削者 (专注于击败当前最好的) 和主要剥削者 (专注于击败剥削者). AlphaStar (StarCraft II). 当游戏允许"岩石纸刀刀"战略周期时需要.

**Communication.**让代理人发送学习信息$m_i$福斯特等人 (2016) 表明可以从端到端培训可分化的代理间通信.今天的基于LLM的多代理系统 (阶段16) 基本上以自然语言进行通信.

```figure
f3-marl-orbit
```

## 建立它

这一课使用一个6×6格里德世界,两个合作代理. 他们从相反的角落开始,必须达到共同的目标.`-1`任何代理人仍在移动,`+10`当他们两个人到达的时候.`code/main.py`现在,我们要去.

### 步骤1:多代理环境

```python
class CoopGridWorld:
    def __init__(self):
        self.size = 6
        self.goal = (5, 5)

    def reset(self):
        return ((0, 0), (5, 0))  # two agents

    def step(self, state, actions):
        a1, a2 = state
        new1 = move(a1, actions[0])
        new2 = move(a2, actions[1])
        done = (new1 == self.goal) and (new2 == self.goal)
        reward = 10.0 if done else -1.0
        return (new1, new2), reward, done
```

共同的行动空间是`|A|² = 16`全球状态是两个位置.

### 步骤2:独立的Q学习

每个代理运行自己的Q表,按联合状态键. 在每一步:两个选择 ε-贪的行动,收集联合过渡,每个更新自己的Q与共享奖励.

```python
def independent_q(env, episodes, alpha, gamma, epsilon):
    Q1, Q2 = defaultdict(default_q), defaultdict(default_q)
    for _ in range(episodes):
        s = env.reset()
        done = False
        while not done:
            a1 = epsilon_greedy(Q1, s, epsilon)
            a2 = epsilon_greedy(Q2, s, epsilon)
            s_next, r, done = env.step(s, (a1, a2))
            if done:
                Q1[s][a1] += alpha * (r - Q1[s][a1])
                Q2[s][a2] += alpha * (r - Q2[s][a2])
                break
            target1 = r + gamma * max(Q1[s_next].values())
            target2 = r + gamma * max(Q2[s_next].values())
            Q1[s][a1] += alpha * (target1 - Q1[s][a1])
            Q2[s][a2] += alpha * (target2 - Q2[s][a2])
            s = s_next
```

工作于这个任务,因为奖励密集和一致. 失败于紧密关联的任务 (例如,一个代理必须 *等*另一个).

### 步骤3: 集中式Q,并更新分解值

使用一个Q而不是联合行动$Q(s, a_1, a_2)$通过边缘化: $\pi_i(s) = \arg\max_{a_i} \max_{a_{-i}} Q(s, a_1, a_2)$交易指数式的联合行动空间以获得一个*正确*的全球观.

### 步骤4:简单的自动玩法 (对抗性二代)

列车代理A与B后$K$随着A的重量转换为B的重量,对称训练,持续进步,

## 陷

- **Non-stationary replay.**经验重复与独立代理更糟糕于单机代理,因为旧的转变是由现在过时的对手所生成的.
- **Credit assignment ambiguity.**经过长期的剧情后共享奖励;没有明确的方法来说哪个代理贡献.
- **Policy drift / chasing.**解决问题是:集中批评,学习速度缓慢,或者一次性结.
- **Reward hacking via coordination.**经纪人发现设计师没有预料的协调性exploits.拍卖代理收购零. 解决:谨慎的奖励设计,行为限制.
- **Exploration redundancy.**两位代理都探索着相同的状态行动对.
- **League cycles.**清纯的自主游戏可以陷入统治周期.
- **Sample explosion.** `n`函数近似式; 因素化行动空间 (每个函数的出口头均为一个政策).

## 用它

2026年 MARL 应用地图:

| Domain | Method | Notes |
|--------|--------|-------|
| Cooperative navigation / manipulation | MAPPO / QMIX | CTDE; shared critic + decentralized actors. |
| Two-player games (chess, Go, poker) | Self-play with MCTS (AlphaZero) | Zero-sum; symmetric training. |
| Complex multiplayer (Dota, StarCraft) | League play + imitation pretraining | OpenAI Five, AlphaStar. |
| Autonomous-vehicle fleets | CTDE MAPPO / PPO with attention | Partial obs; variable team sizes. |
| Auction markets | Game-theoretic equilibrium + RL | Mean-field RL when `n` → ∞. |
| LLM multi-agent systems (Phase 16) | Natural-language comm + role conditioning | RL loop at the agent-planning layer. |

2026年,马尔尔最大的增长领域是基于LLM:语言模型代理商的群体进行谈判,辩论,构建软件.

## 运送它

保存如`outputs/skill-marl-architect.md`其他:

```markdown
---
name: marl-architect
description: Pick the right multi-agent RL regime (IPPO, CTDE, self-play, league) for a given task.
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

Given a task with `n` agents, output:

1. Regime classification. Cooperative / adversarial / general-sum. Justify.
2. Algorithm. IPPO / MAPPO / QMIX / self-play / league. Reason tied to coupling tightness and reward structure.
3. Information access. Centralized training (what global info goes to the critic)? Decentralized execution?
4. Credit assignment. Counterfactual baseline, value decomposition, or reward shaping.
5. Exploration plan. Per-agent entropy, population-based training, or league.

Refuse independent Q-learning on tightly-coupled cooperative tasks. Refuse to recommend self-play for general-sum with cycle risks. Flag any MARL pipeline without a fixed-opponent eval (cherry-picked self-play numbers are common).
```

## 运动

1. **Easy.**在2个代理合作社GridWorld上训练独立Q学习. 平均回报>0之前有多少集? 绘制联合学习曲线.
2. **Medium.**添加一个"协调"任务:只有当两个代理在同一拐角处踏上目标时才达到目标.独立的Q仍然相汇?什么断裂?
3. **Hard.**实施一个集中式的MAPPO类型培训批评器,并对协调任务进行独立的PPO与化速度进行比较.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Markov game | "Multi-agent MDP" | $(S, A_1, \ldots, A_n, P, R_1, \ldots, R_n)$; each agent has its own reward. |
| CTDE | "Centralized training, decentralized execution" | Joint critic at training time; each agent's policy uses only local obs. |
| IPPO | "Independent PPO" | Each agent runs PPO separately. Simple baseline; often underrated. |
| MAPPO | "Multi-agent PPO" | PPO with a centralized value function conditioned on global state. |
| QMIX | "Monotonic value decomposition" | $Q_{\text{tot}} = f_{\text{monotone}}(Q_1, \ldots, Q_n)$ allows decentralized argmax. |
| COMA | "Counterfactual multi-agent" | Advantage = my Q minus expected Q marginalizing over my action. |
| Self-play | "Agent vs past self" | Single agent, two roles; standard for zero-sum games. |
| League play | "Population training" | Cache past policies, sample opponents from the pool; handles strategy cycles. |

## 进一步阅读

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) CTDE与一个集中批评者.
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926)抵消信用转让的基线.
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485)值分解与单调性.
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955)PPO对马尔来说是惊人的强大.
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z)在规模上进行联赛比赛.
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270)在零积分游戏中纯粹的自动游戏.
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf)包括教科书中对多代理设置的简短处理以及CTDE旨在解决的非静止性问题.
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) 调查涉及合作,竞争性和混合 MARL,并有收成性结果.
