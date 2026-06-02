# MARL — MADDPG、QMIX、MAPPO

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 多 agent 协调的强化学习血脉，在 2026 年仍然影响着 LLM-agent 系统。**MADDPG**（Lowe et al., NeurIPS 2017, arXiv:1706.02275）提出了集中训练、去中心化执行（Centralized Training, Decentralized Execution，CTDE）：训练时每个 critic 看到所有 agent 的状态和动作；测试时只跑本地 actor。适用于合作、竞争与混合场景。**QMIX**（Rashid et al., ICML 2018, arXiv:1803.11485）走的是值分解（value decomposition）路线，配单调（monotonic）混合网络；每个 agent 的 Q 组合成联合 Q，`argmax` 因此可以干净地分发——在 StarCraft Multi-Agent Challenge（SMAC）上称霸。**MAPPO**（Yu et al., NeurIPS 2022, arXiv:2103.01955）是带集中价值函数（centralized value function）的 PPO；在 particle-world、SMAC、Google Research Football、Hanabi 上「出乎意料地有效」，几乎不用调参。这些方法支撑着 agent 团队策略的训练——这些团队必须以去中心化方式行动。MAPPO 是 **2026 年合作型 MARL 的默认基线**。这一课从一个迷你 grid-world 玩具一步步搭出三种方法，把这三个想法刻进肌肉记忆，再去碰 LLM-agent 训练。

**Type:** Learn
**Languages:** Python（标准库，小型实现，无 NumPy）
**Prerequisites:** Phase 09（强化学习）、Phase 16 · 09（Parallel Swarm Networks）
**Time:** ~90 分钟

## 问题（Problem）

LLM-agent 系统越来越多地训练用于 agent 间协调的策略：何时让步、何时行动、调用哪个同伴。教你怎么训练这种策略的文献，是 Multi-Agent Reinforcement Learning（MARL，多 agent 强化学习），它早于 LLM 浪潮，并已沉淀出一小批主流算法。

不带模式词汇就读 MARL 论文非常痛苦。集中训练去中心化执行（CTDE）、值分解、集中 critic 不是流行词——它们是针对具体问题的具体答案：

- 独立 RL（每个 agent 各自学习）从单 agent 视角看是非平稳的（non-stationary）。差。
- 集中式 RL（一个 agent 控制所有）扩展不了，也违反执行端的约束。
- CTDE 取两者之长：用全局信息训练，用本地策略部署。

## 概念（Concept）

### 论文常用的三个环境

- **Particle World（multi-agent particle env）。** 简单 2D 物理，含合作 / 竞争任务。MADDPG 的原始测试床。
- **StarCraft Multi-Agent Challenge（SMAC）。** 合作型微操，部分可观测。QMIX 的测试床。离散动作、连续状态。
- **Google Research Football、Hanabi、MPE。** MAPPO 基准。

不同环境有不同的动作 / 观测类型。算法据此挑选。

### MADDPG（2017）—— CTDE 模式

每个 agent `i` 有一个 actor `mu_i(o_i)`，把它自己的观测映射到动作。每个 agent 还有一个 critic `Q_i(x, a_1, ..., a_n)`，训练时看到所有观测和所有动作。actor 通过对 critic 评估的策略梯度（policy gradient）来更新。

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

为什么要 CTDE：训练时我们知道所有人的动作，可以用这个信息降低每个 critic 的方差。部署时每个 agent 只看 `o_i`、调 `mu_i(o_i)`。

失败模式：critic 的输入会随 agent 数 N 增长（要包含所有动作）。不做近似的话，超过 ~10 个 agent 就扩不动。

### QMIX（2018）—— 值分解

仅合作场景。全局奖励是每个 agent Q 值的单调函数之和：

```
Q_tot(tau, a) = f(Q_1(tau_1, a_1), ..., Q_n(tau_n, a_n)),   df/dQ_i >= 0
```

这种单调性保证了 `argmax_a Q_tot` 可以由每个 agent 各自独立选 `argmax_{a_i} Q_i` 算出来。这正是你需要的**去中心化执行属性**。训练时，混合网络从各 agent 的 Q 产出 `Q_tot`。

QMIX 在 SMAC 上为何赢：合作型 StarCraft 微操是同构 agent、本地观测、全局奖励——和值分解严丝合缝。

失败模式：单调性约束太死；有些任务的奖励结构不可单调分解（比如某个 agent 为团队牺牲）。扩展（QTRAN、QPLEX）放松了它。

### MAPPO（2022）—— 被低估的默认值

Multi-Agent PPO：带集中价值函数的 PPO。每个 agent 有自己的策略；所有 agent 共用（或每 agent 一份）价值函数，看到完整状态。Yu et al. 2022 在五个基准（benchmark）上把 MAPPO 与 MADDPG、QMIX 及其扩展做了对照，结果：

- MAPPO 在 particle-world、SMAC、Google Research Football、Hanabi、MPE 上追平甚至打败了 off-policy MARL 方法。
- 几乎不用调超参。
- 训练稳定；多 seed 可复现。

这篇论文之前，社区低估了 on-policy MARL。2026 年，MAPPO 是合作型 MARL 的默认基线；任何新方法都得先打过它。

### LLM-agent 工程师为什么要在意

三个直接的用途：

1. **路由器训练。** meta-agent 决定由哪个子 agent 处理某任务。这是一个 MARL 问题：N 个去中心化的子 agent + 一个集中路由器（router）。MAPPO 合适。
2. **角色涌现。** 在生成式 agent 仿真中，让 agent 随时间习得互补角色，本质是个伪装的 MARL 问题。QMIX 风格的值分解在结构上就强制要求互补。
3. **多 agent tool use。** 当 agent 共享工具、抢预算时，用 CTDE 训练能产出尊重资源约束的可部署本地策略。

实践上的提醒：2026 年大多数生产级 LLM-agent 系统是用 prompt 写策略，不是训练策略。MARL 适合 (a) 有大量交互数据，(b) 奖励信号清晰，(c) 愿意投资训练基础设施，三者俱全的场景。

### CTDE 作为超越 RL 的设计模式

哪怕你不训练，CTDE 也是个有用的架构模式：

- *设计*时，假设全队可见性。
- *运行*时，强制去中心化执行：每个 agent 只看 `o_i`。

这个模式逼你把每个 agent 的状态显式化，并提前思考部分可观测性。许多生产级多 agent 系统默默假设状态处处共享——CTDE 的纪律能避免这一点。

### 非平稳性问题

多个 agent 同时学习时，每个 agent 的环境（包含其他 agent 的策略）就是非平稳的。经典的单 agent RL 证明都失效。本课的 MARL 算法都在应对这件事：

- MADDPG：全局 critic 看到所有动作，因此它的价值估计是平稳的。
- QMIX：值分解把学习挪到联合 Q 空间，那里最优性定义良好。
- MAPPO：集中价值函数能压住其他 agent 策略变化带来的方差。

在 LLM-agent 系统里，非平稳性表现成「上个月还能跑的 agent，上游另一个 agent 一改，我这个就抽风了」。用 CTDE 训练 MARL 是有原则的修法；prompt 层面的修补更快，但更不耐用。

### 这一课**不**覆盖什么

真正训练网络是 Phase 09 的话题。这一课用脚本化策略（scripted policy）的方式做演示，把 CTDE、值分解、集中价值这三个模式呈现出来，但不做梯度更新。目的是在你拿起一个完整的 MARL 库（PyMARL、MARLlib、RLlib multi-agent）之前，先把模式内化。

## 动手实现（Build It）

`code/main.py` 在一个 2 个 agent 的迷你合作型 grid-world 上实现了三种模式演示：

- 环境：4x4 网格上 2 个 agent，1 个奖励豆。任一 agent 到达豆子奖励 = 1；任务结束。
- `IndependentAgents` —— 每个 agent 把别人当环境。基线。
- `MADDPGStyle` —— 集中 critic 算联合价值；actor 策略据此更新。脚本化的策略改进。
- `QMIXStyle` —— 配单调混合器的值分解。
- `MAPPOStyle` —— 集中价值函数；策略对照共享基线更新。

四种都跑同样的 episode，报告平均到达步数。CTDE 变体收敛到比独立基线更短的路径。

运行：

```
python3 code/main.py
```

预期输出：独立 agent 平均 ~6 步；CTDE 变体收敛到 ~3.5 步（4x4 网格的最优是 3）。即便策略是脚本化的，模式差异仍然显现。

## 用起来（Use It）

`outputs/skill-marl-picker.md` 是一个 skill，给定一个多 agent 任务，它会挑选 MARL 算法：合作 vs 竞争、同构 vs 异构、动作空间类型、规模、奖励信号。

## 上线部署（Ship It）

MARL 在生产里很少见。要用的话：

- **从 MAPPO 起步。** 2022 年那篇论文已立它为基线；先复现它能省下数周追新潮方法的时间。
- **记录每个 agent 的观测和动作流。** 没有 per-agent trace，调 MARL 就是无望。
- **训练代码与执行代码分开。** CTDE 是纪律；执行路径上务必只看 `o_i`。
- **奖励 shaping 警告。** MARL 对奖励设计极度敏感。shaping 里有一个协调 bug，agent 就会学会利用它。跑对抗性测试。
- **对 LLM agent**，先考虑 prompt 层策略。只有当交互数据 + 奖励信号 + 基础设施齐备时，才投入 MARL 训练。

## 练习（Exercises）

1. 跑 `code/main.py`。测量独立 agent 与 MAPPO 风格 agent 之间到达步数的差距。在 6x6 网格上这个差距会变大还是变小？
2. 实现一个竞争变体：两个 agent，一颗豆，只有先到的拿奖励。哪种模式干净地处理竞争？历史上是 MADDPG。
3. 读 MADDPG（arXiv:1706.02275）第 3 节。用你自己的话以伪代码符号化地实现它的 critic 更新规则。
4. 读 MAPPO（arXiv:2103.01955）。作者为何主张集中价值 + PPO 在他们的基准上能打败 off-policy MARL？列出最有力的三条论据。
5. 把 CTDE 当成设计模式，应用到一个假设的 LLM-agent 系统（例如：research agent + summarizer + coder）。设计时可用、但运行时不可用的联合信息是什么？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 真正的意思 |
|------|----------------|------------------------|
| MARL | "Multi-Agent RL" | 多 agent 系统的强化学习。 |
| CTDE | "Centralized Training, Decentralized Execution" | 用全局信息训练；用本地策略部署。 |
| MADDPG | "Multi-Agent DDPG" | CTDE，每个 agent 的 critic 看到所有观测 + 动作。 |
| QMIX | "Value decomposition" | 各 agent Q 的单调混合。仅合作。 |
| MAPPO | "Multi-Agent PPO" | 带集中价值函数的 PPO。2026 年默认基线。 |
| Value decomposition | "各自 Q 之和" | 联合 Q 表示为各 agent Q 的单调函数。 |
| Non-stationarity | "目标在动" | 别人在学，每个 agent 的环境就在变。MARL 的核心问题。 |
| On-policy / off-policy | "用当前 / 用回放学习" | PPO 是 on-policy（MAPPO 也是）；DDPG 和 Q-learning 是 off-policy。 |
| SMAC | "StarCraft Multi-Agent Challenge" | 合作型微操基准；QMIX 的主场。 |

## 延伸阅读（Further Reading）

- [Lowe et al. — Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) — MADDPG；NeurIPS 2017
- [Rashid et al. — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) — QMIX；ICML 2018
- [Yu et al. — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) — MAPPO；NeurIPS 2022
- [BAIR blog post on MAPPO](https://bair.berkeley.edu/blog/2021/07/14/mappo/) — 对 MAPPO 结果的可读性梳理
- [SMAC repository](https://github.com/oxwhirl/smac) — StarCraft Multi-Agent Challenge
