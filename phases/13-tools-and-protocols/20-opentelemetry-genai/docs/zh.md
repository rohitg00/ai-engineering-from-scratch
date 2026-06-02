# OpenTelemetry GenAI — 端到端追踪 tool 调用

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个 agent 调用了 5 个 tool、3 个 MCP server、2 个 sub-agent。你需要用一条 trace 把这一切串起来。OpenTelemetry GenAI 语义约定（v1.37 起属性已稳定）是 2026 年的标准，Datadog、Langfuse、Arize Phoenix、OpenLLMetry、AgentOps 都原生支持。本课会列出必填属性、走完 span 的层级结构（agent → LLM → tool），并给你一份用标准库写的 span emitter，可以接到任何 OTel exporter。

**Type:** Build
**Languages:** Python (stdlib, OTel span emitter)
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 说出 LLM span 和 tool 执行 span 在 OTel GenAI 下的必填属性。
- 构造一棵覆盖 agent loop、LLM 调用、tool 调用、MCP 客户端派发的 trace 层级。
- 决定哪些内容要采集（opt-in），哪些要默认脱敏。
- 把 span 发到本地 collector（Jaeger、Langfuse），不用改写 tool 代码。

## 问题（Problem）

2026 年 2 月的一次 debug：用户反馈「我的 agent 有时要 30 秒才回，有时只要 3 秒」。没有 trace。日志里能看到 LLM 调用，但看不到 tool 派发，看不到 MCP server 的往返，看不到 sub-agent。你只能靠猜。最后才发现：某个 MCP server 偶尔会冷启动卡住。

没有端到端追踪，这种问题根本找不到。OTel GenAI 就是来解决它的。

这套约定在 2025–2026 年由 OpenTelemetry semantic-conventions 工作组定型。它定义了稳定的属性命名，让 Datadog、Langfuse、Phoenix、OpenLLMetry、AgentOps 都能解析同一份 span。一次埋点，发到任何后端。

## 概念（Concept）

### Span 层级（Span hierarchy）

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

整棵树挂在同一个 trace id 下。span id 编织出父子关系。

### 必填属性（Required attributes）

按 2025–2026 的 semconv：

- `gen_ai.operation.name` — `"chat"`、`"text_completion"`、`"embeddings"`、`"execute_tool"`、`"invoke_agent"`。
- `gen_ai.provider.name` — `"openai"`、`"anthropic"`、`"google"`、`"azure_openai"`。
- `gen_ai.request.model` — 请求时指定的模型字符串（如 `"gpt-4o-2024-08-06"`）。
- `gen_ai.response.model` — 实际服务的模型。
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`。
- `gen_ai.response.id` — 用于关联的 provider 响应 id。

tool span 的属性：

- `gen_ai.tool.name` — tool 标识。
- `gen_ai.tool.call.id` — 具体某次调用的 id。
- `gen_ai.tool.description` — tool 描述（可选）。

agent span 的属性：

- `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.agent.description`。

### Span 类型（Span kinds）

- `SpanKind.CLIENT` 用于跨进程边界的调用（LLM provider、MCP server）。
- `SpanKind.INTERNAL` 用于 agent 自身 loop 步骤和 tool 执行。

### 内容采集（Opt-in content capture）

默认情况下，span 只带指标和时间戳——不带 prompt 和 completion。大 payload 和 PII 默认是关闭的。设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` 以及对应的内容采集环境变量才会包含内容。在生产开启前请仔细评估。

### Span 上的事件（Events on spans）

token 级事件可以挂到 span 上作为 span event：

- `gen_ai.content.prompt` — 输入消息。
- `gen_ai.content.completion` — 输出消息。
- `gen_ai.content.tool_call` — 记录的 tool 调用。

事件按时间顺序排在一个 span 内，便于详细回放。

### Exporter（Exporters）

OTel span 可以导出到：

- **Jaeger / Tempo.** OSS，可自部署。
- **Langfuse.** 专做 LLM 可观测性；可视化 token 使用。
- **Arize Phoenix.** 评估 + 追踪一体。
- **Datadog.** 商业产品；原生解析 `gen_ai.*` 属性。
- **Honeycomb.** 列式存储；查询友好。

它们都说 OTLP 这套传输协议。你的代码不用关心。

### 跨 MCP 的传播（Propagation across MCP）

当 MCP 客户端调用 server 时，把 W3C traceparent 头注入请求。Streamable HTTP 支持标准 header。Stdio 原生不带 HTTP header；该规范 2026 路线图正在讨论给 JSON-RPC 调用加一个 `_meta.traceparent` 字段。

在它落地之前：每次请求手动把 traceparent 放进 `_meta`。server 端记录 trace id。

### 指标（Metrics）

除了 span，GenAI semconv 也定义了指标：

- `gen_ai.client.token.usage` — 直方图。
- `gen_ai.client.operation.duration` — 直方图。
- `gen_ai.tool.execution.duration` — 直方图。

不需要每次调用细节的看板，用这些就够。

### AgentOps 这一层（AgentOps layer）

AgentOps（2024 年成立）专做 GenAI 可观测性。它对常见框架（LangGraph、Pydantic AI、CrewAI）做了封装，能自动发出 OTel span。如果你用的是它支持的框架就很方便；否则继续手动埋点。

## 用起来（Use It）

`code/main.py` 把 OTel 形态的 span 以（类似 OTLP-JSON 的）格式打到 stdout，模拟一个 agent 调用 LLM、派发两个 tool、做一次 MCP 往返。没有真正的 exporter——本课重点在 span 的形状和属性集合。把输出粘到任何 OTLP 兼容的查看器里，或者直接读也行。

观察重点：

- 所有 span 共享同一个 trace id。
- 父子关系通过 `parentSpanId` 编码。
- 必填的 `gen_ai.*` 属性都填上了。
- 内容采集默认关闭；其中一个场景通过环境变量打开。

## 上线部署（Ship It）

本课产出 `outputs/skill-otel-genai-instrumentation.md`。给定一个 agent 代码库，这个 skill 会输出一份埋点方案：在哪里加 span、要填哪些属性、目标 exporter 是谁。

## 练习（Exercises）

1. 跑 `code/main.py`。数一数 span 数量，识别哪些是 CLIENT、哪些是 INTERNAL。

2. 打开内容采集（环境变量），确认 `gen_ai.content.prompt` 和 `gen_ai.content.completion` 事件出现了。注意它对 PII 的影响。

3. 加上 tool 执行指标 `gen_ai.tool.execution.duration`，每次调用作为一个直方图样本发出来。

4. 把父 agent span 的 traceparent 传播到一次 MCP 请求的 `_meta.traceparent` 字段中。验证 MCP server 端能看到同一个 trace id。

5. 读 OTel GenAI semconv 规范。挑一个 semconv 列出但本课代码没发出的属性，把它加上。

## 关键术语（Key Terms）

| Term | 别人怎么说 | 实际含义 |
|------|----------------|------------------------|
| OTel | 「OpenTelemetry」 | trace / 指标 / 日志的开放标准 |
| GenAI semconv | 「GenAI 语义约定」 | LLM / tool / agent span 的稳定属性命名 |
| `gen_ai.*` | 「属性命名空间」 | 所有 GenAI 属性都带这个前缀 |
| Span | 「定时操作」 | 一段带起止时间和属性的工作单元 |
| Trace | 「跨 span 的祖先关系」 | 共享 trace id 的 span 树 |
| SpanKind | 「CLIENT / SERVER / INTERNAL」 | 标注 span 方向的提示 |
| OTLP | 「OpenTelemetry Line Protocol」 | exporter 的传输格式 |
| Opt-in content | 「prompt / completion 采集」 | 默认关闭；环境变量打开 |
| traceparent | 「W3C 头」 | 跨服务传播 trace 上下文 |
| Exporter | 「面向后端的发送器」 | 把 span 送到 Jaeger / Datadog 等的组件 |

## 延伸阅读（Further Reading）

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — GenAI span、指标、事件的权威约定
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) — LLM 和 tool 执行 span 的属性清单
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — agent 级别的 `invoke_agent` span
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) — GitHub 上的事实源
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) — 生产集成实战
