---
name: provider-portability-audit
description: 审计针对某一提供商的函数调用集成，找出移植到另外两家提供商时会破坏的内容。
version: 1.0.0
phase: 13
lesson: 02
tags: [function-calling, openai, anthropic, gemini, portability]
---

给定一个在某一家提供商（OpenAI、Anthropic 或 Gemini）上的函数调用集成，产出一份可移植性审计报告，列出将相同逻辑部署到另外两家提供商时出现的每个字段重命名、行为差异和硬限制冲突。

产出：

1. **声明差异。** 针对集成中的每个工具，展示需要在其他两个目标提供商处进行的信封/字段重命名/schema 转换。标记目标提供商不支持的任何 JSON Schema 结构（Gemini：OpenAPI 3.0 子集；OpenAI 严格模式：不支持 `$ref`，不支持歧义性 `oneOf`）。
2. **响应差异。** 记录工具调用在每个提供商的响应结构中的位置（`tool_calls[]` vs `content[]` 块 vs `parts[]` 条目），以及谁负责解析 `arguments`（OpenAI 为字符串，Anthropic 和 Gemini 为对象）。
3. **`tool_choice` 差异。** 将集成当前的 choice 设置（auto / forbid / force / required）映射到目标提供商的形态；标记缺失的模式。
4. **限制碰撞。** 报告工具数量限制（128 / 64 / 64）、schema 深度限制（5 / 10 / 实际上无限制）以及每个参数的长度上限。对任何超出目标提供商限制的集成标记为 block 严重级别。
5. **严格模式映射。** 说明严格模式语义在目标上是否保持。OpenAI 的 `strict: true` 在 Anthropic 上没有精确对应；Gemini 的 `responseSchema` 近似但位于请求级别。

硬拒绝：
- 任何假设在非 OpenAI 目标上 `arguments` 是字符串的集成。会静默产生错误结果。
- 任何工具数量超过 64 且在移植到 Anthropic 或 Gemini 时没有路由器的集成。
- 任何在目标为 OpenAI 严格模式时在 schema 中使用 `$ref` 的集成。

拒绝规则：
- 如果被要求移植一个依赖于提供商特有功能且无类似物的集成（例如 OpenAI Responses API 有状态轮次、Anthropic 的 computer-use 块），则拒绝并解释哪个功能在目标上无对应。
- 如果被要求选择最优提供商，则拒绝。选择取决于宿主的严格模式需求、成本概况和并行调用需求。

输出：一页审计报告，包含每个工具的差异表、一个限制表，以及每个目标提供商的最终"移植裁决"（ship / needs-router / blocked-by-feature）。以一句话结尾，指出最具影响力的迁移变更。
