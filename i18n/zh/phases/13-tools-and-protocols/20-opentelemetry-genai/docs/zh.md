# OpenTelemetry GenAI — 端到端追踪工具调用

> 一个 Agent 调用五个工具、三个 MCP 服务器和两个子 Agent。你需要一条覆盖全部环节的 trace。OpenTelemetry GenAI 语义约定（v1.37 及以上为稳定属性）是 2026 年的标准，被 Datadog、Langfuse、Arize Phoenix、OpenLLMetry 和 AgentOps 原生支持。本课讲解必需属性、遍历 span 层级结构（agent → LLM → tool），并提供一个可插入任何 OTel exporter 的 stdlib span 发射器。

**Type:** Build
**Languages:** Python（stdlib，OTel span 发射器）
**Prerequisites:** Phase 13 · 07（MCP server），Phase 13 · 08（MCP client）
**Time:** 约 75 分钟

## 学习目标

- 说出 LLM span 和工具执行 span 所需的 OTel GenAI 属性。
- 构建覆盖 agent 循环、LLM 调用、工具调用和 MCP client 调度的 trace 层级。
- 决定捕获哪些内容（opt-in）以及默认脱敏（redact）哪些内容。
- 将 span 发射到本地 collector（Jaeger、Langfuse），而无需重写工具代码。

## 问题

2026 年 2 月的一次调试：用户反馈"我的 agent 有时 30 秒才响应，有时 3 秒。"没有 trace。日志里有 LLM 调用，但没有工具调度、没有 MCP 服务器往返、也没有子 Agent。你只能靠猜。最终你发现：某个 MCP 服务器偶尔在冷启动时挂起。

没有端到端追踪，你无法定位这类问题。OTel GenAI 解决了它。

这些约定在 2025-2026 年间由 OpenTelemetry semantic-conventions 组织定稿。它们定义了稳定的属性名，使 Datadog、Langfuse、Phoenix、OpenLLMetry 和 AgentOps 都能解析相同的 span。插桩一次；发送到任意后端。

## 概念

### Span 层级

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

一切都嵌套在同一个 trace id 下。Span id 表达父子关系。

### 必需属性

按照 2025-2026 年的 semconv：

- `gen_ai.operation.name` — `"chat"`、`"text_completion"`、`"embeddings"`、`"execute_tool"`、`"invoke_agent"`。
- `gen_ai.provider.name` — `"openai"`、`"anthropic"`、`"google"`、`"azure_openai"`。
- `gen_ai.request.model` — 请求的模型字符串（例如 `"gpt-4o-2024-08-06"`）。
- `gen_ai.response.model` — 实际服务的模型。
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`。
- `gen_ai.response.id` — 提供方的响应 id，用于关联。

工具 span：

- `gen_ai.tool.name` — 工具标识符。
- `gen_ai.tool.call.id` — 具体的调用 id。
- `gen_ai.tool.description` — 工具描述（可选）。

Agent span：

- `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.agent.description`。

### Span 种类

- `SpanKind.CLIENT` 用于跨越进程边界的调用（LLM 提供方、MCP 服务器）。
- `SpanKind.INTERNAL` 用于 agent 自身的循环步骤和工具执行。

### Opt-in 内容捕获

默认情况下，span 只携带指标和计时 —— 不包含 prompt 和 completion。大负载和 PII 默认关闭。设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` 和特定的内容捕获环境变量可包含内容。在生产环境启用前请仔细评估。

### Span 上的事件

Token 级别的事件可以作为 span event 添加：

- `gen_ai.content.prompt` — 输入消息。
- `gen_ai.content.completion` — 输出消息。
- `gen_ai.content.tool_call` — 按记录记录的工具调用。

事件在 span 内按时间排序，便于详细回放。

### Exporter

OTel span 可导出到：

- **Jaeger / Tempo。** 开源、本地部署。
- **Langfuse。** 专注 LLM 可观测性；可视化 token 用量。
- **Arize Phoenix。** 评测 + 追踪结合。
- **Datadog。** 商业产品；原生解析 `gen_ai.*` 属性。
- **Honeycomb。** 列式存储；查询友好。

它们都说 OTLP —— 即线上传输格式。你的代码无需关心。

### 跨 MCP 的传播

当 MCP client 调用服务器时，将 W3C traceparent 头注入请求。Streamable HTTP 支持标准头。Stdio 原生不携带 HTTP 头；规范的 2026 路线图讨论在 JSON-RPC 调用上增加 `_meta.traceparent` 字段。

在该功能落地之前：手动将 traceparent 包含在每个请求的 `_meta` 中。服务器记录 trace id。

### 指标

与 span 并行，GenAI semconv 还定义了指标：

- `gen_ai.client.token.usage` — 直方图。
- `gen_ai.client.operation.duration` — 直方图。
- `gen_ai.tool.execution.duration` — 直方图。

用于不需要每次调用细节的仪表盘。

### AgentOps 层

AgentOps（成立于 2024 年）专注于 GenAI 可观测性。它封装流行框架（LangGraph、Pydantic AI、CrewAI）以自动发射 OTel span。如果你的技术栈使用受支持的框架会很有用；否则使用手动插桩。

```figure
t3-span-waterfall
```

## 使用它

`code/main.py` 向 stdout 发射 OTel 形状的 span（以类 OTLP-JSON 格式），模拟一个调用 LLM、调度两个工具并进行一次 MCP 往返的 agent。没有真实的 exporter —— 本课聚焦 span 形状和属性集。将输出粘贴到 OTLP 兼容的查看器中，或直接阅读。

关注点：

- Trace id 在所有 span 之间共享。
- 父子链接通过 `parentSpanId` 编码。
- 必需的 `gen_ai.*` 属性已填充。
- 内容捕获默认关闭；一个场景通过环境变量将其开启。

## 发布它

本课产出 `outputs/skill-otel-genai-instrumentation.md`。给定一个 agent 代码库，该技能会产出插桩计划：在哪里添加 span、填充哪些属性、以及目标 exporter。

## 练习

1. 运行 `code/main.py`。数一数 span 数量，并辨别哪些是 CLIENT，哪些是 INTERNAL。

2. 开启内容捕获（环境变量），确认 `gen_ai.content.prompt` 和 `gen_ai.content.completion` 事件出现。注意其对 PII 的影响。

3. 添加工具执行指标 `gen_ai.tool.execution.duration`，并按每次调用发射一个直方图样本。

4. 将 traceparent 从父 agent span 传播到 MCP 请求的 `_meta.traceparent` 字段。验证 MCP 服务器将看到相同的 trace id。

5. 阅读 OTel GenAI semconv 规范。找出一个 semconv 中列出但本课代码未发射的属性。将其添加。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| OTel | "OpenTelemetry" | 追踪、指标、日志的开放标准 |
| GenAI semconv | "GenAI 语义约定" | LLM / 工具 / agent span 的稳定属性名 |
| `gen_ai.*` | "属性命名空间" | 所有 GenAI 属性共享此前缀 |
| Span | "带计时的操作" | 一个有开始、结束和属性的工作单元 |
| Trace | "跨 span 的祖先关系" | 共享同一 trace id 的 span 树 |
| SpanKind | "CLIENT / SERVER / INTERNAL" | 关于 span 方向的提示 |
| OTLP | "OpenTelemetry Line Protocol" | exporter 的线上传输格式 |
| Opt-in 内容 | "prompt / completion 捕获" | 默认关闭；通过环境变量启用 |
| traceparent | "W3C 头" | 跨服务传播 trace 上下文 |
| Exporter | "面向后端的发送组件" | 将 span 发送到 Jaeger / Datadog 等的组件 |

## 延伸阅读

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — GenAI span、指标和事件的权威约定
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) — LLM 和工具执行 span 属性列表
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — agent 级别的 `invoke_agent` span
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) — GitHub 上的事实来源
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) — 生产环境集成指南