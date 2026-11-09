# 开通通讯技术 GenAI 追踪工具端到端通话

> 一个代理人打电话给五个工具,三个MCP服务器, 你需要一个痕迹. 开通通讯GenAI语义公约 (v1.37及以上的稳定属性) 是2026年标准,由Datadog,Langfuse,Ariz Phoenix,OpenLLMetry和AgentOps本地支持. 这一课列出所需属性,走向跨度层次 (代理 → LLM →工具),并发送一个可以连接到任何OTel出口商的 stdlib跨度发射器.

**Type:** Build
**Languages:** Python (stdlib, OTel span emitter), TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## 学习目标

- 指定为LLM跨度和工具执行跨度所需的OTel GenAI属性.
- 建立一个覆盖代理循环,LLM调用,工具调用和MCP客户端发送的跟踪层次.
- 决定要捕获 (选择) 和编辑 (默认) 内容.
- 发送到本地收藏器 (Jaeger,Langfuse) 无需重写工具代码.

## 问题

2026年2月的一个调试:用户报告"我的代理有时需要30秒来响应;有时需要3秒".没有痕迹.日志显示了LLM电话,但不是工具发送,不是MCP服务器回路,不是子代理.你猜.最终你发现:一个MCP服务器偶尔挂在冷启动上.

没有端到端追踪,你就找不到这个.

根据OpenTelemetry语义会议组,这些公约在2025-2026年结合.它们定义了稳定的属性名称,因此Datadog,Langfuse,Phoenix,OpenLLMetry和AgentOps都分析相同的范围.

## 概念

### 跨度等级

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

整个东西都在一个痕迹身份证下, 跨度身份证将父母与孩子的关系联系起来.

### 要求属性

根据2025-2026年学期:

- `gen_ai.operation.name` `"chat"`现在`"text_completion"`现在`"embeddings"`现在`"execute_tool"`现在`"invoke_agent"`现在,我们要去.
- `gen_ai.provider.name` `"openai"`现在`"anthropic"`现在`"google"`现在`"azure_openai"`现在,我们要去.
- `gen_ai.request.model`要求的模型字符串 (例如 `"gpt-4o-2024-08-06"`)
- `gen_ai.response.model`模型实际上是服务的.
- `gen_ai.usage.input_tokens`现在,`gen_ai.usage.output_tokens`现在,我们要去.
- `gen_ai.response.id`提供商响应ID对相关性.

对于工具跨度:

- `gen_ai.tool.name`工具标识符
- `gen_ai.tool.call.id`具体的呼叫身份.
- `gen_ai.tool.description`工具描述 (可选).

对于代理范围:

- `gen_ai.agent.name`现在,`gen_ai.agent.id`现在,`gen_ai.agent.description`现在,我们要去.

### 子类型

- `SpanKind.CLIENT`通过进程边界 (LLM提供商,MCP服务器) 的呼叫.
- `SpanKind.INTERNAL`对于代理人的自行循环步骤和工具执行.

### 选择内容捕获

默认情况下,跨度载有指标和时间,而不是提示或完成. 大型有效载荷和 PII默认关闭. 设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`内容的含量,在启用中仔细审查.

### 跨度事件

代币级事件可以作为跨度事件添加:

- `gen_ai.content.prompt`输入信息.
- `gen_ai.content.completion`输出消息.
- `gen_ai.content.tool_call` 工具调用记录.

事件时间顺序在一个时间段内进行详细重播.

### 出口商

欧特尔向:

- **Jaeger / Tempo.**局部,现场.
- **Langfuse.**具有可观性特异性;可视化代币使用.
- **Arize Phoenix.**总数: 总数:
- **Datadog.**商业;本地解析`gen_ai.*`它们的属性.
- **Honeycomb.**专导向; 查询友好.

它们都用OTLP,电线格式.

### 跨MCP传播

当MCP客户端调用服务器时,将W3C追踪头标注入请求中.流式HTTP支持标准头标.Stdio不原生地携带HTTP头标;规范的2026路线图讨论添加一个`_meta.traceparent`在JSON-RPC调用时的字段.

加入其后方的 `_meta`服务器将记录了追踪身份.

### 计量

除了跨度之外,GenAI semconv也定义了指标:

- `gen_ai.client.token.usage`    
- `gen_ai.client.operation.duration`    
- `gen_ai.tool.execution.duration`    

对于不需要每次通话的详细信息的仪表板,使用这些.

### 代理Ops 层

代理Ops (成立于2024年) 专注于GenAI可观测性.它包裹着受欢迎的框架 (LangGraph,Pydantic AI,CrewAI) 以自动发射OTel跨度.如果您的堆使用支持的框架,则有用;否则使用手动仪器.

```figure
t3-span-waterfall
```

## 用它

`code/main.py`发出OTel形状的跨度到stdout (OTLP-JSON类似格式) 代理调用LLM,发送两个工具,并完成一个MCP回路.没有真正的出口商课程专注于跨度形状和属性集.将输出粘贴到OTLP兼容的观众中或简单地阅读.

什么要看:

- 随着所有区域的测量,
- 通过 编码的父母与孩子的链接`parentSpanId`现在,我们要去.
- 需要`gen_ai.*`属性已被填充.
- 默认情况下,内容捕获是关闭的;一个情况通过envvar启动.

## 运送它

这一课产生了`outputs/skill-otel-genai-instrumentation.md`鉴于代理代码基础,技能产生了一个仪器计划:在哪里添加范围,哪些属性被占用,哪些出口者被目标.

## 运动

1. 跑步`code/main.py`计算时间,确定哪个是客户与内部.

2. 启用内容捕获 (env var) 并确认`gen_ai.content.prompt`其他`gen_ai.content.completion`观察对 PII 的影响.

3. 添加工具执行指标`gen_ai.tool.execution.duration`并且以每次通话的 histogram 样本发射.

4. 传播一个从母体代理跨度到MCP请求的追踪父母`_meta.traceparent`检查MCP服务器会看到相同的追踪身份.

5. 读取OTel GenAI semconv规范. 确定本课程代码中没有发射的 semconv中列出的一个属性. 添加它.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| OTel | "OpenTelemetry" | Open standard for traces, metrics, logs |
| GenAI semconv | "GenAI semantic conventions" | Stable attribute names for LLM / tool / agent spans |
| `gen_ai.*` | "The attribute namespace" | All GenAI attributes share this prefix |
| Span | "Timed operation" | A unit of work with a start, end, and attributes |
| Trace | "Cross-span ancestry" | Tree of spans sharing a trace id |
| SpanKind | "CLIENT / SERVER / INTERNAL" | Hints about span direction |
| OTLP | "OpenTelemetry Protocol" | Wire format for exporters |
| Opt-in content | "Prompt / completion capture" | Off by default; env var to enable |
| traceparent | "W3C header" | Propagates trace context across services |
| Exporter | "Backend-specific shipper" | Component that sends spans to Jaeger / Datadog / etc. |

## 进一步阅读

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/)基因科学界范围,指标和事件的常规公约
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) LLM和工具执行跨度属性列表
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/)代理级`invoke_agent`跨度
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) GitHub 托管的真相来源
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/)生产集成步行
