# 并行工具调用与工具流式处理

> 三次独立的天气查询串行执行需要三次往返。将它们并行运行，总时间就会缩减为最慢单次调用的耗时。如今，每家前沿提供商都能在一次交互中发出多个工具调用。收益实实在在，但底层机制却十分微妙。本课程将涵盖两个方面：并行扇出（fan-out）和流式参数重组，重点强调 ID 关联陷阱。

**类型：** 构建
**语言：** Python（标准库、线程池 + 流式处理框架）
**前置知识：** 阶段 13 · 02（函数调用深入探讨）
**时长：** 约 75 分钟

## 学习目标

- 解释为什么存在 `parallel_tool_calls: true` 以及何时禁用。
- 在并行扇出期间，将流式参数块关联到正确的工具调用 ID。
- 将不完整的 `arguments` 字符串重组为完整的 JSON，而不提前解析。
- 运行一个三城市天气基准测试，演示串行与并行延迟。

## 问题

如果没有并行调用，一个回答“班加罗尔、东京和苏黎世的天气如何”的智能体将会这样处理：

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

三次 LLM 往返，每次还需要支付执行器延迟。大约是理想挂钟时间的四倍。

使用并行调用：

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

一次 LLM 往返。执行器时间是最长的那一个，而不是总和。在 OpenAI、Anthropic 和 Gemini 上的生产基准测试显示，在扇出工作负载下，挂钟时间减少了 60% 到 70%。

代价是关联复杂性。当三个调用无序完成时，你的结果必须携带匹配的 `tool_call_id`，以便模型可以对齐它们。当结果流式传输时，你必须在执行之前将不完整的参数片段组装成完整的 JSON。Gemini 3 增加了唯一 ID，部分原因是为了解决一个实际问题：两个指向相同工具的并行调用变得无法区分。

## 概念

### 启用并行

- **OpenAI.** `parallel_tool_calls: true` 默认开启。设置为 `false` 强制串行。
- **Anthropic.** 通过 `disable_parallel_tool_use: false`（Claude 3.5 及以上版本默认开启）实现并行。设置为 `true` 用于串行。
- **Gemini.** 始终支持并行；`tool_config.function_calling_config.mode = "AUTO"` 让模型决定。

当工具存在顺序依赖（例如 `create_file` 然后 `write_file`）、一个调用的输出为另一个调用提供输入、或速率限制器无法处理扇出时，应禁用并行。

### ID 关联

模型发出的每个调用都有一个 `id`。主机返回的每个结果必须包含相同的 `id`。没有它，结果就会模糊不清。

- **OpenAI.** 每个工具角色（tool-role）消息上的 `tool_call_id`。
- **Anthropic.** 每个 `tool_result` 块上的 `tool_use_id`。
- **Gemini.** 每个 `functionResponse` 上的 `id`（Gemini 3 及以上版本；Gemini 2 按名称匹配，对于同名并行调用会失败）。

### 并发运行调用

主机在自己的线程、协程或远程工作者上运行每个调用的执行器。最简单的框架使用线程池；生产环境使用带有 `asyncio.gather` 或结构化并发的 asyncio。完成顺序不可预测 —— id 就是标识符。

一个常见错误：按调用列表顺序回复结果，而不是按完成顺序。这通常能工作，因为模型只关心 `tool_call_id`，但如果一个结果被丢弃或重复，无序提交会使调试更困难。建议按完成顺序回复，并带上显式 ID。

### 流式工具调用

当模型流式传输时，`arguments` 会分块到达。三个并行调用的三个独立的块流会在线路上交织。你需要为每个 ID 提供一个累加器。

各提供商的情况：

- **OpenAI.** 每个块是 `choices[0].delta.tool_calls[i].function.arguments`（部分字符串）。该块带有 `index`（在调用列表中的位置）。你按索引累加，在 `id` 首次出现时读取它，并在 `finish_reason = "tool_calls"` 时解析 JSON。
- **Anthropic.** 流事件是 `message_start`，然后每个类型为 `tool_use` 的块有一个 `content_block_start`（包含 id、name、empty input）。`content_block_delta` 事件携带 `input_json_delta` 块。`content_block_stop` 关闭每个块。
- **Gemini.** `streamFunctionCallArguments`（Gemini 3 及以上版本）会发出带有 `functionCallId` 的块，以便调用可以干净地交织。在 Gemini 3 之前，流式传输一次返回一个完整的调用。

### 部分 JSON 和过早解析陷阱

在 `arguments` 完成之前，你无法解析它。部分 JSON（如 `{"city": "Beng`）不是有效的，会引发异常。正确的门控是提供商的调用结束信号：OpenAI 的 `finish_reason = "tool_calls"`、Anthropic 的 `content_block_stop`、或 Gemini 的流结束事件。只有在那时才能尝试 `json.loads`。一种更稳健的方法使用增量 JSON 解析器，它在结构完成时产生事件；OpenAI 的流式指南推荐这种方法用于显示实时“思考”指示器的用户体验。计数花括号作为完整性测试不可靠（字符串内或转义内容中的花括号会导致误报），只应作为非正式的调试启发式方法。

### 无序完成

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

主机回复仍然必须引用 id：

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

回复中的顺序对 OpenAI 或 Anthropic 的正确性没有影响。只要 id 匹配，Gemini 接受任何顺序。

### 基准测试：串行 vs 并行

`code/main.py` 中的框架模拟了三个执行器，延迟分别为 400、600 和 800 毫秒。串行运行总耗时 1800 毫秒。并行运行耗时 max(400, 600, 800) = 800 毫秒。差异是恒定的，不成比例，因此节省的时间随着工具数量增加而增加。

现实中的注意事项：并行调用会给下游 API 带来压力。对受速率限制的服务进行 10 路扇出会失败。阶段 13 · 17 涵盖了网关级别的背压；重试语义计划在未来的阶段中提供。

### 流式扇出挂钟时间

如果模型本身是流式的，你可以在一个调用的参数完成时立即开始执行，而不是等待所有调用完成。这是 OpenAI 文档中的一个优化，但并非所有 SDK 都公开。本课程的框架做到了这一点：一旦模拟流生成一个完整的参数对象，主机就启动该调用。

## 使用它

`code/main.py` 有两个部分。第一部分使用 `concurrent.futures.ThreadPoolExecutor` 模拟三个天气调用的串行和并行执行，并打印挂钟时间。第二部分重放一个伪造的流式响应 —— 三个并行调用的 `arguments` 块交织在一个流上 —— 并通过 `StreamAccumulator` 按 ID 重组。没有 LLM，没有网络，只有重组逻辑。

需要关注的内容：

- 串行定时器达到 1.8 秒。在相同的伪造延迟下，并行定时器达到 0.8 秒。
- 累加器通过按 ID 缓冲并仅在每个调用的 JSON 完成时解析来处理无序到达的块。
- 执行器在一个 ID 的参数完成后立即启动，而不是在所有流结束后。

## 交付

本课程生成 `outputs/skill-parallel-call-safety-check.md`。给定一个工具注册表，该技能会审计哪些工具可以安全并行化、哪些具有顺序依赖、以及哪些会压垮下游速率限制 —— 返回一个修订后的注册表，其中包含每个工具的 `parallel_safe` 标志。

## 练习

1. 运行 `code/main.py` 并改变模拟延迟。确认并行与串行的比率大约为 `max/sum`（由于线程调度、序列化和框架开销，实际运行会与理想值略有偏差）。在怎样的延迟分布下，并行不再重要？

2. 扩展累加器以处理“调用在流中途中取消”的情况：丢弃其缓冲区并发出 `cancelled` 事件。哪个提供商明确记录了这种情况？查看 Anthropic 的 `content_block_stop` 语义和 OpenAI 的 `finish_reason: "length"` 行为。

3. 将线程池替换为 `asyncio.gather`。对两者进行基准测试。由于上下文切换成本较低，你应该会看到异步方面的小优势，但前提是执行器确实执行了 I/O 操作。

4. 选择两个不应并行化的工具（例如 `create_file` 然后 `write_file`）。在注册表中添加一个 `ordering_dependency` 图，并在该图上对并行扇出进行门控。这是依赖感知调度所需的最小机制，未来的智能体工程阶段会将其形式化。

5. 阅读 OpenAI 的并行函数调用部分和 Anthropic 的 `disable_parallel_tool_use` 文档。找出 Anthropic 建议禁用并行性的一个真实世界工具类型。（提示：对同一资源进行导致后果的修改。）

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|----------|----------|
| 并行工具调用 (Parallel tool calls) | “一次交互中的扇出” | 模型在单个助手消息中发出多个工具调用 |
| `parallel_tool_calls` | “OpenAI 的标志” | 启用或禁用多调用发送 |
| `disable_parallel_tool_use` | “Anthropic 的反向标志” | 退出标志；默认启用并行 |
| 工具调用 ID (Tool call id) | “关联句柄” | 每个调用的标识符，结果消息必须回显 |
| 累加器 (Accumulator) | “流缓冲区” | 每个 ID 的字符串缓冲区，用于存放部分 `arguments` 块 |
| 无序完成 (Out-of-order completion) | “最快优先” | 并行调用以不可预测的顺序完成；id 是粘合剂 |
| 依赖图 (Dependency graph) | “顺序约束” | 输出作为其他工具输入的工具；无法并行化 |
| 过早解析陷阱 (Parse-early trap) | “JSON.parse 爆炸了” | 尝试解析不完整的 `arguments` 字符串 |
| `streamFunctionCallArguments` | “Gemini 3 特性” | 带唯一 ID 的流式参数块，每个调用一个 |
| 按完成顺序回复 (Completion-order reply) | “不要等待全部” | 结果到达时立即回复，按 id 键控 |

## 进一步阅读

- [OpenAI — 并行函数调用](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) — 默认行为和退出标志
- [Anthropic — 工具使用：实现工具使用](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implementing-tool-use) — `disable_parallel_tool_use` 和结果批处理
- [Google — Gemini 函数调用并行部分](https://ai.google.dev/gemini-api/docs/function-calling) — Gemini 3 中 ID 关联的并行调用
- [OpenAI — 带工具的流式响应](https://platform.openai.com/docs/api-reference/responses-streaming) — OpenAI 流的块参数重组
- [Anthropic — 流式消息](https://docs.anthropic.com/en/api/messages-streaming) — 带有 `input_json_delta` 的 `content_block_delta`