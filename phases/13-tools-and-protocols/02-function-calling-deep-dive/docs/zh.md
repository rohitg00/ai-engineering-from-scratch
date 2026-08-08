# 02 · 函数调用深入剖析 —— OpenAI、Anthropic、Gemini

> 三家前沿厂商在 2024 年都收敛到了相同的工具调用循环，随后又在其余一切细节上各自分道扬镳。OpenAI 使用 `tools` 与 `tool_calls`。Anthropic 使用 `tool_use` 与 `tool_result` 块。Gemini 使用 `functionDeclarations` 与唯一 id 关联。本课把三者并排对照，让在某一家厂商上跑通的代码在移植到另一家时不会崩。

**类型：** 构建
**语言：** Python（标准库、schema 转换器）
**前置：** 阶段 13 · 01（工具接口）
**时长：** 约 75 分钟

## 学习目标

- 说清 OpenAI、Anthropic、Gemini 三种函数调用负载在「声明（declaration）」「调用（call）」「结果（result）」三处的形状差异。
- 把一条工具声明在三种厂商格式之间互相转换，并预判严格模式（strict mode）约束在何处会不同。
- 在每家厂商中使用 `tool_choice` 来强制、禁止或自动选择工具调用。
- 掌握每家厂商的硬性上限（工具数量、schema 深度、参数长度），以及触碰上限时各自抛出的错误特征。

## 问题所在

函数调用请求的形状因厂商而异。下面是来自 2026 年生产栈的三个具体例子：

**OpenAI Chat Completions / Responses API。** 你传入 `tools: [{type: "function", function: {name, description, parameters, strict}}]`。模型响应中包含 `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`，其中 `arguments` 是一个你必须自行解析的 JSON 字符串。严格模式（`strict: true`）通过约束解码（constrained decoding）强制 schema 合规。

**Anthropic Messages API。** 你传入 `tools: [{name, description, input_schema}]`。响应以 `content: [{type: "text"}, {type: "tool_use", id, name, input}]` 形式返回。`input` 已经解析完毕（是对象，不是字符串）。你用一条新的 `user` 消息回复，其中包含一个 `{type: "tool_result", tool_use_id, content}` 块。

**Google Gemini API。** 你传入 `tools: [{functionDeclarations: [{name, description, parameters}]}]`（嵌套在 `functionDeclarations` 之下）。响应以 `candidates[0].content.parts: [{functionCall: {name, args, id}}]` 形式返回，其中 `id` 在 Gemini 3 及以上版本中是唯一的，用于并行调用关联。你用 `{functionResponse: {name, id, response}}` 回复。

同一个循环。字段名不同、嵌套不同、字符串 vs 对象的约定不同、关联机制也不同。一个在 OpenAI 上写了天气智能体（agent）的团队，光是为了改这些管道，移植到 Anthropic 要花两天，再移植到 Gemini 又得多花一天。

本课构建一个转换器，把三种格式统一成一份规范化（canonical）的工具声明，并在边缘处做路由分发。阶段 13 · 17 会把同一模式推广为一个 LLM 网关。

## 核心概念

### 共有结构

每家厂商都需要五样东西：

1. **工具列表。** 每个工具的 name、description 和输入 schema。
2. **工具选择。** 强制某个特定工具、禁止使用工具，或让模型自行决定。
3. **调用发射。** 标明工具名与参数的结构化输出。
4. **调用 id。** 把响应关联到正确的调用上（在并行场景中很关键）。
5. **结果注入。** 一条把结果绑回到对应调用的消息或块。

### 逐字段的形状差异

| 维度 | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| 声明外壳 | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| schema 字段 | `parameters` | `input_schema` | `parameters` |
| 响应容器 | 助手消息上的 `tool_calls[]` | 类型为 `tool_use` 的 `content[]` | 类型为 `functionCall` 的 `parts[]` |
| 参数类型 | 字符串化 JSON | 已解析对象 | 已解析对象 |
| id 格式 | `call_...`（由 OpenAI 生成） | `toolu_...`（Anthropic） | UUID（Gemini 3+） |
| 结果块 | role 为 `tool`，带 `tool_call_id` | `user` 消息携带 `tool_result`，带 `tool_use_id` | `functionResponse` 携带匹配的 `id` |
| 强制某工具 | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| 禁止工具 | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| 严格 schema | `strict: true` | schema 即 schema（始终强制执行） | 请求级别的 `responseSchema` |

### 你真正会撞上的上限

- **OpenAI。** 每个请求 128 个工具。schema 深度 5。参数字符串 <= 8192 字节。严格模式要求：不得有 `$ref`，不得有相互重叠的 `oneOf`/`anyOf`/`allOf`，并且每个属性都必须列入 `required`。
- **Anthropic。** 每个请求 64 个工具。schema 深度实质上无上限，但实践极限约为 10。没有严格模式开关；schema 是一份契约，模型通常会遵守。
- **Gemini。** 每个请求 64 个函数。schema 类型是 OpenAPI 3.0 子集（与 JSON Schema 2020-12 略有出入）。自 Gemini 3 起并行调用带唯一 id。

### `tool_choice` 行为

人人都支持的三种模式，只是命名各异。

- **Auto。** 模型自行选择调用工具还是输出文本。默认。
- **Required / Any。** 模型必须至少调用一个工具。
- **None。** 模型不得调用工具。

外加每家厂商各自独有的一种模式：

- **OpenAI。** 按名称强制使用某个特定工具。
- **Anthropic。** 按名称强制使用某个特定工具；`disable_parallel_tool_use` 标志用于区分单次调用与多次调用。
- **Gemini。** `mode: "VALIDATED"` 会让每个响应无论模型意图如何都经过一个 schema 校验器。

### 并行调用

OpenAI 的 `parallel_tool_calls: true`（默认）会在一条助手消息中发射多个调用。你把它们全部执行，然后用一条批处理的 tool 角色消息回复，其中每个 `tool_call_id` 对应一个条目。Anthropic 历史上只做单次调用；`disable_parallel_tool_use: false`（自 Claude 3.5 起为默认）启用多次调用。Gemini 2 允许并行调用但不提供稳定的 id；Gemini 3 加入了 UUID，使乱序到达的响应也能干净地关联。

### 流式传输

三家都支持流式工具调用。线缆格式（wire format）有所不同：

- **OpenAI。** `tool_calls[i].function.arguments` 以增量的 delta 分块到达。你持续累积，直到 `finish_reason: "tool_calls"`。
- **Anthropic。** 采用 block-start / block-delta / block-stop 事件。`input_json_delta` 分块携带部分参数。
- **Gemini。** `streamFunctionCallArguments`（Gemini 3 新增）发射的分块带有 `functionCallId`，因此多个并行调用可以交错传输。

阶段 13 · 03 会深入讲解并行 + 流式重组。本课聚焦于声明与单次调用的形状。

### 错误与修复

无效参数错误的样子也各不相同。

- **OpenAI（非严格）。** 模型返回 `arguments: "{bad json}"`，你的 JSON 解析失败，于是你注入一条错误消息并重新调用。
- **OpenAI（严格）。** 校验在解码过程中发生；无效 JSON 不可能出现，但可能出现 `refusal`。
- **Anthropic。** `input` 可能包含意料之外的字段；schema 只是建议性的。请在服务端自行校验。
- **Gemini。** OpenAPI 3.0 的怪癖：对象字段上的 `enum` 会被静默忽略；请自行校验。

### 转换器模式

你代码中的一份规范化工具声明大致长这样（形状由你来定）：

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

三个小函数把它转换成三种厂商形状。`code/main.py` 中的脚手架正是这么做的，随后让一个伪造的工具调用在每家厂商的响应形状之间往返一遭。无需网络——本课教的是形状，不是 HTTP。

生产团队会把这个转换器包装进 `AbstractToolset`（Pydantic AI）、`UniversalToolNode`（LangGraph）或 `BaseTool`（LlamaIndex）。阶段 13 · 17 会交付一个网关，在三家中的任意一家之前暴露出一套 OpenAI 形状的 API。

## 动手用它

`code/main.py` 定义了一个规范化的 `Tool` 数据类，以及三个发射 OpenAI、Anthropic、Gemini 声明 JSON 的转换器。随后它把一个手工构造的、各种形状的厂商响应解析成同一个规范化调用对象，从而证明它们在表象之下语义完全一致。运行它，并把三种声明并排对照。

要关注什么：

- 三个声明块仅在外壳和字段名上有差异。
- 三个响应块的差异在于调用存放的位置（顶层 `tool_calls`、`content[]` 块、`parts[]` 条目）。
- 一个 `canonical_call()` 函数从所有三种响应形状中提取出 `{id, name, args}`。

## 交付它

本课产出 `outputs/skill-provider-portability-audit.md`。给定一个针对某一家厂商的函数调用集成，该技能会产出一份可移植性审计：它依赖了哪些厂商上限、哪些字段需要改名，以及移植到其他每家厂商时会有什么崩掉。

## 练习

1. 运行 `code/main.py`，验证三种厂商声明 JSON 都序列化自同一个底层 `Tool` 对象。修改规范化工具以添加一个 enum 参数，并确认只有 Gemini 转换器需要处理 OpenAPI 怪癖。

2. 为每家厂商添加一个 `ListToolsResponse` 解析器，用于提取模型在 `list_tools` 或发现调用之后返回的工具列表。OpenAI 原生没有这种机制；记录下这一不对称之处。

3. 实现 `tool_choice` 转换：把规范化的 `ToolChoice(mode="force", tool_name="x")` 映射成三种厂商形状。然后映射 `mode="any"` 和 `mode="none"`。对照本课的差异表。

4. 选三家厂商中的一家，把它的函数调用指南从头读到尾。找出其 schema 规范中一个另外两家不支持的字段。候选：OpenAI 的 `strict`、Anthropic 的 `disable_parallel_tool_use`、Gemini 的 `function_calling_config.allowed_function_names`。

5. 写一个测试向量：一个其参数违反所声明 schema 的工具调用。让它跑过每家厂商的校验器（用第 01 课中的标准库校验器作为代理即可），并记录下哪些错误被触发。说明你会在生产中使用哪家厂商来追求严格性。

## 关键术语

| 术语 | 人们怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| 函数调用（Function calling） | 「工具使用」 | 厂商层面用于结构化工具调用发射的 API |
| 工具声明（Tool declaration） | 「工具规格」 | name + description + JSON Schema 输入负载 |
| `tool_choice` | 「强制 / 禁止」 | Auto / required / none / 指定名称 这几种模式 |
| 严格模式（Strict mode） | 「schema 强制」 | OpenAI 的一个标志，约束解码以匹配 schema |
| `tool_use` 块 | 「Anthropic 的调用形状」 | 带 id、name、input 的内联内容块 |
| `functionCall` 部分 | 「Gemini 的调用形状」 | 一个包含 name、args、id 的 `parts[]` 条目 |
| 参数即字符串（Arguments-as-string） | 「字符串化 JSON」 | OpenAI 把参数作为 JSON 字符串返回，而非对象 |
| 并行工具调用（Parallel tool calls） | 「一轮内扇出」 | 一条助手消息中的多个工具调用 |
| 拒绝（Refusal） | 「模型推辞」 | 仅严格模式下出现的拒绝块，取代了调用 |
| OpenAPI 3.0 子集 | 「Gemini schema 怪癖」 | Gemini 使用一种类 JSON-Schema 方言，存在细微差异 |

## 延伸阅读

- [OpenAI —— 函数调用指南](https://platform.openai.com/docs/guides/function-calling) —— 权威参考，包含严格模式与并行调用
- [Anthropic —— 工具使用概览](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) —— `tool_use` 与 `tool_result` 块语义
- [Google —— Gemini 函数调用](https://ai.google.dev/gemini-api/docs/function-calling) —— 并行调用、唯一 id 与 OpenAPI 子集
- [Vertex AI —— 函数调用参考](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) —— Gemini 的企业级界面
- [OpenAI —— 结构化输出](https://platform.openai.com/docs/guides/structured-outputs) —— 严格模式 schema 强制的细节
