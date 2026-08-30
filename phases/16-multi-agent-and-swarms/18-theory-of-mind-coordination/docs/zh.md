# 18 · 心智理论与涌现协调

> Li 等人（arXiv:2310.10701）的研究表明，在一个协作型文本游戏中，大语言模型（LLM）智能体表现出了**涌现的高阶心智理论（Theory of Mind，ToM）**——即推理某个智能体对第三个智能体信念的看法——但由于上下文管理和幻觉问题，它们在长程规划上表现失败。Riedl（arXiv:2510.05174）在一个种群规模上测量了高阶协同效应，发现**只有**在 ToM 提示条件下，才会产生与身份挂钩的角色分化以及目标导向的互补性；能力较弱的 LLM 仅表现出虚假的涌现。也就是说，协调的涌现是依赖提示且依赖模型的，并非免费获得。本课实现了一个最小化的、具备 ToM 能力的智能体，分别在有 ToM 提示和无 ToM 提示的条件下运行一个协作任务，并对照 Riedl 2025 的协议测量协调增量。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置：** 阶段 16 · 07（心智社会与辩论），阶段 16 · 17（生成式智能体）
**时长：** 约 75 分钟

## 问题

多智能体协调往往看起来很神奇：智能体分工合作、相互预判、避免重复劳动。通常这种"涌现"只是提示工程（prompt engineering）的产物——有人告诉了这些智能体要"协调"。一旦移除提示，协调也随之消失。

Riedl 2025 年的发现更为严格：在受控条件下，只有当智能体被提示去推理**其他智能体的心智**（ToM）时，协调才会涌现。在没有 ToM 提示的情况下，即便是强大的模型也只表现出无法通过统计检验的协调模式。这对生产环境很重要：许多团队发布的"多智能体协调"功能其实依赖提示，且十分脆弱。

本课把 ToM 视为一种具体能力（推理关于信念的信念），构建一个最小化的、具备 ToM 能力的智能体，并测量真正的协调长什么样，以及仅靠提示包装出来的协调又长什么样。

## 概念

### ToM 是什么意思

发展心理学：一个 3 岁孩子认为任何人的内心世界都和自己一样。一个 5 岁孩子能理解别人持有不同的信念。一个 7 岁孩子能推理关于信念的信念（"她以为我以为球在杯子下面"）。这些分别是零阶、一阶和二阶 ToM。

对于 LLM 智能体，ToM 的阶数对应于：

- **零阶（Zeroth-order）：** 没有对他人的建模。智能体只依据自身的观察行动。
- **一阶（First-order）：** 智能体对每个其他智能体的信念建立模型。"Alice 相信 X。"
- **二阶（Second-order）：** 智能体对递归信念建模。"Alice 相信 Bob 相信 X。"

Li 等人 2023 年发现，一阶和二阶 ToM 会在协作游戏中的 LLM 智能体身上涌现，但会随着长程任务和不可靠的通信而退化。

### 萨莉-安妮测试（Sally-Anne test）简述

这是一个 1985 年的错误信念（false-belief）测试：Sally 把一颗弹珠放进篮子 A，然后离开。Anne 把它移到了篮子 B。当 Sally 回来时，她会去哪里找？具备一阶 ToM 的孩子会说篮子 A（Sally 的信念与现实不符）。不具备一阶 ToM 的孩子会说篮子 B。

当问题表述清晰直接时，GPT-4 时代的 LLM 能通过萨莉-安妮式的测试。但当叙述很长、场景多次变化，或问题以间接方式提出时，它们就会失败。这就是 2026 年生产环境 LLM 在 ToM 上的实际状态。

### Riedl 的协调测量

Riedl（arXiv:2510.05174）构建了一个种群规模的测试：N 个智能体、一个协作目标、可变的提示条件。测量：

1. **与身份挂钩的角色分化（Identity-linked differentiation）。** 智能体是否会随时间发展出稳定的角色区分？
2. **目标导向的互补性（Goal-directed complementarity）。** 智能体的行动是相互互补（处理不同子任务）还是相互重复？
3. **高阶协同（Higher-order synergy）。** 一个统计度量，用于衡量群体是否实现了任何子集都无法实现的成果。

结果：只有在 ToM 提示条件下，这三项指标才都能产生高于基线的信号。在没有 ToM 提示时，中等能力模型的各项指标都徘徊在随机水平附近。大型模型在没有显式 ToM 提示时也表现出一定的协调，但其效应小于显式提示时的效应。

### 协调的错觉

在没有统计控制的情况下，演示中的"涌现协调"往往反映的是：

- 把协调写死在提示工程里（系统提示中写着"协同工作"）。
- 观察者偏差（我们看到了我们预期看到的模式）。
- 对成功运行结果的事后挑选（post-hoc selection）。

那些没有可测量信号却以"涌现协调"为卖点的生产系统，应当被视为营销话术。先测量，再宣称。

### 一个最小化的、具备 ToM 能力的智能体

结构：

```
agent state:
  own_beliefs:    {facts the agent believes}
  other_models:   {other_agent_id -> {beliefs_the_agent_attributes_to_them}}
  actions_last_N: [history of others' actions]

observation update:
  - update own_beliefs from direct observation
  - update other_models[agent_id] from their action + prior beliefs

action selection:
  - enumerate candidate actions
  - for each, predict what each other agent will do next given their modeled beliefs
  - pick action that maximizes joint outcome under those predictions
```

`other_models` 属性就是 ToM 状态。一阶 ToM 只保留一层。二阶 ToM 增加 `other_models[i][other_models_of_j]`——即我认为智能体 i 认为智能体 j 相信什么。

### 为什么长程任务会带来损害

Li 等人记录到：上下文限制会导致智能体忘记某个信念属于谁。幻觉会向其他智能体的模型中添加错误信念。两者都会产生"我以为他以为 X"这类错误，并随时间累积放大。

论文以及 2024-2026 年的后续研究中记录的缓解措施：

- **在提示中显式维护 ToM 状态。** 结构化格式：`{agent_id: belief_list}`。强制检索时保留"身份-信念"的绑定关系。
- **更短的推理链。** 每轮更少的 ToM 更新可减少幻觉的累积放大。
- **外部 ToM 存储。** 在 LLM 上下文之外维护模型；每轮只注入相关部分。

### ToM 在生产环境中会在哪里失败

- **对抗性场景。** 拥有良好 ToM 的智能体更容易被操纵（你可以建模它对你的建模，然后加以利用）。
- **异构团队。** 当模型各不相同时，对一个对手有效的 ToM 模型无法泛化到其他对手。
- **依赖真值（ground-truth）的任务。** ToM 关乎信念；如果正确性取决于事实，那么 ToM 反而可能是一种干扰。

### 你真正能测量到的协调

判断一个团队的协调是真实存在、而非提示包装的三个实用信号：

1. **随时间的互补性。** 在一个多轮任务中，智能体的行动是否覆盖了互不相交的子任务？
2. **预判（Anticipation）。** 智能体 A 在第 T+1 轮的行动，是否依赖于它对 B 在第 T+2 轮行动的预测，且该预测后来被证明正确？
3. **纠错（Correction）。** 当 A 在第 T 轮误读了 B 的信念时，A 是否在第 T+2 轮之前完成了纠正？

这些在一个有日志记录的多智能体系统中都是可测量的。它们是"协调"叙事的实质版本。

## 动手构建

`code/main.py` 实现了：

- `ToMAgent`——跟踪自身的信念，以及针对每个其他智能体的信念模型。
- 一个协作任务：三个智能体必须从三个盒子里各收集一个 token；每个盒子只能装一个 token。智能体之间无法通信；它们要从彼此的行动中推断意图。
- 两种配置：`zeroth_order`（无 ToM）和 `first_order`（带一层信念模型的 ToM）。
- 在 200 次随机化试验上的测量：完成率、重复率（两个智能体同时瞄准同一个盒子）、平均完成所需轮数。

运行：

```
python3 code/main.py
```

预期输出：零阶智能体的重复劳动率约为 35%，在 10 轮内完成约 60% 的试验。一阶 ToM 智能体的重复率约为 5%，完成率约为 95%。这一增量就是可测量的协调效应。

## 应用它

`outputs/skill-tom-auditor.md` 是一个技能（skill），用于审计某个多智能体系统对"涌现协调"的宣称。它会检查是否存在提示包装、相对于对照组的统计显著性，以及已测量的互补性。

## 交付它

协调宣称检查清单：

- **对照条件。** 一个不带协调提示的系统版本。对两者都进行测量。
- **统计检验。** 系统与对照之间的差异，在你的指标上是否达到 `p < 0.05` 的显著性？
- **互补性度量。** 随时间的行动互不相交性，而不只是最终的成功率。
- **失败案例日志。** 当智能体协调失败时，ToM 状态是什么样子？
- **模型能力披露。** 如果该效应在更小的模型上消失，请如实说明。

## 练习

1. 运行 `code/main.py`。确认一阶 ToM 把重复率降低了约 7 倍。当你扩展到 5 个智能体和 5 个盒子时，这个差距是否依然存在？
2. 实现二阶 ToM（智能体 A 建模 B 对 C 的看法）。它相比一阶是否有所改进？在哪些任务上？
3. 向 ToM 状态注入一个**幻觉**：每轮随机翻转一个信念。这会让一阶 ToM 的性能退化多少？
4. 阅读 Li 等人的论文（arXiv:2310.10701）。复现其"长程退化"的发现：当轮数从 10 增长到 30 时，你的一阶 ToM 性能如何变化？
5. 阅读 Riedl 2025（arXiv:2510.05174）。在你的模拟日志上实现高阶协同统计量。在没有 ToM 提示条件时，该效应是否存在？

## 关键术语

| 术语 | 人们常说的 | 它实际的含义 |
|------|----------------|------------------------|
| 心智理论（Theory of Mind） | "理解别人的心智" | 建模另一个智能体信念的能力。按阶数分级（0、1、2+）。 |
| 萨莉-安妮测试（Sally-Anne test） | "错误信念测试" | 1985 年的发展心理学测试；LLM 能通过简单版本，在复杂版本上失败。 |
| 一阶 ToM（First-order ToM） | "A 相信 X" | 对一个他者关于事实的信念进行建模。 |
| 二阶 ToM（Second-order ToM） | "A 相信 B 相信 X" | 向更深一层进行递归建模。 |
| 与身份挂钩的角色分化（Identity-linked differentiation） | "随时间稳定的角色" | Riedl 的指标：角色持续存在，而非随机。 |
| 目标导向的互补性（Goal-directed complementarity） | "互不相交的行动" | 智能体瞄准不同的子任务，而非同一个。 |
| 高阶协同（Higher-order synergy） | "群体超越任何子集" | Riedl 用于衡量真实协调的统计度量。 |
| 协调的错觉（Coordination illusion） | "它看起来很协调" | 没有可测量信号、仅靠提示包装出来的协调表象。 |

## 延伸阅读

- [Li 等人 —— Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) —— 协作游戏中的涌现 ToM；长程失败模式
- [Riedl —— Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) —— 种群规模的测量；ToM 提示是承重的关键条件
- [Premack & Woodruff —— Does the chimpanzee have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-chimpanzee-have-a-theory-of-mind/1E96B02CD9850E69AF20F81FA7EB3595) —— 1978 年 ToM 概念的起源
- [Baron-Cohen, Leslie, Frith —— Does the autistic child have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-autistic-child-have-a-theory-of-mind/) —— 萨莉-安妮论文（1985）
