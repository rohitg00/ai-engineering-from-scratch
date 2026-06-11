---
name: provider-portability-audit
description: 审计针对一个提供商的函数调用集成，找出当移植到另外两个提供商时会破坏的内容。
version: 1.0.0
phase: 13
lesson: 02
tags: [function-calling, openai, anthropic, gemini, portability]
---

给定一个提供商（OpenAI、Anthropic 或 Gemini）上的函数调用集成，生成可移植性审计，列出当相同逻辑在另外两个提供商上交付时出现的每个字段重命名、行为差异和硬限制冲突。

生成：

1. 声明差异。对于集成中的每个工具，显示其他两个提供商中每个所需的信封/字段重命名/模式转换。标记目标提供商不支持的任何 JSON Schema 构造（Gemini：OpenAPI 3.0 子集；OpenAI 严格模式：无 `$ref`，无歧义 `oneOf`）。
2. 响应差异。记录工具调用在每个提供商响应形状中的位置（`tool_calls[]` vs `content[]` 块 vs `parts[]` 条目）以及谁负责解析 `arguments`（OpenAI 上为字符串，Anthropic 和 Gemini 上为对象）。
3. `tool_choice` 差异。将集成的当前选择设置（auto / forbid / force / required）映射到目标提供商形状；标记缺失模式。
4. 限制冲突。报告工具计数（128 / 64 / 64）、模式深度（5 / 10 / 实际上无界）和每个参数长度上限。对任何超过目标提供商限制的集成提高阻塞严重程度。
5. 严格模式映射。说明严格模式语义是否在目标上保留。OpenAI `strict: true` 在 Anthropic 上没有完全等效项；Gemini `responseSchema` 近似但在请求级别。

硬性拒绝：
- 任何假设 `arguments` 在非 OpenAI 目标上是字符串的集成。将静默产生错误结果。
- 任何工具计数超过 64 且在移植到 Anthropic 或 Gemini 时没有路由器的集成。
- 任何在目标为 OpenAI 严格模式时在模式中使用 `$ref` 的集成。

拒绝规则：
- 如果被要求移植依赖于没有类似物的提供商特定功能的集成（例如 OpenAI Responses API 有状态轮次、Anthropic computer-use 块），拒绝并解释哪个功能没有目标等效项。
- 如果被要求选择赢家，拒绝。选择取决于主机的严格模式需求、成本概况和并行调用需求。

输出：一页审计，包含每个工具的差异表、限制表和每个目标提供商的最终"移植裁决"（发货/需要路由器/被功能阻塞）。以一句命名最高杠杆迁移更改的话结尾。
