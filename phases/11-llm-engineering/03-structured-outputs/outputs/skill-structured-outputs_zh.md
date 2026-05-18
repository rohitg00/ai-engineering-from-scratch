---
name: skill-structured-outputs
description: 基于提供商、可靠性和复杂度选择正确结构化输出策略的决策框架
version: 1.0.0
phase: 11
lesson: 03
tags: [structured-output, json, schema, constrained-decoding, pydantic, function-calling]
---

# 结构化输出策略

在构建需要结构化数据的 LLM 应用时，应用此决策框架。

## 何时使用每种方法

**基于提示词（"返回 JSON"）**：仅用于原型设计。对于偶尔解析失败可容忍的内部工具可接受。添加 try/except 和重试。切勿用于生产流水线。

**JSON 模式（API 标志）**：你需要保证有效的 JSON，但 schema 简单或灵活。适用于在应用端验证形状时。可用：OpenAI、Anthropic（通过工具使用）、Google。

**Schema 模式（约束解码）**：生产系统，其中每个输出必须匹配特定 schema。零解析失败。零 schema 违规。默认用于任何生产提取或分类任务。可用：OpenAI 结构化输出、Outlines、Guidance。

**函数调用 / 工具使用**：模型需要选择调用哪个函数，而不仅仅是填充参数。你有多个 schema，模型选择合适的一个。也在与现有工具/函数基础设施集成时使用。

**Instructor 库**：你想要跨任何提供商的 Pydantic 验证和自动重试。Python 项目的最佳开发体验。包装 OpenAI、Anthropic、Google 和开源模型。

## 提供商特定指导

**OpenAI**：使用 `response_format` 配合 `json_schema` 类型。内置约束解码。Pydantic 模型可直接使用。最可靠的结构化输出实现。

**Anthropic**：使用工具使用进行结构化输出。定义一个具有所需 schema 的单一工具。模型返回匹配 schema 的工具调用参数。可靠但需要工具使用 API 模式。

**开源模型（vLLM、Ollama）**：使用 Outlines 或 Guidance 进行约束解码。这些库将 JSON Schema 编译成有限状态机，在生成过程中屏蔽无效 token。需要在本地运行推理。

## Schema 设计指南

1. 尽可能保持 schema 扁平。超过 2 层的嵌套对象会增加提取错误。
2. 对分类字段使用枚举。不要依赖模型发明正确的字符串。
3. 将模糊字段设为必填并显式支持 null，而非可选。强制模型做出决定。
4. 为 schema 属性添加描述。模型将这些作为指令读取。
5. 除非必要，避免联合类型（oneOf/anyOf）。它们增加了解码复杂度。
6. 对数字设置最小/最大值。捕获幻觉的极端值。
7. 对数组使用 minItems/maxItems 以防止空或无界输出。

## 常见失败模式和修复

- **模型将 JSON 包裹在 markdown 围栏中**：从基于提示词切换到 JSON 模式或 schema 模式
- **Schema 有效但事实错误**：在提取后添加 LLM-as-judge 验证步骤
- **枚举值不一致**：切换到约束解码或添加后处理规范化
- **缺少可选字段**：将它们设为必填或在应用代码中添加默认值
- **提取非常慢**：约束解码增加 5-15% 延迟，如果对延迟敏感则降低 schema 复杂度
- **包含多样项目的大数组**：分块输入并按块提取，然后合并结果

## 可靠性阶梯

| 方法 | 解析成功率 | Schema 匹配率 | 设置工作量 |
|----------|-------------|-------------|-------------|
| 基于提示词 | ~90% | ~80% | 1 分钟 |
| JSON 模式 | 100% | ~90% | 5 分钟 |
| Schema 模式 | 100% | ~99% | 15 分钟 |
| 约束解码 | 100% | 100% | 30 分钟 |
| Instructor + 重试 | 100% | ~99.5% | 10 分钟 |
