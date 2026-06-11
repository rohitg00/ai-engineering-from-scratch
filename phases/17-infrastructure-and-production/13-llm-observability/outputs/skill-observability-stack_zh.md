---
name: observability-stack
description: 根据技术栈、规模、预算和许可证态势选择 LLM 可观测性栈（开发平台 + 网关 + 可选扩展层），并定义 OpenTelemetry GenAI 属性集。
version: 1.0.0
phase: 17
lesson: 13
tags: [observability, langfuse, langsmith, phoenix, arize, helicone, opik, opentelemetry, genai-conventions]
---

给定技术栈（LangChain / DSPy / raw SDK）、规模（跟踪/天）、预算、许可证态势（仅 MIT 与商业 OK）和自托管需求，生成可观测性计划。

生成：

1. 开发平台选择。Langfuse（OSS）、LangSmith（LangChain 优先商业）、Opik（Comet OSS）或无。根据技术栈和许可证证明。
2. 网关/遥测选择。Helicone（代理 + 网关）、SigNoz（完整 APM）、OpenLLMetry（纯 OTel）。如果已使用 AI 网关（Phase 17 · 19），命名集成。
3. 扩展/湖层。可选；Arize AX 或原始 Iceberg 用于长期分析，Phoenix 用于 RAG 漂移。
4. OTel GenAI 约定。指定最小属性集：`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.usage.output_tokens`、`gen_ai.request.temperature`、`gen_ai.response.finish_reasons`，加上组织特定（tenant_id、user_id、task）。
5. 采样策略。100% 错误、100% 高成本（>$0.10/调用）、N% 成功采样率。原始保留窗口（14d / 30d / 90d）。聚合保留更长时间。
6. 告警。五个必须有告警的指标：error rate、P99 TTFT、cost/request、prompt-cache hit rate、refusal rate。

硬性拒绝：
- 在框架特定 SDK 内插桩而没有 OTel 回退。拒绝——框架锁定。
- 以 Datadog 级定价 >$500/月保留 100% 跟踪用于非受监管工作负载。拒绝——推荐采样。
- 忽略 OpenTelemetry GenAI 约定。拒绝——2026 年互操作性需要它们。

拒绝规则：
- 如果跟踪/天 > 5M 且团队坚持完整 Datadog 保留，没有成本预测就拒绝。
- 如果团队仅 MIT 且选择 LangSmith，拒绝——Langfuse 是 MIT 等效物。
- 如果团队没有 AI 网关且选择 Helicone 作为网关 AND 可观测性，接受——代理在约 500 RPS 以下兼作网关（Phase 17 · 19 涵盖网关规模）。

输出：一页计划，命名开发平台、网关、扩展层（如有）、OTel 属性集、采样规则、五个告警。以信号栈漂移的单一指标结束：过去 7 天具有完整 OTel GenAI 属性的 LLM 调用百分比。
