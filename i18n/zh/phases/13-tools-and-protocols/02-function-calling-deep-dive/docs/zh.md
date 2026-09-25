# Function Calling 深度解析 — OpenAI、Anthropic、Gemini

> 三家前沿厂商在 2024 年收敛到了相同的工具调用循环，随后在其他方面各自分化。OpenAI 使用 `tools` 和 `tool_calls`。Anthropic 使用 `tool_use` 和 `tool_result` 块。Gemini 使用 `functionDeclarations` 和唯一 id 关联。本课并排对比三者，确保在一个厂商上跑通的代码在迁移时不会出错。

**Type:** Build
**Languages:** Python（标准库、schema 转换器）
**Prerequisites:** Phase 13 · 01（工具接口）
**Time:** 约 75 分钟

## 学习目标

- 说出 OpenAI、Anthropic 和 Gemini function-calling 载荷之间的三个结构差异（声明、调用、结果）。
- 将一个工具声明翻译到全部三种厂商格式，并预测 strict 模式约束在何处会有差异。
- 在每个厂商中使用 `tool_choice` 来强制、禁止或自动选择工具调用。
- 了解各厂商的硬性限制（工具数量、schema 深度、参数长度），以及超出限制时各自抛出的错误签名。

## 问题所在

function-calling 请求的结构因厂商而异。三个来自 2026 年生产栈的具体示例：

**OpenAI Chat Completions / Responses API。** 你传入 `tools: [{type: "function", function: {name, description, parameters, strict}}]`。模型的响应包含 `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`，其中 `arguments` 是你必须自行解析的 JSON 字符串。Strict 模式（`strict: true`）通过受限解码强制符合 schema。

**Anthropic Messages API。** 你传入 `tools: [{name, description, input_schema}]`。响应以 `content: [{type: "text"}, {type: "tool_use", id, name, input}]` 形式返回。`input` 已经是解析好的（是对象，不是字符串）。你回复一条新的 `user` 消息，其中包含一个 `{type: "tool_result", tool_use_id, content}` 块。

**Google Gemini API。** 你传入 `tools: [{functionDeclarations: [{name, description, parameters}]}]`（嵌套在 `functionDeclarations` 下）。响应以 `candidates[0].content.parts: [{functionCall: {name, args, id}}]` 形式到达，其中 `id` 在 Gemini 3 及以上版本中是唯一的，用于并行调用关联。你回复 `{functionResponse: {name, id, response}}`。

相同的循环。不同的字段名、不同的嵌套、不同的字符串 vs 对象约定、不同的关联机制。一个在 OpenAI 上编写天气 agent 的团队，仅管道代码的迁移就要为移植到 Anthropic 花两天，再花一天移植到 Gemini。

本课构建一个转换器，将三种格式统一为一种规范的工具声明，并在边缘进行路由。Phase 13 · 17 将同一模式泛化为 LLM 网关。

## 概念

### 共同结构

每个厂商都需要五样东西：

1. **工具列表。** 每个工具的名称、描述和输入 schema。
2. **工具选择。** 强制特定工具、禁止工具，或让模型自行决定。
3. **调用发出。** 命名工具和参数的结构化输出。
4. **调用 id。** 将响应关联到正确的调用（并行场景下很重要）。
5. **结果注入。** 将结果绑定回调用的消息或块。

### 逐字段的结构差异

| 方面 | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| 声明信封 | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Schema 字段 | `parameters` | `input_schema` | `parameters` |
| 响应容器 | assistant 消息上的 `tool_calls[]` | 类型为 `tool_use` 的 `content[]` | 类型为 `functionCall` 的 `parts[]` |
| 参数类型 | 字符串化的 JSON | 解析后的对象 | 解析后的对象 |
| Id 格式 | `call_...`（OpenAI 生成） | `toolu_...`（Anthropic） | UUID（Gemini 3+） |
| 结果块 | role `tool`、`tool_call_id` | `user`，含 `tool_result` 和 `tool_use_id` | `functionResponse`，带匹配的 `id` |
| 强制工具 | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| 禁止工具 | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| Strict schema | `strict: true` | schema 即 schema（始终强制） | 请求级 `responseSchema` |

### 你实际会撞上的限制

- **OpenAI。** 每请求 128 个工具。Schema 深度为 5。参数字符串 <= 8192 字节。Strict 模式要求无 `$ref`、无重叠的 `oneOf`/`anyOf`/`allOf`、每个属性都列入 `required`。
- **Anthropic。** 每请求 64 个工具。Schema 深度实际无上限，但实用上限为 10。无 strict 模式标志；schema 是一份契约，模型倾向于遵守。
- **Gemini。** 每请求 64 个函数。Schema 类型是 OpenAPI 3.0 子集（与 JSON Schema 2020-12 略有分歧）。自 Gemini 3 起并行调用使用唯一 id。

### `tool_choice` 行为

三种人人支持的模式，只是命名不同。

- **Auto。** 模型自选工具或文本。默认值。
- **Required / Any。** 模型必须至少调用一个工具。
- **None。** 模型不得调用工具。

外加每个厂商各有一种独有模式：

- **OpenAI。** 按名称强制特定工具。
- **Anthropic。** 按名称强制特定工具；`disable_parallel_tool_use` 标志区分单次与多次。
- **Gemini。** `mode: "VALIDATED"` 无论模型意图如何，都让每个响应经过 schema 验证器。

### 并行调用

OpenAI 的 `parallel_tool_calls: true`（默认）在一条 assistant 消息中发出多个调用。你全部执行它们，然后用一条批量 tool-role 消息回复，其中每个 `tool_call_id` 对应一个条目。Anthropic 历史上只支持单调用；`disable_parallel_tool_use: false`（自 Claude 3.5 起为默认）启用了多调用。Gemini 2 允许并行调用但不提供稳定 id；Gemini 3 加入 UUID，使乱序响应能干净地关联。

### 流式传输

三家都支持流式工具调用。线格式不同：

- **OpenAI。** `tool_calls[i].function.arguments` 的 delta 块增量到达。你累积直到 `finish_reason: "tool_calls"`。
- **Anthropic。** block-start / block-delta / block-stop 事件。`input_json_delta` 块携带部分参数。
- **Gemini。** `streamFunctionCallArguments`（Gemini 3 新增）发出带 `functionCallId` 的块，使多个并行调用可以交错。

Phase 13 · 03 深入讲解并行 + 流式重组。本课聚焦于声明和单调用结构。

### 错误与修复

无效参数错误的样子也不相同。

- **OpenAI（非 strict）。** 模型返回 `arguments: "{bad json}"`，你的 JSON 解析失败，你注入一条错误消息并重新调用。
- **OpenAI（strict）。** 验证发生在解码期间；无效 JSON 不可能出现，但 `refusal` 可能出现。
- **Anthropic。** `input` 可能包含意外字段；schema 仅供参考。请在服务端验证。
- **Gemini。** OpenAPI 3.0 怪癖：对象字段上的 `enum` 会被静默忽略；需自行验证。

### 转换器模式

你代码中的规范工具声明形如（结构由你选择）：

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

三个小函数把它翻译成三种厂商结构。`code/main.py` 中的测试框架正是这样做的，然后让一个伪造的工具调用在每个厂商的响应结构中往返。无需网络——本课教的是结构，不是 HTTP。

生产团队会把此转换器封装进 `AbstractToolset`（Pydantic AI）、`UniversalToolNode`（LangGraph）或 `BaseTool`（LlamaIndex）。Phase 13 · 17 提供一个网关，在三者任一之前暴露 OpenAI 形状的 API。

```figure
function-call-args
```

## 动手使用

`code/main.py` 定义一个规范的 `Tool` dataclass，以及三个转换器，分别输出 OpenAI、Anthropic 和 Gemini 的声明 JSON。随后它把每种结构的手工构造厂商响应解析为同一个规范调用对象，证明表层之下语义完全一致。运行它，并排对比三份声明。

观察要点：

- 三份声明块仅在信封和字段名上不同。
- 三份响应块的区别在于调用所在的位置（顶层 `tool_calls`、`content[]` 块、`parts[]` 条目）。
- 一个 `canonical_call()` 函数从全部三种响应结构中提取 `{id, name, args}`。

## 上线交付

本课产出 `outputs/skill-provider-portability-audit.md`。给定针对某一厂商的 function-calling 集成，该技能产出一份可移植性审计：它依赖了哪些厂商限制、哪些字段需要重命名，以及移植到其余每个厂商时会有什么坏掉。

## 练习

1. 运行 `code/main.py`，验证三份厂商声明 JSON 都对同一个底层 `Tool` 对象进行了序列化。修改规范工具以添加一个 enum 参数，确认只有 Gemini 转换器需要处理 OpenAPI 怪癖。

2. 为每个厂商添加一个 `ListToolsResponse` 解析器，提取模型在 `list_tools` 或发现调用之后返回的工具列表。OpenAI 原生没有这个功能；请记录这一不对称性。

3. 实现 `tool_choice` 转换：把规范的 `ToolChoice(mode="force", tool_name="x")` 映射到全部三种厂商结构。然后映射 `mode="any"` 和 `mode="none"`。对照本课的差异表检查。

4. 三家厂商中选一家，从头到尾阅读其 function-calling 指南。找出其 schema 规范中其他两家不支持的一个字段。候选：OpenAI `strict`、Anthropic `disable_parallel_tool_use`、Gemini `function_calling_config.allowed_function_names`。

5. 编写一个测试向量：一个参数违反所声明 schema 的工具调用。用每个厂商的验证器（可用第 01 课中的标准库验证器作为替身）运行它，并记录哪些错误被触发。记录在生产中为了严格性你会选用哪家厂商。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Function calling | "Tool use" | 厂商级的结构化工具调用发出 API |
| 工具声明 | "Tool spec" | 名称 + 描述 + JSON Schema 输入载荷 |
| `tool_choice` | "Force / forbid" | Auto / required / none / 特定名称模式 |
| Strict 模式 | "Schema enforcement" | OpenAI 的标志，约束解码以匹配 schema |
| `tool_use` 块 | "Anthropic 的调用结构" | 带 id、name、input 的内联内容块 |
| `functionCall` part | "Gemini 的调用结构" | 一个 `parts[]` 条目，包含 name、args 和 id |
| 字符串形式参数 | "Stringified JSON" | OpenAI 将参数作为 JSON 字符串而非对象返回 |
| 并行工具调用 | "单轮扇出" | 一条 assistant 消息中的多个工具调用 |
| Refusal | "模型拒绝" | 仅 strict 模式下出现的 refusal 块，代替调用 |
| OpenAPI 3.0 子集 | "Gemini schema 怪癖" | Gemini 使用类 JSON Schema 的方言，存在细微差异 |

## 延伸阅读

- [OpenAI — Function calling 指南](https://platform.openai.com/docs/guides/function-calling) — 权威参考，包含 strict 模式与并行调用
- [Anthropic — Tool use 概览](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — `tool_use` 与 `tool_result` 块语义
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) — 并行调用、唯一 id 与 OpenAPI 子集
- [Vertex AI — Function calling 参考](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) — Gemini 的企业级接口
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) — strict 模式 schema 强制的细节