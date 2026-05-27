# 函数调用深度解析 —— OpenAI、Anthropic、Gemini

> 2024年，三家前沿提供商在工具调用循环上趋于一致，但在其他方面则分道扬镳。OpenAI使用 `tools` 和 `tool_calls`。Anthropic使用 `tool_use` 和 `tool_result` 块。Gemini使用 `functionDeclarations` 和唯一ID关联。本课程将三者并列对比，以确保在某个提供商上编写的代码在移植时不会出错。

**类型:** 构建
**语言:** Python（标准库，模式翻译器）
**前置条件:** 阶段13 · 01（工具接口）
**时间:** 约75分钟

## 学习目标

- 描述OpenAI、Anthropic和Gemini函数调用载荷在三个方面的形状差异（声明、调用、结果）。
- 将一条工具声明翻译成三种提供商的格式，并预测严格模式约束的差异所在。
- 在每个提供商中使用 `tool_choice` 来强制、禁止或自动选择工具调用。
- 了解每个提供商的具体硬限制（工具数量、模式深度、参数长度）以及超出限制时返回的错误特征。

## 问题

函数调用请求的形状因提供商而异。以下是2026年生产环境中的三个具体例子：

**OpenAI Chat Completions / Responses API。** 你传入 `tools: [{type: "function", function: {name, description, parameters, strict}}]`。模型的响应包含 `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`，其中 `arguments` 是需要你解析的JSON字符串。严格模式（`strict: true`）通过受限解码强制模式合规。

**Anthropic Messages API。** 你传入 `tools: [{name, description, input_schema}]`。响应以 `content: [{type: "text"}, {type: "tool_use", id, name, input}]` 的形式返回。`input` 已被解析（是一个对象，而非字符串）。你需要用一个新的 `user` 消息回复，其中包含 `{type: "tool_result", tool_use_id, content}` 块。

**Google Gemini API。** 你传入 `tools: [{functionDeclarations: [{name, description, parameters}]}]`（嵌套在 `functionDeclarations` 下）。响应以 `candidates[0].content.parts: [{functionCall: {name, args, id}}]` 的形式返回，其中在Gemini 3及以上版本中 `id` 是唯一的，用于并行调用关联。你回复时使用 `{functionResponse: {name, id, response}}`。

相同的循环，不同的字段名、不同的嵌套方式、不同的字符串-对象约定、不同的关联机制。一个团队在OpenAI上编写天气代理，移植到Anthropic需要两天，再到Gemini又需要一天，仅仅是为了接口适配。

本课程构建了一个翻译器，将三种格式统一为一种规范的工具声明，并在边缘层进行路由。阶段13 · 17将同样的模式泛化为一个LLM网关。

## 概念

### 共同结构

每个提供商都需要五个部分：

1. **工具列表。** 每个工具的名称、描述和输入模式。
2. **工具选择。** 强制使用特定工具、禁止使用工具，或让模型自行决定。
3. **调用发出。** 结构化输出，指定工具名称和参数。
4. **调用ID。** 将响应与正确的调用关联（对于并行调用至关重要）。
5. **结果注入。** 将结果与调用关联的消息或块。

### 形状差异，逐字段对比

| 方面 | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| 声明封装 | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| 模式字段 | `parameters` | `input_schema` | `parameters` |
| 响应容器 | 助手消息上的 `tool_calls[]` | 类型为 `tool_use` 的 `content[]` | 类型为 `functionCall` 的 `parts[]` |
| 参数类型 | 字符串化JSON | 已解析的对象 | 已解析的对象 |
| ID格式 | `call_...`（OpenAI生成） | `toolu_...`（Anthropic） | UUID（Gemini 3+） |
| 结果块 | role为 `tool`，带 `tool_call_id` | role为 `user`，带 `tool_result` 和 `tool_use_id` | `functionResponse` 带匹配的 `id` |
| 强制工具 | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| 禁止工具 | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| 严格模式 | `strict: true` | 模式即模式（始终强制执行） | 在请求级别使用 `responseSchema` |

### 你可能会遇到的实际限制

- **OpenAI。** 每个请求最多128个工具。模式深度为5。参数字符串不超过8192字节。严格模式要求不包含 `$ref`、不包含重叠的 `oneOf`/`anyOf`/`allOf`，每个属性都必须在 `required` 中列出。
- **Anthropic。** 每个请求最多64个工具。模式深度实际上无限制，但实用限制为10。没有严格模式标志；模式即契约，模型倾向于遵守。
- **Gemini。** 每个请求最多64个函数。模式类型是OpenAPI 3.0子集（与JSON Schema 2020-12略有差异）。自Gemini 3起，并行调用使用唯一ID。

### `tool_choice` 行为

三种模式各提供商都支持，但命名不同。

- **自动（Auto）。** 模型自行选择工具或文本。默认。
- **必需/任意（Required / Any）。** 模型必须至少调用一个工具。
- **无（None）。** 模型不得调用工具。

此外，每个提供商还支持一种独特模式：

- **OpenAI。** 通过名称强制使用特定工具。
- **Anthropic。** 通过名称强制使用特定工具；`disable_parallel_tool_use` 标志区分单次与多次调用。
- **Gemini。** `mode: "VALIDATED"` 将所有响应通过模式验证器路由，无论模型意图如何。

### 并行调用

OpenAI的 `parallel_tool_calls: true`（默认）在一次助手消息中发出多个调用。你并行执行所有调用，然后用一个批处理的工具角色消息回复，每条 `tool_call_id` 对应一个条目。Anthropic历史上是单次调用；`disable_parallel_tool_use: false`（自Claude 3.5起为默认）启用了多次调用。Gemini 2支持并行调用，但未提供稳定的ID；Gemini 3增加了UUID，因此乱序响应的关联更清晰。

### 流式处理

所有三个提供商都支持流式工具调用。网络格式不同：

- **OpenAI。** `tool_calls[i].function.arguments` 的增量块逐步到达。你累积直到 `finish_reason: "tool_calls"`。
- **Anthropic。** 块开始/块增量/块停止事件。`input_json_delta` 块携带部分参数。
- **Gemini。** `streamFunctionCallArguments`（Gemini 3新增）发出带有 `functionCallId` 的块，使得多个并行调用可以交错。

阶段13 · 03深入讲解并行+流式重组。本课程侧重于声明和单次调用形状。

### 错误与修复

无效参数错误也看起来不同。

- **OpenAI（非严格）。** 模型返回 `arguments: "{bad json}"`，你的JSON解析失败，你注入一条错误消息并重新调用。
- **OpenAI（严格）。** 验证在解码期间进行；无效JSON不可能出现，但可能出现 `refusal`（拒绝）。
- **Anthropic。** `input` 可能包含意外字段；模式是建议性的。在服务端验证。
- **Gemini。** OpenAPI 3.0的怪癖：对象字段上的 `enum` 被静默忽略；自行验证。

### 翻译器模式

代码中的规范工具声明如下所示（你选择形状）：

```python
Tool(
    name="get_weather",
    description="在...时使用",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

三个小函数将其翻译成三个提供商的形状。`code/main.py` 中的测试框架正是这样做的，然后通过每个提供商的响应形状来回传一个伪造的工具调用。无需网络——本课程教授形状，而非HTTP。

生产团队将此翻译器封装在 `AbstractToolset`（Pydantic AI）、`UniversalToolNode`（LangGraph）或 `BaseTool`（LlamaIndex）中。阶段13 · 17提供了一个网关，该网关在任何三家提供商前面暴露一个OpenAI形状的API。

## 使用它

`code/main.py` 定义了一个规范的 `Tool` 数据类和三个翻译器，分别生成OpenAI、Anthropic和Gemini的声明JSON。然后，它从每个提供商的一个人工构建的响应中解析出相同的规范调用对象，证明其语义本质上是相同的。运行它并并排对比三个声明。

需要关注的内容：

- 三个声明块仅在封装和字段名上不同。
- 三个响应块在调用所在位置（顶层 `tool_calls`、`content[]` 块、`parts[]` 条目）上不同。
- 一个 `canonical_call()` 函数从所有三个响应形状中提取 `{id, name, args}`。

## 交付

本课程产出 `outputs/skill-provider-portability-audit.md`。给定一个针对某个提供商的函数调用集成，该技能生成一份可移植性审计报告：它依赖哪些提供商限制，哪些字段需要重命名，以及移植到其他提供商时会出现什么问题。

## 练习

1. 运行 `code/main.py`，验证三个提供商的声明JSON都能序列化同一个底层 `Tool` 对象。修改规范工具，添加一个枚举参数，确认只有Gemini翻译器需要处理OpenAPI怪癖。

2. 为每个提供商添加一个 `ListToolsResponse` 解析器，用于提取模型在 `list_tools` 或发现调用后返回的工具列表。OpenAI原生不支持此功能；注意这种不对称性。

3. 实现 `tool_choice` 转换：将规范的 `ToolChoice(mode="force", tool_name="x")` 映射到所有三个提供商的形状。然后映射 `mode="any"` 和 `mode="none"`。对照本课程的差异表检查。

4. 选择其中一个提供商，完整阅读其函数调用指南。找出其模式规范中其他两个提供商不支持的一个字段。候选：OpenAI的 `strict`、Anthropic的 `disable_parallel_tool_use`、Gemini的 `function_calling_config.allowed_function_names`。

5. 编写一个测试向量：一个工具调用，其参数违反了声明的模式。通过每个提供商的验证器（阶段01中的标准库验证器可作代理）运行它，记录触发的错误。记录你认为哪个提供商在生产中更严格。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|----------------|------------------------|
| 函数调用（Function calling） | "工具使用" | 用于结构化工具调用发出的提供商级API |
| 工具声明（Tool declaration） | "工具规范" | 名称 + 描述 + JSON Schema输入载荷 |
| `tool_choice` | "强制/禁止" | 自动 / 必需 / 无 / 指定名称模式 |
| 严格模式（Strict mode） | "模式强制" | OpenAI标志，约束解码以匹配模式 |
| `tool_use` 块 | "Anthropic的调用形状" | 内联内容块，包含id、name、input |
| `functionCall` 部分 | "Gemini的调用形状" | 包含name、args和id的 `parts[]` 条目 |
| 参数即字符串（Arguments-as-string） | "字符串化JSON" | OpenAI将args作为JSON字符串返回，而非对象 |
| 并行工具调用（Parallel tool calls） | "一轮中的扇出" | 一条助手消息中的多个工具调用 |
| 拒绝（Refusal） | "模型拒绝" | 严格模式下拒绝块代替调用的输出 |
| OpenAPI 3.0子集 | "Gemini模式怪癖" | Gemini使用一种与JSON Schema略有不同的方言 |

## 延伸阅读

- [OpenAI — 函数调用指南](https://platform.openai.com/docs/guides/function-calling) — 官方参考，包括严格模式和并行调用
- [Anthropic — 工具使用概览](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — `tool_use` 和 `tool_result` 块语义
- [Google — Gemini函数调用](https://ai.google.dev/gemini-api/docs/function-calling) — 并行调用、唯一ID和OpenAPI子集
- [Vertex AI — 函数调用参考](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) — Gemini的企业级接口
- [OpenAI — 结构化输出](https://platform.openai.com/docs/guides/structured-outputs) — 严格模式模式强制细节