# 心智理论与涌现式协调（Theory of Mind and Emergent Coordination）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Li 等人（arXiv:2310.10701）发现，在一个合作型文字游戏中，LLM agent 表现出 **涌现式高阶心智理论（Theory of Mind, ToM）** —— 能够推理「另一个 agent 对第三个 agent 的信念有什么信念」—— 但因为 context 管理与 hallucination（幻觉）的限制，长链路（long-horizon）规划就崩了。Riedl（arXiv:2510.05174）在群体尺度上测量了高阶 synergy，发现**只有**带 ToM prompt 的条件才会产生「身份绑定的角色分化」与「目标导向的互补」；能力较弱的 LLM 只表现出虚假的涌现。也就是说，协调的涌现是 prompt 条件性、模型依赖性的，没有免费午餐。本课实现一个最小可用的 ToM-aware agent，跑一个合作任务，对比有无 ToM prompt 的条件，并按 Riedl 2025 协议测量协调差值。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 17 (Generative Agents)
**Time:** ~75 minutes

## 问题（Problem）

多 agent 协调常常看起来很玄：agent 自动分工、互相预判、避免重复。多数情况下这种「涌现」不过是 prompt 工程的副产物——有人在 prompt 里写了「请协作」。把那句话拿掉，协调也就没了。

Riedl 2025 的结论更严苛：在受控条件下，只有当 agent 被 prompt 引导去推理 **其他 agent 的心智**（ToM）时，协调才会涌现。如果不上 ToM prompt，即使是强模型，呈现出来的协调模式也撑不过统计检验。这件事对生产系统很重要：很多团队推出的「多 agent 协调」功能，本质上 prompt 依赖且非常脆弱。

本课把 ToM 当成一种具体能力（推理「关于信念的信念」）来对待，构建一个最小 ToM-aware agent，并测量「真协调」与「prompt 包装出来的协调」之间到底差多少。

## 概念（Concept）

### ToM 是什么意思（What ToM means）

发展心理学的描述：3 岁的孩子认为别人的内心世界和自己一样。5 岁的孩子能理解别人有不同信念。7 岁的孩子能推理「关于信念的信念」（「她以为我以为球在杯子下面」）。这分别对应零阶、一阶、二阶 ToM。

对 LLM agent 而言，ToM 阶数对应：

- **零阶（Zeroth-order）：** 没有他人模型。agent 只根据自己的观察行动。
- **一阶（First-order）：** agent 维护对每个其他 agent 的信念模型。「Alice 相信 X。」
- **二阶（Second-order）：** agent 建模递归信念。「Alice 相信 Bob 相信 X。」

Li 等人 2023 发现，一阶和二阶 ToM 在合作游戏的 LLM agent 上确实会涌现，但会因为长链路与不可靠通信而退化。

### Sally-Anne 测试简介（The Sally-Anne test, in brief）

1985 年的一个错误信念测试：Sally 把弹珠放进 A 篮子，离开。Anne 把它移到 B 篮子。Sally 回来时会去哪个篮子找？拥有一阶 ToM 的孩子会回答 A 篮子（Sally 的信念与现实不一致）。没有的孩子会回答 B 篮子。

GPT-4 时代的 LLM 在题目表述简单时能通过 Sally-Anne 这类测试。但当叙述变长、场景多次切换、提问方式变得间接时，它们就开始出错。这就是 2026 年生产环境里 LLM 的 ToM 实际状况。

### Riedl 的协调测量（Riedl's coordination measurement）

Riedl（arXiv:2510.05174）做了一个群体尺度的测试：N 个 agent，一个合作目标，多种 prompt 条件。测量：

1. **身份绑定的角色分化（Identity-linked differentiation）。** agent 是否会随着时间发展出稳定的角色区分？
2. **目标导向的互补（Goal-directed complementarity）。** agent 的动作是否互补（不同子任务）而非重复？
3. **高阶 synergy（Higher-order synergy）。** 一个统计量，衡量整组是否做到任何子集都做不到的事。

结果：只有在 ToM prompt 条件下，三个指标才会都跑出超过 baseline（基线）的信号。没有 ToM prompt 的话，中等容量模型的指标基本贴着随机水平。大模型即便没有显式 ToM prompt 也会显示出一些协调，但效应明显小于显式 prompt。

### 协调幻觉（The coordination illusion）

没有统计控制的话，demo 里看到的「涌现协调」往往反映的是：

- prompt 工程把协调直接焊死（system prompt 里写「work together」）。
- 观察者偏差（我们看到的是我们期待的模式）。
- 事后挑选成功的 run。

凡是声称「涌现协调」却拿不出可测量信号的生产系统，都应当按营销话术对待。先测量，再下结论。

### 一个最小 ToM-aware agent（A minimal ToM-aware agent）

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

`other_models` 这个字段就是 ToM 状态。一阶 ToM 只保留一层。二阶 ToM 加一层 `other_models[i][other_models_of_j]` —— 我认为 agent i 认为 agent j 相信什么。

### 为什么长链路会拖垮 ToM（Why long-horizon hurts）

Li 等人记录到：context 长度限制会让 agent 忘记某条信念到底属于谁。Hallucination 会向「他人模型」里掺入错误信念。这两者都会产生「我以为他以为 X」类的错误，并随时间复合放大。

论文与 2024–2026 的后续工作里给出的缓解手段：

- **把 ToM 状态显式写进 prompt。** 用结构化格式：`{agent_id: belief_list}`。强迫检索时保留「身份-信念」的绑定。
- **缩短推理链。** 每轮做更少 ToM 更新，减少幻觉的复合放大。
- **外置 ToM store。** 把模型放到 LLM context 之外维护，每轮只注入相关片段。

### ToM 在生产里会失效的地方（Where ToM fails in production）

- **对抗场景。** ToM 越好的 agent 越容易被操纵（对手可以模型化你对他的模型，再加以利用）。
- **异质团队。** 模型不同的时候，对一个对手有效的 ToM 模型未必能泛化到别人。
- **依赖 ground truth 的任务。** ToM 关心的是信念；如果正确性取决于事实，ToM 反而是分心项。

### 真正能测量的协调（The coordination you can actually measure）

判断一个团队的协调是真协调而非 prompt 包装，有三个实操信号：

1. **随时间互补（Complementarity over time）。** 多轮任务里，agent 的动作是否覆盖不重叠的子任务？
2. **预判（Anticipation）。** agent A 在第 T+1 轮的动作，是否依赖于它对 B 在第 T+2 轮动作的预测，且预测正确？
3. **纠正（Correction）。** 当 A 在第 T 轮误读了 B 的信念，A 是否能在第 T+2 轮纠正？

这些都是带日志的多 agent 系统里可测量的指标。它们才是「协调」叙事的硬核版本。

## 动手实现（Build It）

`code/main.py` 实现了：

- `ToMAgent` —— 维护自身信念，以及对每个其他 agent 的信念模型。
- 一个合作任务：三个 agent 要从三个箱子里各取一个 token，每个箱子只能装一个 token。agent 之间不能通信，只能从对方动作中推断意图。
- 两种配置：`zeroth_order`（无 ToM）和 `first_order`（一阶 ToM，单层信念模型）。
- 在 200 次随机化试验上的测量：完成率、重复率（两个 agent 同时盯一个箱子）、平均完成回合数。

运行：

```
python3 code/main.py
```

预期输出：零阶 agent 的重复率 ~35%、10 回合内完成率 ~60%。一阶 ToM agent 重复率 ~5%、完成率 ~95%。这个差值就是可测量的协调效应。

## 用起来（Use It）

`outputs/skill-tom-auditor.md` 是一个 skill，用来审查多 agent 系统中所谓「涌现协调」的说法。它会检查 prompt 包装、对照组的统计显著性，以及测得的互补性。

## 上线部署（Ship It）

协调声明 checklist：

- **对照条件（Control condition）。** 准备一个去掉协调 prompt 的版本。两个版本都测。
- **统计检验（Statistical test）。** 你那个指标上，系统和对照组的差异在 `p < 0.05` 上显著吗？
- **互补性测量（Complementarity measure）。** 看的是随时间的动作不重叠度，而不是只看最终成功。
- **失败案例日志（Failure-case log）。** agent 协调失败的时候，ToM 状态长什么样？
- **模型容量披露（Model-capacity disclosure）。** 如果换成更小的模型效应消失了，明说。

## 练习（Exercises）

1. 跑 `code/main.py`。确认一阶 ToM 把重复率压低约 7 倍。当你扩展到 5 个 agent 和 5 个箱子时，这个差距还在吗？
2. 实现二阶 ToM（agent A 建模 B 对 C 的看法）。是否优于一阶？在哪种任务上？
3. 向 ToM 状态里注入 **hallucination**：每回合随机翻转一条信念。这会让一阶性能退化多少？
4. 读 Li 等人（arXiv:2310.10701）。复现「长链路退化」结论：当回合数从 10 增加到 30 时，你的一阶 ToM 性能怎么变？
5. 读 Riedl 2025（arXiv:2510.05174）。在你模拟的日志上实现高阶 synergy 统计量。在没有 ToM prompt 的条件下，效应还在吗？

## 关键术语（Key Terms）

| 术语 | 大家通常怎么说 | 实际是什么意思 |
|------|----------------|------------------------|
| 心智理论（Theory of Mind） | 「理解他人的内心」 | 建模另一个 agent 信念的能力。按阶数（0、1、2+）分级。 |
| Sally-Anne 测试 | 「错误信念测试」 | 1985 年发展心理学经典；LLM 能过简单版，过不了复杂版。 |
| 一阶 ToM（First-order ToM） | 「A 相信 X」 | 建模一个他人对事实的信念。 |
| 二阶 ToM（Second-order ToM） | 「A 相信 B 相信 X」 | 再深入一层的递归建模。 |
| 身份绑定的角色分化（Identity-linked differentiation） | 「随时间稳定的角色」 | Riedl 的指标：角色稳定，不随机。 |
| 目标导向的互补（Goal-directed complementarity） | 「不重叠的动作」 | agent 各自针对不同子任务，而非同一个。 |
| 高阶 synergy（Higher-order synergy） | 「整组超过任意子集」 | Riedl 用来度量真协调的统计量。 |
| 协调幻觉（Coordination illusion） | 「看起来很协调」 | prompt 包装出来的协调表象，没有可测信号。 |

## 延伸阅读（Further Reading）

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) —— 合作游戏中的涌现 ToM；长链路下的失效模式
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) —— 群体尺度的测量；ToM prompt 是承重条件
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-chimpanzee-have-a-theory-of-mind/1E96B02CD9850E69AF20F81FA7EB3595) —— 1978 年 ToM 概念的源头
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-autistic-child-have-a-theory-of-mind/) —— Sally-Anne 论文（1985）
