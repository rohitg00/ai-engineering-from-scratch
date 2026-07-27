# 并行工具调用与流式工具调用

> 三次独立天气查询串行执行需要三次往返。将它们并行运行，总时间将缩减为最慢的单次调用时间。每家前沿提供商现在都能在一次交互中发出多个工具调用。收益是真实的，但底层机制颇为微妙。本节课将讲解两个方面：并行扇出与流式参数重组，重点强调 ID 关联陷阱。

**类型：** 构建
**语言：** Python（标准库，线程池 + 流式处理框架）
**前置条件：** 阶段 13 · 02（函数调用深入探究）
**预计用时：** ~75 分钟

## 学习目标

- 解释 `parallel_tool_calls: true` 为何存在以及何时应禁用它。
- 在并行扇出期间，将流式参数块关联到正确的工具调用 ID。
- 将不完整的 `arguments` 字符串重组为完整的 JSON，避免过早解析。
- 运行一个三城市天气基准测试，展示串行与并行的延迟对比。

## 问题

没有并行调用时，一个回答"班加罗尔、东京和苏黎世的天气如何？"的智能体是这样工作的：

```
用户 -> LLM
LLM -> 调用 get_weather(班加罗尔)
主机 -> 运行执行器，返回结果
LLM -> 调用 get_weather(东京)
主机 -> 运行执行器，返回结果
LLM -> 调用 get_weather(苏黎世)
主机 -> 运行执行器，返回结果
LLM -> 最终文本回答
```

三次 LLM 往返，每次还要承担执行器延迟。大致是理想挂钟时间的 4 倍。

有了并行调用：

```
用户 -> LLM
LLM -> 调用 get_weather(班加罗尔)；调用 get_weather(东京)；调用 get_weather(苏黎世)
主机 -> 同时运行三个执行器，返回三个结果
LLM -> 最终文本回答
```

一次 LLM 往返。执行器时间是三者中的最大值，而非总和。在 OpenAI、Anthropic 和 Gemini 上的生产基准测试表明，扇出工作负载的挂钟时间减少了 60% 到 70%。

代价是关联复杂性。当三个调用以乱序完成时，你的结果必须携带匹配的 `tool_call_id`，以便模型正确配对。当结果流式传输时，你必须在执行前将不完整的参数片段组装成完整的 JSON。Gemini 3 增加了唯一 ID，部分原因就是为了解决指向同一工具的两个并行调用无法区分这一实际问题。

## 概念

### 启用并行

- **OpenAI。** `parallel_tool_calls: true` 默认开启。设为 `false` 强制串行。
- **Anthropic。** 通过 `disable_parallel_tool_use: false` 启用并行（Claude 3.5 及以上版本默认）。设为 `true` 强制串行。
- **Gemini。** 始终支持并行；`tool_config.function_calling_config.mode = "AUTO"` 让模型自行决定。

当工具存在顺序依赖（先 `create_file` 再 `write_file`）、一个调用的输出影响另一个调用的输入、或速率限制器无法处理扇出时，应禁用并行。

### ID 关联

模型发出的每个调用都有一个 `id`。主机返回的每个结果必须包含相同的 `id`。没有这一点，结果将是歧义的。

- **OpenAI。** 每个工具角色消息上的 `tool_call_id`。
- **Anthropic。** 每个 `tool_result` 块中的 `tool_use_id`。
- **Gemini。** 每个 `functionResponse` 上的 `id`（Gemini 3 及以上版本；Gemini 2 按名称匹配，这在同名并行调用时会出现问题）。

### 并发运行调用

主机将每个调用的执行器运行在其自己的线程、协程或远程工作器上。最简单的框架使用线程池；生产环境使用带 `asyncio.gather` 的 asyncio 或结构化并发。完成顺序是不可预测的——ID 才是标识符。

一个常见错误：按调用列表顺序而不是完成顺序返回结果。这通常也能工作，因为模型只关心 `tool_call_id`，但如果结果被丢弃或重复，乱序提交会使调试更加困难。建议按完成顺序返回结果并明确标注 ID。

### 流式工具调用

当模型流式输出时，`arguments` 会分片到达。三个并行调用的三个独立流式块会在传输中交错。你需要为每个 ID 维护一个累加器。

各提供商的情况：

- **OpenAI。** 每个数据块为 `choices[0].delta.tool_calls[i].function.arguments`（部分字符串）。数据块带有 `index`（调用列表中的位置）。你按索引累加，在 `id` 首次出现时读取它，并在 `finish_reason = "tool_calls"` 时解析 JSON。
- **Anthropic。** 流事件为 `message_start`，然后是每个类型为 `tool_use` 的块的 `content_block_start`（包含 id、name、空 input）。`content_block_delta` 事件携带 `input_json_delta` 块。`content_block_stop` 关闭每个块。
- **Gemini。** `streamFunctionCallArguments`（Gemini 3 及以上版本）发出带有 `functionCallId` 的块，使调用之间能够干净地交错。在 Gemini 3 之前，流式一次返回一个完整的调用。

### 部分 JSON 与过早解析陷阱

在 `arguments` 完整之前，你不能对其执行解析。像 `{"city": "Beng` 这样的部分 JSON 是无效的，会引发异常。正确的门控条件是提供商的调用结束信号：OpenAI 的 `finish_reason = "tool_calls"`、Anthropic 的 `content_block_stop` 或 Gemini 的流结束事件。只有在那时才尝试 `json.loads`。更稳健的方法是使用增量 JSON 解析器，它在结构完成时产生事件；OpenAI 的流式指南推荐这种方法，用于显示实时"思考中"指示器的用户体验。花括号计数作为完整性检查是不可靠的（引号字符串或转义内容中的花括号会导致误报），仅应作为非正式的调试启发式方法。

### 乱序完成

```
call_A: 快速 API，先返回
call_B: 慢速 API，后返回
call_C: 中等速度 API，第三返回
```

主机回复仍需注明 ID：

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

回复中的顺序在 OpenAI 或 Anthropic 上不影响正确性。只要 ID 匹配，Gemini 接受任何顺序。

### 基准测试：串行 vs 并行

`code/main.py` 中的框架模拟了三个执行器，延迟分别为 400、600 和 800 毫秒。串行运行总耗时 1800 毫秒。并行运行耗时 max(400, 600, 800) = 800 毫秒。这种差异是恒定的，而非比例的，因此节省的时间随工具数量增加而增加。

实际注意事项：并行调用会给下游 API 带来压力。向一个受速率限制的服务进行 10 路扇出将会失败。阶段 13 · 17 介绍网关层背压；重试语义计划在未来的阶段中涵盖。

### 流式扇出的挂钟时间

如果模型本身是流式输出的，你可以在某个调用的参数一旦完整时就开始执行，而不必等待所有调用完成。这是 OpenAI 文档中提及的一种优化，但并非所有 SDK 都暴露了这一点。本节课的框架实现了这一点：一旦模拟流产生了一个完整的参数对象，主机就启动该调用。

## 实际运用

`code/main.py` 包含两部分。第一部分使用 `concurrent.futures.ThreadPoolExecutor` 依次和并行运行三个模拟的天气调用，并打印挂钟时间。第二部分重放一个模拟的流式响应——三个并行调用的 `arguments` 块在一条流上交错排列——并通过 `StreamAccumulator` 按 ID 进行重组。没有 LLM，没有网络，只有重组逻辑。

值得关注的点：

- 串行计时器达到 1.8 秒。在相同的模拟延迟下，并行计时器达到 0.8 秒。
- 累加器通过按 ID 缓冲并在每个调用的 JSON 完整时才进行解析，来处理乱序到达的块。
- 执行器在某个 ID 的参数完成时立即启动，而不是等待所有流结束。

## 交付成果

本节课产出 `outputs/skill-parallel-call-safety-check.md`。给定一个工具注册表，该技能会审计哪些工具可以安全并行化、哪些存在顺序依赖、以及哪些会压垮下游速率限制——返回一个带有每个工具 `parallel_safe` 标志的修订版注册表。

## 练习

1. 运行 `code/main.py` 并改变模拟延迟。确认并行与串行的比率大约为 `max/sum`（由于线程调度、序列化和框架开销，实际运行与理想值略有偏差）。在什么样的延迟分布下，并行不再重要？

2. 扩展累加器，处理"调用在流式传输中途被取消"的情况：丢弃其缓冲区并发出一个 `cancelled` 事件。哪家提供商标明确记载了这种情况？请查阅 Anthropic 的 `content_block_stop` 语义和 OpenAI 的 `finish_reason: "length"` 行为。

3. 将线程池替换为 `asyncio.gather`。对两者进行基准测试。由于上下文切换成本较低，你应会看到异步方式有少量优势，但仅在执行器进行真实 I/O 操作时成立。

4. 选择两个不应并行化的工具（例如先 `create_file` 再 `write_file`）。向注册表添加一个 `ordering_dependency` 图，并在该图上对并行扇出进行门控。这是依赖感知调度的最小机制，未来的智能体工程阶段将对此进行形式化。

5. 阅读 OpenAI 的并行函数调用部分和 Anthropic 的 `disable_parallel_tool_use` 文档。找出 Anthropic 建议禁用并行性的那一种实际工具类型。（提示：对同一资源进行有副作用的变更。）

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|---------|---------|
| 并行工具调用 | "一次交互中的扇出" | 模型在单条助理消息中发出多个工具调用 |
| `parallel_tool_calls` | "OpenAI 的标志" | 启用或禁用的多重调用发出 |
| `disable_parallel_tool_use` | "Anthropic 的反向标志" | 选择性退出标志；默认启用并行 |
| 工具调用 ID | "关联句柄" | 结果消息必须回显的每次调用标识符 |
| 累加器 | "流缓冲区" | 用于存储不完整 `arguments` 块的按 ID 字符串缓冲区 |
| 乱序完成 | "最快先完成" | 并行调用以不可预测的顺序完成；ID 是粘合剂 |
| 依赖图 | "顺序约束" | 输出作为其他工具输入的工具；不能并行化 |
| 过早解析陷阱 | "JSON.parse 爆炸了" | 尝试解析不完整的 `arguments` 字符串 |
| `streamFunctionCallArguments` | "Gemini 3 特性" | 每个调用带有唯一 ID 的流式参数块 |
| 按完成顺序回复 | "不等全部完成" | 结果一到达就按 ID 键回复 |

## 延伸阅读

- [OpenAI — 并行函数调用](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) — 默认行为与选择性退出标志
- [Anthropic — 工具使用：实现工具使用](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implementing-tool-use) — `disable_parallel_tool_use` 与结果批处理
- [Google — Gemini 函数调用并行部分](https://ai.google.dev/gemini-api/docs/function-calling) — Gemini 3 起支持 ID 关联的并行调用
- [OpenAI — 带工具的流式响应](https://platform.openai.com/docs/api-reference/responses-streaming) — OpenAI 流的分块参数重组
- [Anthropic — 流式消息](https://docs.anthropic.com/en/api/messages-streaming) — 带有 `input_json_delta` 的 `content_block_delta`
