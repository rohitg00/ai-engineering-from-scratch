---
name: structured-output-picker
description: 选择结构化输出方法、模式设计和验证计划
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

给定一个用例（供应商、延迟预算、模式复杂性、容错能力），输出：

1. 机制。原生供应商结构化输出、Instructor 重试、Outlines FSM 或 XGrammar CFG。一句话解释原因。
2. 模式设计。字段顺序（推理在前，答案在后）、"未知"场景的可空字段、枚举 vs 正则表达式、必填字段。
3. 失败策略。最大重试次数、回退模型、优雅的 `null` 处理、分布外拒绝。
4. 验证计划。模式合规率（目标100%）、语义有效性（LLM 评判）、字段覆盖率、延迟 P50/P99。

拒绝任何将 `answer` 或 `decision` 放在推理字段之前的设计。拒绝在没有模式的情况下使用裸 JSON 模式。将递归模式标记为只能使用仅 FSM 的库。
