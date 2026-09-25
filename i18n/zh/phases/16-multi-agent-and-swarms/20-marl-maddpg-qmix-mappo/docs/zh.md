# MARL — MADDPG、QMIX、MAPPO

> 多智能体协作的强化学习渊源，在 2026 年仍持续影响着 LLM 智能体系统。**MADDPG**（Lowe 等，NeurIPS 2017，arXiv:1706.02275）提出了集中式训练、分散式执行（CTDE）：训练时每个 critic 能看到所有智能体的状态和动作；测试时只运行局部 actor。适用于合作、竞争和混合场景。**QMIX**（Rashid 等，ICML 2018，arXiv:1803.11485）是一种带单调混合网络的价值分解方法；各智能体的 Q 值组合成联合 Q，使 `argmax` 能够干净地分配——在 StarCraft Multi-Agent Challenge（SMAC）上占主导地位。**MAPPO**（Yu 等，NeurIPS 2022，arXiv:2103.01955）是带集中式价值函数的 PPO；在粒子世界、SMAC、Google Research Football、Hanabi 上仅需极少调参便“出奇地有效”。这些算法构成了必须分散行动的智能体团队训练策略的基础。MAPPO 是 **2026 年合作式 MARL 的默认基线**。本课程从一个小型网格世界玩具环境出发逐个构建它们，在接触 LLM 智能体训练之前，把这三个思想刻进肌肉记忆。

**Type:** Learn
**Languages:** Python（标准库，小型无 NumPy 实现）
**Prerequisites:** Phase 09（强化学习）、Phase 16 · 09（并行集群网络）
**Time:** 约 90 分钟

## 问题

LLM 智能体系统越来越多地为智能体间协作训练策略：何时让位、何时行动、调用哪个同伴。告诉你如何训练这类策略的文献是多智能体强化学习（MARL），它早于 LLM 浪潮，并有一小套占主导地位的算法。

没有模式词汇去读 MARL 论文会很痛苦。集中式训练与分散式执行（CTDE）、价值分解、集中式 critic 都不是空洞的时髦词——它们是针对具体问题的具体答案：

- 独立 RL（每个智能体单独学习）从每个智能体的视角看是非平稳的。很糟。
- 集中式 RL（一个智能体控制所有）无法扩展，且违反执行约束。
- CTDE 兼得两者之长：用全局信息训练，用局部策略部署。

## 概念

### 论文使用的三种环境

- **粒子世界（multi-agent particle env）。** 简单的 2D 物理，带有合作/竞争任务。MADDPG 的原始测试床。
- **StarCraft Multi-Agent Challenge（SMAC）。** 合作式微观操作，部分可观测。QMIX 的测试床。离散动作，连续状态。
- **Google Research Football、Hanabi、MPE。** MAPPO 的基线环境。

不同环境的动作/观测类型不同。算法据此做出选择。

### MADDPG（2017）—— CTDE 模式

每个智能体 `i` 有一个 actor `mu_i(o_i)`，将自己的观测映射为动作。每个智能体还有一个 critic `Q_i(x, a_1, ..., a_n)`，训练时能看到所有观测和所有动作。actor 依据 critic 的评估通过策略梯度更新。

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

为什么用 CTDE：训练时我们知道所有人的动作，我们利用这一点来降低每个 critic 的方差。部署时，每个智能体只看到 `o_i` 并调用 `mu_i(o_i)`。

失败模式：critic 随 N 个智能体增长（输入包含所有动作）。不做近似就无法扩展到约 10 个智能体以上。

### QMIX（2018）—— 价值分解

仅限合作场景。全局奖励是各智能体 Q 值的某个单调函数之和：

```
Q_tot(tau, a) = f(Q_1(tau_1, a_1), ..., Q_n(tau_n, a_n)),   df/dQ_i >= 0
```

单调性保证 `argmax_a Q_tot` 可以通过各智能体独立选择 `argmax_{a_i} Q_i` 来计算。这正是你所需要的**分散式执行性质**。训练时，一个混合网络从各智能体的 Q 值产生 `Q_tot`。

QMIX 为何在 SMAC 上胜出：合作式 StarCraft 微观操作具有同质智能体、局部观测、全局奖励——与价值分解完美契合。

失败模式：单调性约束是限制性的；某些任务的奖励结构不可单调分解（某个智能体为团队牺牲自己）。扩展方法（QTRAN、QPLEX）放宽了这一点。

### MAPPO（2022）—— 被忽视的默认选择

多智能体 PPO：带集中式价值函数的 PPO。每个智能体有自己的策略；所有智能体共享（或各有一个）能看到完整状态的价值函数。Yu 等 2022 在五个基准上把 MAPPO 与 MADDPG、QMIX 及其扩展做了对比，发现：

- MAPPO 在粒子世界、SMAC、Google Research Football、Hanabi、MPE 上持平或超越 off-policy MARL 方法。
- 所需超参数调优极少。
- 训练稳定；跨随机种子可复现。

在这篇论文之前，社区低估了 on-policy MARL。2026 年，MAPPO 是合作式 MARL 的默认基线；任何新方法都必须击败它。

### 为什么 LLM 智能体工程师应该在意

三个直接用途：

1. **路由器训练。** 一个元智能体选择由哪个子智能体处理任务。这是一个有 N 个分散式子智能体和一个集中式路由器的 MARL 问题。MAPPO 很合适。
2. **角色涌现。** 在生成式智能体模拟中，训练智能体随时间采用互补角色，本质上是一个 MARL 问题。QMIX 风格的价值分解从构造上强制互补性。
3. **多智能体工具使用。** 当智能体共享工具并竞争预算时，通过 CTDE 训练它们能产生尊重资源约束的可部署局部策略。

实践提醒：2026 年，大多数生产级 LLM 智能体系统通过提示而非训练来获得策略。当你具备 (a) 大量交互数据，(b) 清晰的奖励信号，(c) 投入训练基础设施的意愿时，才轮到 MARL。

### CTDE 作为 RL 之外的设计模式

即使不训练，CTDE 也是一个有用的架构模式：

- 在*设计*阶段，假设团队全局可见。
- 在*运行*阶段，强制分散式执行：每个智能体只看到 `o_i`。

这个模式迫使你显式维护每个智能体的状态，并提前思考部分可观测性。许多生产级多智能体系统默认静默假设到处共享状态——CTDE 纪律可以防止这一点。

### 非平稳性问题

当多个智能体同时学习时，每个智能体的环境（包含其他智能体的策略）是非平稳的。经典单智能体 RL 的证明失效。本课程中的 MARL 算法都解决了这个问题：

- MADDPG：全局 critic 看到所有动作，因此其价值估计是平稳的。
- QMIX：价值分解把学习转移到联合 Q 空间，其中最优性有明确定义。
- MAPPO：集中式价值函数抑制了来自其他智能体策略变化的方差。

在 LLM 智能体系统中，非平稳性表现为“我的智能体上个月还能用，现在上游另一个智能体改了，我的就出问题了。”用 CTDE 训练 MARL 是有原则的修复；提示层面的修复更快但不持久。

### 本课程不涵盖的内容

训练真实网络是 Phase 09 的主题。本课程构建脚本化策略版本，在不做梯度更新的情况下演示 CTDE、价值分解和集中式价值模式。目标是在你拿起完整的 MARL 库（PyMARL、MARLlib、RLlib multi-agent）之前内化这些模式。

```figure
sw-ctde
```

## 构建它

`code/main.py` 实现三个模式演示，全部在一个微型的 2 智能体合作网格世界上：

- 环境：4x4 网格上的 2 个智能体，一个奖励豆。任一智能体到达豆则奖励 = 1；任务结束。
- `IndependentAgents` —— 每个智能体把其他智能体当作环境。基线。
- `MADDPGStyle` —— 集中式 critic 计算联合价值；actor 策略据此更新。脚本化策略改进。
- `QMIXStyle` —— 带单调混合器的价值分解。
- `MAPPOStyle` —— 集中式价值函数；各策略对照共享基线更新。

四者运行相同的回合并报告平均到达目标的步数。CTDE 变体收敛到比独立基线更短的路径。

运行：

```
python3 code/main.py
```

预期输出：独立智能体平均约需 6 步；CTDE 变体收敛到约 3.5 步（4x4 网格最优为 3 步）。即便使用脚本化策略，模式差异依然显现。

## 使用它

`outputs/skill-marl-picker.md` 是一个为给定多智能体任务选择 MARL 算法的技能：合作 vs 竞争、同质 vs 异质、动作空间类型、规模、奖励信号。

## 交付它

生产环境中 MARL 很少见。当你确实要使用时：

- **从 MAPPO 开始。** 2022 年的论文确立了它作为基线；先复现它可以节省数周追逐花哨方法的时间。
- **记录每个智能体的观测和动作流。** 没有按智能体的轨迹，调试 MARL 毫无希望。
- **把训练代码与执行代码分开。** CTDE 是一种纪律；让执行路径真正只看到 `o_i`。
- **奖励塑形警告。** MARL 对奖励设计极其敏感。塑形中一个协作 bug，智能体就会学会利用它。运行对抗性测试。
- **对于 LLM 智能体**，先考虑提示层面的策略。只有当交互数据 + 奖励信号 + 基础设施三者齐备时，才投入 MARL 训练。

## 练习

1. 运行 `code/main.py`。测量独立智能体与 MAPPO 风格智能体之间到达目标的步数差距。在 6x6 网格上，这个差距是变大还是变小？
2. 实现一个竞争变体：两个智能体，一颗豆，只有先到达者获得奖励。哪种模式能干净地处理竞争？历史上是 MADDPG。
3. 阅读 MADDPG（arXiv:1706.02275）第 3 节。用自己的话以伪代码形式符号化地实现精确的 critic 更新规则。
4. 阅读 MAPPO（arXiv:2103.01955）。作者为什么论证集中式价值 + PPO 在他们的基准上胜过 off-policy MARL？列出三个最有力的论点。
5. 将 CTDE 作为设计模式应用于一个假想的 LLM 智能体系统（例如研究智能体 + 摘要器 + 编码器）。设计时可用而运行时不可用的联合信息是什么？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| MARL | “多智能体 RL” | 面向多智能体系统的强化学习。 |
| CTDE | “集中式训练，分散式执行” | 用全局信息训练；用局部策略部署。 |
| MADDPG | “多智能体 DDPG” | CTDE，每个智能体的 critic 看到所有观测 + 动作。 |
| QMIX | “价值分解” | 各智能体 Q 值的单调混合。合作式。 |
| MAPPO | “多智能体 PPO” | 带集中式价值函数的 PPO。2026 年默认基线。 |
| 价值分解 | “各 Q 值之和” | 联合 Q 表示为各智能体 Q 值的单调函数。 |
| 非平稳性 | “移动的靶子” | 随着其他智能体学习，每个智能体的环境在变化。MARL 的核心问题。 |
| On-policy / off-policy | “从当前策略 / 回放中学习” | PPO 是 on-policy（MAPPO）；DDPG 和 Q-learning 是 off-policy。 |
| SMAC | “StarCraft Multi-Agent Challenge” | 合作式微观操作基准；QMIX 的主场。 |

## 延伸阅读

- [Lowe 等 — Multi-Agent Actor-Critic for Mixed Competitive-Competitive Environments](https://arxiv.org/abs/1706.02275) — MADDPG；NeurIPS 2017
- [Rashid 等 — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) — QMIX；ICML 2018
- [Yu 等 — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) — MAPPO；NeurIPS 2022
- [BAIR 关于 MAPPO 的博客文章](https://bair.berkeley.edu/blog/2021/07/14/mappo/) — 对 MAPPO 结果的可读性阐述
- [SMAC 仓库](https://github.com/oxwhirl/smac) — StarCraft Multi-Agent Challenge