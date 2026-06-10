# 05 · Self-Refine 与 CRITIC：迭代式输出改进

> Self-Refine（Madaan 等，2023）让同一个大语言模型（LLM）在三种角色——生成、反馈、改进——之间循环。平均增益：在 7 项任务上绝对提升 +20 分。CRITIC（Gou 等，2023）通过把验证环节路由到外部工具，强化了反馈步骤。到 2026 年，这一模式已内置于各大框架，称为「评估器-优化器（evaluator-optimizer）」（Anthropic）或护栏循环（OpenAI Agents SDK）。

**类型：** 构建
**语言：** Python（标准库）
**前置：** 阶段 14 · 01（智能体循环），阶段 14 · 03（Reflexion）
**时长：** 约 60 分钟

## 学习目标

- 说出 Self-Refine 的三个提示词（生成、反馈、改进），并解释为什么历史记录对改进提示词至关重要。
- 阐明 CRITIC 的核心洞见：在缺乏外部接地（external grounding）的情况下，LLM 的自我验证并不可靠。
- 用标准库实现一个带历史记录、可选外部验证器的 Self-Refine 循环。
- 把这一模式对应到 Anthropic 的「评估器-优化器」工作流，以及 OpenAI Agents SDK 的输出护栏（output guardrails）。

## 问题

一个智能体产出了一个几乎正确的答案。也许某行代码有语法错误；也许摘要太长；也许某个计划漏掉了一个边界情况。你想要的是：智能体批判自己的输出，然后加以修正。

Self-Refine 证明了这件事用单个模型即可做到，无需训练数据，无需强化学习（RL）。但有一个陷阱：LLM 在硬事实（hard facts）上的自我验证很糟糕。CRITIC 点明了解决之道——把验证步骤路由到外部工具（搜索、代码解释器、计算器、测试运行器）。

这两篇论文共同定义了 2026 年迭代改进的默认范式：生成、验证（尽量借助外部）、改进，验证器通过即停止。

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
stop when feedback says "no issues" or budget exhausted.
```

关键细节：`refine` 能看到完整历史记录——所有先前的输出与批判——因此不会重复犯错。论文对此做了消融实验：去掉历史记录，质量会急剧下降。

亮眼结论：在 7 项任务（数学、代码、首字母缩写、对话）上平均绝对提升 +20 分，包含 GPT-4。无需训练，无需外部工具，单个模型即可。

### CRITIC（Gou 等，arXiv:2305.11738，v4 2024 年 2 月）

Self-Refine 的弱点在于：反馈步骤是一个 LLM 在给自己打分。对于事实性断言，这并不可靠（一个幻觉对产生它的模型来说往往看起来很有说服力）。CRITIC 把 `feedback(task, output)` 替换为 `verify(task, output, tools)`，其中 `tools` 包括：

- 用于事实性断言的搜索引擎。
- 用于代码正确性的代码解释器。
- 用于算术的计算器。
- 领域专用验证器（单元测试、类型检查器、代码风格检查器 linter）。

验证器产出一份基于工具结果接地的结构化批判。改进器随后以这份批判为条件进行修改。

亮眼结论：在事实性任务上 CRITIC 优于 Self-Refine，因为其批判是有接地的。在没有外部验证器的任务上（创意写作、格式化），CRITIC 退化为 Self-Refine。

### 停止条件

两种常见形态：

1. **验证器通过。** 外部测试返回成功。在可用时优先采用（单元测试、类型检查器、护栏断言）。
2. **未发出反馈。** 模型说「输出没问题」。更便宜但不可靠；需搭配最大迭代次数上限。

2026 年的默认做法：把两者结合起来。「若验证器通过 OR（模型说没问题 AND 迭代次数 >= 2）OR 迭代次数 >= max_iterations，则停止。」

### 评估器-优化器（Anthropic，2024）

Anthropic 在 2024 年 12 月的文章中将其列为五种工作流模式之一。两种角色：

- 评估器（Evaluator）：为输出打分并产出一份批判。
- 优化器（Optimizer）：根据批判修改输出。

循环直到评估器通过。这就是 Anthropic 框架下的 Self-Refine/CRITIC。Anthropic 补充的关键工程细节是：评估器与优化器的提示词应当有实质性差异，这样模型才不会只是机械式盖章放行。

### OpenAI Agents SDK 的输出护栏

OpenAI Agents SDK 以「输出护栏（output guardrails）」的形式提供了这一模式。护栏是一个在智能体最终输出上运行的验证器。如果护栏被触发（抛出 `OutputGuardrailTripwireTriggered`），该输出会被拒绝，智能体可以重试。护栏既可以调用工具（CRITIC 风格），也可以是纯函数（Self-Refine 风格）。

### 2026 年的坑

- **盖章式循环。** 同一个模型用相同的提示风格既做生成又做批判，会收敛到「我觉得挺好」。请使用结构上不同的提示词，或者用一个更小、更便宜的模型来做批判。
- **过度改进。** 每一轮改进都会增加延迟和 token 消耗。预算控制在 1-3 轮；之后应升级到人工审核。
- **在琐碎任务上用 CRITIC。** 如果没有外部验证器，CRITIC 会退化为 Self-Refine；不要为一个空壳验证器付出延迟代价。

## 动手构建

`code/main.py` 在一个玩具任务上实现了 Self-Refine 与 CRITIC：给定一个主题，产出一份简短的要点列表。验证器检查格式（3 个要点，每个不超过 60 个字符）。CRITIC 额外加入了一个外部「事实验证器」，用于惩罚已知的幻觉。

组件：

- `generate`——脚本化的生成器。
- `feedback`——LLM 风格的自我批判。
- `verify_external`——CRITIC 风格的有接地验证器。
- `refine`——根据历史记录重写输出。
- 停止条件——验证器通过或最多 4 次迭代。

运行它：

```
python3 code/main.py
```

对比 Self-Refine 与 CRITIC 两次运行。CRITIC 捕捉到了 Self-Refine 遗漏的一个事实错误，因为外部验证器拥有自我批判者所不具备的接地能力。

## 实际应用

Anthropic 的评估器-优化器就是这一模式的 Claude 友好版表述。OpenAI Agents SDK 的输出护栏是 CRITIC 形态的（护栏可以调用工具）。LangGraph 提供了一个反思（reflection）节点，读起来就像 Self-Refine。Google 的 Gemini 2.5 Computer Use 增加了一个逐步安全评估器，它是 CRITIC 的一种变体：每个动作在提交前都会被验证。

## 交付落地

`outputs/skill-refine-loop.md` 会根据任务形态、验证器可用性和迭代预算，配置一个评估器-优化器循环。它会生成生成器、评估器/验证器、优化器的提示词，外加一套停止策略。

## 练习

1. 用 max_iterations=1 运行这个玩具示例。CRITIC 还有帮助吗？
2. 把外部验证器替换为一个带噪声的版本（随机 30% 误报）。循环会怎么做？这就是 2026 年大多数护栏栈的现实。
3. 实现一个「在不同模型上做生成器-批判者」的变体：大模型生成，小模型批判。它能击败同模型方案吗？
4. 阅读 CRITIC 第 3 节（arXiv:2305.11738 v4）。说出三类验证工具，并各举一例。
5. 把 OpenAI Agents SDK 的 `output_guardrails` 对应到 CRITIC 的验证器角色。该 SDK 哪里做错了，哪里做对了？

## 关键术语

| 术语 | 大家怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| Self-Refine | 「会自我修正的 LLM」 | 在单个模型内的 生成 -> 反馈 -> 改进 循环，带历史记录 |
| CRITIC | 「工具接地的验证」 | 用外部验证器（搜索、代码、计算、测试）替换反馈 |
| 评估器-优化器（Evaluator-Optimizer） | 「Anthropic 的工作流模式」 | 两种角色——评估器打分，优化器修改——循环至收敛 |
| 输出护栏（Output guardrail） | 「事后检查」 | OpenAI Agents SDK 的验证器，在智能体产出输出之后运行 |
| 验证步骤（Verify step） | 「批判阶段」 | 承重的决策点：有接地还是自我评分 |
| 改进历史（Refine history） | 「模型已经尝试过什么」 | 把先前的输出 + 批判前置到改进提示词中；去掉它质量就崩 |
| 盖章式循环（Rubber-stamp loop） | 「自我认同失败」 | 相同提示词的批判返回「看着不错」；用结构不同的提示词修复 |
| 停止条件（Stop condition） | 「收敛测试」 | 验证器通过 OR（无反馈 AND 迭代上限）；绝不要用单一条件 |

## 延伸阅读

- [Madaan 等，Self-Refine（arXiv:2303.17651）](https://arxiv.org/abs/2303.17651) —— 经典原始论文
- [Gou 等，CRITIC（arXiv:2305.11738）](https://arxiv.org/abs/2305.11738) —— 工具接地的验证
- [Anthropic，Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 评估器-优化器工作流模式
- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/) —— 作为 CRITIC 形态验证器的输出护栏
