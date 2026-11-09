# 调用深潜的功能 OpenAI,人类,双胞胎

> 在2024年,这三个边境供应商都在同一工具调用循环上汇聚,然后在其他方面分歧.`tools`其他`tool_calls`人类用品`tool_use`其他`tool_result`双胞胎使用`functionDeclarations`这一课将三个字符相对不同,以便在一个提供商上发送的代码在移植时不会破裂.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, schema translators)
**Prerequisites:** Phase 13 · 01 (the tool interface)
**Time:** ~75 minutes

## 学习目标

- 描述OpenAI,Anthropic和Gemini函数调用有效载荷 (声明,调用,结果) 之间的三个形状差异.
- 翻译一个工具声明在所有三个供应商格式中,并预测严格模式限制将在哪里不同.
- 使用`tool_choice`在每个提供商中强制,禁止或自动选择工具的呼叫.
- 了解每个提供商的硬度限制 (工具数量,方案深度,参数长度) 和每一个用户在违反限制时发出错误签名.

## 问题

要求调用函数的形状因供应商而异. 2026 年生产堆的三个具体例子:

**OpenAI Chat Completions / Responses API.**你通过了`tools: [{type: "function", function: {name, description, parameters, strict}}]`模型的反应包含`choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`在哪里`arguments`必须解析的 JSON 字符串.`strict: true`) 通过限制解码来强制执行方案的合规性.

**Anthropic Messages API.**你通过了`tools: [{name, description, input_schema}]`答案是:`content: [{type: "text"}, {type: "tool_use", id, name, input}]`现在,我们要去.`input`您用新的字符串回复`user`包含一个信息`{type: "tool_result", tool_use_id, content}`区块.

**Google Gemini API.**你通过了`tools: [{functionDeclarations: [{name, description, parameters}]}]`(在下面嵌`functionDeclarations`答案是`candidates[0].content.parts: [{functionCall: {name, args, id}}]`在哪里`id`双子座3级以上的通话相关性.`{functionResponse: {name, id, response}}`现在,我们要去.

另一组在OpenAI上写了一篇天气报道,为安特罗皮克支付了两天的港口,另一个天给双胞胎只为管道.

这一课程建立了一个翻译器,将三个格式统一成一个正规工具声明和边缘路线.

## 概念

### 共同结构

每个提供商都需要五件事:

1. **Tool list.**每个工具名称,描述和输入方案.
2. **Tool choice.**强迫一个特定的工具,禁止工具,或者让模型决定.
3. **Call emission.**结构化输出名称工具和参数.
4. **Call id.**相关答案与正确的呼叫 (对平行的情况).
5. **Result injection.**结果与电话联系的消息或封锁.

### 形状差异,场次

| Aspect | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| Declaration envelope | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Schema field | `parameters` | `input_schema` | `parameters` |
| Response container | `tool_calls[]` on assistant message | `content[]` of type `tool_use` | `parts[]` of type `functionCall` |
| Arguments type | stringified JSON | parsed object | parsed object |
| Id format | `call_...` (OpenAI generates) | `toolu_...` (Anthropic) | UUID (Gemini 3+) |
| Result block | role `tool`, `tool_call_id` | `user` with `tool_result`, `tool_use_id` | `functionResponse` with matching `id` |
| Force-a-tool | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| Forbid tools | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| Strict schema | `strict: true` | `strict: true` per tool (opt-in) | `responseSchema` at request level |

### 你会达到的极限

- **OpenAI.**参数字符串 <= 8192字节. 严格模式不需要 `$ref`没有`oneOf`现在,我们要去.`anyOf`现在,我们要去.`allOf`任何物件都在`required`现在,我们要去.
- **Anthropic.**系统深度实际上无限,但实际上是限制的.`strict: true`没有它,方案是模型倾向于遵循的合同,而不是保证.
- **Gemini.**根据要求,可执行 64 个函数. 方案类型是OpenAPI 3.0 子集 (与 JSON Schema 2020-12 略有差异).

### `tool_choice`行为

每个人都支持的三个模式,不同的名称.

- **Auto.**模型选择工具或文字.默认.
- **Required / Any.**模型必须至少调用一个工具.
- **None.**模型不能叫工具.

另外,每个提供商都有一个独特的模式:

- **OpenAI.**强迫一个特定的工具,以名字.
- **Anthropic.**强制使用一个特定的工具,以名字;`disable_parallel_tool_use`标志分开单个与多个.
- **Gemini.** `mode: "VALIDATED"`通过一个方案验证器,无论模型意图如何,将每个响应路由.

### 并行通话

开放AI的`parallel_tool_calls: true`您运行它们全部,并以包含每条条目的工具角色消息回复.`tool_call_id`历史上,人类一直在一次性呼叫.`disable_parallel_tool_use: false`双子座2允许并行调用,但没有提供稳定的ID;双子座3添加 UUID,因此异常响应与其相关.

### 流媒体

电话形式不同:

- **OpenAI.**的`tool_calls[i].function.arguments`它们会逐步到达,`finish_reason: "tool_calls"`现在,我们要去.
- **Anthropic.**阻塞启动/阻塞 delta/阻塞停止事件. `input_json_delta`部分部分的论点.
- **Gemini.** `streamFunctionCallArguments`它们是的.`functionCallId`为了让多个并行通话可以相互间歇.

第13期 · 03期深入研究并行+流动重组.本课程重点关注声明和单次调用形状.

### 错误和修复

无效论证错误也看起来不一样.

- **OpenAI (non-strict).**模型返回`arguments: "{bad json}"`如果您的JSON解析失败,您将注入一个错误信息,然后重新调用.
- **OpenAI (strict).**验证发生在解码过程中;不有效的JSON是不可能的,但 `refusal`现在,我们可以出现.
- **Anthropic (non-strict).** `input`系统的数据表可以包含意想不到的字段;该方案是建议的. 验证服务器侧.`strict: true`采样仅限于方案.
- **Gemini.**开放API 3.0 的特点:`enum`在被默默忽视的对象领域, 验证自己.

### 翻译模式

在你的代码中,一个可信工具声明是这样的 (你选择了形状):

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

它们可以将其转化为三种提供商形状.`code/main.py`没有网络需要这个课程教导了形状,而不是HTTP.

制作团队将这位翻译包装在`AbstractToolset`它们是的.`UniversalToolNode`其他国家`BaseTool`通过"LlamaIndex" (LlamaIndex) 实现了第13期的运输,

```figure
function-call-args
```

## 用它

`code/main.py`定义一个法典`Tool`通过数据类和三个翻译器发射OpenAI,Anthropic和Gemini声明JSON.然后它将每个形状的手工供应商响应解析到同一定性呼叫对象中,证明语义在皮肤下是相同的.运行它并对三个声明隔离.

什么要看:

- 声明区的三个区块仅因封面和字段名称而不同.
- 响应区分不同于电话的位置 (顶级级`tool_calls`现在`content[]`区块`parts[]`输入
- 一个`canonical_call()`功能摘录`{id, name, args}`通过所有三种反应形式.

## 运送它

这一课产生了`outputs/skill-provider-portability-audit.md`由于一个提供商的功能调用集成,技能产生了可移植性审计:哪个提供商限制其依赖,哪些领域需要更名,以及当转移到其他提供商时会发生什么断裂.

## 运动

1. 跑步`code/main.py`检查三个提供商声明JSON所有串行相同的基础`Tool`修改可行工具,增加一个enum参数,并确认只有双子翻译需要处理OpenAPI奇怪.

2. 添加一个`ListToolsResponse`分析器为每一个提供商,从工具列表中提取工具,模型在一个 `list_tools`开放AI没有一个本地;请注意这种不对称性.

3. 实施`tool_choice`转换:绘制一个法典`ToolChoice(mode="force", tool_name="x")`它们可以在三种形式中进行.`mode="any"`其他`mode="none"`检查课程的分数表.

4. 选择三个提供商之一,并阅读其函数调用指南. 在其方案规格中找到一个两个其他不支持的字段. 候选人:OpenAI `strict`人类学`disable_parallel_tool_use`双子座`function_calling_config.allowed_function_names`现在,我们要去.

5. 写一个测试向量:一个工具调用,其参数违反了声明的方案.通过每个提供商的验证器运行它 (课01中的stdlib将作为代理) 并记录哪些错误发生. 文件是哪个提供商将使用在生产中以确定严格性.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Function calling | "Tool use" | Provider-level API for structured tool-call emission |
| Tool declaration | "Tool spec" | Name + description + JSON Schema input payload |
| `tool_choice` | "Force / forbid" | Auto / required / none / specific-name modes |
| Strict mode | "Schema enforcement" | OpenAI flag that constrains decoding to match schema |
| `tool_use` block | "Anthropic's call shape" | Inline content block with id, name, input |
| `functionCall` part | "Gemini's call shape" | A `parts[]` entry containing name, args, and id |
| Arguments-as-string | "Stringified JSON" | OpenAI returns args as a JSON string, not an object |
| Parallel tool calls | "Fan-out in one turn" | Multiple tool calls in one assistant message |
| Refusal | "Model declines" | Strict-mode-only refusal block instead of a call |
| OpenAPI 3.0 subset | "Gemini schema quirk" | Gemini uses a JSON-Schema-like dialect with minor differences |

## 进一步阅读

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling)包括严格模式和并行调用的法典引用
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) `tool_use`其他`tool_result`区块语义
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling)并行调用,唯一的ID和OpenAPI子集
- [Vertex AI — Function calling reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling)双子座的企业表面
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs)严格模式方案执行细节
