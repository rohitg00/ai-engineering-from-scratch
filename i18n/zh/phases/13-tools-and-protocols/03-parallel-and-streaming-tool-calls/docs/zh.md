# 并行工具调用和与工具的流媒体

> 通过三次独立的天气查询,将进行三次回路.并行运行它们,总时间将崩到最慢的单次通话.每个边境提供商现在在单次转换中发出多次工具通话. 收益是真实的;管道是微妙的. 这一课程走着两个半端:并行风扇和流动论点重新组装,强调了ID相关陷.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, thread pool + streaming harness)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## 学习目标

- 解释原因`parallel_tool_calls: true`任何可能存在的信息,以及何时将其禁用.
- 在平行风扇中将流动的参数块与右工具调用ID相关.
- 部分重组`arguments`无需提前解析,将字符串转化为完整的JSON.
- 运行一个三个城市的天气基准, 显示序列与并行延迟.

## 问题

没有相对通话,一个代理人回答"孟加拉,东京和苏黎世的天气是什么"这样做:

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

执行员的延迟也在每个过程中, 约是理想的墙钟时间的4倍.

通过并行调用:

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

士师资格的高达10万美元,是我国第一届高中教育大学的高中教育专业.

价格是相关性复杂性. 当三个通话完成时,你的结果必须保持匹配.`tool_call_id`结果流时,您必须在执行之前将部分参数碎片组装成完整的JSON.双子座3部分添加了独特的ID,以解决一个现实世界问题,其中两个对同一工具的并行调用是无法区分的.

## 概念

### 允许并行

- **OpenAI.** `parallel_tool_calls: true`默认启动`false`强迫一系列.
- **Anthropic.**通过`disable_parallel_tool_use: false`(在Claude 3.5及以上的默认情况下).`true`为了连载.
- **Gemini.**总是可行;`tool_config.function_calling_config.mode = "AUTO"`让模型决定.

工具有顺序依赖性时,禁用并行 (`create_file`然后`write_file`),当一个调用输出通知另一个输入时,或者速度限制器无法处理风扇.

### 相关性

每次电话,模型发射的电话都有一个`id`没有这个,结果是模糊的.

- **OpenAI.** `tool_call_id`在每个工具角色信息上.
- **Anthropic.** `tool_use_id`在每一个`tool_result`区块.
- **Gemini.** `id`在每一个`functionResponse`(双子座3及以上;双子座2与名字相匹配,而与同名并行通话打破).

### 同时进行电话

接待者在自己的线程,Coroutine或远程工作者上运行每个呼叫的执行器.最简单的带使用线程池;生产使用asyncio与 `asyncio.gather`完成顺序是不可预测的  id是标识符.

答案的结果是调用列表顺序而不是完成顺序.`tool_call_id`结果被删除或重复,则在结果的顺序下重新排列的答复列表使得记录中更难找到差距. 选择用明确的ID来完成答复.

### 流媒体工具的呼叫

当模型流动时,`arguments`接下来,三个相对通话的分别流量在线上交互.

提供商的形状:

- **OpenAI.**每个部分都是`choices[0].delta.tool_calls[i].function.arguments`部分弦. 部分带着`index`您按指数积累,读取`id`当它第一次出现时,并解析JSON当`finish_reason = "tool_calls"`现在,我们要去.
- **Anthropic.**流媒体事件是`message_start`然后一个`content_block_start`每块,有类型`tool_use`(包含身份证,名称,空格输入). `content_block_delta`事件的运行`input_json_delta`子.`content_block_stop`关闭每一个街区.
- **Gemini.** `streamFunctionCallArguments`双子三级以上) 发射了`functionCallId`在双子座3之前,流媒体回应一次一次一次.

### 部分JSON和分析早期陷

你不能分析.`arguments`部分JSON,如`{"city": "Beng`合适的门是提供商的终端通话信号:OpenAI的`finish_reason = "tool_calls"`美国人文学报`content_block_stop`只有那时才尝试.`json.loads`更加强大的方法采用一个增量JSON解析器,随着结构完成时生成事件;OpenAI的流媒体指南建议为 UX使用这种方法,该指标显示了现场"思考"指标. 数计数是不可靠的,作为完整性测试 (引用字符串内或逃逸内容导致虚假阳性),并且只应作为非正式的调试数.

### 订单外完成

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

接待者答复必须引用以下身份证:

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

答案中的顺序对OpenAI或Anthropic的准确性并不重要.只要ID匹配,双胞胎会接受任何订单.

### 基准:连续对平行

带里面`code/main.py`模拟三个执行器,400,600和800ms延迟. 序列运行在1800ms总. 并行运行在最大400,600,800) =800ms. 差异是恒定,不成比例,因此节省随着工具数量增长.

现实世界警告:并行通话压力下游API.一个10个方式的风扇到一个限速服务将失败.13 · 17阶段涵盖门口级压力;重试语义计划在未来阶段.

### 流动风扇外墙钟

如果模型本身流,你可以在一个调用的参数完成后开始执行,而不是等待所有调用完成.这是一个优化 OpenAI 文档,但不是所有的 SDK 暴露.本课程中的杆是这样做的:一旦模拟流产生完整的参数对象,主机启动了调用.

```figure
tp-parallel-fanout
```

## 用它

`code/main.py`首先,它运行了三个模拟的天气调用,`concurrent.futures.ThreadPoolExecutor`另一半重复了一个假的流媒体响应`arguments`在一个流中交互的三个并行调用,并将它们重新组装成每个ID`StreamAccumulator`没有法学士,没有网络,只是重新组装逻辑.

什么要看:

- 顺序计时器达到1.8秒,并行计时器达到0.8秒,
- 积累器只处理到达不顺序的块,通过按标识缓冲和解析,
- 执行器在所有流程结束后,不但在ID的论点完成后就开始.

## 运送它

这一课产生了`outputs/skill-parallel-call-safety-check.md`鉴于工具登记,技能审计是哪些工具可以安全地并行化,有订单依赖性,并且会压倒下游利率限制 每工具的修订登记 `parallel_safe`旗.

## 运动

1. 跑步`code/main.py`确认平行到序列比率是大约`max/sum`(实际运行因线程安排,串行和带上层费而略有偏离于理想).

2. 扩展蓄积器以处理"中流取消电话"的情况下,`cancelled`哪个提供商明确记录了这个案例?`content_block_stop`语义和OpenAI的研究`finish_reason: "length"`如何表现?

3. 替换线池为`asyncio.gather`由于下文交换成本,你应该看到小的胜利,但只有执行器做真正的I/O.

4. 选择两个不应该平行的工具 (例如:`create_file`然后`write_file`添加一个`ordering_dependency`对于依赖意识的规划,这是一个未来的代理工程阶段正式化的最低机械.

5. 阅读OpenAI的并行函数调用部分和Anthropic的部分.`disable_parallel_tool_use`鉴定人类推禁用并行性 (提示:同一资源的后果突变).

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Parallel tool calls | "Fan-out in one turn" | Model emits multiple tool calls in a single assistant message |
| `parallel_tool_calls` | "OpenAI's flag" | Enable or disable multi-call emission |
| `disable_parallel_tool_use` | "Anthropic's inverse" | Opt-out flag; default is parallel enabled |
| Tool call id | "Correlation handle" | Per-call identifier the result message must echo |
| Accumulator | "Stream buffer" | Per-id string buffer for partial `arguments` chunks |
| Out-of-order completion | "Fastest first" | Parallel calls finish in unpredictable order; ids are the glue |
| Dependency graph | "Ordering constraints" | Tools whose outputs feed into inputs of other tools; cannot parallelize |
| Parse-early trap | "JSON.parse exploded" | Attempting to parse an incomplete `arguments` string |
| `streamFunctionCallArguments` | "Gemini 3 feature" | Streamed argument chunks with unique id per call |
| Completion-order reply | "Don't wait for all" | Reply with results as they arrive, keyed by id |

## 进一步阅读

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling)默认行为和选择退出标志
- [Anthropic — Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use) `disable_parallel_tool_use`结果批量
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling)来自双子座3的ID相关的并行电话
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) 对于OpenAI流的分断参数重组
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) `content_block_delta`随着`input_json_delta`
