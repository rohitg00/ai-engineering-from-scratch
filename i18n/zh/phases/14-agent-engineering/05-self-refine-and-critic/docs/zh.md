# Self-Refine 与 CRITIC:迭代式输出改进

> Self-Refine(Madaan 等，2023)让同一个 LLM 在循环中扮演三种角色——生成、反馈、改进。7 个任务上平均绝对提升 +20。CRITIC(Gou 等，2023)通过将验证路由到外部工具来强化反馈步骤。到 2026 年，这一模式在所有框架中都以 "evaluator-optimizer"(Anthropic)或护栏循环(OpenAI Agents SDK)的形式落地。

**类型:** 构建
**语言：** Python(标准库)
**前置知识：** Phase 14 · 01(Agent Loop)、Phase 14 · 03(Reflexion)
**时间：** 约 60 分钟

## 学习目标

- 说明 Self-Refine 的三个提示词(生成、反馈、改进)，并解释为什么历史记录对改进提示词很重要。
- 解释 CRITIC 的关键洞见：缺乏外部依据时，LLM 的自我验证不可靠。
- 实现一个基于标准库、带历史记录和可选外部验证器的 Self-Refine 循环。
- 将该模式映射到 Anthropic 的 "evaluator-optimizer" 工作流和 OpenAI Agents SDK 的输出护栏。

## 问题

智能体给出的答案几乎正确。也许某行代码有语法错误，也许摘要太长，也许某个计划遗漏了边界情况。你想要的是：智能体批判自己的输出，然后修正它。

Self-Refine 表明，这在单一模型、无训练数据、无强化学习的情况下就能奏效。但有一个陷阱：LLM 在难事实上的自我验证很差。CRITIC 给出了解决方案——将验证步骤路由到外部工具(搜索、代码解释器、计算器、测试运行器)。

这两篇论文共同定义了 2026 年迭代式改进的默认做法：生成、验证(尽可能用外部工具)、改进，验证器通过后停止。

## 概念

### Self-Refine(Madaan 等，NeurIPS 2023)

一个 LLM,三种角色：

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

关键细节：`refine` 看到完整的历史——所有先前的输出和批评——因此不会重复犯错。论文对此做了消融实验：去掉历史后质量急剧下降。

核心结论：在 7 个任务(数学、代码、缩写、对话)上平均绝对提升 +20,包括 GPT-4。无需训练，无外部工具，单一模型。

### CRITIC(Gou 等，arXiv:2305.11738,2024 年 2 月 v4)

Self-Refine 的弱点：反馈步骤是 LLM 给自己打分。对事实性断言而言这不可靠(幻觉对产生它的模型来说往往显得很有说服力)。CRITIC 将 `feedback(task, output)` 替换为 `verify(task, output, tools)`,其中 `tools` 包括：

- 用于事实性断言的搜索引擎。
- 用于代码正确性的代码解释器。
- 用于算术的计算器。
- 领域特定验证器(单元测试、类型检查器、linter)。

验证器产生基于工具结果的、有依据的结构化批评。改进器随后以该批评为条件。

核心结论：CRITIC 在事实性任务上优于 Self-Refine,因为批评是有依据的。在没有外部验证器的任务(创意写作、格式化)上，CRITIC 退化为 Self-Refine。

### 停止条件

两种常见形式：

1. **验证器通过。** 外部测试返回成功。可用时优先采用(单元测试、类型检查器、护栏断言)。
2. **无反馈。** 模型说“输出没问题”。更便宜但不可靠；需配合最大迭代次数上限。

2026 年默认做法：两者结合。“若验证器通过 或 模型说没问题 且 迭代次数 >= 2 或 迭代次数 >= max_iterations,则停止。”

### Evaluator-Optimizer(Anthropic,2024)

Anthropic 2024 年 12 月的文章将其列为五种工作流模式之一。两种角色：

- Evaluator:为输出打分并产生批评。
- Optimizer:根据批评修订输出。

循环直到 evaluator 通过。这就是 Anthropic 框架下的 Self-Refine/CRITIC。Anthropic 补充的关键工程细节：evaluator 和 optimizer 的提示词应当有实质性差异，以免模型只是走过场盖章。

### OpenAI Agents SDK 输出护栏

OpenAI Agents SDK 以“输出护栏”的形式提供该模式。护栏是运行在智能体最终输出上的验证器。如果护栏触发(抛出 `OutputGuardrailTripwireTriggered`),输出被拒绝，智能体可以重试。护栏可以调用工具(CRITIC 式)，也可以是纯函数(Self-Refine 式)。

### 2026 年的陷阱

- **盖章式循环。** 同一模型用相同风格的提示词同时做生成和批评，会收敛于“我觉得不错”。使用结构上不同的提示词，或用更小的廉价模型做批评。
- **过度改进。** 每次改进都会增加延迟和 token。预算 1–3 次迭代；之后升级为人工审核。
- **在琐碎任务上用 CRITIC。** 如果没有外部验证器，CRITIC 退化为 Self-Refine;不要为占位验证器付出延迟代价。

```figure
self-refine
```

## 动手构建

`code/main.py` 在一个玩具任务上实现 Self-Refine 和 CRITIC:根据主题生成一个简短的要点列表。验证器检查格式(3 个要点，每个不超过 60 字符)。CRITIC 增加一个外部“事实验证器”，对已知幻觉进行惩罚。

组件：

- `generate` — 脚本化的生成器。
- `feedback` — LLM 式自我批评。
- `verify_external` — CRITIC 式有依据的验证器。
- `refine` — 根据历史重写输出。
- 停止条件 — 验证器通过或最多 4 次迭代。

运行它：

```
python3 code/main.py
```

对比 Self-Refine 与 CRITIC 的运行结果。CRITIC 能捕获 Self-Refine 遗漏的事实性错误，因为外部验证器拥有自我批评所不具备的依据。

## 实际应用

Anthropic 的 evaluator-optimizer 就是用 Claude 术语描述的这一模式。OpenAI Agents SDK 的输出护栏是 CRITIC 形态的(护栏可以调用工具)。LangGraph 提供了一个读起来像 Self-Refine 的反思节点。Google 的 Gemini 2.5 Computer Use 增加了每步安全评估器，是 CRITIC 的变体：每个动作在提交前都会被验证。

## 上线部署

`outputs/skill-refine-loop.md` 根据任务形态、验证器可用性和迭代预算配置 evaluator-optimizer 循环。生成生成器、评估器/验证器和改进器的提示词，外加停止策略。

## 练习

1. 用 max_iterations=1 运行玩具任务。CRITIC 仍然有帮助吗？
2. 将外部验证器替换为有噪声的版本(随机 30% 假阳性)。循环会怎样？这是 2026 年大多数护栏技术栈的现实。
3. 实现“生成器与批评器使用不同模型”的变体：大模型生成，小模型批评。它是否优于同模型方案？
4. 阅读 CRITIC 第 3 节(arXiv:2305.11738 v4)。说出三种验证工具类别，并为每类举一个例子。
5. 将 OpenAI Agents SDK 的 `output_guardrails` 映射到 CRITIC 的验证器角色。SDK 哪里做错了，哪里做对了？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|------------------------|------------------------|
| Self-Refine | “能自我修正的 LLM” | 单一模型内的 生成 -> 反馈 -> 改进 循环，带历史记录 |
| CRITIC | “基于工具的验证” | 用外部验证器(搜索、代码、计算器、测试)替代反馈 |
| Evaluator-Optimizer | “Anthropic 工作流模式” | 两种角色——评估器打分，改进器修订——循环至收敛 |
| 输出护栏 | “事后检查” | OpenAI Agents SDK 在智能体产生输出后运行的验证器 |
| 验证步骤 | “批评阶段” | 关键决策：有依据还是自我评价 |
| 改进历史 | “模型已经尝试过的内容” | 将先前输出和批评前置到改进提示词；去掉后质量崩溃 |
| 盖章式循环 | “自我认同失败” | 相同提示词的批评返回“看起来不错”；用结构上不同的提示词修复 |
| 停止条件 | “收敛测试” | 验证器通过 或 无反馈 且 迭代上限；绝不用单一条件 |

## 延伸阅读

- [Madaan 等，Self-Refine(arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — 原始论文
- [Gou 等，CRITIC(arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) — 基于工具的验证
- [Anthropic,Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — evaluator-optimizer 工作流模式
- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/) — 作为 CRITIC 形态验证器的输出护栏