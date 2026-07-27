# 自我精炼与 CRITIC：迭代式输出改进

> Self-Refine（Madaan 等人, 2023）利用同一个 LLM 扮演三种角色——生成、反馈、精炼——形成一个循环。在 7 项任务上平均绝对提升达 +20。CRITIC（Gou 等人, 2023）通过将验证步骤路由到外部工具来强化反馈环节。到 2026 年，这一模式已内置在每个主流框架中，称为"评估器-优化器"（Anthropic）或护栏循环（OpenAI Agents SDK）。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 阶段 14 · 01（Agent 循环），阶段 14 · 03（Reflexion）
**时长：** 约 60 分钟

## 学习目标

- 阐述 Self-Refine 的三个提示（生成、反馈、精炼），并解释为什么历史记录对精炼提示至关重要。
- 解释 CRITIC 的关键洞见：没有外部基础事实支撑时，LLM 的自我验证是不可靠的。
- 用 Python 标准库实现带历史记录的 Self-Refine 循环及可选的外部验证器。
- 将该模式映射到 Anthropic 的"评估器-优化器"工作流和 OpenAI Agents SDK 的输出护栏。

## 问题

Agent 产出的答案几乎正确——可能某行代码有语法错误，可能摘要太长，可能计划遗漏了一个边界情况。你期望的是：Agent 自己批评自己的输出，然后修复它。

Self-Refine 证明仅用单个模型、无需训练数据、无需强化学习就能做到这一点。但有一个问题：LLM 在严格事实上的自我验证能力很差。CRITIC 指出了解决方案——将验证步骤路由到外部工具（搜索、代码解释器、计算器、测试运行器）。

这两篇论文共同定义了 2026 年迭代式改进的默认范式：生成、验证（尽可能借助外部工具）、精炼、验证通过则停止。

## 概念

### Self-Refine（Madaan 等人, NeurIPS 2023）

同一个 LLM，三种角色：

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
当 feedback 表示"没问题"或预算耗尽时停止。
```

关键细节：`refine` 能看到完整历史——所有先前的输出和批评——因此不会重复犯错。论文通过消融实验证明：去掉历史记录，质量会急剧下降。

核心数据：在 7 项任务（数学、代码、缩写、对话）上平均绝对提升达 +20，包括 GPT-4。无需训练、无需外部工具、单一模型。

### CRITIC（Gou 等人, arXiv:2305.11738, v4 2024 年 2 月）

Self-Refine 的弱点在于：反馈步骤是 LLM 对自己评分。对于事实性陈述，这种方式并不可靠（模型自己产生的幻觉通常看起来很有说服力）。CRITIC 将 `feedback(task, output)` 替换为 `verify(task, output, tools)`，其中 `tools` 包括：

- 用于事实性陈述的搜索引擎。
- 用于代码正确性的代码解释器。
- 用于算术的计算器。
- 领域特定的验证器（单元测试、类型检查器、代码检查工具）。

验证器产生基于工具结果的结构化批评。精炼器则以此批评为条件进行改进。

核心数据：CRITIC 在事实性任务上优于 Self-Refine，因为其批评有据可依。在没有外部验证器的任务上（创意写作、格式整理），CRITIC 退化为 Self-Refine。

### 停止条件

两种常见形式：

1. **验证器通过。** 外部测试返回成功。尽可能优先使用（单元测试、类型检查器、护栏断言）。
2. **无反馈发出。** 模型认为"输出没问题"。成本更低但不可靠；需配合最大迭代上限。

2026 年默认方案：两者结合。"当验证器通过，或者模型认为没问题且迭代次数 >= 2，或者迭代次数 >= 最大迭代次数时停止。"

### 评估器-优化器（Anthropic, 2024）

Anthropic 于 2024 年 12 月的文章将此列为五种工作流模式之一。两个角色：

- 评估器：对输出评分并给出批评意见。
- 优化器：根据批评意见修改输出。

循环直到评估器通过。这是 Anthropic 框架下的 Self-Refine/CRITIC。Anthropic 添加的关键工程细节：评估器和优化器的提示应有显著差异，避免模型只是走过场盖章通过。

### OpenAI Agents SDK 输出护栏

OpenAI Agents SDK 将此模式实现为"输出护栏"。护栏是一个验证器，在 agent 的最终输出上运行。如果护栏被触发（抛出 `OutputGuardrailTripwireTriggered`），输出被拒绝，agent 可以重试。护栏可以调用工具（CRITIC 风格）或作为纯函数运行（Self-Refine 风格）。

### 2026 年常见陷阱

- **盖章式循环。** 同一个模型使用相同的提示风格进行生成和批评，最终趋同于"看起来没问题"。应使用结构上不同的提示，或使用较小的廉价模型进行批评。
- **过度精炼。** 每次精炼都会增加延迟和令牌消耗。预算限制在 1-3 次；之后升级到人工审查。
- **在琐碎任务上使用 CRITIC。** 如果没有外部验证器，CRITIC 退化为 Self-Refine；不要为占位验证器支付额外的延迟成本。

## 动手构建

`code/main.py` 在玩具任务上实现了 Self-Refine 和 CRITIC：根据给定主题生成一个简短的要点列表。验证器检查格式（3 个要点，每个不超过 60 字符）。CRITIC 增加了一个外部"事实验证器"，用于惩罚已知的幻觉。

组件：

- `generate` —— 脚本化生成器。
- `feedback` —— LLM 风格的自我批评。
- `verify_external` —— CRITIC 风格的基于外部工具的验证器。
- `refine` —— 根据历史记录重写输出。
- 停止条件 —— 验证器通过或最多迭代 4 次。

运行：

```
python3 code/main.py
```

比较 Self-Refine 和 CRITIC 的运行结果。CRITIC 能捕捉到 Self-Refine 遗漏的事实错误，因为外部验证器具有自我批评所不具备的基础事实支撑。

## 实际应用

Anthropic 的评估器-优化器是该模式在 Claude 语境下的表述。OpenAI Agents SDK 的输出护栏是 CRITIC 形态的（护栏可以调用工具）。LangGraph 提供了一个类似 Self-Refine 的反思节点。Google 的 Gemini 2.5 Computer Use 增加了每步安全评估器，这是 CRITIC 的一个变体：每个动作在提交前都要经过验证。

## 交付产出

`outputs/skill-refine-loop.md` 根据任务形态、验证器可用性和迭代预算配置评估器-优化器循环。输出生成器、评估器/验证器和优化器的提示，以及停止策略。

## 练习

1. 将 max_iterations 设为 1 运行玩具示例。CRITIC 仍然有帮助吗？
2. 将外部验证器替换为带噪声的验证器（随机 30% 的误报率）。循环会如何表现？这就是 2026 年大多数护栏栈的现实情况。
3. 实现"不同模型上的生成器-批评者"变体：大模型生成，小模型批评。它能胜过同模型方案吗？
4. 阅读 CRITIC 第 3 节（arXiv:2305.11738 v4）。列出三种验证工具类别，并为每种给出一个示例。
5. 将 OpenAI Agents SDK 的 `output_guardrails` 映射到 CRITIC 的验证器角色。SDK 做对了什么，又做错了什么？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------|----------|
| Self-Refine | "能自我修复的 LLM" | 单一模型中的生成 -> 反馈 -> 精炼循环，带历史记录 |
| CRITIC | "基于工具的验证" | 用外部验证器（搜索、代码、计算、测试）替代反馈步骤 |
| 评估器-优化器 | "Anthropic 工作流模式" | 两个角色——评估器评分，优化器修改——循环直至收敛 |
| 输出护栏 | "事后检查" | OpenAI Agents SDK 验证器，在 agent 产生输出后运行 |
| 验证步骤 | "批评阶段" | 关键决策环节：基于外部工具还是自我评分 |
| 精炼历史 | "模型已经尝试过的内容" | 先前输出 + 批评意见前置到精炼提示中；去掉则质量崩溃 |
| 盖章式循环 | "自我认可失效" | 相同提示的批评返回"看起来没问题"；通过结构不同的提示修复 |
| 停止条件 | "收敛测试" | 验证器通过，或者无反馈且达到迭代上限；永远不要使用单一条件 |

## 延伸阅读

- [Madaan 等人, Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) —— 经典论文
- [Gou 等人, CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) —— 基于工具的验证
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 评估器-优化器工作流模式
- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/) —— CRITIC 形态的输出护栏验证器
