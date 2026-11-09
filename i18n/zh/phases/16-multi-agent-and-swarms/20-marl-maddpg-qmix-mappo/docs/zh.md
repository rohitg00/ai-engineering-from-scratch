# 马德普格,QMIX,MAPPO

> 跨代理协调的增强学习遗产,在2026年仍在线提供LLM代理系统. **MADDPG**(Lowe et al., NeurIPS 2017, arXiv:1706.02275) 引入了集中训练,分散执行 (CTDE):每个评论家都会在训练中看到所有代理人的状态和行动;在测试时间,只有当地演员运行.为合作,竞争和混合环境工作. **QMIX**(Rashid等,ICML 2018,arXiv:1803.11485) 是一个单调的混合网络的值分解;每种代理Qs结合成联合Q,所以`argmax`清洁地分布在星际飞行器多代理挑战 (SMAC) 中. **MAPPO**(Yu et al., NeurIPS 2022, arXiv:2103.01955) 是一个具有中心化的价值函数的PPO;在粒子世界,SMAC,谷歌研究足球,哈纳比上"惊人的有效".这些支持代理团队的培训政策,必须以分散方式行动.**default 2026 cooperative-MARL baseline**在学习法师训练之前,我们将这三个想法放在肌肉记忆中.

**Type:** Learn
**Languages:** Python (stdlib, small NumPy-free implementations), TypeScript
**Prerequisites:** Phase 09 (Reinforcement Learning), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~90 minutes

## 问题

专业知识管理机构系统越来越多地培训机构间协调的政策:何时推迟,何时采取行动,谁应调用.告诉你如何培训这些政策的文献是多代理增强学习 (MARL),它早于专业知识管理机构的波浪,并且有一小组主导算法.

没有模式词汇阅读 MARL 论文是痛苦的.集中式训练,分散执行 (CTDE),价值分解和集中式批评不是流行词,它们是特定问题的具体答案:

- 独立的RL (每一个代理学习独自) 是从每个代理的角度来看不静止的.
- 集中式RL (一个代理控制所有) 不扩展并违反执行限制.
- 技术技术技术得到了两者的最佳效果:利用全球信息训练,

## 概念

### 论文使用的三个环境

- **Particle World (multi-agent particle env).**简单的二维物理,具有合作/竞争任务.
- **StarCraft Multi-Agent Challenge (SMAC).**合作微管理,部分观察,QMIX的试验床, 微妙的行动,持续状态.
- **Google Research Football, Hanabi, MPE.**根据地图的基本线.

不同的环境有不同的行动/观察类型.算法根据此选择.

###         

每个代理人`i`有一个演员`mu_i(o_i)`任何代理都具有一个批评者.`Q_i(x, a_1, ..., a_n)`演员的政策格里因与评论家的评价进行更新.

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

为什么CTDE:在训练时,我们知道每个人的行动;我们使用这一点来减少每个评论家的差异.`o_i`电话`mu_i(o_i)`现在,我们要去.

失败模式:批评者使用N代理增长 (输入包括所有操作).没有接近的情况下不超过~10代理.

### 值分解 QMIX (2018)

只有合作. 共同行动价值`Q_tot`是每剂Q值的单调混合函数:

```math
Q_{\text{tot}}(\tau, a) = f\big(Q_1(\tau_1, a_1), \ldots, Q_n(\tau_n, a_n)\big), \quad \frac{\partial f}{\partial Q_i} \ge 0
```

调性保证`argmax_a Q_tot`任何代理选择的可计算`argmax_{a_i} Q_i`独立的.**exactly the decentralized execution property**在训练时,一个混合网络产生了`Q_tot`根据每位代理的Qs.

为什么QMIX在SMAC中获胜:合作伙伴的StarCraft微管理具有均的代理,本地工作,全球奖励 完美适合价值分解.

失败模式:单调性限制是限制性的;一些任务具有非单调分解性的奖励结构 (一个代理为团队牺牲).扩展 (QTRAN,QPLEX) 缓解这一点.

###  没有考虑的违约

多代理PPO:PPO具有集中价值功能.每个代理都有自己的政策;所有代理都分享 (或每个代理) 价值功能,看出完整状态.Yu等. 2022年与MADDPG,QMIX和它们的扩展进行了比较,并发现:

- 根据"MAPPO"的规定,MAPPO与"粒子世界",SMAC,Google研究足球,Hanabi,MPE"的非政策 MARL方法相匹配或超过.
- 需要最小的超参数调整.
- 稳定训练;可在种子中复制.

在2026年,MAPPO是合作社MarL的默认基准;任何新的方法都必须击败它.

### 什么是 LLM代理工程师应该关心

直接使用的三种用途:

1. **Router training.**转载中,一个分类代理选择哪个分类代理处理任务.这是一个 MARL 问题,N 分级分类代理和一个集中路由器.
2. **Role emergence.**在生成代理模拟中,培训代理人随着时间的推移采取互补作用是身的MARL问题.
3. **Multi-agent tool use.**当代理人分享工具并争取预算时,通过CTDE培训产生可部署的本地政策,尊重资源限制.

实际警告:在2026年,大多数生产LLM代理系统会提醒其政策而不是培训. MARL是当你 (a) 有大量的互动数据, (b) 清楚的奖励信号, (c) 愿意投资培训基础设施时.

### CTDE作为超越RL的设计模式

即使没有培训,CTDE是一个有用的建筑模式:

- 在设计过程中, 确保团队的全视力.
- 在*运行时间*,执行分散执行:每个代理只看到`o_i`现在,我们要去.

许多生产多代理系统默默地假设在任何地方都会分享状态. CTDE纪律阻止这种情况.

### 无静止性问题

当多个代理同时学习时,每个代理的环境 (包括其他代理的政策) 不会静止.经典单代理RL证明断裂.本课中的 MARL算法都解决了这一问题:

- 全球批评者看到所有行动,所以它的估值是静止的.
- 值分解将学习转移到一个合体Q空间,其中优化是精确定义的.
- 图:集中价值函数缓解了其他政策变化的差异.

在LLM代理系统中,非静止性表现为"我的代理工作了上个月,现在其他代理上游改变了,我的行为不当.

### 这本课没有涵盖的内容

培训实际网络是9阶段的课程.本课程建立了脚本式政策版本,展示了CTDE,值分解和中心化的值模式,而没有梯度更新.目标是在您采集完整的 MARL库之前,将模式内部化.

```figure
sw-ctde
```

## 建立它

`code/main.py`通过两个代理合作的小网络世界,

- 环境: 4x4格格上的2个代理,一个奖励片. 奖励 = 1 如果任何代理达到片;任务完成.
- `IndependentAgents`每个代理人对待其他代理人,
- `MADDPGStyle`集中批评者计算了共同价值;演员政策从中更新.
- `QMIXStyle`单调混合器的值分解.
- `MAPPOStyle`集中价值函数; 政策更新与共享基线相比.

它们都运行相同的节目,并报告平均步骤到目标.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

预期输出:独立代理平均采取6步;CTDE变体向3.5步相近 (最佳为4x4格式是3).尽管脚本的政策,但模式差异显示.

## 用它

`outputs/skill-marl-picker.md`是一个选择一个MARL算法的技能,用于一个特定的多代理任务:合作与竞争,同质与异质,行动空间类型,规模,奖励信号.

## 运送它

果是很少见的.

- **Start with MAPPO.**报纸在2022年确定了这一点为基准; 首先将其复制,可以节省了几个星期的追求更精致的方法.
- **Log every agent's observation and action stream.**没有任何特工的痕迹,就会无望.
- **Separate training code from execution code.**执行路径真的只能看到`o_i`现在,我们要去.
- **Reward shaping warning.**马尔对奖励设计非常敏感. 调整过程中有一种协调错误, 代理人学会利用它.
- **For LLM agents**只有在互动数据+奖励信号+基础设施都存在时,才投资MARL培训.

## 运动

1. 跑步`code/main.py`测量独立和MAPPO类代理之间的步骤到目标差距.在6×6网格上,差距是否会增加或缩小?
2. 实施竞争型变体:两个代理,一个子,只有第一个达到的获得奖励. 哪个模式处理竞争清洁?
3. 阅读MADDPG (arXiv:1706.02275) 第三节. 用自己的话语,用伪码符号实现精确的评论更新规则.
4. 阅读MAPPO (arXiv:2103.01955). 为什么作者认为中心化价值+PPO在他们的基准上超过非政策 MARL?列出三个最强大的索赔.
5. 应用CTDE作为一个假设的LLM代理系统的设计模式 (例如,研究代理+总结器+编码器).在设计时可用的联合信息是什么,而在运行时间无法使用?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARL | "Multi-Agent RL" | Reinforcement learning for multi-agent systems. |
| CTDE | "Centralized Training, Decentralized Execution" | Train with global info; deploy with local policies. |
| MADDPG | "Multi-Agent DDPG" | CTDE with per-agent critic seeing all observations + actions. |
| QMIX | "Value decomposition" | Monotonic mixing of per-agent Qs. Cooperative. |
| MAPPO | "Multi-Agent PPO" | PPO with centralized value function. 2026 default baseline. |
| Value decomposition | "Sum of individual Qs" | Joint Q represented as a monotone function of per-agent Qs. |
| Non-stationarity | "Moving targets" | Each agent's env changes as others learn. The core MARL problem. |
| On-policy / off-policy | "Learn from current / replay" | PPO is on-policy (MAPPO); DDPG and Q-learning are off-policy. |
| SMAC | "StarCraft Multi-Agent Challenge" | Cooperative micromanagement benchmark; QMIX's homegrown ground. |

## 进一步阅读

- [Lowe et al. — Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) MADDPG; 2017 年的 NeurIPS
- [Rashid et al. — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) QMIX;ICML 2018 年
- [Yu et al. — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955)MAPPO;神经系统2022年
- [BAIR blog post on MAPPO](https://bair.berkeley.edu/blog/2021/07/14/mappo/)可读的MAPPO结果框架
- [SMAC repository](https://github.com/oxwhirl/smac)星际飞行多代理挑战
