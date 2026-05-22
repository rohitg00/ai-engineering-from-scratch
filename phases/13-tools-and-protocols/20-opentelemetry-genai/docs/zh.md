# OpenTelemetry GenAI — 端到端追踪工具调用

> 一个智能体调用五个工具、三个 MCP 服务器和两个子智能体。你需要一个覆盖所有这些的追踪。OpenTelemetry GenAI 语义约定（v1.37 及以上版本中的稳定属性）是 2026 年的标准，由 Datadog、Langfuse、Arize Phoenix、OpenLLMetry 和 AgentOps 原生支持。本课命名了所需的属性，演练了 span 层次结构（智能体 → LLM → 工具），并发布了一个可以插入任何 OTel 导出器的 stdlib span 发射器。

**类型：** 构建
**语言：** Python (stdlib, OTel span 发射器)
**前置条件：** 阶段 13 · 07 (MCP 服务器), 阶段 13 · 08 (MCP 客户端)
**时间：** ~75 分钟

## 学习目标

- 命名 LLM span 和工具执行 span 所需的 OTel GenAI 属性。
- 构建一个覆盖智能体循环、LLM 调用、工具调用和 MCP 客户端调度的追踪层次结构。
- 决定要捕获什么内容（选择加入）vs 编辑什么（默认）。
- 在不重写工具代码的情况下向本地收集器（Jaeger、Langfuse）发射 span。

## 问题背景

2026 年 2 月的一次调试：用户报告"我的智能体有时需要 30 秒响应；其他时候 3 秒。"没有追踪。日志显示了 LLM 调用，但没有工具调度、没有 MCP 服务器往返、没有子智能体。你猜测。最终你发现：一个 MCP 服务器偶尔在冷启动时挂起。

没有端到端追踪，你无法找到这个。OTel GenAI 修复了它。

这些约定在 2025-2026 年在 OpenTelemetry 语义约定小组下确定。它们定义了稳定的属性名称，以便 Datadog、Langfuse、Phoenix、OpenLLMetry 和 AgentOps 都解析相同的 span。仪表化一次；发送到任何后端。

## 概念详解

### Span 层次结构

```
agent.invoke_agent  (顶层, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

整个事情嵌套在一个追踪 ID 下。Span ID 链接父子关系。

### 必需属性

根据 2025-2026 semconv：

- `gen_ai.operation.name` — `"chat"`、`"text_completion"`、`"embeddings"`、`"execute_tool"`、`"invoke_agent"`。
- `gen_ai.provider.name` — `"openai"`、`"anthropic"`、`"google"`、`"azure_openai"`。
- `gen_ai.request.model` — 请求的模型字符串（例如 `"gpt-4o-2024-08-06"`）。
- `gen_ai.response.model` — 实际服务的模型。
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`。
- `gen_ai.response.id` — 用于关联的提供商响应 ID。

对于工具 span：

- `gen_ai.tool.name` — 工具标识符。
- `gen_ai.tool.call.id` — 特定调用 ID。
- `gen_ai.tool.description` — 工具描述（可选）。

对于智能体 span：

- `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.agent.description`。

### Span 类型

- `SpanKind.CLIENT` 用于跨越进程边界的调用（LLM 提供商、MCP 服务器）。
- `SpanKind.INTERNAL` 用于智能体自己的循环步骤和工具执行。

### 选择加入内容捕获

默认情况下，span 携带指标和计时 — 而不是提示词或补全。大负载和 PII 默认关闭。设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` 和特定内容捕获环境变量以包含内容。在生产中启用之前仔细审查。

### Span 上的事件

令牌级事件可以作为 span 事件添加：

- `gen_ai.content.prompt` — 输入消息。
- `gen_ai.content.completion` — 输出消息。
- `gen_ai.content.tool_call` — 记录的工具调用。

事件在 span 内按时间顺序用于详细重放。

### 导出器

OTel span 导出到：

- **Jaeger / Tempo。** OSS，本地部署。
- **Langfuse。** LLM 可观测性专用；可视化令牌使用。
- **Arize Phoenix。** Evals + 追踪组合。
- **Datadog。** 商业；原生解析 `gen_ai.*` 属性。
- **Honeycomb。** 面向列的；查询友好。

都讲 OTLP，线路格式。你的代码不在乎。

### 跨 MCP 传播

当 MCP 客户端调用服务器时，将 W3C traceparent 头部注入请求。Streamable HTTP 支持标准头部。Stdio 本身不携带 HTTP 头部；规范的 2026 路线图讨论了在 JSON-RPC 调用上添加 `_meta.traceparent` 字段。

在那发布之前：手动在每个请求的 `_meta` 中包含 traceparent。服务器记录追踪 ID。

### 指标

除了 span，GenAI semconv 还定义了指标：

- `gen_ai.client.token.usage` — 直方图。
- `gen_ai.client.operation.duration` — 直方图。
- `gen_ai.tool.execution.duration` — 直方图。

将这些用于不需要每调用详细信息的仪表板。

### AgentOps 层

AgentOps（成立于 2024 年）专门从事 GenAI 可观测性。它包装流行框架（LangGraph、Pydantic AI、CrewAI）以自动发射 OTel span。如果你的技术栈使用支持的框架则很有用；否则使用手动仪表化。

## 使用示例

`code/main.py` 向 stdout 发射 OTel 形状的 span（在 OTLP-JSON 类似的格式中）用于调用 LLM、调度两个工具和进行一次 MCP 往返的智能体。没有真正的导出器 — 课程专注于 span 形态和属性集。将输出粘贴到 OTLP 兼容的查看器或直接读取它。

需要关注的点：

- 追踪 ID 在所有 span 之间共享。
- 父子链接通过 `parentSpanId` 编码。
- 必需的 `gen_ai.*` 属性被填充。
- 内容捕获默认关闭；一个场景通过环境变量打开它。

## 实战输出

本课生成 `outputs/skill-otel-genai-instrumentation.md`。给定一个智能体代码库，该技能生成仪表化计划：在哪里添加 span、要填充哪些属性，以及要定位哪些导出器。

## 练习

1. 运行 `code/main.py`。计算 span 并识别哪些是 CLIENT vs INTERNAL。

2. 打开内容捕获（环境变量）并确认 `gen_ai.content.prompt` 和 `gen_ai.content.completion` 事件出现。注意对 PII 的影响。

3. 添加工具执行指标 `gen_ai.tool.execution.duration` 并将其作为每次调用的直方图样本发射。

4. 将 traceparent 从父智能体 span 传播到 MCP 请求的 `_meta.traceparent` 字段。验证 MCP 服务器将看到相同的追踪 ID。

5. 阅读 OTel GenAI semconv 规范。识别课程代码未发射的 semconv 中列出的一个属性。添加它。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| OTel | "OpenTelemetry" | 追踪、指标、日志的开放标准 |
| GenAI semconv | "GenAI 语义约定" | LLM / 工具 / 智能体 span 的稳定属性名称 |
| `gen_ai.*` | "属性命名空间" | 所有 GenAI 属性共享此前缀 |
| Span | "计时操作" | 具有开始、结束和属性的工作单位 |
| Trace | "跨 span 祖先" | 共享追踪 ID 的 span 树 |
| SpanKind | "CLIENT / SERVER / INTERNAL" | 关于 span 方向的提示 |
| OTLP | "OpenTelemetry Line Protocol" | 导出器的线路格式 |
| 选择加入内容 | "提示词 / 补全捕获" | 默认关闭；环境变量启用 |
| traceparent | "W3C 头部" | 跨服务传播追踪上下文 |
| 导出器 | "后端特定运输器" | 将 span 发送到 Jaeger / Datadog / 等的组件 |

## 延伸阅读

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — GenAI span、指标和事件的权威约定
- [OpenTelemetry — GenAI span](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) — LLM 和工具执行 span 属性列表
- [OpenTelemetry — GenAI 智能体 span](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — 智能体级 `invoke_agent` span
- [open-telemetry/semantic-conventions — GenAI span](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) — GitHub 托管的真相源
- [Datadog — LLM OTel 语义约定](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) — 生产集成演练
