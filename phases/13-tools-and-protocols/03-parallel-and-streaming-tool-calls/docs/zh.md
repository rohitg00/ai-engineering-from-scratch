# 并行工具调用与流式工具调用

> 三个独立的天气查询串行执行就是三个往返。并行运行它们，总时间坍缩到最慢的单次调用。每个前沿提供商现在都能在一个回合中发出多个工具调用。收益是真实的；管道工程是微妙的。本课走过两半：并行扇出和流式参数重组，重点是 ID 关联陷阱。

**类型：** Build
**语言：** Python（stdlib，线程池 + 流式框架）
**前置知识：** Phase 13 · 02（函数调用深入解析）
**时间：** ~75 分钟

## 学习目标

- 解释 `parallel_tool_calls: true` 为何存在以及何时禁用它。
- 在并行扇出期间将流式参数块关联到正确的工具调用 ID。
- 将部分 `arguments` 字符串重组为完整 JSON，而不提前解析。
- 运行一个三城市天气基准测试，演示串行 vs 并行延迟。

## 问题所在

没有并行调用时，回答"班加罗尔、东京和苏黎世的天气如何"的代理这样做：

```
user -> LLM
LLM -> 调用 get_weather(Bengaluru)
host -> 运行执行器，回复结果
LLM -> 调用 get_weather(Tokyo)
host -> 运行执行器，回复结果
LLM -> 调用 get_weather(Zurich)
host -> 运行执行器，回复结果
LLM -> 最终文本答案
```

三次 LLM 往返，每次还要支付执行器延迟。大约是理想挂钟时间的 4 倍。

使用并行调用：

```
user -> LLM
LLM -> 调用 get_weather(Bengaluru)；调用 get_weather(Tokyo)；调用 get_weather(Zurich)
host -> 并发运行三个执行器，回复三个结果
LLM -> 最终文本答案
```

一次 LLM 往返。执行器时间是三个中的最大值，而非总和。OpenAI、Anthropic 和 Gemini 的生产基准测试显示，扇出工作负载的挂钟时间减少 60% 到 70%。

代价是关联复杂性。当三个调用无序完成时，你的结果必须携带匹配的 `tool_call_id`，以便模型将它们对齐。当结果流式传输时，你必须将部分参数片段组装成完整 JSON 才能执行。Gemini 3 添加唯一 ID 部分是为了解决一个现实世界问题：两次并行调用同一工具无法区分。

## 核心概念

### 启用并行

- **OpenAI。** `parallel_tool_calls: true` 默认开启。设为 `false` 强制串行。
- **Anthropic。** 通过 `disable_parallel_tool_use: false` 并行（Claude 3.5 及以上默认）。设为 `true` 串行。
- **Gemini。** 始终支持并行；`tool_config.function_calling_config.mode = "AUTO"` 让模型决定。

当工具有顺序依赖（`create_file` 然后 `write_file`）、当一个调用的输出告知另一个的输入、或当速率限制器无法处理扇出时，禁用并行。

### ID 关联

模型发出的每个调用都有一个 `id`。宿主返回的每个结果必须包含相同的 ID。没有此，结果不明确。

- **OpenAI。** 每个工具角色消息上的 `tool_call_id`。
- **Anthropic。** 每个 `tool_result` 块上的 `tool_use_id`。
- **Gemini。** 每个 `functionResponse` 上的 `id`（Gemini 3 及以上；Gemini 2 按名称匹配，同名并行调用时崩溃）。

### 并发运行调用

宿主在每个调用自己的线程、协程或远程工作者上运行执行器。最简单的框架使用线程池；生产使用 `asyncio.gather` 或结构化并发的 asyncio。完成顺序不可预测——ID 是标识符。

一个常见错误：按调用列表顺序而非完成顺序回复结果。这通常有效，因为模型只关心 `tool_call_id`，但如果结果丢失或重复，无序提交使调试更困难。优先按完成顺序显式 ID 回复。

### 流式工具调用

当模型流式传输时，`arguments` 分段到达。三个并行调用的三个独立流在线路上交错。你需要每个 ID 一个累加器。

按提供商的形状：

- **OpenAI。** 每个块是 `choices[0].delta.tool_calls[i].function.arguments`（部分字符串）。块携带 `index`（调用列表中的位置）。你按索引累积，首次出现时读取 `id`，在 `finish_reason = "tool_calls"` 时解析 JSON。
- **Anthropic。** 流事件是 `message_start`，然后每个块一个 `content_block_start`，类型为 `tool_use`（包含 id、name、空 input）。`content_block_delta` 事件携带 `input_json_delta` 块。`content_block_stop` 关闭每个块。
- **Gemini。** `streamFunctionCallArguments`（Gemini 3 及以上）发出带 `functionCallId` 的块，因此调用干净交错。Gemini 3 之前，流式传输一次返回一个完整调用。

### 部分 JSON 和提前解析陷阱

你不能在 `arguments` 完成前解析它。部分 JSON 如 `{"city": "Beng` 无效并会抛出。正确的门是提供商的调用结束信号：OpenAI 的 `finish_reason = "tool_calls"`、Anthropic 的 `content_block_stop` 或 Gemini 的流结束事件。只有那时才尝试 `json.loads`。更稳健的方法使用增量 JSON 解析器，在结构完成时产生事件；OpenAI 的流式指南推荐此用于显示实时"思考"指示器的 UX。大括号计数作为完整性测试不可靠（引号字符串内或转义内容中的大括号导致误报），只应作为非正式调试启发式使用。

### 无序完成

```
call_A: 快速 API，第一个返回
call_B: 慢速 API，第二个返回
call_C: 中速 API，第三个返回
```

宿主回复仍必须引用 ID：

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

回复中的顺序对 OpenAI 或 Anthropic 的正确性不重要。Gemini 接受任何顺序，只要 ID 匹配。

### 基准测试：串行 vs 并行

`code/main.py` 中的框架模拟三个延迟分别为 400、600 和 800 毫秒的执行器。串行运行总计 1800 毫秒。并行运行 max(400, 600, 800) = 800 毫秒。差异是恒定的，而非成比例的，因此节省随工具数量增长。

现实世界注意事项：并行调用对下游 API 造成压力。对速率受限服务的 10 路扇出将失败。Phase 13 · 17 覆盖网关级背压；重试语义计划在未来阶段中。

### 流式扇出挂钟时间

如果模型本身流式传输，你可以在一个调用的参数完成时立即开始执行，而非等待所有调用最终确定。这是 OpenAI 记录但非所有 SDK 暴露的优化。本课的框架这样做：一旦模拟流产生完整参数对象，宿主就启动该调用。

## 使用它

`code/main.py` 有两半。第一半使用 `concurrent.futures.ThreadPoolExecutor` 串行和并行运行三个模拟天气调用，并打印挂钟时间。第二半重放一个伪造流式响应——三个并行调用的 `arguments` 块在一条流上交错——并用 `StreamAccumulator` 按 ID 重组它们。无 LLM，无网络，只有重组逻辑。

看点：

- 串行计时器达到 1.8 秒。并行计时器在相同伪造延迟下达到 0.8 秒。
- 累加器通过按 ID 缓冲并仅在每个调用的 JSON 完成时解析，处理无序到达的块。
- 执行器在一个 ID 的参数最终确定时立即启动，而非在所有流结束后。

## 交付它

本课产出 `outputs/skill-parallel-call-safety-check.md`。给定工具注册表，该技能审核哪些工具可以安全并行化、哪些有顺序依赖、哪些会压垮下游速率限制——返回带每个工具 `parallel_safe` 标志的修订注册表。

## 练习

1. 运行 `code/main.py` 并改变模拟延迟。确认并行与串行比率大约为 `max/sum`（实际运行因线程调度、序列化和框架开销而略有偏离）。在什么延迟分布下并行不再重要？

2. 扩展累加器以处理"调用在流中间被取消"的情况，通过丢弃其缓冲区并发出 `cancelled` 事件。哪个提供商明确记录了这种情况？检查 Anthropic 的 `content_block_stop` 语义和 OpenAI 的 `finish_reason: "length"` 行为。

3. 用 `asyncio.gather` 替换线程池。对两者进行基准测试。你应该在异步上看到小胜，因为上下文切换成本更低，但仅当执行器执行真正的 I/O 时。

4. 选择两个不应并行化的工具（例如 `create_file` 然后 `write_file`）。向注册表添加 `ordering_dependency` 图并在该图上限制并行扇出。这是依赖感知调度的最小机制，未来代理工程阶段将形式化。

5. 阅读 OpenAI 的并行函数调用部分和 Anthropic 的 `disable_parallel_tool_use` 文档。识别 Anthropic 推荐禁用并行性的一个现实世界工具类型。（提示：同一资源上的 consequential 变更。）

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 并行工具调用 | "一个回合中的扇出" | 模型在单个助手消息中发出多个工具调用 |
| `parallel_tool_calls` | "OpenAI 的标志" | 启用或禁用多调用发出 |
| `disable_parallel_tool_use` | "Anthropic 的反义" | 退出标志；默认启用并行 |
| 工具调用 ID | "关联句柄" | 结果消息必须回显的每次调用标识符 |
| 累加器 | "流缓冲区" | 每个 ID 的部分 `arguments` 块字符串缓冲区 |
| 无序完成 | "最快优先" | 并行调用以不可预测顺序完成；ID 是粘合剂 |
| 依赖图 | "顺序约束" | 输出供给其他工具输入的工具；无法并行化 |
| 提前解析陷阱 | "JSON.parse 爆炸" | 尝试解析不完整的 `arguments` 字符串 |
| `streamFunctionCallArguments` | "Gemini 3 功能" | 带每次调用唯一 ID 的流式参数块 |
| 完成顺序回复 | "不等全部" | 按结果到达顺序回复，以 ID 为键 |

## 延伸阅读

- [OpenAI — 并行函数调用](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) — 默认行为和退出标志
- [Anthropic — 工具使用：实现工具使用](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implementing-tool-use) — `disable_parallel_tool_use` 和结果批处理
- [Google — Gemini 函数调用并行部分](https://ai.google.dev/gemini-api/docs/function-calling) — Gemini 3 的 ID 关联并行调用
- [OpenAI — 带工具的流式响应](https://platform.openai.com/docs/api-reference/responses-streaming) — OpenAI 流的块参数重组
- [Anthropic — 流式消息](https://docs.anthropic.com/en/api/messages-streaming) — 带 `input_json_delta` 的 `content_block_delta`
