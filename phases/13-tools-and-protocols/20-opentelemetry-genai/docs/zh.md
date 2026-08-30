# 20 · OpenTelemetry GenAI——端到端追踪工具调用

> 一个智能体（agent）调用了五个工具、三个 MCP 服务器和两个子智能体。你需要一条贯穿全程的追踪（trace）。OpenTelemetry GenAI 语义约定（semantic conventions，自 v1.37 起属性已稳定）是 2026 年的标准，被 Datadog、Langfuse、Arize Phoenix、OpenLLMetry 与 AgentOps 原生支持。本课会列出必备属性，逐层讲解跨度层级（span hierarchy，agent → LLM → tool），并交付一个标准库实现的跨度发射器（span emitter），你可以把它接入任意 OTel 导出器（exporter）。

**类型：** 构建
**语言：** Python（标准库，OTel 跨度发射器）
**前置：** 阶段 13 · 07（MCP 服务器）、阶段 13 · 08（MCP 客户端）
**时长：** 约 75 分钟

## 学习目标

- 说出一个 LLM 跨度和一个工具执行跨度所需的 OTel GenAI 必备属性。
- 构建一条覆盖智能体循环、LLM 调用、工具调用与 MCP 客户端分派的追踪层级。
- 决定哪些内容应该捕获（按需开启），哪些应该脱敏（默认行为）。
- 在不重写工具代码的前提下，将跨度发射到本地收集器（Jaeger、Langfuse）。

## 问题所在

2026 年 2 月的一次调试：用户报告"我的智能体有时要 30 秒才回应，有时只要 3 秒"。没有任何追踪。日志里只能看到 LLM 调用，看不到工具分派，看不到 MCP 服务器的往返，也看不到子智能体。你只能靠猜。最终你发现：某个 MCP 服务器偶尔会在冷启动（cold-start）时挂起。

没有端到端追踪，你根本找不到这个问题。OTel GenAI 解决了它。

这套约定在 2025-2026 年由 OpenTelemetry 语义约定工作组确定下来。它定义了稳定的属性名称，于是 Datadog、Langfuse、Phoenix、OpenLLMetry 和 AgentOps 都能解析同一批跨度。只需埋点一次，就能发往任意后端。

## 核心概念

### 跨度层级

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

整棵树都嵌套在同一个 trace id 之下。span id 用来连接父子关系。

### 必备属性

依据 2025-2026 的语义约定（semconv）：

- `gen_ai.operation.name`——`"chat"`、`"text_completion"`、`"embeddings"`、`"execute_tool"`、`"invoke_agent"`。
- `gen_ai.provider.name`——`"openai"`、`"anthropic"`、`"google"`、`"azure_openai"`。
- `gen_ai.request.model`——请求的模型字符串（例如 `"gpt-4o-2024-08-06"`）。
- `gen_ai.response.model`——实际服务的模型。
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`。
- `gen_ai.response.id`——供应商响应 id，用于关联。

对于工具跨度：

- `gen_ai.tool.name`——工具标识符。
- `gen_ai.tool.call.id`——具体的调用 id。
- `gen_ai.tool.description`——工具描述（可选）。

对于智能体跨度：

- `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.agent.description`。

### 跨度类型（Span kinds）

- `SpanKind.CLIENT` 用于跨越进程边界的调用（LLM 供应商、MCP 服务器）。
- `SpanKind.INTERNAL` 用于智能体自身的循环步骤和工具执行。

### 按需开启的内容捕获

默认情况下，跨度只携带指标和计时信息——不含提示词（prompt）或补全内容（completion）。大体量负载和个人身份信息（PII）默认关闭。设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` 以及特定的内容捕获环境变量，才能纳入内容。在生产环境启用前请仔细评估。

### 跨度上的事件

可以把 token 级别的事件作为跨度事件（span events）添加：

- `gen_ai.content.prompt`——输入消息。
- `gen_ai.content.completion`——输出消息。
- `gen_ai.content.tool_call`——记录下来的工具调用。

事件在一个跨度内按时间排序，便于详细回放。

### 导出器（Exporters）

OTel 跨度可导出到：

- **Jaeger / Tempo。** 开源、本地部署。
- **Langfuse。** 专注于 LLM 可观测性；可视化 token 用量。
- **Arize Phoenix。** 评估（eval）与追踪二合一。
- **Datadog。** 商业产品；原生解析 `gen_ai.*` 属性。
- **Honeycomb。** 列式存储；查询友好。

它们都使用 OTLP 这一传输格式。你的代码无需关心区别。

### 跨 MCP 的上下文传播

当 MCP 客户端调用服务器时，把 W3C 的 traceparent 头部注入请求中。可流式 HTTP（Streamable HTTP）支持标准头部。Stdio 本身不携带 HTTP 头部；规范的 2026 路线图正在讨论为 JSON-RPC 调用增加一个 `_meta.traceparent` 字段。

在该特性落地之前：手动把 traceparent 放进每个请求的 `_meta` 中。服务器记录 trace id。

### 指标（Metrics）

除跨度之外，GenAI 语义约定还定义了指标：

- `gen_ai.client.token.usage`——直方图（histogram）。
- `gen_ai.client.operation.duration`——直方图。
- `gen_ai.tool.execution.duration`——直方图。

对于无需逐次调用细节的仪表盘，用这些指标即可。

### AgentOps 层

AgentOps（成立于 2024 年）专注于 GenAI 可观测性。它封装了主流框架（LangGraph、Pydantic AI、CrewAI），自动发射 OTel 跨度。如果你的技术栈使用受支持的框架，它会很有用；否则请采用手动埋点。

## 上手实践

`code/main.py` 会为一个智能体把 OTel 形态的跨度发射到标准输出（以类 OTLP-JSON 格式），该智能体调用了一个 LLM、分派了两个工具，并完成了一次 MCP 往返。没有真实的导出器——本课聚焦于跨度的形态与属性集合。把输出粘贴到兼容 OTLP 的查看器中，或者直接阅读。

需要关注的点：

- trace id 在所有跨度间共享。
- 父子关系通过 `parentSpanId` 编码。
- 必备的 `gen_ai.*` 属性都已填充。
- 内容捕获默认关闭；有一个场景通过环境变量将其打开。

## 交付物

本课会产出 `outputs/skill-otel-genai-instrumentation.md`。给定一份智能体代码库，该技能（skill）会产出一份埋点方案：在哪里添加跨度、填充哪些属性、面向哪些导出器。

## 练习

1. 运行 `code/main.py`。数一数跨度的数量，并判断哪些是 CLIENT、哪些是 INTERNAL。

2. 打开内容捕获（通过环境变量），确认 `gen_ai.content.prompt` 和 `gen_ai.content.completion` 事件出现。注意它对 PII 的影响。

3. 添加工具执行指标 `gen_ai.tool.execution.duration`，并为每次调用发射一个直方图样本。

4. 把 traceparent 从父智能体跨度传播到一个 MCP 请求的 `_meta.traceparent` 字段。验证 MCP 服务器是否会看到相同的 trace id。

5. 阅读 OTel GenAI 语义约定规范。找出规范中列出但本课代码并未发射的一个属性，把它加上。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| OTel | "OpenTelemetry" | 用于追踪、指标、日志的开放标准 |
| GenAI semconv | "GenAI 语义约定" | LLM / 工具 / 智能体跨度的稳定属性名 |
| `gen_ai.*` | "属性命名空间" | 所有 GenAI 属性共享这个前缀 |
| Span（跨度） | "计时操作" | 一个有起点、终点和属性的工作单元 |
| Trace（追踪） | "跨跨度的谱系" | 共享同一 trace id 的跨度树 |
| SpanKind | "CLIENT / SERVER / INTERNAL" | 关于跨度方向的提示 |
| OTLP | "OpenTelemetry Line Protocol" | 导出器使用的传输格式 |
| 按需内容捕获 | "提示词 / 补全捕获" | 默认关闭；通过环境变量启用 |
| traceparent | "W3C 头部" | 跨服务传播追踪上下文 |
| Exporter（导出器） | "后端专用的发送器" | 把跨度发往 Jaeger / Datadog 等的组件 |

## 延伸阅读

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/)——GenAI 跨度、指标与事件的权威约定
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/)——LLM 与工具执行跨度的属性清单
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/)——智能体级别的 `invoke_agent` 跨度
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md)——托管于 GitHub 的权威来源
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/)——生产环境集成实操
