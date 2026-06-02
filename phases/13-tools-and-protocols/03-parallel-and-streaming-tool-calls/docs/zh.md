# 并行 tool call 与带 tool 的流式输出

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 三次互相独立的天气查询如果串行跑，就是三个 round trip。改成并行后，总耗时塌缩成最慢那一次单独调用的时间。如今每家前沿模型厂商都能在一轮内吐出多个 tool call。收益是真金白银的；但管线很微妙。这节课把两半都讲透：并行 fan-out（扇出）和流式参数的重组，重点放在 id 关联（id-correlation）这个坑上。

**Type:** Build
**Languages:** Python (stdlib, thread pool + streaming harness)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 解释 `parallel_tool_calls: true` 为什么存在，什么时候要关掉它。
- 在并行 fan-out 时把流式的参数 chunk 关联到正确的 tool-call id 上。
- 把分片的 `arguments` 字符串重组成完整 JSON，且不要提前解析。
- 跑一次三城天气基准测试，演示串行 vs 并行延迟。

## 问题（The Problem）

如果不开并行，agent 在回答「Bengaluru、Tokyo、Zurich 三地天气如何」时会这样：

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

三个 LLM round trip，每个还要叠加执行器的延迟。大概是理想 wall-clock 时间的 4 倍。

开了并行之后：

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

只剩一次 LLM round trip。执行器耗时是三者的最大值，不再是求和。OpenAI、Anthropic、Gemini 上的生产基准（benchmark）显示，fan-out 类工作负载的 wall-clock 时间能下降 60% 到 70%。

代价是关联（correlation）变复杂。三个调用乱序完成时，结果必须带上匹配的 `tool_call_id`，模型才能对得上。结果如果是流式来的，你得把分片的参数片段拼成完整 JSON 才能去执行。Gemini 3 之所以加入唯一 id，部分原因就是为了解决一个真实问题：对同一个 tool 发起的两次并行调用没法区分。

## 概念（The Concept）

### 启用并行

- **OpenAI.** `parallel_tool_calls: true` 默认开启。设为 `false` 强制串行。
- **Anthropic.** 通过 `disable_parallel_tool_use: false` 开并行（Claude 3.5 及以上默认开）。设为 `true` 走串行。
- **Gemini.** 始终具备并行能力；`tool_config.function_calling_config.mode = "AUTO"` 让模型自己决定。

什么时候要关掉并行：tool 之间有顺序依赖（先 `create_file` 再 `write_file`）、一个调用的输出会喂给另一个的输入、或者下游限流器扛不住扇出。

### id 关联

模型每发出一个 call 都带 `id`。host 返回的每个结果都必须带回同样的 id。否则结果就是模糊的。

- **OpenAI.** 每条 tool 角色消息上的 `tool_call_id`。
- **Anthropic.** 每个 `tool_result` block 上的 `tool_use_id`。
- **Gemini.** 每个 `functionResponse` 上的 `id`（Gemini 3 及以上；Gemini 2 是按 name 匹配，遇到同名并行调用就崩了）。

### 并发地跑这些 call

host 把每个 call 的执行器放到独立的线程、协程或远程 worker 上跑。最简单的 harness（脚手架）用线程池；生产环境用 asyncio 配合 `asyncio.gather` 或者结构化并发。完成顺序不可预测——id 才是身份标识。

一个常见 bug：按调用列表的顺序回结果，而不是按完成顺序。这通常能跑，因为模型只看 `tool_call_id`，但一旦有结果丢失或重复，乱序提交会让 debug 难上加难。最好按完成顺序回，并显式带 id。

### 流式的 tool call

模型走流式时，`arguments` 是分片到达的。三个并行调用就是三条 chunk 流，在线缆上互相交错。你需要为每个 id 准备一个累加器（accumulator）。

各家的形态：

- **OpenAI.** 每个 chunk 是 `choices[0].delta.tool_calls[i].function.arguments`（部分字符串）。chunk 带一个 `index`（在调用列表中的位置）。你按 index 累加，第一次出现时读 `id`，等到 `finish_reason = "tool_calls"` 再去 parse JSON。
- **Anthropic.** 流事件先是 `message_start`，然后每个 block 一个 `content_block_start`，type 为 `tool_use`（包含 id、name、空 input）。`content_block_delta` 事件携带 `input_json_delta` chunk。`content_block_stop` 关闭每个 block。
- **Gemini.** `streamFunctionCallArguments`（Gemini 3 及以上）发出的 chunk 带 `functionCallId`，所以多个调用可以干净地交错。在 Gemini 3 之前，流式一次返回一个完整的 call。

### 不完整 JSON 与「提前解析」陷阱

`arguments` 没收完之前不能 parse。像 `{"city": "Beng` 这种不完整 JSON 不合法，会抛异常。正确的关卡是各家的 end-of-call 信号：OpenAI 的 `finish_reason = "tool_calls"`、Anthropic 的 `content_block_stop`、Gemini 的 stream-end 事件。只有那时才尝试 `json.loads`。更稳健的做法是用增量 JSON 解析器，在结构完成时逐步 yield 事件；OpenAI 的流式指南推荐用这种方式实现一个能展示实时「思考中」指示器的 UX。靠数大括号判断完整性是不可靠的（引号串内或转义内容里的大括号会引发误判），最多只能当作非正式的 debug 启发式。

### 乱序完成

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

host 的回复仍然必须把 id 带上：

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

回复中的顺序在 OpenAI 或 Anthropic 上对正确性没影响。Gemini 也接受任意顺序，只要 id 对得上。

### 基准测试：串行 vs 并行

`code/main.py` 里的 harness 模拟了三个执行器，延迟分别是 400、600、800 ms。串行跑总共 1800 ms。并行跑是 max(400, 600, 800) = 800 ms。差值是常数，不是比例，所以 tool 越多收益越大。

现实警告：并行调用会给下游 API 加压。一次 10 路 fan-out 打到限流的服务上就会挂掉。Phase 13 · 17 会讲网关层的反压（backpressure）；重试语义留给后续 phase。

### 流式 fan-out 的 wall-clock

如果模型本身在流式输出，你可以在某一个 call 的参数刚收完时立刻去执行它，而不必等所有 call 都收齐。这是 OpenAI 文档里写过的优化，但不是所有 SDK 都暴露出来。本节的 harness 就这么干：模拟流一旦 yield 出一个完整的参数对象，host 就把那个 call 启起来。

## 用起来（Use It）

`code/main.py` 分两半。前一半用 `concurrent.futures.ThreadPoolExecutor` 把三次模拟天气调用先串行后并行跑一遍，打印 wall-clock 时间。后一半回放一段假的流式响应——三个并行调用的 `arguments` chunk 在一条流上交错——并用 `StreamAccumulator` 按 id 重组。没有 LLM、没有网络，纯粹是重组逻辑。

要看的点：

- 串行计时器到 1.8 秒。同样的假延迟下，并行计时器到 0.8 秒。
- accumulator 处理乱序到达的 chunk：按 id 缓冲，只在每个 call 的 JSON 完整时才 parse。
- 某个 id 的参数刚收完执行器就启动，不用等所有流都结束。

## 上线部署（Ship It）

本节产出 `outputs/skill-parallel-call-safety-check.md`。给定一个 tool 注册表，这个 skill 会审计哪些 tool 可以安全并行、哪些有顺序依赖、哪些会把下游限流压垮——返回一份带逐个 tool `parallel_safe` 标志的修订后注册表。

## 练习（Exercises）

1. 跑一下 `code/main.py`，调整模拟延迟。确认并行/串行的比值大致是 `max/sum`（实际运行会因为线程调度、序列化和 harness 开销稍有偏离理想值）。在什么样的延迟分布下，并行就不再有意义了？

2. 扩展 accumulator，处理「call 在流到一半被取消」的情况：丢掉它的缓冲并发出一个 `cancelled` 事件。哪家厂商显式记录了这种情况？查一下 Anthropic 的 `content_block_stop` 语义和 OpenAI 的 `finish_reason: "length"` 行为。

3. 把线程池换成 `asyncio.gather`，对两者做基准测试。async 应当能赢一点，因为上下文切换成本更低，但前提是执行器真的在做 I/O。

4. 选两个绝对不该并行的 tool（例如先 `create_file` 再 `write_file`）。给注册表加一个 `ordering_dependency` 图，并基于这个图给并行 fan-out 加门控。这是依赖感知调度的最小机制，未来某个 agent 工程 phase 会把它正式化。

5. 读一下 OpenAI 的 parallel-function-calling 章节和 Anthropic 的 `disable_parallel_tool_use` 文档。找出 Anthropic 推荐关掉并行的那一类真实 tool。（提示：对同一资源做有后果的 mutation。）

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Parallel tool calls | "一轮内 fan-out" | 模型在一条 assistant 消息里发出多个 tool call |
| `parallel_tool_calls` | "OpenAI 的 flag" | 启用或关闭多 call 发出 |
| `disable_parallel_tool_use` | "Anthropic 的反向 flag" | 退订式开关；默认是开并行 |
| Tool call id | "关联句柄" | 每个 call 的标识符，结果消息必须回显 |
| Accumulator | "流缓冲区" | 按 id 缓冲部分 `arguments` chunk 的字符串 buffer |
| Out-of-order completion | "最快先到" | 并行 call 完成顺序不可预测；id 是粘合剂 |
| Dependency graph | "顺序约束" | 一些 tool 的输出会喂进另一些 tool 的输入；不能并行 |
| Parse-early trap | "JSON.parse 炸了" | 试图 parse 不完整的 `arguments` 字符串 |
| `streamFunctionCallArguments` | "Gemini 3 的能力" | 带每 call 唯一 id 的流式参数 chunk |
| Completion-order reply | "别等齐" | 谁到先回谁，按 id 索引 |

## 延伸阅读（Further Reading）

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) — 默认行为与退订 flag
- [Anthropic — Tool use: implementing tool use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implementing-tool-use) — `disable_parallel_tool_use` 与结果批处理
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling) — 从 Gemini 3 起带 id 关联的并行调用
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) — OpenAI 流的分片参数重组
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) — 携带 `input_json_delta` 的 `content_block_delta`
