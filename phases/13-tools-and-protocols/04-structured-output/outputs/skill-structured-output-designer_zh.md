---
name: structured-output-designer
description: 为自由文本提取目标设计一个兼容严格模式的 JSON Schema 及 Pydantic 模型，并预置类型化拒绝和重试处理。
version: 1.0.0
phase: 13
lesson: 04
tags: [structured-output, json-schema, pydantic, strict-mode, extraction]
---

给定一个自由文本提取目标（发票、简历、支持工单、研究报告摘要），产出一份生产级别的提取合约：JSON Schema 2020-12、Pydantic 模型、拒绝处理器和重试策略。

产出：

1. **JSON Schema 2020-12。** 每个属性都有类型。`required` 列出每个属性。每个对象上有 `additionalProperties: false`。枚举用于封闭值集。无 `$ref`。无歧义性 `oneOf` / `anyOf`。已针对 OpenAI 严格模式要求进行验证。
2. **Pydantic v2 BaseModel。** Schema 的镜像，使用 Python 类型。`model_json_schema()` 必须产生与 (1) 等价的 schema。
3. **拒绝处理器。** 类型化结果 `Refusal(reason: str, category: str)`。列出类别：`safety`、`input_mismatch`、`insufficient_info`。
4. **重试策略。** 三种重试形态：(a) 注入验证错误并重试一次（严格模式外）；(b) 将拒绝作为最终结果接受（严格模式）；(c) 在反复拒绝时升级到更强模型。
5. **测试向量。** 十个输入，涵盖正常路径、对抗性字段、部分输入以及触发拒绝的场景。每个都附带预期结果。

硬拒绝：
- 任何包含无类型字段的 schema。同时违反严格模式和验证器。
- 任何缺少 `additionalProperties: false` 的 schema。会泄漏幻觉内容。
- 任何使用 `oneOf` 但没有判别器字段的 schema。会导致歧义解码。
- 任何未经 JSON Schema 往返检查的 Pydantic 模型。

拒绝规则：
- 如果目标领域包含个人身份信息且没有记录目的，拒绝并引导至阶段 18（伦理）进行合法依据论证。
- 如果用户要求的 schema 无法用 JSON Schema 2020-12 表达（例如递归任意图），拒绝并提出最接近的可表达简化方案。
- 如果提取目标是"从任何内容提取结构化数据"，拒绝并要求指定具体领域。

输出：一页合约，包含 schema JSON、Pydantic 类、拒绝与重试策略以及十个测试向量。最后附注关于首选目标提供商及其原因。
