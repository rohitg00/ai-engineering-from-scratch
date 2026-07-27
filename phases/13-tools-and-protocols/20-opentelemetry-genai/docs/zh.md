# OpenTelemetry GenAI —— 端到端的工具调用链路追踪

> 一个智能体调用五个工具、三个 MCP 服务器和两个子智能体。你需要一条跨越所有环节的链路。OpenTelemetry GenAI 语义约定（v1.37 及以上的稳定属性）是 2026 年的标准，得到了 Datadog、Langfuse、Arize Phoenix、OpenLLMetry 和 AgentOps 的原生支持。本课程列出必需的属性，讲解 Span 层次结构（智能体 → LLM → 工具），并提供一个可直接接入任何 OTel 导出器的标准库 Span 发射器。

**类型：** 构建
**语言：** Python（标准库，OTel Span 发射器）
**前置条件：** 阶段 13 · 07（MCP 服务器），阶段 13 · 08（MCP 客户端）
**时长：** 约 75 分钟

## 学习目标

- 列出 LLM Span 和工具执行 Span 所需的 OTel GenAI 属性。
- 构建覆盖智能体循环、LLM 调用、工具调用和 MCP 客户端调度的链路层次结构。
- 判断哪些内容需要捕获（选择加入）vs 隐藏（默认行为）。
- 将 Span 发射到本地收集器（Jaeger、Langfuse），而无需重写工具代码。

## 问题

2026 年 2 月的一次调试：用户报告"我的智能体有时需要 30 秒才能响应，有时只要 3 秒。"没有链路追踪。日志显示了 LLM 调用，但没有工具调度，没有 MCP 服务器往返，没有子智能体。你只能猜测。最终你发现：某个 MCP 服务器偶尔会因冷启动而挂起。

没有端到端的链路追踪，你无法找到这个问题。OTel GenAI 解决了它。

这些约定于 2025–2026 年在 OpenTelemetry 语义约定小组下确定。它们定义了稳定的属性名称，使得 Datadog、Langfuse、Phoenix、OpenLLMetry 和 AgentOps 都能解析相同的 Span。一次埋点，可发往任何后端。

## 概念

### Span 层次结构

```
agent.invoke_agent  （顶层，INTERNAL Span）
 ├── llm.chat       （CLIENT Span）
 ├── tool.execute   （INTERNAL）
 │    └── mcp.call  （CLIENT Span）
 ├── llm.chat       （CLIENT Span）
 └── subagent.invoke（INTERNAL）
```

所有内容都嵌套在同一个 trace id 下。Span id 连接父子关系。

### 必需属性

根据 2025–2026 语义约定：

- `gen_ai.operation.name` —— `"chat"`、`"text_completion"`、`"embeddings"`、`"execute_tool"`、`"invoke_agent"`。
- `gen_ai.provider.name` —— `"openai"`、`"anthropic"`、`"google"`、`"azure_openai"`。
- `gen_ai.request.model` —— 请求的模型字符串（例如 `"gpt-4o-2024-08-06"`）。
- `gen_ai.response.model` —— 实际服务的模型。
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`。
- `gen_ai.response.id` —— 提供商的响应 ID，用于关联。

对于工具 Span：

- `gen_ai.tool.name` —— 工具标识符。
- `gen_ai.tool.call.id` —— 具体的调用 ID。
- `gen_ai.tool.description` —— 工具描述（可选）。

对于智能体 Span：

- `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.agent.description`。

### Span 类型

- `SpanKind.CLIENT` —— 用于跨进程边界的调用（LLM 提供商、MCP 服务器）。
- `SpanKind.INTERNAL` —— 用于智能体自身的循环步骤和工具执行。

### 选择性内容捕获

默认情况下，Span 携带的是指标和耗时信息，而不是提示词或补全内容。大负载和 PII 默认关闭。设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` 以及特定的内容捕获环境变量来包含内容。在生产环境中启用前请仔细评估。

### Span 事件

可以在 Span 上添加令牌级事件：

- `gen_ai.content.prompt` —— 输入消息。
- `gen_ai.content.completion` —— 输出消息。
- `gen_ai.content.tool_call` —— 记录的工具调用。

事件在 Span 内按时间排序，便于详细回放。

### 导出器

OTel Span 可导出到：

- **Jaeger / Tempo。** 开源，本地部署。
- **Langfuse。** LLM 可观测性专用；可视化令牌用量。
- **Arize Phoenix。** 评估与链路追踪相结合。
- **Datadog。** 商业产品；原生解析 `gen_ai.*` 属性。
- **Honeycomb。** 面向列；适合查询。

所有导出器都使用 OTLP 这种线路格式。你的代码无需关心。

### 跨 MCP 传播

当 MCP 客户端调用服务器时，将 W3C traceparent 头注入到请求中。Streamable HTTP 支持标准头部。Stdio 本身不携带 HTTP 头部；该规范的 2026 路线图讨论了在 JSON-RPC 调用中添加 `_meta.traceparent` 字段。

在该功能发布之前：手动在每个请求的 `_meta` 中包含 traceparent。服务器记录 trace id。

### 指标

除 Span 之外，GenAI 语义约定还定义了指标：

- `gen_ai.client.token.usage` —— 直方图。
- `gen_ai.client.operation.duration` —— 直方图。
- `gen_ai.tool.execution.duration` —— 直方图。

在不需要每次调用详情的仪表板上使用这些指标。

### AgentOps 层

AgentOps（成立于 2024 年）专注于 GenAI 可观测性。它封装了主流框架（LangGraph、Pydantic AI、CrewAI），自动发出 OTel Span。如果你的技术栈使用了受支持的框架，这会很有用；否则请使用手动埋点。

## 使用

`code/main.py` 为一个调用 LLM、调度两个工具并进行一次 MCP 往返的智能体，向标准输出（以类似 OTLP-JSON 的格式）发出 OTel 格式的 Span。没有真实的导出器 —— 本课程专注于 Span 的结构和属性集。你可以将输出粘贴到兼容 OTLP 的查看器中，或者直接阅读。

需要关注的内容：

- 所有 Span 共享同一个 trace id。
- 父子关系通过 `parentSpanId` 编码。
- 所需的 `gen_ai.*` 属性已被填充。
- 内容捕获默认关闭；一个场景通过环境变量将其启用。

## 产出

本课程生成 `outputs/skill-otel-genai-instrumentation.md`。给定一个智能体代码库，该技能会生成一个埋点方案：在哪里添加 Span，填充哪些属性，以及针对哪些导出器。

## 练习

1. 运行 `code/main.py`。统计 Span 数量，并识别哪些是 CLIENT 类型、哪些是 INTERNAL 类型。

2. 开启内容捕获（环境变量），确认 `gen_ai.content.prompt` 和 `gen_ai.content.completion` 事件出现。注意对 PII 的影响。

3. 添加工具执行指标 `gen_ai.tool.execution.duration`，并以每次调用的直方图样本形式发出。

4. 将 traceparent 从父智能体 Span 传播到 MCP 请求的 `_meta.traceparent` 字段。验证 MCP 服务器将看到相同的 trace id。

5. 阅读 OTel GenAI 语义约定规范。找出本课程代码中**未**发出的一个属性，并将其添加。

## 关键术语

| 术语 | 大家说的 | 实际含义 |
|------|----------|----------|
| OTel | "OpenTelemetry" | 链路、指标、日志的开放标准 |
| GenAI semconv | "GenAI 语义约定" | LLM / 工具 / 智能体 Span 的稳定属性名称 |
| `gen_ai.*` | "属性命名空间" | 所有 GenAI 属性共享此前缀 |
| Span | "计时操作" | 一个有开始、结束和属性的工作单元 |
| Trace | "跨 Span 谱系" | 共享同一 trace id 的 Span 树 |
| SpanKind | "CLIENT / SERVER / INTERNAL" | 关于 Span 方向的提示 |
| OTLP | "OpenTelemetry 线路协议" | 导出器的线路格式 |
| 选择性内容 | "提示词/补全捕获" | 默认关闭；通过环境变量启用 |
| traceparent | "W3C 头部" | 跨服务传播链路上下文 |
| Exporter | "后端特定的发送器" | 将 Span 发送到 Jaeger / Datadog 等的组件 |

## 延伸阅读

- [OpenTelemetry — GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— GenAI Span、指标和事件的规范约定
- [OpenTelemetry — GenAI Span](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) —— LLM 和工具执行 Span 属性列表
- [OpenTelemetry — GenAI 智能体 Span](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) —— 智能体级 `invoke_agent` Span
- [open-telemetry/semantic-conventions — GenAI Span](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) —— GitHub 托管的真相源头
- [Datadog — LLM OTel 语义约定](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) —— 生产集成实践指南
