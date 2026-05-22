# Self-Refine 与 CRITIC：迭代输出改进

> Self-Refine（Madaan 等人，2023）在一个 LLM 中使用三个角色——生成（generate）、反馈（feedback）、精炼（refine）——形成一个循环。平均收益：在 7 个任务上提高 20 个百分点。CRITIC（Gou 等人，2023）通过外部工具路由验证来强化反馈步骤。在 2026 年，此模式在每个框架中作为"评估器-优化器"（Anthropic）或防护栏循环（OpenAI Agents SDK）发布。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（Agent 循环）、阶段 14 · 03（Reflexion）
**时长：** 约 60 分钟

## 学习目标

- 说明 Self-Refine 的三个提示（生成、反馈、精炼），并解释为什么历史记录对精炼提示很重要。
- 解释 CRITIC 的关键洞察：LLM 在没有外部 grounding 的情况下，自我验证是不可靠的。
- 实现一个带有历史记录和可选外部验证器的标准库 Self-Refine 循环。
- 将此模式映射到 Anthropic 的"评估器-优化器"工作流和 OpenAI Agents SDK 的输出防护栏。

## 问题背景

一个 Agent 产生了一个几乎正确的答案。也许一行代码有语法错误。也许摘要太长。也许一个计划漏掉了一个边缘情况。你想要的是：Agent 批判自己的输出，然后修复它。

Self-Refine 表明这可以用单个模型实现，无需训练数据，无需强化学习。但有一个问题：LLM 在硬事实的自我验证方面很差。CRITIC 提出了修复方案——通过外部工具（搜索、代码解释器、计算器、测试运行器）路由验证步骤。

这两篇论文共同定义了 2026 年迭代改进的默认方式：生成、验证（尽可能外部）、精炼，当验证器通过时停止。

## 核心概念

### Self-Refine（Madaan 等人，NeurIPS 2023）

一个 LLM，三个角色：

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
当 feedback 说"无问题"或预算耗尽时停止。
```

关键细节：`refine` 看到完整的历史记录——所有先前的输出和批判——所以它不会重复错误。论文对此进行了消融实验：丢弃历史记录，质量急剧下降。

标题：在包括 GPT-4 在内的 7 个任务（数学、代码、首字母缩略词、对话）上，平均绝对改进 20 个百分点。无需训练，无需外部工具，单个模型。

### CRITIC（Gou 等人，arXiv:2305.11738，v4 2024 年 2 月）

Self-Refine 的弱点：反馈步骤是 LLM 对自己评分。对于事实声明，这是不可靠的（幻觉对产生它的模型来说往往看起来令人信服）。CRITIC 用 `verify(task, output, tools)` 替换 `feedback(task, output)`，其中 `tools` 包括：

- 用于事实声明的搜索引擎。
- 用于代码正确性的代码解释器。
- 用于算术的计算器。
- 特定领域的验证器（单元测试、类型检查器、linter）。

验证器产生基于工具结果的结构化批判。然后精炼器以这个批判为条件。

标题：CRITIC 在事实任务上优于 Self-Refine，因为批判是有根据的。在没有外部验证器的任务上（创意写作、格式化），CRITIC 退化为 Self-Refine。

### 停止条件

两种常见形态：

1. **验证器通过。** 外部测试返回成功。当可用时首选（单元测试、类型检查器、防护栏断言）。
2. **未发出反馈。** 模型说"输出没问题。"更便宜但不可靠；配合最大迭代上限使用。

2026 年默认：组合它们。"如果验证器通过 或 模型说没问题 且 迭代次数 >= 2 或 迭代次数 >= max_iterations，则停止。"

### 评估器-优化器（Anthropic，2024）

Anthropic 2024 年 12 月的帖子将其命名为五种工作流模式之一。两个角色：

- 评估器（Evaluator）：对输出评分并产生批判。
- 优化器（Optimizer）：给定批判修订输出。

循环直到评估器通过。这是 Anthropic 框架中的 Self-Refine/CRITIC。Anthropic 添加的关键工程细节：评估器和优化器提示应该有实质性不同，这样模型就不会只是橡皮图章。

### OpenAI Agents SDK 输出防护栏

OpenAI Agents SDK 将此模式作为"输出防护栏（output guardrails）"发布。防护栏是在 Agent 的最终输出上运行的验证器。如果防护栏触发（引发 `OutputGuardrailTripwireTriggered`），输出被拒绝，Agent 可以重试。防护栏可以调用工具（CRITIC 风格）或是纯函数（Self-Refine 风格）。

### 2026 年的陷阱

- **橡皮图章循环。** 同一模型使用相同的提示风格进行生成和批判，收敛于"在我看来不错"。使用结构上不同的提示，或使用更小更便宜的模型进行批判。
- **过度精炼。** 每次精炼都会增加延迟和 token。预算 1-3 次传递；之后，上报到人工审查。
- **在琐碎任务上使用 CRITIC.** 如果没有外部验证器，CRITIC 退化为 Self-Refine；不要为存根验证器支付延迟。

## 构建它

`code/main.py` 在一个玩具任务上实现 Self-Refine 和 CRITIC：给定主题生成简短的项目符号列表。验证器检查格式（3 个项目符号，每个少于 60 个字符）。CRITIC 添加了一个外部"事实验证器"，对已知幻觉进行惩罚。

组件：

- `generate`——脚本化生成器。
- `feedback`——LLM 风格的自批判。
- `verify_external`——CRITIC 风格的有根据验证器。
- `refine`——给定历史记录重写输出。
- 停止条件——验证器通过或最多 4 次迭代。

运行它：

```
python3 code/main.py
```

比较 Self-Refine 与 CRITIC 的运行。CRITIC 捕获了 Self-Refine 漏掉的事实错误，因为外部验证器具有自我批判者不具备的 grounding。

## 使用它

Anthropic 的评估器-优化器是这种模式的 Claude 友好语言。OpenAI Agents SDK 的输出防护栏是 CRITIC 形态的（防护栏可以调用工具）。LangGraph 发布了一个读起来像 Self-Refine 的反思节点。Google 的 Gemini 2.5 Computer Use 添加了一个每步安全评估器，这是一个 CRITIC 变体：每个行动在提交前都经过验证。

## 部署它

`outputs/skill-refine-loop.md` 根据任务形态、验证器可用性和迭代预算，配置一个评估器-优化器循环。发出生成器、评估器/验证器和优化器的提示，加上停止策略。

## 练习

1. 用 max_iterations=1 运行玩具。CRITIC 仍然有帮助吗？
2. 将外部验证器替换为一个嘈杂的验证器（随机 30% 假阳性）。循环会做什么？这是大多数防护栏堆栈的 2026 年现实。
3. 实现一个"不同模型上的生成器-批判器"变体：大模型生成，小模型批判。它比同模型更好吗？
4. 阅读 CRITIC 第 3 节（arXiv:2305.11738 v4）。说出三种验证工具类别，并为每个举一个例子。
5. 将 OpenAI Agents SDK 的 `output_guardrails` 映射到 CRITIC 的验证器角色。SDK 什么地方错了，什么地方对了？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Self-Refine | "LLM 自我修复" | 在单个模型中生成 -> 反馈 -> 精炼循环，带有历史记录 |
| CRITIC | "工具 Grounding 验证" | 用外部验证器（搜索、代码、计算器、测试）替换反馈 |
| Evaluator-Optimizer | "Anthropic 工作流模式" | 两个角色——评估器评分，优化器修订——循环到收敛 |
| Output guardrail | "事后检查" | OpenAI Agents SDK 在 Agent 产生输出后运行的验证器 |
| Verify step | "批判阶段" | 承重决策：有根据的或自评的 |
| Refine history | "模型已经尝试了什么" | 先前的输出 + 批判预置到精炼提示中；丢弃后质量崩溃 |
| Rubber-stamp loop | "自协议失败" | 同提示批判返回"看起来不错"；用结构上不同的提示修复 |
| Stop condition | "收敛测试" | 验证器通过 或 无反馈 且 迭代上限；永远不要单条件 |

## 延伸阅读

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651)——规范论文
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738)——工具 Grounding 验证
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)——评估器-优化器工作流模式
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/)——作为 CRITIC 形态验证器的输出防护栏
