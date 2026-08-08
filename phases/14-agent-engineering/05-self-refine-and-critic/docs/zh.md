# Self-Refine 与 CRITIC：迭代式输出改进

> Self-Refine（Madaan 等，2023）使用一个 LLM 承担三种角色——生成、反馈、优化——构成循环。在 7 项任务上平均提升 +20 个绝对百分点。CRITIC（Gou 等，2023）通过将验证路由到外部工具来强化反馈步骤。到 2026 年，这种模式以 "evaluator-optimizer"（Anthropic）或 guardrail 循环（OpenAI Agents SDK）的形式出现在每个框架中。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 01（Agent Loop），第 14 阶段 · 03（Reflexion）
**时间：** ~60 分钟

## 学习目标

- 说明 Self-Refine 的三个提示词（生成、反馈、优化），并解释为什么历史记录对优化提示词很重要。
- 解释 CRITIC 的核心洞察：LLM 在没有外部依据的情况下进行自我验证是不可靠的。
- 实现一个带历史记录和可选外部验证器的标准库 Self-Refine 循环。
- 将此模式映射到 Anthropic 的 "evaluator-optimizer" 工作流和 OpenAI Agents SDK 的输出 guardrails。

## 问题

Agent 给出的答案往往接近正确，但还差一点点。可能是一行代码有语法错误，可能是摘要太长，可能是计划遗漏了边界情况。你想要的是：agent 能批评自己的输出，然后修正它。

Self-Refine 表明这可以用单个模型实现，无需训练数据，无需强化学习。但有一个问题：LLM 在硬事实上的自我验证能力很差。CRITIC 给出了解决方案——将验证步骤通过外部工具（搜索、代码解释器、计算器、测试运行器）进行路由。

这两篇论文共同定义了 2026 年迭代改进的默认模式：生成、验证（尽可能外部化）、优化，直到验证器通过。

## 概念

### Self-Refine（Madaan 等，NeurIPS 2023）

一个 LLM，三种角色：

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
当反馈说"没有问题"或预算耗尽时停止。
```

关键细节：`refine` 能看到完整的历史记录——所有先前的输出和批评——因此不会重复犯错。论文对此进行了消融实验：去掉历史记录，质量显著下降。

Headline：在 7 项任务（数学、代码、缩写、对话）上平均提升 +20 个绝对百分点，包括 GPT-4。无需训练，无需外部工具，单个模型。

### CRITIC（Gou 等，arXiv:2305.11738，v4 2024年2月）

Self-Refine 的弱点：反馈步骤是 LLM 给自己打分。对于事实性声明，这是不可靠的（一个幻觉往往对产生它的模型来说很有说服力）。CRITIC 将 `feedback(task, output)` 替换为 `verify(task, output, tools)`，其中 `tools` 包括：

- 用于事实性声明的搜索引擎。
- 用于代码正确性的代码解释器。
- 用于算术的计算器。
- 领域特定验证器（单元测试、类型检查器、linter）。

验证器产生基于工具结果的结构化批评。优化器随后基于此批评进行条件生成。

Headline：CRITIC 在事实性任务上优于 Self-Refine，因为批评是有依据的。在没有外部验证器的任务上（创意写作、格式化），CRITIC 退化为 Self-Refine。

### 停止条件

两种常见形式：

1. **验证器通过。** 外部测试返回成功。在可用时优先使用（单元测试、类型检查器、guardrail 断言）。
2. **没有反馈。** 模型说"输出没问题。"更便宜但不可靠；需配合最大迭代次数上限。

2026 年默认：结合两者。"如果验证器通过则停止，或模型说没问题且迭代次数 >= 2，或迭代次数 >= max_iterations。"

### Evaluator-Optimizer（Anthropic，2024）

Anthropic 2024 年 12 月的文章将此命名为五种工作流模式之一。两种角色：

- Evaluator：对输出打分并产生批评。
- Optimizer：根据批评修改输出。

循环直到 evaluator 通过。这就是 Anthropic 框架下的 Self-Refine/CRITIC。Anthropic 增加的关键工程细节：evaluator 和 optimizer 的提示词应该 substantially different，这样模型才不会只是 rubber-stamp。

### OpenAI Agents SDK 输出 guardrails

OpenAI Agents SDK 将此模式作为 "output guardrails" 提供。Guardrail 是在 agent 最终输出上运行的验证器。如果 guardrail 触发（引发 `OutputGuardrailTripwireTriggered`），输出会被拒绝，agent 可以重试。Guardrails 可以调用工具（CRITIC 风格）或作为纯函数（Self-Refine 风格）。

### 2026 年的陷阱

- **Rubber-stamp 循环。** 同一个模型用相同风格的提示词同时做生成和批评，会收敛到"看起来不错"。使用结构上不同的提示词，或用一个更小更便宜的模型做批评。
- **过度优化。** 每次优化都会增加延迟和 token 消耗。预算 1-3 次；之后升级到人工审核。
- **在简单任务上用 CRITIC。** 如果没有外部验证器，CRITIC 退化为 Self-Refine；不要为 stub 验证器付出延迟代价。

## 构建

`code/main.py` 在玩具任务上实现了 Self-Refine 和 CRITIC：给定主题生成短 bullet list。验证器检查格式（3 个 bullet，每个不超过 60 字符）。CRITIC 添加了一个外部"事实验证器"，对已知幻觉进行惩罚。

组件：

- `generate` — 脚本化的生成器。
- `feedback` — LLM 风格的自我批评。
- `verify_external` — CRITIC 风格的外部验证器。
- `refine` — 根据历史重写输出。
- 停止条件 — 验证器通过或最多 4 次迭代。

运行：

```
python3 code/main.py
```

比较 Self-Refine 和 CRITIC 的运行。CRITIC 捕获了 Self-Refine 遗漏的事实错误，因为外部验证器有自我批评所没有的依据。

## 使用

Anthropic 的 evaluator-optimizer 是用 Claude 友好语言描述的这个模式。OpenAI Agents SDK 的输出 guardrails 是 CRITIC 形状的（guardrails 可以调用工具）。LangGraph 提供了一个读起来像 Self-Refine 的 reflection 节点。Google 的 Gemini 2.5 Computer Use 添加了一个每步安全评估器，这是 CRITIC 的一个变体：每个动作在提交前都要验证。

## 交付

`outputs/skill-refine-loop.md` 配置了一个 evaluator-optimizer 循环，给定任务形状、验证器可用性和迭代预算。生成 generator、evaluator/verifier 和 optimizer 的提示词，以及停止策略。

## 练习

1. 用 max_iterations=1 运行玩具。CRITIC 还有帮助吗？
2. 将外部验证器替换为有噪声的（随机 30% 假阳性）。循环会怎么做？这是 2026 年大多数 guardrail 堆栈的现实。
3. 实现一个"不同模型做生成和批评"的变体：大模型生成，小模型批评。它是否优于同模型？
4. 阅读 CRITIC 第 3 节（arXiv:2305.11738 v4）。命名三种验证工具类别并各给一例。
5. 将 OpenAI Agents SDK 的 `output_guardrails` 映射到 CRITIC 的验证器角色。SDK 哪里做对了，哪里做错了？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Self-Refine | "LLM 自我修复" | 生成 -> 反馈 -> 优化循环，在一个模型中，带历史记录 |
| CRITIC | "工具依据验证" | 用外部验证器（搜索、代码、计算、测试）替换反馈 |
| Evaluator-Optimizer | "Anthropic 工作流模式" | 两种角色——evaluator 打分，optimizer 修改——循环到收敛 |
| Output guardrail | "事后检查" | OpenAI Agents SDK 验证器，在 agent 产生输出后运行 |
| Verify 步骤 | "批评阶段" | 关键决策：有依据的还是自我评分的 |
| Refine history | "模型已经尝试过的" | 先前的输出 + 批评前置到优化提示词；去掉则质量崩溃 |
| Rubber-stamp loop | "自我同意失败" | 相同提示词的批评返回"看起来不错"；用结构不同的提示词修复 |
| Stop condition | "收敛测试" | 验证器通过 OR 无反馈 AND 迭代上限；永远不要单条件 |

## 延伸阅读

- [Madaan 等，Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — 经典论文
- [Gou 等，CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) — 工具依据验证
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — evaluator-optimizer 工作流模式
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — 作为 CRITIC 形状验证器的输出 guardrails