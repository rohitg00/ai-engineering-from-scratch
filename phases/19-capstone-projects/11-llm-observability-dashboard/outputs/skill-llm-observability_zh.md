---
name: llm-observability
description: 构建自托管LLM可观测性仪表板，摄取OpenTelemetry GenAI span，运行评估，并在五分钟内捕获注入回归。
version: 1.0.0
phase: 19
lesson: 11
tags: [capstone, observability, otel, langfuse, phoenix, evals, drift, clickhouse]
---

给定跨至少六个SDK家族（OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM）的生产LLM流量，部署一个自托管可观测性平面，摄取OTLP GenAI-semconv span，运行评估，检测漂移并告警。

构建计划：

1. OpenTelemetry Collector，含OTLP HTTP接收器、尾采样处理器（保留100%错误、10%成功、100%高毒性/PII）、导出到ClickHouse + S3。
2. ClickHouse span模式镜像GenAI semconv：gen_ai.system、gen_ai.request.model、usage.input/output_tokens、latency_ms、user_id、app_id，加上prompts/completions的JSON包。
3. Postgres元数据存储，用于应用、用户、会话、注释队列。
4. 每个SDK家族的客户端应用上的OpenLLMetry自动仪表化；验证规范span落地。
5. DeepEval + RAGAS + Phoenix评估器包，按计划运行在采样trace上；用于PII和离策略的自定义LLM评判。
6. 每周PSI / KL漂移检测器，在汇集的prompt嵌入上；告警阈值0.2。
7. Prometheus导出器，用于评估分数聚合和延迟百分位数；Alertmanager到Slack（警告）+ PagerDuty（严重）。
8. Next.js 15 App Router仪表板：概览、trace搜索 + 瀑布图、评估趋势、漂移图表、告警。
9. 回归探测：注入1%时间泄露假SSN的响应模式；测量MTTR（告警触发时间）。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | Trace模式覆盖率 | 产生规范GenAI span的SDK家族数量（目标6+） |
| 20 | 评估正确性 | DeepEval / RAGAS分数 vs 手工标记集 |
| 20 | 仪表板UX | 注入回归上的MTTR（目标低于5分钟） |
| 20 | 成本/规模 | 持续1k span/秒摄取无积压 |
| 15 | 告警 + 漂移检测 | Prometheus/Alertmanager链端到端运行 |

硬性拒绝：
- 发明OpenTelemetry GenAI semconv中不存在的属性名的span模式。
- 丢弃错误的尾采样策略（众所周知的反模式）。
- 在摄取速率下无采样运行评估（不可接受的成本）。
- 显示"延迟"而没有p50/p95/p99分离的仪表板。

拒绝规则：
- 拒绝在没有PII修订策略的情况下持久化prompt或completion。
- 拒绝在没有每SDK规范span回归测试的情况下声称"多SDK支持"。
- 拒绝在没有基线窗口的情况下发布漂移检测；零样本漂移是无用的。

输出：包含收集器配置、ClickHouse模式、Next.js 15仪表板、评估作业、漂移检测器、告警链、带注释回归的10k-trace演示数据集，以及一份记录注入PII回归的MTTR及迭代中降低MTTR的前三大仪表板UX改进的撰写的仓库。
