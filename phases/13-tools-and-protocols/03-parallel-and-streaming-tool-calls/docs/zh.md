# 03 · 并行工具调用与工具流式传输

> 三次相互独立的天气查询如果串行执行，就是三次往返。把它们并行跑，总耗时就坍缩到最慢那一次调用的时间。如今每家前沿模型提供商都能在单轮中发出多个工具调用。收益是实打实的；但其中的管线细节很微妙。本课同时讲透两个部分：并行扇出（fan-out）与流式参数的重组，并重点剖析 id 关联（id-correlation）这个陷阱。

**类型：** 构建
**语言：** Python（标准库、线程池 + 流式处理框架）
**前置：** 第 13 阶段 · 02（函数调用深入）
**时长：** 约 75 分钟

## 学习目标

- 解释 `parallel_tool_calls: true` 为何存在，以及何时应当禁用它。
- 在并行扇出过程中，把流式到达的参数分片关联到正确的工具调用 id 上。
- 把零散的 `arguments` 字符串重组为完整 JSON，且不要过早解析。
- 跑一个三城市天气基准测试，演示串行与并行的延迟差异。

## 问题所在

如果没有并行调用，一个智能体在回答「Bengaluru、Tokyo、Zurich 三地的天气如何」时，会这样做：

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

三次 LLM 往返，每一次还要再叠加执行器（executor）的延迟。大约是理想墙钟时间（wall-clock time）的 4 倍。

有了并行调用：

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

只有一次 LLM 往返。执行器的耗时取三者中的最大值，而非总和。OpenAI、Anthropic 和 Gemini 上的生产环境基准测试显示，扇出型工作负载的墙钟时间可缩减 60% 到 70%。

代价是关联复杂度（correlation complexity）。当三个调用以乱序完成时，你的结果必须携带匹配的 `tool_call_id`，模型才能把它们对上号。当结果以流式返回时，你必须在执行前把零散的参数片段拼装成完整 JSON。Gemini 3 引入唯一 id，部分原因正是为了解决一个真实问题：对同一工具发起的两个并行调用此前无法区分。

## 核心概念

### 启用并行

- **OpenAI。** `parallel_tool_calls: true` 默认开启。设为 `false` 可强制串行。
- **Anthropic。** 通过 `disable_parallel_tool_use: false` 启用并行（Claude 3.5 及以上默认开启）。设为 `true` 即串行。
- **Gemini。** 始终具备并行能力；`tool_config.function_calling_config.mode = "AUTO"` 让模型自行决定。

在以下情况禁用并行：工具间存在顺序依赖（先 `create_file` 再 `write_file`）、一个调用的输出会作为另一个调用的输入、或限流器（rate limiter）无法承受扇出。

### id 关联

模型发出的每个调用都带有一个 `id`。host 返回的每个结果都必须包含相同的 id。否则结果就会出现歧义。

- **OpenAI。** 每条 tool 角色消息上带 `tool_call_id`。
- **Anthropic。** 每个 `tool_result` 块上带 `tool_use_id`。
- **Gemini。** 每个 `functionResponse` 上带 `id`（Gemini 3 及以上；Gemini 2 是按名称匹配，这对同名的并行调用会失效）。

### 并发执行调用

host 在各自独立的线程、协程或远程 worker 上运行每个调用的执行器。最简单的处理框架使用线程池；生产环境则使用 asyncio，配合 `asyncio.gather` 或结构化并发（structured concurrency）。完成顺序不可预测——id 才是标识符。

一个常见的 bug：按调用列表顺序（而非完成顺序）回复结果。这通常也能正常工作，因为模型只关心 `tool_call_id`；但一旦某个结果被丢弃或重复，乱序提交会让调试更加困难。更可取的做法是按完成顺序、带显式 id 回复。

### 流式工具调用

当模型以流式输出时，`arguments` 是分片到达的。三个并行调用各自的分片流会在传输线路上交错（interleave）。你需要为每个 id 配一个累加器（accumulator）。

各提供商的数据形态：

- **OpenAI。** 每个分片是 `choices[0].delta.tool_calls[i].function.arguments`（部分字符串）。分片携带 `index`（在调用列表中的位置）。你按 index 累加，在 `id` 首次出现时读取它，并在 `finish_reason = "tool_calls"` 时解析 JSON。
- **Anthropic。** 流事件依次为 `message_start`，然后每个块对应一个 `content_block_start`，其 type 为 `tool_use`（包含 id、name、空的 input）。`content_block_delta` 事件携带 `input_json_delta` 分片。`content_block_stop` 关闭每个块。
- **Gemini。** `streamFunctionCallArguments`（Gemini 3 及以上）发出的分片带有 `functionCallId`，因此多个调用能干净地交错。在 Gemini 3 之前，流式输出每次只返回一个完整调用。

### 部分 JSON 与过早解析陷阱

在 `arguments` 完整之前，你不能解析它。形如 `{"city": "Beng` 的部分 JSON 是无效的，会抛出异常。正确的判定门槛是提供商的「调用结束」信号：OpenAI 的 `finish_reason = "tool_calls"`、Anthropic 的 `content_block_stop`，或 Gemini 的流结束事件。只有到那时才尝试 `json.loads`。更稳健的做法是使用增量式 JSON 解析器（incremental JSON parser），在结构逐步完成时产出事件；OpenAI 的流式指南推荐用它来实现展示实时「思考中」指示器的交互体验。靠数花括号（brace-counting）来判断完整性并不可靠（引号内的花括号或转义内容会造成误判），只能用作非正式的调试启发式手段。

### 乱序完成

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

host 的回复仍然必须标注各个 id：

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

在 OpenAI 或 Anthropic 上，回复中的顺序对正确性没有影响。Gemini 也接受任意顺序，只要 id 匹配即可。

### 基准测试：串行 vs 并行

`code/main.py` 中的处理框架模拟了三个执行器，延迟分别为 400、600、800 毫秒。串行执行总共耗时 1800 毫秒。并行执行耗时为 max(400, 600, 800) = 800 毫秒。这个差值是恒定的，而非按比例缩放，因此节省的时间会随工具数量增长。

现实中的注意事项：并行调用会给下游 API 带来压力。对一个受限流约束的服务做 10 路扇出，会直接失败。第 13 阶段 · 17 讲解网关级别的背压（backpressure）；重试语义计划在未来某个阶段讲解。

### 流式扇出的墙钟时间

如果模型本身就是流式输出的，你可以在某个调用的参数一完整就开始执行它，而不必等所有调用都收尾。这是 OpenAI 文档记载的一项优化，但并非所有 SDK 都开放了它。本课的处理框架就这么做：一旦模拟流产出一个完整的参数对象，host 就立即启动该调用。

## 上手实践

`code/main.py` 分为两部分。第一部分用 `concurrent.futures.ThreadPoolExecutor` 分别以串行和并行方式运行三个模拟天气调用，并打印墙钟时间。第二部分回放一个伪造的流式响应——三个并行调用的 `arguments` 分片在同一条流上交错——并用 `StreamAccumulator` 按 id 重组它们。没有 LLM、没有网络，纯粹就是重组逻辑。

需要关注的点：

- 串行计时器达到 1.8 秒。在同样的伪造延迟下，并行计时器达到 0.8 秒。
- 累加器通过按 id 缓冲、并仅在每个调用的 JSON 完整时才解析，来处理乱序到达的分片。
- 执行器在某个 id 的参数收尾后立即启动，而不是等所有流结束之后。

## 发布交付

本课产出 `outputs/skill-parallel-call-safety-check.md`。给定一个工具注册表（tool registry），该 skill 会审计哪些工具可以安全并行、哪些存在顺序依赖、哪些会压垮下游限流——并返回一份带有每个工具 `parallel_safe` 标志的修订后注册表。

## 练习

1. 运行 `code/main.py` 并改变模拟延迟。确认并行与串行的比值近似为 `max/sum`（实际运行会因线程调度、序列化和处理框架开销而略微偏离理想值）。在怎样的延迟分布下，并行就不再有意义了？

2. 扩展累加器以处理「调用在流中途被取消」的情况：丢弃其缓冲区并发出一个 `cancelled` 事件。哪家提供商明确记载了这种情况？查阅 Anthropic 的 `content_block_stop` 语义和 OpenAI 的 `finish_reason: "length"` 行为。

3. 用 `asyncio.gather` 替换线程池。对两者做基准测试。由于上下文切换成本更低，你应该能在异步上看到一点小幅优势，但前提是执行器执行的是真实 I/O。

4. 挑两个不应当并行化的工具（例如先 `create_file` 再 `write_file`）。给注册表添加一张 `ordering_dependency`（顺序依赖）图，并基于该图对并行扇出加以约束。这是依赖感知调度（dependency-aware scheduling）的最小化机制，未来某个智能体工程阶段会将其形式化。

5. 阅读 OpenAI 的并行函数调用章节和 Anthropic 的 `disable_parallel_tool_use` 文档。指出 Anthropic 建议禁用并行的那一类真实工具类型。（提示：对同一资源进行有后果的变更。）

## 关键术语

| 术语 | 人们常说 | 它的真正含义 |
|------|----------------|------------------------|
| 并行工具调用（Parallel tool calls） | 「单轮扇出」 | 模型在单条 assistant 消息中发出多个工具调用 |
| `parallel_tool_calls` | 「OpenAI 的开关」 | 启用或禁用多调用发出 |
| `disable_parallel_tool_use` | 「Anthropic 的反向开关」 | 退出（opt-out）标志；默认启用并行 |
| 工具调用 id（Tool call id） | 「关联句柄」 | 每个调用的标识符，结果消息必须回传它 |
| 累加器（Accumulator） | 「流缓冲区」 | 用于缓存部分 `arguments` 分片的按 id 字符串缓冲区 |
| 乱序完成（Out-of-order completion） | 「快的先到」 | 并行调用以不可预测的顺序完成；id 是黏合剂 |
| 依赖图（Dependency graph） | 「顺序约束」 | 某些工具的输出会喂给其他工具的输入；不能并行化 |
| 过早解析陷阱（Parse-early trap） | 「JSON.parse 炸了」 | 试图解析一个不完整的 `arguments` 字符串 |
| `streamFunctionCallArguments` | 「Gemini 3 特性」 | 流式参数分片，每个调用带唯一 id |
| 按完成顺序回复（Completion-order reply） | 「别等所有调用」 | 结果一到就回复，并以 id 作为键 |

## 延伸阅读

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) —— 默认行为与退出开关
- [Anthropic — Tool use: implementing tool use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implementing-tool-use) —— `disable_parallel_tool_use` 与结果批处理
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling) —— 自 Gemini 3 起的 id 关联并行调用
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) —— OpenAI 流的分片参数重组
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) —— 带 `input_json_delta` 的 `content_block_delta`
