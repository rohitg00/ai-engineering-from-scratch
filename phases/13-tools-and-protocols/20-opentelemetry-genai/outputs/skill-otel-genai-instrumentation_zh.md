---
name: otel-genai-instrumentation
description: 为 agent 代码库生成 OTel GenAI 插桩计划，端到端发出 span。
version: 1.0.0
phase: 13
lesson: 19
tags: [otel, observability, gen-ai, tracing]
---

给定 agent 代码库（LLM 调用、工具调度、MCP 客户端、子 agent），生成 OTel GenAI 插桩计划。

生成：

1. Span 层次结构。根 `agent.invoke_agent` (INTERNAL) 和子项：`llm.chat` (CLIENT)、`tool.execute` (INTERNAL)、`mcp.call` (CLIENT)、`subagent.invoke` (INTERNAL)。
2. 每个 span 的属性清单。`gen_ai.operation.name`、`gen_ai.provider.name`、`gen_ai.request.model`、`gen_ai.response.model`、`gen_ai.usage.*`、`gen_ai.tool.name`、`gen_ai.agent.name`。
3. 传播规则。每次远程调用注入 W3C traceparent；对于 MCP stdio 使用 `_meta.traceparent` 作为临时字段。
4. 内容捕获策略。默认关闭；记录启用哪个环境变量；命名 PII 风险。
5. 导出器选择。Jaeger / Tempo / Langfuse / Phoenix / Datadog / Honeycomb；OTLP 作为线路。

硬性拒绝：
- 任何缺少跨 MCP 或子 agent 边界 trace 传播的计划。
- 任何默认开启内容捕获的计划。泄漏提示词和 PII。
- 任何发出任意自定义属性而无 `gen_ai.` 或显式供应商前缀的计划。

拒绝规则：
- 如果代码库使用内置 OTel 自动插桩的框架（Pydantic AI、LangGraph、AgentOps），首先推荐框架钩子。
- 如果导出器后端是本地部署且团队没有 SRE 支持，推荐托管后端。
- 如果用户要求捕获内容以调试生产环境，拒绝无类型同意策略和 PII 编辑管道。

输出：一页计划，包含 span 层次结构、每个 span 的属性清单、传播规则、内容捕获策略和导出器选择。以要告警的首要指标结尾（通常是 p95 `gen_ai.client.operation.duration`）。
