---
name: llm-observability
description: 构建一个自托管的 LLM 可观测性仪表板，接收 OpenTelemetry GenAI 跨度，运行评估，并在五分钟内捕获注入的回归。
version: 1.0.0
phase: 19
lesson: 11
tags: [capstone, observability, otel, langfuse, phoenix, evals, drift, clickhouse]
---

给定至少六个 SDK 家族（OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM）的生产 LLM 流量，部署一个自托管可观测性平台，接收 OTLP GenAI-semconv 跨度，运行评估，检测漂移并发出警报。

构建计划：

1. OpenTelemetry Collector，带 OTLP HTTP 接收器、尾部采样处理器（保留 100% 错误、10% 成功、100% 高毒性/PII）、导出器到 ClickHouse + S3。
2. ClickHouse 跨度模式反映 GenAI semconv：gen_ai.system、gen_ai.request.model、usage.input/output_tokens、latency_ms、user_id、app_id，以及用于提示/补全的 JSON 包。
3. Postgres 元数据存储，用于应用、用户、会话、注释队列。
4. 每个 SDK 家族在客户端应用上运行 OpenLLMetry 自动仪器化；验证规范跨度落地。
5. DeepEval + RAGAS + Phoenix 评估器包按计划对采样跟踪运行；自定义 LLM 评判器用于 PII 和策略外。
6. 每周 PSI / KL 漂移检测器，基于池化的提示嵌入；警报阈值 0.2。
7. Prometheus 导出器，用于评估分数聚合和延迟百分位数；Alertmanager 到 Slack（警告） + PagerDuty（严重）。
8. Next.js 15 App Router 仪表板：概览、跟踪搜索 + 瀑布图、评估趋势、漂移图表、警报。
9. 回归探测：注入一个响应模式，1% 的时间泄露虚假 SSN；测量 MTTR（警报触发时间）。

评估量规：

| 权重 | 标准 | 衡量方法 |
|:-:|---|---|
| 25 | 跟踪模式覆盖率 | 产生规范 GenAI 跨度的 SDK 家族数量（目标 6+） |
| 20 | 评估正确性 | DeepEval / RAGAS 分数 vs 手工标记集 |
| 20 | 仪表板用户体验 | 注入回归的 MTTR（目标低于 5 分钟） |
| 20 | 成本/规模 | 持续每秒 1k 跨度摄取，无积压 |
| 15 | 告警 + 漂移检测 | Prometheus/Alertmanager 链端到端演练 |

硬性拒绝：

- 使用 OpenTelemetry GenAI semconv 中不存在的属性名称的跨度模式。
- 丢弃错误的尾部采样策略（众所周知的反模式）。
- 以摄取速率运行评估而不采样（不可接受的成本）。
- 显示"延迟"但没有 p50/p95/p99 分离的仪表板。

拒绝规则：

- 拒绝在没有 PII 编辑策略的情况下持久化提示或补全。
- 拒绝声称"多 SDK 支持"而没有每个 SDK 规范跨度回归测试。
- 拒绝在没有基线窗口的情况下发布漂移检测；零样本漂移是无用的。

输出：一个包含收集器配置、ClickHouse 模式、Next.js 15 仪表板、评估作业、漂移检测器、告警链、带有注释回归的 10k 跟踪演示数据集，以及一份记录注入 PII 回归的 MTTR 以及在迭代过程中降低 MTTR 的前三大仪表板 UX 改进的仓库。
