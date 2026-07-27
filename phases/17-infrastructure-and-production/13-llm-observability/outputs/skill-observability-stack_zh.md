---
name: observability-stack
description: 根据技术栈、规模、预算和许可状况选择 LLM 可观测性栈（开发平台 + 网关 + 可选的规模层），并定义 OpenTelemetry GenAI 属性集。
version: 1.0.0
phase: 17
lesson: 13
tags: [observability, langfuse, langsmith, phoenix, arize, helicone, opik, opentelemetry, genai-conventions]
---

给定技术栈（LangChain / DSPy / 原生 SDK）、规模（跟踪/天）、预算、许可状况（仅 MIT vs 可商业使用）和自托管要求，生成可观测性方案。

输出：

1. **开发平台选择**。Langfuse（开源）、LangSmith（LangChain 优先的商业产品）、Opik（Comet 开源）或无。根据技术栈和许可证论证。
2. **网关/遥测选择**。Helicone（代理 + 网关）、SigNoz（完整 APM）、OpenLLMetry（纯 OTel）。如果已在使用 AI 网关（阶段 17 · 19），指明集成方式。
3. **规模/数据湖层**。可选；用于长期分析的 Arize AX 或原生 Iceberg，用于 RAG 漂移检测的 Phoenix。
4. **OTel GenAI 约定**。指定最小属性集：`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.usage.output_tokens`、`gen_ai.request.temperature`、`gen_ai.response.finish_reasons`，加上组织特定属性（tenant_id、user_id、task）。
5. **采样策略**。100% 错误、100% 高成本（>$0.10/调用）、N% 成功采样率。原始数据保留窗口（14天/30天/90天）。聚合数据保留更长时间。
6. **告警**。必须设置告警的五个指标：错误率、P99 TTFT、成本/请求、提示缓存命中率、拒绝率。

**硬性拒绝条件：**
- 在框架特定的 SDK 内进行检测而没有 OTel 回退方案。拒绝——框架锁定。
- 在非监管工作负载上以 Datadog 级别定价（>$500/月）保留 100% 的跟踪数据。拒绝——建议采样。
- 忽略 OpenTelemetry GenAI 约定。拒绝——2026 年互操作性需要它们。

**拒绝规则：**
- 如果跟踪数/天 > 500 万且团队坚持完整的 Datadog 保留，拒绝而无成本预测。
- 如果团队是仅 MIT 许可证且选择了 LangSmith，拒绝——Langfuse 是 MIT 等价方案。
- 如果团队没有 AI 网关且选择 Helicone 同时作为网关和可观测性工具，接受——该代理在约 500 RPS 内兼作网关（阶段 17 · 19 涵盖网关规模）。

**输出**：一页方案，指明开发平台、网关、规模层（若有）、OTel 属性集、采样规则、五个告警。最后给出指示栈漂移的单一指标：过去 7 天内具有完整 OTel GenAI 属性的 LLM 调用百分比。
