# OpenTelemetry GenAI —— 端到端追踪工具调用

> 智能体调用五个工具、三个 MCP 服务器和两个子智能体。你需要一个跨越所有内容的追踪。OpenTelemetry GenAI 语义约定（v1.37 及以上稳定属性）是 2026 年标准，原生支持 Datadog、Langfuse、Arize Phoenix、OpenLLMetry 和 AgentOps。本课命名必需属性，介绍跨度层次结构（智能体 → LLM → 工具），并提供一个 stdlib 跨度发射器，你可以插入任何 OTel 导出器。

**类型：** Build
**语言：** Python（stdlib，OTel 跨度发射器）
**前置知识：** Phase 13 · 07（MCP 服务器），Phase 13 · 08（MCP 客户端）
**时间：** ~75 分钟

## 学习目标

- 命名 LLM 跨度和工具执行跨度的必需 OTel GenAI 属性。
- 构建覆盖智能体循环、LLM 调用、工具调用和 MCP 客户端分发的追踪层次结构。
- 决定捕获什么内容（选择加入）与脱敏什么（默认）。
- 将跨度发射到本地收集器（Jaeger、Langfuse）而无需重写工具代码。

## 问题所在

2026 年 2 月的一次调试：用户报告"我的智能体有时需要 30 秒响应；其他时候 3 秒。"没有追踪。日志显示 LLM 调用，但不显示工具分发、MCP 服务器往返、子智能体。你猜测。最终你发现：一个 MCP 服务器偶尔在冷启动时挂起。

没有端到端追踪，你无法找到这个问题。OTel GenAI 修复了它。

约定在 2025-2026 年 OpenTelemetry 语义约定组下确定。它们定义稳定属性名称，以便 Datadog、Langfuse、Phoenix、OpenLLMetry 和 AgentOps 都解析相同的跨度。一次检测；发送到任何后端。

## 核心概念

### 跨度层次结构

```
agent.invoke_agent  (顶层，INTERNAL 跨度)
 ├── llm.chat       (CLIENT 跨度)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT 跨度)
 ├── llm.chat       (CLIENT 跨度)
 └── subagent.invoke (INTERNAL)
```

整个内容嵌套在一个追踪 ID 下。跨度 ID 链接父子关系。

### 必需属性

根据 2025-2026 语义约定：

- `gen_ai.operation.name` —— `"chat"`、`"text_completion"`、`"embeddings"`、`"execute_tool"`、`"invoke_agent"`。
- `gen_ai.provider.name` —— `"openai"`、`"anthropic"`、`"google"`、`"azure_openai"`。
- `gen_ai.request.model` —— 请求的模型字符串（例如 `"gpt-4o-2024-08-06"`）。
- `gen_ai.response.model` —— 实际服务的模型。
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`。
- `gen_ai.response.id` —— 用于关联的提供商响应 ID。

对于工具跨度：

- `gen_ai.tool.name` —— 工具标识符。
- `gen_ai.tool.call.id` —— 特定调用 ID。
- `gen_ai.tool.description` —— 工具描述（可选）。

对于智能体跨度：

- `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.agent.description`。

### 跨度类型

- `SpanKind.CLIENT` 用于跨越进程边界的调用（LLM 提供商、MCP 服务器）。
- `SpanKind.INTERNAL` 用于智能体自己的循环步骤和工具执行。

### 选择加入内容捕获

默认情况下，跨度携带指标和时序 —— 而非提示或完成。大型负载和 PII 默认关闭。设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` 和特定内容捕获环境变量以包含内容。在生产环境中启用前仔细审查。

### 跨度上的事件

令牌级事件可以作为跨度事件添加：

- `gen_ai.content.prompt` —— 输入消息。
- `gen_ai.content.completion` —— 输出消息。
- `gen_ai.content.tool_call` —— 记录的工具调用。

事件在跨度内按时间排序以进行详细重放。

### 导出器

OTel 跨度导出到：

- **Jaeger / Tempo。** 开源，本地部署。
- **Langfuse。** 针对 LLM 可观察性；可视化令牌使用。
- **Arize Phoenix。** 评估 + 追踪结合。
- **Datadog。** 商业；原生解析 `gen_ai.*` 属性。
- **Honeycomb。** 列导向；查询友好。

所有都使用 OTLP，即传输格式。你的代码不关心。

### 跨 MCP 传播

当 MCP 客户端调用服务器时，将 W3C traceparent 头注入请求。Streamable HTTP 支持标准头。Stdio 原生不携带 HTTP 头；规范的 2026 年路线图讨论在 JSON-RPC 调用上添加 `_meta.traceparent` 字段。

在该功能发布之前：手动在每个请求的 `_meta` 中包含 traceparent。服务器记录追踪 ID。

### 指标

除了跨度，GenAI 语义约定还定义了指标：

- `gen_ai.client.token.usage` —— 直方图。
- `gen_ai.client.operation.duration` —— 直方图。
- `gen_ai.tool.execution.duration` —— 直方图。

将这些用于不需要每次调用详细信息的仪表板。

### AgentOps 层

AgentOps（成立于 2024 年）专注于 GenAI 可观察性。它包装流行的框架（LangGraph、Pydantic AI、CrewAI）以自动发出 OTel 跨度。如果你的堆栈使用受支持的框架，这很有用；否则使用手动检测。

## 使用它

`code/main.py` 为调用 LLM、分发两个工具和进行一次 MCP 往返的智能体发出 OTel 形状的跨度到 stdout（以 OTLP-JSON 类似格式）。没有真正的导出器 —— 本课专注于跨度形状和属性集。将输出粘贴到 OTLP 兼容查看器中或直接阅读。

需要查看的内容：

- 追踪 ID 在所有跨度之间共享。
- 父子链接通过 `parentSpanId` 编码。
- 必需的 `gen_ai.*` 属性已填充。
- 内容捕获默认关闭；一个场景通过环境变量打开它。

## 交付它

本课产出 `outputs/skill-otel-genai-instrumentation.md`。给定一个智能体代码库，该技能产出检测计划：在哪里添加跨度、填充哪些属性以及目标哪些导出器。

## 练习

1. 运行 `code/main.py`。计算跨度并识别哪些是 CLIENT 与 INTERNAL。

2. 打开内容捕获（环境变量）并确认 `gen_ai.content.prompt` 和 `gen_ai.content.completion` 事件出现。注意对 PII 的影响。

3. 添加工具执行指标 `gen_ai.tool.execution.duration` 并将其作为每次调用的直方图样本发出。

4. 将 traceparent 从父智能体跨度传播到 MCP 请求的 `_meta.traceparent` 字段。验证 MCP 服务器将看到相同的追踪 ID。

5. 阅读 OTel GenAI 语义约定规范。识别语义约定中列出但本课代码未发出的一个属性。添加它。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| OTel | "OpenTelemetry" | 追踪、指标、日志的开放标准 |
| GenAI 语义约定 | "GenAI 语义约定" | LLM / 工具 / 智能体跨度的稳定属性名称 |
| `gen_ai.*` | "属性命名空间" | 所有 GenAI 属性共享此前缀 |
| 跨度 | "定时操作" | 具有开始、结束和属性的工作单元 |
| 追踪 | "跨跨度祖先" | 共享追踪 ID 的跨度树 |
| 跨度类型 | "CLIENT / SERVER / INTERNAL" | 关于跨度方向的提示 |
| OTLP | "OpenTelemetry 线路协议" | 导出器的传输格式 |
| 选择加入内容 | "提示 / 完成捕获" | 默认关闭；环境变量启用 |
| traceparent | "W3C 头" | 跨服务传播追踪上下文 |
| 导出器 | "后端特定发送器" | 将跨度发送到 Jaeger / Datadog 等的组件 |

## 延伸阅读

- [OpenTelemetry — GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — GenAI 跨度、指标和事件的规范约定
- [OpenTelemetry — GenAI 跨度](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) — LLM 和工具执行跨度属性列表
- [OpenTelemetry — GenAI 智能体跨度](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — 智能体级 `invoke_agent` 跨度
- [open-telemetry/semantic-conventions — GenAI 跨度](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) — GitHub 托管的真相来源
- [Datadog — LLM OTel 语义约定](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) — 生产集成演练
