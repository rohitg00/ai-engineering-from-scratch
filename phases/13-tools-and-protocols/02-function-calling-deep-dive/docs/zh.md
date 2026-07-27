# 函数调用深度解析 — OpenAI、Anthropic、Gemini

> 三大前沿提供商在 2024 年趋于相同的工具调用循环，然后在其他方面分道扬镳。OpenAI 使用 `tools` 和 `tool_calls`。Anthropic 使用 `tool_use` 和 `tool_result` 块。Gemini 使用 `functionDeclarations` 和唯一 ID 关联。本课将三者并排对比，让你在某一提供商上运行的代码在移植时不会出错。

**类型：** 构建  
**语言：** Python（标准库、schema 转换器）  
**前置要求：** 阶段 13 · 01（工具接口）  
**时长：** ~75 分钟  

## 学习目标

- 陈述 OpenAI、Anthropic 和 Gemini 函数调用负载的三个形状差异（声明、调用、结果）。
- 将一个工具声明翻译成所有三种提供商的格式，并预测严格模式约束在哪些方面会有所不同。
- 在每个提供商中使用 `tool_choice` 来强制、禁止或自动选择工具调用。
- 了解每个提供商的硬限制（工具数量、schema 深度、参数长度）以及超出限制时各自抛出的错误特征。

## 问题

函数调用请求的形状因提供商而异。以下是 2026 年生产环境中的三个具体示例：

**OpenAI Chat Completions / Responses API。** 传入 `tools: [{type: "function", function: {name, description, parameters, strict}}]`。模型的响应包含 `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`，其中 `arguments` 是一个 JSON 字符串，你必须自行解析。严格模式（`strict: true`）通过受约束的解码来强制 schema 合规。

**Anthropic Messages API。** 传入 `tools: [{name, description, input_schema}]`。响应以 `content: [{type: "text"}, {type: "tool_use", id, name, input}]` 的形式返回。`input` 是已解析的对象（而非字符串）。你以一条新的 `user` 消息回复，其中包含一个 `{type: "tool_result", tool_use_id, content}` 块。

**Google Gemini API。** 传入 `tools: [{functionDeclarations: [{name, description, parameters}]}]`（嵌套在 `functionDeclarations` 下）。响应以 `candidates[0].content.parts: [{functionCall: {name, args, id}}]` 的形式到达，其中 `id` 在 Gemini 3 及以上版本中是唯一的，用于并行调用关联。你以 `{functionResponse: {name, id, response}}` 回复。

相同的循环。不同的字段名、不同的嵌套层级、不同的字符串与对象约定、不同的关联机制。一个在 OpenAI 上编写天气智能体的团队，仅仅为了管道适配就需要花费两天移植到 Anthropic，再加一天移植到 Gemini。

本课构建一个转换器，将三种格式统一为一种规范的工具声明，并在边缘进行路由。阶段 13 · 17 将相同模式泛化到 LLM 网关中。

## 核心概念

### 通用结构

每个提供商都需要五样东西：

1. **工具列表。** 每个工具的名称、描述和输入 schema。
2. **工具选择。** 强制使用特定工具、禁止工具或让模型自行决定。
3. **调用发射。** 结构化输出，包含工具名称和参数。
4. **调用 ID。** 将响应与正确的调用关联起来（对并行调用很重要）。
5. **结果注入。** 一条消息或一个块，将结果与调用关联起来。

### 逐字段的形状差异

| 方面 | OpenAI | Anthropic | Gemini |
|------|--------|-----------|--------|
| 声明信封 | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Schema 字段 | `parameters` | `input_schema` | `parameters` |
| 响应容器 | assistant 消息上的 `tool_calls[]` | `content[]` 中类型为 `tool_use` | `parts[]` 中类型为 `functionCall` |
| 参数类型 | 字符串化 JSON | 已解析对象 | 已解析对象 |
| ID 格式 | `call_...`（OpenAI 生成） | `toolu_...`（Anthropic） | UUID（Gemini 3+） |
| 结果块 | role 为 `tool`，`tool_call_id` | `user` 消息中包含 `tool_result`、`tool_use_id` | 带有匹配 `id` 的 `functionResponse` |
| 强制使用某个工具 | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| 禁止工具 | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| 严格 schema | `strict: true` | schema 即 schema（始终强制） | 请求级别的 `responseSchema` |

### 你真正会碰到的限制

- **OpenAI。** 每次请求最多 128 个工具。Schema 深度 5 层。参数字符串 <= 8192 字节。严格模式不允许 `$ref`、不允许有重叠的 `oneOf`/`anyOf`/`allOf`，每个属性必须列在 `required` 中。
- **Anthropic。** 每次请求最多 64 个工具。Schema 深度实际上无限制，但实用限制为 10 层。没有严格模式标志；schema 是一份契约，模型倾向于遵守。
- **Gemini。** 每次请求最多 64 个函数。Schema 类型是 OpenAPI 3.0 子集（与 JSON Schema 2020-12 略有差异）。自 Gemini 3 起支持带唯一 ID 的并行调用。

### `tool_choice` 行为

所有提供商都支持的三种模式，只是命名不同。

- **Auto（自动）。** 模型自行选择工具或文本回复。默认值。
- **Required / Any（必需/任意）。** 模型必须调用至少一个工具。
- **None（无）。** 模型不得调用工具。

此外，每个提供商还有其独有的一种模式：

- **OpenAI。** 按名称强制使用特定工具。
- **Anthropic。** 按名称强制使用特定工具；`disable_parallel_tool_use` 标志区分单次调用和多次调用。
- **Gemini。** `mode: "VALIDATED"` 使每次响应都通过 schema 验证器，无论模型意图如何。

### 并行调用

OpenAI 的 `parallel_tool_calls: true`（默认值）在一条 assistant 消息中发射多次调用。你可以全部执行，然后用一条批量的 tool 角色消息回复，其中每个 `tool_call_id` 对应一条记录。Anthropic 历史上只支持单次调用；`disable_parallel_tool_use: false`（自 Claude 3.5 起为默认值）启用了多调用。Gemini 2 允许并行调用但不提供稳定的 ID；Gemini 3 增加了 UUID，使乱序响应也能被正确关联。

### 流式传输

三者都支持流式工具调用。在线格式各不相同：

- **OpenAI。** `tool_calls[i].function.arguments` 的 delta 分块逐步到达。你持续累加，直到 `finish_reason: "tool_calls"`。
- **Anthropic。** block-start / block-delta / block-stop 事件。`input_json_delta` 分块携带部分参数。
- **Gemini。** `streamFunctionCallArguments`（Gemini 3 新增）发射带有 `functionCallId` 的分块，使多个并行调用可以交错传输。

阶段 13 · 03 深入探讨并行和流式重组。本课聚焦于声明和单次调用的形状。

### 错误与修复

无效参数错误的呈现方式也各不相同。

- **OpenAI（非严格模式）。** 模型返回 `arguments: "{bad json}"`，你的 JSON 解析失败，你可以注入一条错误消息并重新调用。
- **OpenAI（严格模式）。** 验证在解码期间进行；无效 JSON 不可能出现，但可能出现 `refusal`。
- **Anthropic。** `input` 可能包含意外字段；schema 仅作参考。建议在服务端进行验证。
- **Gemini。** OpenAPI 3.0 的怪癖：对象字段上的 `enum` 会被静默忽略；请自行验证。

### 转换器模式

你代码中的规范工具声明如下所示（你可以自行选择形状）：

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

三个小函数将其转换为三种提供商的形状。`code/main.py` 中的测试框架正是这样做的，然后通过每个提供商的响应形状进行一次模拟工具调用的往返测试。无需网络——本课教授的是形状，而非 HTTP。

生产团队将这个转换器包装在 `AbstractToolset`（Pydantic AI）、`UniversalToolNode`（LangGraph）或 `BaseTool`（LlamaIndex）中。阶段 13 · 17 提供了一个网关，在三种提供商中的任何一种前面暴露 OpenAI 形状的 API。

## 使用

`code/main.py` 定义了一个规范的 `Tool` 数据类以及三个转换器，分别发射 OpenAI、Anthropic 和 Gemini 的声明 JSON。然后，它将每个提供商的手工构造响应解析为相同的规范调用对象，证明语义本质上是一致的。运行它并将三种声明并排对比。

需要注意的事项：

- 三个声明块仅在信封和字段名上有所不同。
- 三个响应块的不同之处在于调用所在的位置（顶层 `tool_calls`、`content[]` 块、`parts[]` 条目）。
- 一个 `canonical_call()` 函数从所有三种响应形状中提取 `{id, name, args}`。

## 交付件

本课产出 `outputs/skill-provider-portability-audit.md`。给定一个针对某提供商的函数调用集成，该技能会生成一份可移植性审计报告：它依赖了哪些提供商限制、哪些字段需要重命名、以及移植到其他提供商时会出什么问题。

## 练习

1. 运行 `code/main.py`，验证三种提供商的声明 JSON 都能序列化同一个底层 `Tool` 对象。修改规范工具以添加一个枚举参数，确认只有 Gemini 转换器需要处理 OpenAPI 怪癖。

2. 为每个提供商添加一个 `ListToolsResponse` 解析器，提取模型在 `list_tools` 或发现调用后返回的工具列表。OpenAI 原生没有此功能；注意这种不对称性。

3. 实现 `tool_choice` 转换：将规范的 `ToolChoice(mode="force", tool_name="x")` 映射到三种提供商的形状。然后映射 `mode="any"` 和 `mode="none"`。对照本课的差异表进行检查。

4. 选择三个提供商之一，从头到尾阅读其函数调用指南。在其 schema 规范中找出其他两个提供商不支持的一个字段。候选：OpenAI 的 `strict`、Anthropic 的 `disable_parallel_tool_use`、Gemini 的 `function_calling_config.allowed_function_names`。

5. 编写一个测试向量：一个参数违反声明 schema 的工具调用。通过每个提供商的验证器（第 01 课的标准库验证器可以用作代理）运行它，记录哪些错误被触发。文档记录你会选择哪个提供商用于严格模式生产环境。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|----------|----------|
| Function calling | "工具使用" | 提供商级别的 API，用于结构化工具调用发射 |
| Tool declaration | "工具规格" | 名称 + 描述 + JSON Schema 输入负载 |
| `tool_choice` | "强制/禁止" | 自动 / 必需 / 无 / 特定名称模式 |
| Strict mode | "Schema 强制" | OpenAI 的标志，约束解码以匹配 schema |
| `tool_use` 块 | "Anthropic 的调用形状" | 内联内容块，包含 id、name、input |
| `functionCall` 部分 | "Gemini 的调用形状" | 包含 name、args 和 id 的 `parts[]` 条目 |
| Arguments-as-string | "字符串化 JSON" | OpenAI 将参数以 JSON 字符串而非对象形式返回 |
| Parallel tool calls | "一轮中的扇出" | 一条 assistant 消息中的多次工具调用 |
| Refusal | "模型拒绝" | 严格模式下的拒绝块，替代调用返回 |
| OpenAPI 3.0 子集 | "Gemini schema 怪癖" | Gemini 使用一种类似 JSON Schema 但略有差异的方言 |

## 延伸阅读

- [OpenAI — 函数调用指南](https://platform.openai.com/docs/guides/function-calling) — 包含严格模式和并行调用的权威参考
- [Anthropic — 工具使用概述](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — `tool_use` 和 `tool_result` 块语义
- [Google — Gemini 函数调用](https://ai.google.dev/gemini-api/docs/function-calling) — 并行调用、唯一 ID 和 OpenAPI 子集
- [Vertex AI — 函数调用参考](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) — Gemini 的企业级界面
- [OpenAI — 结构化输出](https://platform.openai.com/docs/guides/structured-outputs) — 严格模式 schema 强制细节
