# 并行工具调用与流式工具调用

> 三个相互独立的天气查询串行执行就是三次往返。并行运行它们，总时间就会压缩为最慢的那一次调用。如今每家前沿提供商都能在单个回合中发出多个工具调用。收益是真实的，但底层管道细节微妙。本课讲解这两个方面：并行扇出和流式参数重组，重点讲解 id 关联陷阱。

**Type:** Build
**Languages:** Python（标准库、线程池 + 流式测试框架）
**Prerequisites:** Phase 13 · 02（函数调用深度解析）
**Time:** 约 75 分钟

## 学习目标

- 解释 `parallel_tool_calls: true` 为何存在，以及何时应禁用它。
- 在并行扇出期间，将流式传输的参数片段关联到正确的工具调用 id。
- 将不完整的 `arguments` 字符串重组为完整 JSON，而不过早解析。
- 运行一个三城市天气基准测试，展示串行与并行的延迟差异。

## 问题所在

在没有并行调用的情况下，一个回答"班加罗尔、东京和苏黎世的天气如何"的智能体会这样做：

```
user -> LLM
LLM -> call get_weather(Bengaluru)
host -> run executor, reply with result
LLM -> call get_weather(Tokyo)
host -> run executor, reply with result
LLM -> call get_weather(Zurich)
host -> run executor, reply with result
LLM -> final text answer
```

三次 LLM 往返，每次还要承担执行器的延迟。大约是理想总耗时（wall-clock time）的 4 倍。

使用并行调用时：

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

一次 LLM 往返。执行器时间是三者中的最大值，而非总和。在 OpenAI、Anthropic 和 Gemini 上的生产基准测试显示，扇出型工作负载的总耗时降低了 60% 到 70%。

代价是关联复杂度。当三个调用乱序完成时，你的结果必须携带匹配的 `tool_call_id`，以便模型将它们对应起来。当结果以流式传输时，你必须在执行之前将不完整的参数片段组装成完整 JSON。Gemini 3 引入唯一 id，部分原因就是为了解决一个真实问题：对同一工具的两个并行调用此前无法区分。

## 概念

### 启用并行

- **OpenAI.** `parallel_tool_calls: true` 默认开启。设置 `false` 可强制串行。
- **Anthropic.** 通过 `disable_parallel_tool_use: false` 实现并行（在 Claude 3.5 及以上版本默认开启）。设置 `true` 可切换为串行。
- **Gemini.** 始终支持并行；`tool_config.function_calling_config.mode = "AUTO"` 让模型自行决定。

当工具存在顺序依赖（先 `create_file` 后 `write_file`）、当一个调用的输出决定另一个调用的输入，或当速率限制器无法承受扇出时，应禁用并行。

### id 关联

模型发出的每个调用都有一个 `id`。宿主返回的每个结果都必须包含相同的 id。否则结果就会产生歧义。

- **OpenAI.** 每条 tool 角色消息上使用 `tool_call_id`。
- **Anthropic.** 每个 `tool_result` 块上使用 `tool_use_id`。
- **Gemini.** 每个 `functionResponse` 上使用 `id`（Gemini 3 及以上；Gemini 2 按名称匹配，这对同名并行调用是行不通的）。

### 并发运行调用

宿主在自己的线程、协程或远程工作进程上运行每个调用的执行器。最简单的测试框架使用线程池；生产环境则使用 asyncio 配合 `asyncio.gather` 或结构化并发。完成顺序不可预测——id 才是标识符。

一个常见 bug：按调用列表顺序而非完成顺序回复结果。这通常能正常工作，因为模型只关心 `tool_call_id`，但一旦某个结果丢失或重复，乱序提交会让调试变得更困难。建议按完成顺序携带显式 id 回复。

### 流式工具调用

当模型以流式传输时，`arguments` 会分片到达。三个并行调用的三路独立分片流会在线路上交错出现。你需要为每个 id 准备一个累加器。

按提供商区分的形态：

- **OpenAI.** 每个分片是 `choices[0].delta.tool_calls[i].function.arguments`（部分字符串）。分片携带 `index`（在调用列表中的位置）。你按索引累加，在 `id` 首次出现时读取它，并在 `finish_reason = "tool_calls"` 时解析 JSON。
- **Anthropic.** 流事件先是 `message_start`，然后每个块出现一个 `content_block_start`，类型为 `tool_use`（包含 id、name 和空 input）。`content_block_delta` 事件携带 `input_json_delta` 分片。`content_block_stop` 关闭每个块。
- **Gemini.** `streamFunctionCallArguments`（Gemini 3 及以上）发出带有 `functionCallId` 的分片，使调用可以干净地交错。在 Gemini 3 之前，流式传输每次只返回一个完整调用。

### 部分 JSON 与过早解析陷阱

在 `arguments` 完整之前你不能解析它。诸如 `{"city": "Beng` 这样的部分 JSON 是无效的，会抛出异常。正确的门槛是提供商的调用结束信号：OpenAI 的 `finish_reason = "tool_calls"`、Anthropic 的 `content_block_stop`，或 Gemini 的流结束事件。只有在那之后才应尝试 `json.loads`。更稳健的方法是使用增量式 JSON 解析器，在结构完成时产出事件；OpenAI 的流式传输指南在展示实时"思考中"指示器的 UX 场景中推荐这种做法。大括号计数作为完整性检测并不可靠（引号字符串或转义内容中的大括号会导致误报），只应作为非正式的调试启发式方法。

### 乱序完成

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

宿主的回复仍必须引用这些 id：

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

对 OpenAI 或 Anthropic 而言，回复中的顺序不影响正确性。Gemini 接受任意顺序，只要 id 匹配即可。

### 基准测试：串行 vs 并行

`code/main.py` 中的测试框架模拟了三个延迟分别为 400、600 和 800 毫秒的执行器。串行运行总耗时 1800 毫秒。并行运行耗时 max(400, 600, 800) = 800 毫秒。这个差值是固定的，而非成比例的，因此节省随工具数量增长。

现实中的注意事项：并行调用会给下游 API 带来压力。对一个有速率限制的服务进行 10 路扇出会失败。Phase 13 · 17 讲解网关级背压；重试语义计划在未来阶段讲解。

### 流式扇出的总耗时

如果模型本身在流式输出，你可以在一个调用的参数完整后就立即开始执行，而无需等待所有调用最终完成。这是 OpenAI 有文档说明的优化，但并非所有 SDK 都暴露它。本课的测试框架实现了这一点：一旦模拟流产出一个完整的参数对象，宿主就立即发起该调用。

```figure
tp-parallel-fanout
```

## 使用它

`code/main.py` 分为两部分。第一部分使用 `concurrent.futures.ThreadPoolExecutor` 依次以串行和并行方式运行三个模拟天气调用，并打印总耗时。第二部分回放一个伪造的流式响应——三个并行调用的 `arguments` 分片在一条流上交错——并使用 `StreamAccumulator` 按 id 重新组装它们。没有 LLM，没有网络，只有重组逻辑。

需要关注的地方：

- 串行计时达到 1.8 秒。并行计时在相同的伪造延迟下达到 0.8 秒。
- 累加器通过按 id 缓冲、且仅在每次调用的 JSON 完整时才解析，来处理乱序到达的分片。
- 执行器在某个 id 的参数最终完成后立即启动，而不是等所有流结束。

## 交付

本课产出 `outputs/skill-parallel-call-safety-check.md`。给定一个工具注册表，该技能会审计哪些工具可以安全并行化、哪些存在顺序依赖、哪些会压垮下游速率限制——并返回一个带有逐工具 `parallel_safe` 标志的修订后注册表。

## 练习

1. 运行 `code/main.py` 并调整模拟的延迟值。确认并行与串行的比值接近 `max/sum`（由于线程调度、序列化和测试框架的开销，实际运行会略微偏离理想值）。在怎样的延迟分布下并行就不再重要了？

2. 扩展累加器，处理"调用在流式传输中途被取消"的情况：丢弃其缓冲区并发出一个 `cancelled` 事件。哪家提供商明确记录了这种情况？查看 Anthropic 的 `content_block_stop` 语义和 OpenAI 的 `finish_reason: "length"` 行为。

3. 将线程池替换为 `asyncio.gather`。对两者进行基准测试。你应该会看到异步带来的小幅优势，因为上下文切换成本更低，但前提是执行器执行的是真实的 I/O。

4. 选出两个不应并行化的工具（例如先 `create_file` 后 `write_file`）。在注册表中添加一个 `ordering_dependency` 图，并基于该图对并行扇出进行门控。这是实现依赖感知调度所需的最小机制，未来的智能体工程阶段会将其规范化。

5. 阅读 OpenAI 的并行函数调用章节和 Anthropic 的 `disable_parallel_tool_use` 文档。找出 Anthropic 建议禁用并行的那一类真实工具类型。（提示：对同一资源的重大变更操作。）

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 并行工具调用 | "一个回合内扇出" | 模型在单条 assistant 消息中发出多个工具调用 |
| `parallel_tool_calls` | "OpenAI 的标志" | 启用或禁用多调用发出 |
| `disable_parallel_tool_use` | "Anthropic 的反向开关" | 选择退出标志；默认启用并行 |
| 工具调用 id | "关联句柄" | 结果消息必须回显的逐调用标识符 |
| 累加器 | "流缓冲区" | 用于部分 `arguments` 分片的逐 id 字符串缓冲区 |
| 乱序完成 | "最快者先到" | 并行调用以不可预测的顺序完成；id 是粘合剂 |
| 依赖图 | "顺序约束" | 输出会馈入其他工具输入的工具；无法并行化 |
| 过早解析陷阱 | "JSON.parse 炸了" | 尝试解析不完整的 `arguments` 字符串 |
| `streamFunctionCallArguments` | "Gemini 3 特性" | 带有逐调用唯一 id 的流式参数分片 |
| 按完成顺序回复 | "不等全部" | 结果一到就回复，以 id 为键 |

## 延伸阅读

- [OpenAI — 并行函数调用](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) — 默认行为与选择退出标志
- [Anthropic — 工具使用：实现工具使用](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implementing-tool-use) — `disable_parallel_tool_use` 与结果批量处理
- [Google — Gemini 函数调用并行章节](https://ai.google.dev/gemini-api/docs/function-calling) — 从 Gemini 3 开始的 id 关联并行调用
- [OpenAI — 流式响应与工具](https://platform.openai.com/docs/api-reference/responses-streaming) — OpenAI 流的分片参数重组
- [Anthropic — 流式消息](https://docs.anthropic.com/en/api/messages-streaming) — `content_block_delta` 配合 `input_json_delta`