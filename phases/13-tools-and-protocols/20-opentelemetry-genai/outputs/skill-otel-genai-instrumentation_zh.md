---
name: otel-genai-instrumentation
description: 为智能体代码库生成端到端 OTel GenAI 跨度检测计划。
version: 1.0.0
phase: 13
lesson: 19
tags: [otel, observability, gen-ai, tracing]
---

给定一个智能体代码库（LLM 调用、工具分发、MCP 客户端、子智能体），生成 OTel GenAI 检测计划。

产出：

1. **跨度层次。** 根节点 `agent.invoke_agent`（INTERNAL）及子节点：`llm.chat`（CLIENT）、`tool.execute`（INTERNAL）、`mcp.call`（CLIENT）、`subagent.invoke`（INTERNAL）。
2. **每个跨度的属性检查清单。** `gen_ai.operation.name`、`gen_ai.provider.name`、`gen_ai.request.model`、`gen_ai.response.model`、`gen_ai.usage.*`、`gen_ai.tool.name`、`gen_ai.agent.name`。
3. **传播规则。** 在每次远程调用时注入 W3C traceparent；对于 MCP stdio，使用 `_meta.traceparent` 作为临时字段。
4. **内容捕获策略。** 默认关闭；记录哪个环境变量启用；指出 PII 风险。
5. **导出器选择。** Jaeger / Tempo / Langfuse / Phoenix / Datadog / Honeycomb；传输协议使用 OTLP。

硬拒绝：
- 任何缺少跨 MCP 或子智能体边界追踪传播的计划。
- 任何默认开启内容捕获的计划。会泄漏提示和 PII。
- 任何发出任意自定义属性而没有 `gen_ai.` 或显式供应商前缀的计划。

拒绝规则：
- 如果代码库使用具有内置 OTel 自动检测功能的框架（Pydantic AI、LangGraph、AgentOps），推荐优先使用框架钩子。
- 如果导出器后端是本地部署且团队没有 SRE 支持，推荐托管后端。
- 如果用户要求捕获内容用于生产环境调试，拒绝，除非有类型化的同意策略和 PII 脱敏管线。

输出：一页计划，包含跨度层次、每个跨度的属性检查清单、传播规则、内容捕获策略和导出器选择。最后以应设置警报的首要指标结尾（通常为 p95 `gen_ai.client.operation.duration`）。
