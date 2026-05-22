# 综合项目 11 — LLM 可观测性与评估仪表板

> Langfuse 转向了开放核心。Arize Phoenix 发布了 2026 年 GenAI 语义约定映射。Helicone 和 Braintrust 都加倍投注在每用户成本归因上。Traceloop 的 OpenLLMetry 成为事实上的 SDK 仪器化标准。生产形态是 ClickHouse 用于追踪、Postgres 用于元数据、Next.js 用于 UI，以及一小批评估作业（DeepEval、RAGAS、LLM-judge）在采样追踪上运行。构建一个自托管的，从至少四个 SDK 家族摄取，并演示在五分钟内捕获注入的回归。

**类型：** 综合项目
**语言：** TypeScript（UI）、Python / TypeScript（摄取 + 评估）、SQL（ClickHouse）
**前置条件：** 第 11 阶段（LLM 工程）、第 13 阶段（工具）、第 17 阶段（基础设施）、第 18 阶段（安全）
**涉及阶段：** P11 · P13 · P17 · P18
**时间：** 25 小时

## 问题描述

2026 年每个运行生产流量的 AI 团队都保留着一个可观测性平面，与模型并行。成本归因。幻觉检测。漂移监控。越狱信号。SLO 仪表板。PII 泄漏警报。开源参考——Langfuse、Phoenix、OpenLLMetry——汇聚在 OpenTelemetry GenAI 语义约定作为摄取 schema 上。你现在可以用一个 SDK 对 OpenAI、Anthropic、Google、LangChain、LlamaIndex 和 vLLM 进行检测，并发送兼容的 span。

你将构建一个自托管的仪表板，从至少四个 SDK 家族摄取，在采样追踪上运行一小批评估作业，检测漂移，并发出警报。测量标准：给定一个故意注入的回归（一个开始产生 PII 的提示），仪表板在五分钟内捕获它并发出警报。

## 核心概念

摄取是 OTLP HTTP。SDK 产生 GenAI 语义约定 span：`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.response.id`、`llm.prompts`、`llm.completions`。Span 降落在 ClickHouse 中用于列式分析；元数据（用户、会话、应用）降落在 Postgres 中。

评估作为批处理作业在采样追踪上运行。DeepEval 对 Faithfulness、Toxicity 和 Answer Relevance 评分。当追踪携带检索上下文时，RAGAS 对检索指标评分。自定义 LLM 裁判运行领域特定检查（PII 泄漏、偏离策略响应）。评估运行写回同一个 ClickHouse，作为链接到父追踪的评估 span。

漂移检测观察随时间变化的嵌入空间分布（prompt 嵌入上的 PSI 或 KL 散度）加上评估分数趋势。警报推送至 Prometheus Alertmanager，然后推送到 Slack / PagerDuty。UI 是带有 Recharts 的 Next.js 15。

## 架构

```
生产应用：
  OpenAI SDK  +  Anthropic SDK  +  Google GenAI SDK
  LangChain + LlamaIndex + vLLM
       |
       v
  OpenTelemetry SDK 带 GenAI 语义约定
       |
       v  OTLP HTTP
  收集器（摄取、采样、扇出）
       |
       +-------------+-----------+
       v             v           v
   ClickHouse    Postgres    S3 归档
   （spans）       （元数据）  （原始事件）
       |
       +---> 评估作业（DeepEval、RAGAS、LLM-judge）
       |     采样或全追踪
       |     写回评估 span
       |
       +---> 漂移检测器（prompt 嵌入上的 PSI / KL）
       |
       +---> Prometheus 指标 -> Alertmanager -> Slack / PagerDuty
       |
       v
   Next.js 15 仪表板（Recharts）
```

## 技术栈

- 摄取：OpenTelemetry SDK + GenAI 语义约定；OTLP HTTP 传输
- 收集器：带有尾部采样处理器（用于成本控制）的 OpenTelemetry Collector
- 存储：ClickHouse 用于 span，Postgres 用于元数据，S3 用于原始事件归档
- 评估：DeepEval、RAGAS 0.2、Arize Phoenix 评估器包、自定义 LLM 裁判
- 漂移：池化 prompt 嵌入上的 PSI / KL（sentence-transformers），每周
- 警报：Prometheus Alertmanager -> Slack / PagerDuty
- UI：Next.js 15 App Router + Recharts + 服务器操作
- 开箱即用的 SDK 支持：OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM

## 构建步骤

1. **收集器配置。** 带有 OTLP HTTP 接收器、保留 100% 错误追踪和 10% 成功追踪的尾部采样器，以及导出到 ClickHouse 和 S3 的 OpenTelemetry Collector。

2. **ClickHouse schema。** 表 `spans` 的列镜像 GenAI 语义约定：`gen_ai_system`、`gen_ai_request_model`、`input_tokens`、`output_tokens`、`latency_ms`、`prompt_hash`、`trace_id`、`parent_span_id`，加上用于长载荷的 JSON 包。按 user_id 和 app_id 添加二级索引。

3. **SDK 覆盖测试。** 使用每个 SDK（OpenAI、Anthropic、Google、LangChain、LlamaIndex、vLLM）编写一个小型客户端应用，带 OpenLLMetry 自动仪器化。验证每个都产生降落在 ClickHouse 中的规范 GenAI span。

4. **评估作业。** 一个调度作业读取最近 15 分钟的采样追踪，并运行 DeepEval Faithfulness、Toxicity 和 Answer Relevance。输出是链接到父追踪的评估 span。

5. **自定义 LLM 裁判。** 一个 PII 泄漏裁判：给定一个响应，调用守卫 LLM 对 PII 泄漏可能性评分。高分响应降落在分诊队列中。

6. **漂移检测。** 每周作业计算本周池化 prompt 嵌入与 trailing 4 周基线之间的 PSI。如果 PSI 高于阈值，发出警报。

7. **仪表板。** 带有页面的 Next.js 15：概览（spans/秒、成本/用户、p95 延迟）、追踪（搜索 + 瀑布图）、评估（Faithfulness 趋势、Toxicity）、漂移（随时间变化的 PSI）、警报。

8. **警报链。** Prometheus 导出器读取评估分数聚合和延迟百分位数；Alertmanager 路由到 Slack 用于警告，路由到 PagerDuty 用于严重违规。

9. **回归探针。** 注入一个 bug：被评估的聊天机器人开始 1% 的时间泄漏虚假 SSN。测量 MTTR：从 bug 部署到 Slack 警报。

## 使用示例

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[collector]  接受了 1 个追踪，3 个 span
[clickhouse] 插入了 3 个 span（app=chat，user=u_42）
[eval]        DeepEval faithfulness 0.82，toxicity 0.03
[drift]       每周 PSI 0.08（低于 0.2 阈值）
[ui]          直播在 https://obs.example.com
```

## 交付成果

`outputs/skill-llm-observability.md` 是可交付成果。给定一个 LLM 应用，仪表板摄取其追踪、运行评估、对漂移发出警报，并在 Next.js 中呈现成本/用户细分。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 追踪 schema 覆盖 | 产生规范 GenAI span 的 SDK 家族数量（目标：6+） |
| 20 | 评估正确性 | DeepEval / RAGAS 分数 vs 手工标注集 |
| 20 | 仪表板 UX | 注入回归的 MTTR（目标低于 5 分钟） |
| 20 | 成本 / 规模 | 在 1k spans/秒 下持续摄取而无积压 |
| 15 | 警报 + 漂移检测 | Prometheus/Alertmanager 链端到端执行 |
| **100** | | |

## 练习

1. 为 Haystack 框架添加自定义仪器化。验证规范的 span 降落在 ClickHouse 中，带有忠实的 `gen_ai.*` 属性。

2. 在同一追踪上将 DeepEval 换为 Phoenix 评估器。测量两个评估引擎之间的分数漂移。

3. 锐化漂移检测器：按 app-id 计算 PSI 而非全局。显示每应用漂移轨迹。

4. 添加一个"用户影响"页面：带有 sparklines 的每用户成本和每用户失败率。

5. 构建一个尾部采样策略，保留 toxicity > 0.5 的 100% 追踪，加上其余的 10% 分层采样。测量引入的采样偏差。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| GenAI 语义约定 | "OTel LLM 属性" | 2025 OpenTelemetry LLM span 属性规范（system、model、tokens） |
| 尾部采样 | "追踪后采样" | 收集器在追踪完成后决定保留或丢弃（可以偷看错误） |
| PSI | "总体稳定性指数" | 比较两个分布的漂移指标；> 0.2 通常表示有意义的漂移 |
| LLM 裁判 | "作为模型的评估" | 一个 LLM 按评分标准对另一个 LLM 的输出评分（Faithfulness、Toxicity、PII） |
| 尾部采样策略 | "保留规则" | 决定保留哪些追踪 vs 丢弃的规则；错误 + 采样率 |
| 评估 span | "链接的评估追踪" | 携带评估分数的子 span，链接到原始 LLM 调用 span |
| 每用户成本 | "单位经济" | 在窗口内归因到 user_id 的美元成本；关键产品指标 |

## 延伸阅读

- [Langfuse](https://github.com/langfuse/langfuse) — 参考开放核心可观测性平台
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — 带有强大漂移支持的备选参考
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) — 自动仪器化 SDK 家族
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 摄取 schema
- [Helicone](https://www.helicone.ai) — 备选托管可观测性
- [Braintrust](https://www.braintrust.dev) — 备选评估优先平台
- [ClickHouse 文档](https://clickhouse.com/docs) — 列式 span 存储
- [DeepEval](https://github.com/confident-ai/deepeval) — 评估器库
