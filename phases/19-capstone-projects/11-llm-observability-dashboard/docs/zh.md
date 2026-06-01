# 11 · LLM 可观测性与评估仪表盘

> Langfuse 走向开放核心（open-core）模式。Arize Phoenix 发布了 2026 GenAI 语义约定（semconv）映射。Helicone 与 Braintrust 双双加码按用户成本归因（per-user cost attribution）。Traceloop 的 OpenLLMetry 成为事实上的 SDK 插桩（instrumentation）标准。生产环境的架构形态是：ClickHouse 存追踪（traces）、Postgres 存元数据、Next.js 做 UI，外加一组运行在采样追踪上的评估任务（DeepEval、RAGAS、LLM 评判器）。你需要自建一套自托管（self-hosted）方案，从至少四套 SDK 家族接入数据，并演示在注入的回归问题（regression）出现后五分钟内将其捕获。

**类型：** 综合项目
**语言：** TypeScript（UI）、Python / TypeScript（接入与评估）、SQL（ClickHouse）
**前置：** 第 11 阶段（LLM 工程）、第 13 阶段（工具）、第 17 阶段（基础设施）、第 18 阶段（安全）
**涉及阶段：** P11 · P13 · P17 · P18
**时长：** 25 小时

## 问题

2026 年，每个有生产流量的 AI 团队都会在模型之外搭建一层可观测性平面（observability plane）：成本归因、幻觉检测（hallucination detection）、漂移监控（drift monitoring）、越狱信号（jailbreak signal）、SLO 仪表盘、PII 泄露告警。开源参考项目——Langfuse、Phoenix、OpenLLMetry——都已收敛到以 OpenTelemetry GenAI 语义约定作为接入数据模式（ingest schema）。你现在可以用一套 SDK 同时对 OpenAI、Anthropic、Google、LangChain、LlamaIndex 和 vLLM 进行插桩，产出兼容的 span。

你将构建一个自托管仪表盘，从至少四套 SDK 家族接入数据，对采样追踪运行一组小型评估任务，检测漂移并发出告警。衡量标准：在故意注入一个回归问题（一段开始产出 PII 的提示词）后，仪表盘能在五分钟内捕获并触发告警。

## 概念

接入层（ingest）走 OTLP HTTP。SDK 产出 GenAI 语义约定 span：`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.response.id`、`llm.prompts`、`llm.completions`。Span 落入 ClickHouse 用于列式分析；元数据（用户、会话、应用）落入 Postgres。

评估（evals）以批处理任务的形式在采样追踪上运行。DeepEval 对忠实度（faithfulness）、毒性（toxicity）和答案相关性（answer relevance）打分。当追踪中携带检索上下文时，RAGAS 对检索指标打分。自定义 LLM 评判器（LLM-judge）执行领域特定检查（PII 泄露、偏离策略的回复）。评估运行结果以评估 span 的形式写回同一个 ClickHouse 实例，并关联到父追踪。

漂移检测监控嵌入空间分布随时间的变化（对提示词嵌入计算 PSI 或 KL 散度），同时监控评估分数趋势。告警通过 Prometheus Alertmanager 推送至 Slack / PagerDuty。UI 采用 Next.js 15 加 Recharts。

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
       +-------------+
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
- 收集器（Collector）：OpenTelemetry Collector，配置尾部采样（tail-sampling）处理器以控制成本
- 存储：ClickHouse 存 span、Postgres 存元数据、S3 存原始事件归档
- 评估：DeepEval、RAGAS 0.2、Arize Phoenix 评估器包、自定义 LLM 评判器
- 漂移：对池化提示词嵌入（sentence-transformers）按周计算 PSI / KL 散度
- 告警：Prometheus Alertmanager → Slack / PagerDuty
- UI：Next.js 15 App Router + Recharts + server actions
- 开箱支持的 SDK：OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM

## 构建步骤

1. **收集器配置。** 配置 OpenTelemetry Collector：使用 OTLP HTTP 接收器，尾部采样器保留 100% 的错误追踪和 10% 的成功追踪，并将数据导出到 ClickHouse 和 S3。

2. **ClickHouse 模式（schema）。** 建表 `spans`，列与 GenAI 语义约定对应：`gen_ai_system`、`gen_ai_request_model`、`input_tokens`、`output_tokens`、`latency_ms`、`prompt_hash`、`trace_id`、`parent_span_id`，外加一个用于长载荷的 JSON 包。按 user_id 和 app_id 建辅助索引。

3. **SDK 覆盖测试。** 用每个 SDK（OpenAI、Anthropic、Google、LangChain、LlamaIndex、vLLM）编写一个小型客户端应用，搭配 OpenLLMetry 自动插桩。验证每个 SDK 产出的规范 GenAI span 确实落入了 ClickHouse。

4. **评估任务。** 一个调度任务读取最近 15 分钟的采样追踪，运行 DeepEval 的忠实度、毒性和答案相关性评估。输出为关联到父追踪的评估 span。

5. **自定义 LLM 评判器。** 一个 PII 泄露评判器：给定回复，调用一个防护 LLM 对 PII 泄露可能性打分。高分的回复进入排查队列（triage queue）。

6. **漂移检测。** 按周运行的任务：计算本周池化提示词嵌入与过去四周基线之间的 PSI。若 PSI 高于阈值则告警。

7. **仪表盘。** Next.js 15，包含以下页面：概览（span/秒、成本/用户、p95 延迟）、追踪（搜索 + 瀑布图）、评估（忠实度趋势、毒性）、漂移（PSI 随时间变化曲线）、告警。

8. **告警链路。** Prometheus exporter 读取评估分数聚合值和延迟百分位数；Alertmanager 将警告路由到 Slack，严重违规路由到 PagerDuty。

9. **回归探测。** 注入一个缺陷：受评估的聊天机器人开始有 1% 的概率泄露虚假的 SSN。测量 MTTR：从缺陷部署到 Slack 告警的时长。

## 使用示例

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[collector]  accepted 1 trace, 3 spans
[clickhouse] inserted 3 spans (app=chat, user=u_42)
[eval]       DeepEval faithfulness 0.82, toxicity 0.03
[drift]      weekly PSI 0.08 (below 0.2 threshold)
[ui]         live at https://obs.example.com
```

## 交付物

`outputs/skill-llm-observability.md` 是交付物。给定一个 LLM 应用，仪表盘能够接入其追踪数据、运行评估、在漂移时告警，并在 Next.js 中展示按用户的成本拆解。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 追踪模式覆盖度 | 产出规范 GenAI span 的 SDK 家族数量（目标：6+） |
| 20 | 评估正确性 | DeepEval / RAGAS 评分 vs 人工标注集 |
| 20 | 仪表盘 UX | 注入回归的 MTTR（目标：5 分钟内） |
| 20 | 成本 / 规模 | 在 1k span/秒 的持续接入下无积压 |
| 15 | 告警 + 漂移检测 | Prometheus/Alertmanager 链路端到端验证通过 |
| **100** | | |

## 练习

1. 为 Haystack 框架添加自定义插桩。验证规范 span 落入 ClickHouse，带有准确的 `gen_ai.*` 属性。

2. 将同样的追踪数据上的 DeepEval 替换为 Phoenix 评估器。测量两种评估引擎之间的评分漂移。

3. 细化漂移检测器：按 app-id 而非全局计算 PSI。展示每个应用的漂移轨迹。

4. 添加一个「用户影响」页面：按用户的成本与按用户的失败率，附带迷你折线图（sparkline）。

5. 构建一个尾部采样策略：保留 100% 毒性 > 0.5 的追踪，外加其余追踪中 10% 的分层采样。测量引入的采样偏差。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| GenAI semconv | "OTel LLM 属性" | 2025 年 OpenTelemetry 为 LLM span 属性制定的规范（system、model、tokens） |
| Tail sampling（尾部采样） | "追踪完成后采样" | 收集器在追踪完成后决定保留还是丢弃（可以查看是否有错误） |
| PSI | "群体稳定性指标" | 比较两个分布的漂移度量；> 0.2 通常指示有意义的漂移 |
| LLM-judge（LLM 评判器） | "用模型做评估" | 一个 LLM 按评分标准对另一个 LLM 的输出打分（忠实度、毒性、PII） |
| Tail-sampling policy（尾部采样策略） | "保留规则" | 决定哪些追踪保留、哪些丢弃的规则；错误 + 采样率 |
| Eval span（评估 span） | "关联的评估追踪" | 携带评估分数的子 span，关联到原始 LLM 调用 span |
| Cost per user（单用户成本） | "单位经济学" | 在一个时间窗口内归因到某个 user_id 的美元成本；关键产品指标 |

## 延伸阅读

- [Langfuse](https://github.com/langfuse/langfuse) —— 参考级开放核心可观测性平台
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) —— 另一参考实现，漂移支持较强
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) —— 自动插桩 SDK 家族
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 接入数据模式
- [Helicone](https://www.helicone.ai) —— 另一托管可观测性方案
- [Braintrust](https://www.braintrust.dev) —— 另一评估优先的平台
- [ClickHouse 文档](https://clickhouse.com/docs) —— 列式 span 存储
- [DeepEval](https://github.com/confident-ai/deepeval) —— 评估器库
