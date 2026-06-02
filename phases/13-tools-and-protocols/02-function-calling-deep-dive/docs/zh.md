# Function Calling 深入剖析 —— OpenAI、Anthropic、Gemini

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 三家前沿厂商在 2024 年不约而同地收敛到了同一种 tool-call 循环，然后在其它所有事情上又各自发散。OpenAI 用 `tools` 和 `tool_calls`。Anthropic 用 `tool_use` 和 `tool_result` 块。Gemini 用 `functionDeclarations`，并通过唯一 id 做关联。本课把三者并排做 diff，让一份在某家厂商上线的代码，移植到另外两家时不会炸。

**Type:** Build
**Languages:** Python（标准库 + schema 翻译器）
**Prerequisites:** Phase 13 · 01（tool 接口）
**Time:** ~75 分钟

## 学习目标（Learning Objectives）

- 说出 OpenAI、Anthropic、Gemini 三家在 function calling payload 上的三处形态差异（声明、调用、结果）。
- 把同一个 tool 声明翻译成三家的格式，并预判 strict 模式约束在哪里会出现差异。
- 在三家分别用 `tool_choice` 来强制、禁止、或自动选择 tool 调用。
- 知道每家的硬限制（tool 数量、schema 深度、参数长度），以及超限时各自会抛出怎样的错误特征。

## 问题（The Problem）

function calling 请求的形态是按厂商来的。三个来自 2026 年生产栈的真实例子：

**OpenAI Chat Completions / Responses API。** 你传 `tools: [{type: "function", function: {name, description, parameters, strict}}]`。模型的响应里是 `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`，其中 `arguments` 是一段 JSON 字符串，得自己 parse。strict 模式（`strict: true`）通过约束解码强制 schema 合规。

**Anthropic Messages API。** 你传 `tools: [{name, description, input_schema}]`。响应回来是 `content: [{type: "text"}, {type: "tool_use", id, name, input}]`。`input` 已经是 parse 好的对象，不是字符串。你需要回一条新的 `user` 消息，里面带一个 `{type: "tool_result", tool_use_id, content}` 块。

**Google Gemini API。** 你传 `tools: [{functionDeclarations: [{name, description, parameters}]}]`（嵌套在 `functionDeclarations` 下）。响应到达的形式是 `candidates[0].content.parts: [{functionCall: {name, args, id}}]`，其中 `id` 从 Gemini 3 开始保证唯一，用于并行调用的关联。你回的是 `{functionResponse: {name, id, response}}`。

同一个循环。字段名不同、嵌套不同、字符串/对象的约定不同、关联机制也不同。一个团队在 OpenAI 上写了一个天气 agent，移植到 Anthropic 要花两天，再移到 Gemini 又要一天，纯纯是水管工活。

本课会构建一个 translator，把三种格式统一成一份 canonical 的 tool 声明，然后在边界上做路由。Phase 13 · 17 会把同一个 pattern 推广成一个 LLM gateway。

## 概念（The Concept）

### 通用结构（The common structure）

每家厂商都需要五样东西：

1. **Tool 列表。** 每个 tool 的 name、description、input schema。
2. **Tool choice。** 强制某个 tool、禁止使用 tool，或者交给模型决定。
3. **Call 发射。** 结构化输出，里面写明 tool 名和参数。
4. **Call id。** 把响应关联到正确的调用上（在并行场景中很关键）。
5. **结果注入。** 用一条消息或一个块，把结果绑回到调用上。

### 形态 diff，逐字段对照（Shape diffs, field by field）

| 维度 | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| 声明外壳 | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Schema 字段 | `parameters` | `input_schema` | `parameters` |
| 响应容器 | assistant 消息上的 `tool_calls[]` | 类型为 `tool_use` 的 `content[]` | 类型为 `functionCall` 的 `parts[]` |
| 参数类型 | 字符串化 JSON | 已 parse 的对象 | 已 parse 的对象 |
| Id 格式 | `call_...`（OpenAI 生成） | `toolu_...`（Anthropic） | UUID（Gemini 3+） |
| 结果块 | role 为 `tool`，带 `tool_call_id` | `user` 消息里带 `tool_result`，带 `tool_use_id` | `functionResponse`，`id` 对应匹配 |
| 强制某个 tool | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| 禁用 tool | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| Strict schema | `strict: true` | schema 即合同（始终强制） | 请求级的 `responseSchema` |

### 你真的会撞到的限制（Limits you will actually hit）

- **OpenAI。** 单次请求 128 个 tool。Schema 深度 5。参数字符串 <= 8192 字节。Strict 模式要求不能用 `$ref`，不能用有重叠的 `oneOf`/`anyOf`/`allOf`，每个 property 都必须列在 `required` 里。
- **Anthropic。** 单次请求 64 个 tool。Schema 深度名义上没限制，但实际建议不超过 10。没有 strict 模式开关；schema 就是合同，模型基本会照办。
- **Gemini。** 单次请求 64 个 function。Schema 类型用的是 OpenAPI 3.0 的子集（与 JSON Schema 2020-12 略有偏差）。从 Gemini 3 开始并行调用支持唯一 id。

### `tool_choice` 行为（`tool_choice` behavior）

三种所有厂商都支持的模式，名字各不相同：

- **Auto。** 模型自选 tool 或文本。默认。
- **Required / Any。** 模型必须至少调用一个 tool。
- **None。** 模型不能调用 tool。

外加每家厂商各自独有的一种模式：

- **OpenAI。** 按名字强制某个具体 tool。
- **Anthropic。** 按名字强制某个具体 tool；`disable_parallel_tool_use` 开关用来切单调用 vs 多调用。
- **Gemini。** `mode: "VALIDATED"` 会把所有响应都过一遍 schema 校验器，无论模型本意如何。

### 并行调用（Parallel calls）

OpenAI 的 `parallel_tool_calls: true`（默认）会在一条 assistant 消息里发出多个调用。你把它们都跑掉，然后回一条批量的 tool-role 消息，里面每个 `tool_call_id` 一项。Anthropic 历史上是单调用；从 Claude 3.5 起 `disable_parallel_tool_use: false`（默认）启用了多调用。Gemini 2 允许并行调用但没给稳定的 id；Gemini 3 加了 UUID，让乱序响应也能干净地关联回去。

### 流式（Streaming）

三家都支持流式 tool 调用。线缆格式不同：

- **OpenAI。** `tool_calls[i].function.arguments` 的 delta chunk 增量到达。你一直拼，直到 `finish_reason: "tool_calls"`。
- **Anthropic。** 是 block-start / block-delta / block-stop 事件。`input_json_delta` chunk 携带部分参数。
- **Gemini。** `streamFunctionCallArguments`（Gemini 3 新增）发出的 chunk 带一个 `functionCallId`，让多个并行调用可以交错传输。

Phase 13 · 03 会深入并行 + 流式重组。本课聚焦在声明和单调用形态上。

### 错误与修复（Errors and repair）

参数非法时的报错也长得不一样：

- **OpenAI（非 strict）。** 模型返回 `arguments: "{bad json}"`，你 JSON parse 失败，注入一条错误消息然后重新调用。
- **OpenAI（strict）。** 校验在解码阶段就完成了；JSON 非法这件事在物理上不可能发生，但可能出现 `refusal`。
- **Anthropic。** `input` 里可能出现非预期字段；schema 是建议性的。请在服务端自行 validate。
- **Gemini。** OpenAPI 3.0 的怪癖：object 字段上的 `enum` 会被静默忽略；自己 validate。

### Translator 模式（The translator pattern）

你代码里 canonical 的 tool 声明长这样（形状你自己定）：

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

三个小函数把它翻译到三家厂商的形态。`code/main.py` 里的 harness 干的就是这件事，然后把一个伪造的 tool 调用在三家厂商的响应形态上各跑一遍 round-trip。不需要网络 —— 本课教的是形态，不是 HTTP。

生产团队会把这个 translator 包在 `AbstractToolset`（Pydantic AI）、`UniversalToolNode`（LangGraph）或 `BaseTool`（LlamaIndex）里。Phase 13 · 17 会发一个 gateway，前面挂一个 OpenAI 形态的 API，背后通到任意三家中的一家。

## 用起来（Use It）

`code/main.py` 定义了一个 canonical 的 `Tool` dataclass 和三个 translator，分别输出 OpenAI、Anthropic、Gemini 的声明 JSON。然后它会把一份手工构造的、各家形态的厂商响应，统一 parse 成同一个 canonical 调用对象，证明三家在皮肤底下的语义是完全一致的。跑一下，把三份声明并排 diff 看看。

重点看：

- 三段声明块只在外壳和字段名上有差别。
- 三段响应块的差别在 call 究竟住在哪里（顶层 `tool_calls`、`content[]` 块、`parts[]` 条目）。
- 一个 `canonical_call()` 函数从三种响应形态里提取出 `{id, name, args}`。

## 上线部署（Ship It）

本课产出 `outputs/skill-provider-portability-audit.md`。给定一个针对某家厂商的 function calling 集成，这个 skill 会输出一份可移植性审计：它依赖了哪家的限制、哪些字段需要重命名、移植到另两家时哪些会断。

## 练习（Exercises）

1. 跑一下 `code/main.py`，验证三家厂商的声明 JSON 序列化出来对应的是同一个底层 `Tool` 对象。改一改 canonical tool，加一个 enum 参数，确认只有 Gemini translator 需要处理 OpenAPI 的怪癖。

2. 为每家厂商添加一个 `ListToolsResponse` 的解析器，提取模型在 `list_tools` 或发现调用之后返回的 tool 列表。OpenAI 原生没有这个；记下这处不对称。

3. 实现 `tool_choice` 的转换：把一个 canonical 的 `ToolChoice(mode="force", tool_name="x")` 映射到三家厂商的形态。然后再做 `mode="any"` 和 `mode="none"`。对照本课的 diff 表。

4. 选三家厂商中的一家，把它的 function calling 指南从头读到尾。找一个它的 schema spec 里有、另外两家不支持的字段。候选：OpenAI 的 `strict`、Anthropic 的 `disable_parallel_tool_use`、Gemini 的 `function_calling_config.allowed_function_names`。

5. 写一份 test vector：一个参数违反所声明 schema 的 tool 调用。把它过一遍每家的校验器（Lesson 01 里的标准库版本可以当代理），记录哪些错误会被触发。写下你在生产里会选哪家来追求严格性。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|------|----------------|------------------------|
| Function calling | "Tool use" | 厂商级别的 API，用于发射结构化 tool 调用 |
| Tool 声明 | "Tool spec" | name + description + JSON Schema 输入 payload |
| `tool_choice` | "Force / forbid" | Auto / required / none / 指定 tool 名 四种模式 |
| Strict 模式 | "Schema 强制" | OpenAI 的开关，将解码约束到符合 schema |
| `tool_use` 块 | "Anthropic 的调用形态" | 内联 content 块，含 id、name、input |
| `functionCall` part | "Gemini 的调用形态" | 一个 `parts[]` 条目，含 name、args、id |
| 参数即字符串 | "字符串化 JSON" | OpenAI 把参数作为 JSON 字符串而非对象返回 |
| 并行 tool 调用 | "一个 turn 里 fan-out" | 一条 assistant 消息里多个 tool 调用 |
| Refusal | "模型拒绝" | strict 模式独有的拒绝块，替代调用 |
| OpenAPI 3.0 子集 | "Gemini 的 schema 怪癖" | Gemini 用的是类 JSON Schema 方言，有些细微差异 |

## 延伸阅读（Further Reading）

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) —— 官方权威参考，含 strict 模式与并行调用
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) —— `tool_use` 与 `tool_result` 块的语义
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) —— 并行调用、唯一 id、OpenAPI 子集
- [Vertex AI — Function calling reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) —— Gemini 的企业端
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) —— strict 模式 schema 强制的细节
