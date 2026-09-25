# 毕业项目 11 — LLM 可观测性与评估仪表盘

> Langfuse 转向了 open-core 模式。Arize Phoenix 发布了 2026 年 GenAI 语义约定的映射。Helicone 和 Braintrust 都在按用户成本归集上加倍投入。Traceloop 的 OpenLLMetry 成为了事实上的 SDK 埋点标准。生产环境的标准形态是：ClickHouse 存储轨迹，Postgres 存储元数据，Next.js 作为 UI，外加一支小型评估任务大军（DeepEval、RAGAS、LLM-judge）在采样轨迹上运行。搭建一个自托管系统，支持至少四种 SDK 族的接入，并演示在五分钟内捕获一次注入的回归。

**Type:** 毕业项目
**Languages:** TypeScript（UI）、Python / TypeScript（接入 + 评估）、SQL（ClickHouse）
**Prerequisites:** 阶段 11（LLM 工程）、阶段 13（工具）、阶段 17（基础设施）、阶段 18（安全）
**Phases exercised:** P11 · P13 · P17 · P18
**Time:** 25 小时

## 问题

2026 年，每个承载生产流量的 AI 团队都会在模型旁边部署一个可观测平面。成本归集。幻觉检测。漂移监控。越狱信号。SLO 仪表盘。PII 泄露告警。开源参考实现——Langfuse、Phoenix、OpenLLMetry——已收敛到以 OpenTelemetry GenAI 语义约定作为接入 schema。现在你可以用一套 SDK 为 OpenAI、Anthropic、Google、LangChain、LlamaIndex 和 vLLM 做埋点，并输出兼容的 span。

你将构建一个自托管仪表盘，它能从至少四种 SDK 族接入数据、在采样轨迹上运行一小批评估任务、检测漂移并发出告警。度量标准：给定一个故意注入的回归（一个开始泄露 PII 的提示词），仪表盘需在五分钟内捕获它并触发告警。

## 概念

接入使用 OTLP HTTP。SDK 产出 GenAI-semconv span：`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.response.id`、`llm.prompts`、`llm.completions`。Span 落入 ClickHouse 用于列式分析；元数据（用户、会话、应用）落入 Postgres。

评估以批处理任务的形式在采样轨迹上运行。DeepEval 评分 faithfulness、toxicity 和 answer relevance。当轨迹携带检索上下文时，RAGAS 计算检索指标。自定义 LLM-judge 运行领域特定的检查（PII 泄露、偏离政策的回复）。评估运行以评估 span 的形式写回同一个 ClickHouse，并关联到父轨迹。

漂移检测监控随时间变化的嵌入空间分布（对提示词嵌入做 PSI 或 KL 散度），外加评估分数趋势。告警输入 Prometheus Alertmanager，再转发到 Slack / PagerDuty。UI 是 Next.js 15 配 Recharts。

## 架构

```
production apps:
  OpenAI SDK  +  Anthropic SDK  +  Google GenAI SDK
  LangChain + LlamaIndex + vLLM
       |
       v
  OpenTelemetry SDK with GenAI semconv
       |
       v  OTLP HTTP
  collector (ingest, sample, fan-out)
       |
       +-------------+-----------+
       v             v           v
   ClickHouse    Postgres    S3 archive
   (spans)       (metadata)  (raw events)
       |
       +---> eval jobs (DeepEval, RAGAS, LLM-judge)
       |     sampled or all-trace
       |     write eval spans back
       |
       +---> drift detector (PSI / KL on prompt embeddings)
       |
       +---> Prometheus metrics -> Alertmanager -> Slack / PagerDuty
       |
       v
   Next.js 15 dashboard (Recharts)
```

## 技术栈

- 接入：OpenTelemetry SDK + GenAI 语义约定；OTLP HTTP 传输
- 采集器：OpenTelemetry Collector，带尾部采样处理器（用于成本控制）
- 存储：ClickHouse 存 span，Postgres 存元数据，S3 存原始事件归档
- 评估：DeepEval、RAGAS 0.2、Arize Phoenix 评估器包、自定义 LLM-judge
- 漂移：每周对聚合的提示词嵌入（sentence-transformers）计算 PSI / KL
- 告警：Prometheus Alertmanager -> Slack / PagerDuty
- UI：Next.js 15 App Router + Recharts + server actions
- 开箱即用支持的 SDK：OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM

```figure
ce-otel-drift
```

## 动手构建

1. **采集器配置。** OpenTelemetry Collector，带 OTLP HTTP receiver、一个保留 100% 错误轨迹和 10% 成功轨迹的尾部采样器，以及导出到 ClickHouse 和 S3 的 exporter。

2. **ClickHouse schema。** 表 `spans`，其列与 GenAI semconv 对应：`gen_ai_system`、`gen_ai_request_model`、`input_tokens`、`output_tokens`、`latency_ms`、`prompt_hash`、`trace_id`、`parent_span_id`，外加一个 JSON 袋用于存放长 payload。按 user_id 和 app_id 添加二级索引。

3. **SDK 覆盖测试。** 用每个 SDK（OpenAI、Anthropic、Google、LangChain、LlamaIndex、vLLM）配合 OpenLLMetry 自动埋点编写一个小客户端应用。验证每个 SDK 都产出规范的 GenAI span 并落入 ClickHouse。

4. **评估任务。** 一个定时任务读取最近 15 分钟的采样轨迹，运行 DeepEval 的 faithfulness、toxicity 和 answer relevance。输出为关联到父轨迹的评估 span。

5. **自定义 LLM-judge。** 一个 PII 泄露 judge：给定一条回复，调用一个 guard LLM 评估 PII 泄露的可能性。高分的回复进入分诊队列。

6. **漂移检测。** 每周任务计算本周聚合提示词嵌入与过去 4 周基线之间的 PSI。若 PSI 超过阈值则告警。

7. **仪表盘。** Next.js 15，包含以下页面：概览（spans/sec、成本/用户、p95 延迟）、轨迹（搜索 + 瀑布图）、评估（faithfulness 趋势、toxicity）、漂移（PSI 随时间变化）、告警。

8. **告警链路。** Prometheus exporter 读取评估分数聚合和延迟分位数；Alertmanager 将警告路由到 Slack，将严重事件路由到 PagerDuty。

9. **回归探针。** 注入一个 bug：被评估的聊天机器人有 1% 的概率泄露假 SSN。测量 MTTR：从 bug 部署到 Slack 告警的时间。

## 使用

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[collector]  accepted 1 trace, 3 spans
[clickhouse] inserted 3 spans (app=chat, user=u_42)
[eval]       DeepEval faithfulness 0.82, toxicity 0.03
[drift]      weekly PSI 0.08 (below 0.2 threshold)
[ui]         live at https://obs.example.com
```

## 交付

`outputs/skill-llm-observability.md` 是交付物。给定一个 LLM 应用，仪表盘能接入其轨迹、运行评估、对漂移告警，并在 Next.js 中呈现成本/用户分解。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 轨迹 schema 覆盖 | 产出规范 GenAI span 的 SDK 族数量（目标：6+） |
| 20 | 评估正确性 | DeepEval / RAGAS 分数与人工标注集对比 |
| 20 | 仪表盘 UX | 注入回归的 MTTR（目标：5 分钟以内） |
| 20 | 成本 / 规模 | 在 1k spans/sec 下持续接入无积压 |
| 15 | 告警 + 漂移检测 | Prometheus/Alertmanager 链路端到端演练 |
| **100** | | |

## 练习

1. 为 Haystack 框架添加自定义埋点。验证规范 span 落入 ClickHouse 并带有忠实的 `gen_ai.*` 属性。

2. 在相同的轨迹上把 DeepEval 换成 Phoenix 评估器。测量两个评估引擎之间的分数漂移。

3. 打磨漂移检测器：按 app-id 而非全局计算 PSI。展示按应用的漂移轨迹。

4. 添加一个“用户影响”页面：每个用户的成本和失败率，配 sparkline。

5. 构建一个尾部采样策略：保留 100% toxicity > 0.5 的轨迹，其余做 10% 分层采样。测量引入的采样偏差。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| GenAI semconv | “OTel LLM 属性” | 2025 年 OpenTelemetry 关于 LLM span 属性的规范（system、model、tokens） |
| Tail sampling | “轨迹后采样” | 采集器在轨迹结束后决定保留或丢弃（可以查看错误） |
| PSI | “Population stability index” | 比较两个分布的漂移指标；> 0.2 通常意味着显著漂移 |
| LLM-judge | “模型做评估” | 一个 LLM 按评分标准（faithfulness、toxicity、PII）对另一个 LLM 的输出打分 |
| Tail-sampling policy | “保留规则” | 决定哪些轨迹持久化、哪些丢弃的规则；错误 + 采样率 |
| Eval span | “关联的评估轨迹” | 携带评估分数并关联到原始 LLM 调用 span 的子 span |
| Cost per user | “单位经济” | 在某时间窗口内归集到某 user_id 的美元成本；核心产品指标 |

## 延伸阅读

- [Langfuse](https://github.com/langfuse/langfuse) — 参考级 open-core 可观测平台
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — 替代参考实现，漂移支持较强
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) — 自动埋点 SDK 族
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 接入 schema
- [Helicone](https://www.helicone.ai) — 替代托管可观测方案
- [Braintrust](https://www.braintrust.dev) — 替代评估优先平台
- [ClickHouse documentation](https://clickhouse.com/docs) — 列式 span 存储
- [DeepEval](https://github.com/confident-ai/deepeval) — 评估器库