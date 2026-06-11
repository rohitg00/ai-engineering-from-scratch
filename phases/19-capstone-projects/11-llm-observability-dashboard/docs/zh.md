# 顶点项目 11 —— LLM 可观测性与评估仪表板

> Langfuse 转向开放核心模式。Arize Phoenix 发布了 2026 年 GenAI 语义约定映射。Helicone 和 Braintrust 都加倍投入每用户成本归因。Traceloop 的 OpenLLMetry 成为事实上的 SDK 插桩标准。生产形态是 ClickHouse 用于追踪，Postgres 用于元数据，Next.js 用于 UI，以及一小群评估作业（DeepEval、RAGAS、LLM-judge）在采样追踪上运行。构建一个自托管版本，从至少四个 SDK 家族摄取，并演示在五分钟内捕获注入的回归。

**类型：** 顶点项目
**语言：** TypeScript（UI）、Python / TypeScript（摄取 + 评估）、SQL（ClickHouse）
**先决条件：** Phase 11（LLM 工程）、Phase 13（工具）、Phase 17（基础设施）、Phase 18（安全）
**涉及阶段：** P11 · P13 · P17 · P18
**时间：** 25 小时

## 问题

2026 年，每个运行生产流量的 AI 团队都在模型旁边保持一个可观测性平面。成本归因。幻觉检测。漂移监控。越狱信号。SLO 仪表板。PII 泄露警报。开源参考——Langfuse、Phoenix、OpenLLMetry——在 OpenTelemetry GenAI 语义约定上汇聚为摄取模式。你现在可以用一个 SDK 插桩 OpenAI、Anthropic、Google、LangChain、LlamaIndex 和 vLLM，并发送兼容的跨度。

你将构建一个自托管仪表板，从至少四个 SDK 家族摄取，在采样追踪上运行一小套评估作业，检测漂移并发出警报。测量标准：给定一个故意注入的回归（一个开始产生 PII 的提示），仪表板捕获它并在五分钟内触发警报。

## 概念

摄取是 OTLP HTTP。SDK 生成 GenAI-语义约定跨度：`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.response.id`、`llm.prompts`、`llm.completions`。跨度落入 ClickHouse 用于列式分析；元数据（用户、会话、应用）落入 Postgres。

评估作为批处理作业在采样追踪上运行。DeepEval 评分忠实度、毒性和答案相关性。当追踪携带检索上下文时，RAGAS 评分检索指标。自定义 LLM-judge 运行领域特定检查（PII 泄露、偏离策略响应）。评估运行将评估跨度写回同一 ClickHouse，链接到父追踪。

漂移检测随时间监控嵌入空间分布（提示嵌入上的 PSI 或 KL 散度）加上评估分数趋势。警报输入 Prometheus Alertmanager，然后到 Slack / PagerDuty。UI 是 Next.js 15，带 Recharts。

## 架构

```
生产应用：
  OpenAI SDK  +  Anthropic SDK  +  Google GenAI SDK
  LangChain + LlamaIndex + vLLM
       |
       v
  带 GenAI 语义约定的 OpenTelemetry SDK
       |
       v  OTLP HTTP
  收集器（摄取、采样、扇出）
       |
       +-------------+-----------+
       v             v           v
   ClickHouse    Postgres    S3 归档
   (跨度)       (元数据)  (原始事件)
       |
       +---> 评估作业（DeepEval、RAGAS、LLM-judge）
       |     采样或全追踪
       |     写回评估跨度
       |
       +---> 漂移检测器（提示嵌入上的 PSI / KL）
       |
       +---> Prometheus 指标 -> Alertmanager -> Slack / PagerDuty
       |
       v
   Next.js 15 仪表板（Recharts）
```

## 技术栈

- 摄取：OpenTelemetry SDK + GenAI 语义约定；OTLP HTTP 传输
- 收集器：OpenTelemetry Collector，带尾部采样处理器（用于成本控制）
- 存储：ClickHouse 用于跨度，Postgres 用于元数据，S3 用于原始事件归档
- 评估：DeepEval、RAGAS 0.2、Arize Phoenix 评估器包、自定义 LLM-judge
- 漂移：每周在汇集的提示嵌入（sentence-transformers）上的 PSI / KL
- 警报：Prometheus Alertmanager -> Slack / PagerDuty
- UI：Next.js 15 App Router + Recharts + 服务器操作
- 开箱即用的 SDK：OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM

## 构建它

1. **收集器配置。** OpenTelemetry Collector，带 OTLP HTTP 接收器、尾部采样器（保留 100% 错误追踪和 10% 成功追踪），以及到 ClickHouse 和 S3 的导出器。

2. **ClickHouse 模式。** 表 `spans`，列镜像 GenAI 语义约定：`gen_ai_system`、`gen_ai_request_model`、`input_tokens`、`output_tokens`、`latency_ms`、`prompt_hash`、`trace_id`、`parent_span_id`，加上 JSON 包用于长负载。按 user_id 和 app_id 添加二级索引。

3. **SDK 覆盖测试。** 使用每个 SDK（OpenAI、Anthropic、Google、LangChain、LlamaIndex、vLLM）编写一个小客户端应用，使用 OpenLLMetry 自动插桩。验证每个生成规范 GenAI 跨度并落入 ClickHouse。

4. **评估作业。** 定时作业读取最近 15 分钟的采样追踪并运行 DeepEval 忠实度、毒性和答案相关性。输出是链接到父追踪的评估跨度。

5. **自定义 LLM-judge。** PII 泄露 judge：给定响应，调用防护 LLM 评分 PII 泄露可能性。高分响应落入分类队列。

6. **漂移检测。** 每周作业计算本周汇集的提示嵌入与过去 4 周基线之间的 PSI。如果 PSI 超过阈值，发出警报。

7. **仪表板。** Next.js 15，带页面：概览（跨度/秒、成本/用户、p95 延迟）、追踪（搜索 + 瀑布图）、评估（忠实度趋势、毒性）、漂移（随时间的 PSI）、警报。

8. **警报链。** Prometheus 导出器读取评估分数聚合和延迟百分位数；Alertmanager 路由到 Slack 用于警告，PagerDuty 用于严重违规。

9. **回归探测。** 注入一个错误：评估的聊天机器人开始 1% 的时间泄露假 SSN。测量 MTTR：从错误部署到 Slack 警报。

## 使用它

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[收集器]  接受 1 个追踪，3 个跨度
[clickhouse] 插入 3 个跨度（应用=聊天，用户=u_42）
[评估]       DeepEval 忠实度 0.82，毒性 0.03
[漂移]      每周 PSI 0.08（低于 0.2 阈值）
[ui]         在线于 https://obs.example.com
```

## 交付它

`outputs/skill-llm-observability.md` 是可交付成果。给定一个 LLM 应用，仪表板摄取其追踪、运行评估、对漂移发出警报，并在 Next.js 中展示成本/用户细分。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 追踪模式覆盖 | 生成规范 GenAI 跨度的 SDK 家族数量（目标：6+） |
| 20 | 评估正确性 | DeepEval / RAGAS 分数与手动标记集对比 |
| 20 | 仪表板用户体验 | 注入回归上的 MTTR（目标低于 5 分钟） |
| 20 | 成本 / 规模 | 持续摄取 1k 跨度/秒，无积压 |
| 15 | 警报 + 漂移检测 | Prometheus/Alertmanager 链端到端执行 |
| **100** | | |

## 练习

1. 为 Haystack 框架添加自定义插桩。验证规范跨度落入 ClickHouse，带有忠实的 `gen_ai.*` 属性。

2. 在同一追踪上将 DeepEval 换成 Phoenix 评估器。测量两个评估引擎之间的分数漂移。

3. 锐化漂移检测器：按应用 ID 计算 PSI 而非全局。展示每应用漂移轨迹。

4. 添加"用户影响"页面：每用户成本和每用户失败率，带迷你图。

5. 构建尾部采样策略：保留 100% 毒性 > 0.5 的追踪加上其余 10% 的分层样本。测量引入的采样偏差。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| GenAI 语义约定 | "OTel LLM 属性" | 2025 年 OpenTelemetry 规范，用于 LLM 跨度属性（系统、模型、token） |
| 尾部采样 | "追踪后采样" | 收集器在追踪完成后决定保留或丢弃（可以查看错误） |
| PSI | "群体稳定性指数" | 比较两个分布的漂移指标；> 0.2 通常表示有意义的漂移 |
| LLM-judge | "评估即模型" | 一个 LLM 根据评分标准评分另一个 LLM 的输出（忠实度、毒性、PII） |
| 尾部采样策略 | "保留规则" | 决定哪些追踪持久化 vs 丢弃的规则；错误 + 采样率 |
| 评估跨度 | "链接的评估追踪" | 携带评估分数的子跨度，链接到原始 LLM 调用跨度 |
| 每用户成本 | "单位经济学" | 在一个窗口内归因于 user_id 的美元成本；关键产品指标 |

## 延伸阅读

- [Langfuse](https://github.com/langfuse/langfuse) —— 参考开放核心可观测性平台
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) —— 替代参考，带强漂移支持
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) —— 自动插桩 SDK 家族
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 摄取模式
- [Helicone](https://www.helicone.ai) —— 替代托管可观测性
- [Braintrust](https://www.braintrust.dev) —— 替代评估优先平台
- [ClickHouse 文档](https://clickhouse.com/docs) —— 列式跨度存储
- [DeepEval](https://github.com/confident-ai/deepeval) —— 评估器库
