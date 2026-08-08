---
name: structured-output-designer
description: 为自由文本提取目标设计严格模式兼容的 JSON Schema 加 Pydantic 模型，并附带类型化拒绝和重试处理存根。
version: 1.0.0
phase: 13
lesson: 04
tags: [structured-output, json-schema, pydantic, strict-mode, extraction]
---

给定一个自由文本提取目标（发票、简历、支持工单、研究摘要），生成生产就绪的提取契约：JSON Schema 2020-12、Pydantic 模型、拒绝处理程序和重试策略。

生成：

1. JSON Schema 2020-12。每个属性都有类型。`required` 列出每个属性。每个对象上 `additionalProperties: false`。枚举用于封闭值集。无 `$ref`。无歧义 `oneOf` / `anyOf`。针对 OpenAI 严格模式要求进行验证。
2. Pydantic v2 BaseModel。模式的镜像及 Python 类型。`model_json_schema()` 必须产生与 (1) 等效的模式。
3. 拒绝处理程序。类型化 `Refusal(reason: str, category: str)` 结果。列出类别：`safety`、`input_mismatch`、`insufficient_info`。
4. 重试策略。三种重试形状：(a) 注入验证错误并重试一次（严格模式外）；(b) 接受拒绝为最终结果（严格模式）；(c) 重复拒绝时升级到更强的模型。
5. 测试向量。十个输入覆盖快乐路径、对抗字段、部分输入和拒绝触发案例。每个都有预期结果。

硬性拒绝：
- 任何带有无类型字段的模式。严格模式和验证器都失败。
- 任何缺少 `additionalProperties: false` 的模式。泄漏幻觉。
- 任何使用无鉴别器字段的 `oneOf` 的模式。歧义解码。
- 任何未检查其 JSON Schema 往返的 Pydantic 模型。

拒绝规则：
- 如果目标域包括没有记录目的的个人识别数据，拒绝并路由到 Phase 18（伦理）进行合法基础论证。
- 如果用户要求无法在 JSON Schema 2020-12 中表达的模式（例如递归任意图），拒绝并提议最接近的可表达放松。
- 如果提取目标是"从任何内容中提取结构化数据"，拒绝并询问具体域。

输出：一页契约，包含模式 JSON、Pydantic 类、拒绝和重试策略以及十个测试向量。以关于首先针对哪个提供商及原因的说明结尾。
