# 顶点项目 11 — LLM 可观测性与评估仪表盘

> Langfuse 走向了开放核心。Arize Phoenix 发布了 2026 年 GenAI 语义约定映射。Helicone 和 Braintrust 都加倍押注于按用户成本归属。Traceloop 的 OpenLLMetry 成为了事实上的 SDK 仪器化标准。生产环境的形态是 ClickHouse 负责追踪数据、Postgres 负责元数据、Next.js 负责 UI，以及一小批在采样追踪数据上运行的评估任务（DeepEval、RAGAS、LLM-judge）。构建一个自托管系统，从至少四个 SDK 家族采集数据，并演示在五分钟内发现注入的回归缺陷。

**类型：** 顶点项目
**语言：** TypeScript（UI）、Python / TypeScript（采集 + 评估）、SQL（ClickHouse）
**前置条件：** 阶段 11（LLM 工程）、阶段 13（工具）、阶段 17（基础设施）、阶段 18（安全）
**涉及阶段：** P11 · P13 · P17 · P18
**时间：** 25 小时

## 问题

到了 2026 年，每个运行生产流量的 AI 团队都会在模型旁边配备一个可观测性层。成本归属、幻觉检测、漂移监控、越狱信号、SLO 仪表盘、PII 泄漏告警。开源参考实现——Langfuse、Phoenix、OpenLLMetry——已统一采用 OpenTelemetry GenAI 语义约定作为采集模式。你现在可以用一个 SDK 为 OpenAI、Anthropic、Google、LangChain、LlamaIndex 和 vLLM 进行仪器化，并发送兼容的 spans。

你将构建一个自托管仪表盘，从至少四个 SDK 家族采集数据，在采样追踪上运行一小批评估作业，检测漂移并发出告警。衡量标准：给定一个故意注入的回归缺陷（一个开始产生 PII 的提示词），仪表盘在五分钟内捕获它并触发告警。

## 概念

采集采用 OTLP HTTP。SDK 生成 GenAI 语义约定 spans：`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.response.id`、`llm.prompts`、`llm.completions`。Spans 存入 ClickHouse 用于列式分析；元数据（用户、会话、应用）存入 Postgres。

评估作为批处理作业在采样追踪上运行。DeepEval 对忠实度、毒性和答案相关性进行评分。RAGAS 在追踪携带检索上下文时评估检索指标。自定义 LLM-judge 执行领域特定检查（PII 泄漏、策略外响应）。评估运行的结果以评估 spans 的形式写回同一个 ClickHouse，并关联到父追踪。

漂移检测监控嵌入空间分布的随时间变化（对提示嵌入使用 PSI 或 KL 散度）以及评估分数趋势。告警通过 Prometheus Alertmanager 发送到 Slack / PagerDuty。UI 是使用 Recharts 的 Next.js 15。

## 架构

```
生产应用：
  OpenAI SDK  +  Anthropic SDK  +  Google GenAI SDK
  LangChain + LlamaIndex + vLLM
       |
       v
  OpenTelemetry SDK（带 GenAI 语义约定）
       |
       v  OTLP HTTP
  采集器（ingest, sample, fan-out）
       |
       +-------------+-----------+
       v             v           v
   ClickHouse    Postgres    S3 归档
   (spans)       (元数据)     (原始事件)
       |
       +---> 评估作业 (DeepEval, RAGAS, LLM-judge)
       |     采样或全量追踪
       |     写回评估 spans
       |
       +---> 漂移检测器（对提示嵌入使用 PSI / KL）
       |
       +---> Prometheus 指标 -> Alertmanager -> Slack / PagerDuty
       |
       v
   Next.js 15 仪表盘 (Recharts)
```

## 技术栈

- 采集：OpenTelemetry SDK + GenAI 语义约定；OTLP HTTP 传输
- 采集器：OpenTelemetry Collector，带尾采样处理器（用于成本控制）
- 存储：ClickHouse 用于 spans，Postgres 用于元数据，S3 用于原始事件归档
- 评估：DeepEval、RAGAS 0.2、Arize Phoenix 评估器包、自定义 LLM-judge
- 漂移：对聚合的提示嵌入（sentence-transformers）每周计算 PSI / KL
- 告警：Prometheus Alertmanager -> Slack / PagerDuty
- UI：Next.js 15 App Router + Recharts + server actions
- 原生支持的 SDK：OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM

## 构建步骤

1. **采集器配置。** OpenTelemetry Collector，配置 OTLP HTTP 接收器、尾采样器（100% 保留出错追踪，10% 保留成功追踪），以及 ClickHouse 和 S3 的导出器。

2. **ClickHouse 模式。** 表 `spans` 包含镜像 GenAI 语义约定的列：`gen_ai_system`、`gen_ai_request_model`、`input_tokens`、`output_tokens`、`latency_ms`、`prompt_hash`、`trace_id`、`parent_span_id`，以及用于长负载的 JSON 袋子。按 user_id 和 app_id 添加二级索引。

3. **SDK 覆盖测试。** 使用每个 SDK（OpenAI、Anthropic、Google、LangChain、LlamaIndex、vLLM）编写一个小型客户端应用，采用 OpenLLMetry 自动仪器化。验证每个 SDK 都能生成规范的 GenAI spans 并落入 ClickHouse。

4. **评估作业。** 一个定时作业读取过去 15 分钟的采样追踪，运行 DeepEval 的忠实度、毒性和答案相关性评估。输出是与父追踪关联的评估 spans。

5. **自定义 LLM-judge。** 一个 PII 泄漏判断器：给定一个响应，调用一个守卫 LLM 来评估 PII 泄漏的可能性。高分响应进入一个分类队列。

6. **漂移检测。** 每周作业计算本周聚合提示嵌入与过去 4 周基线的 PSI。如果 PSI 超过阈值，则告警。

7. **仪表盘。** Next.js 15 页面包括：概览（spans/秒、成本/用户、p95 延迟）、追踪（搜索 + 瀑布图）、评估（忠实度趋势、毒性）、漂移（PSI 随时间变化）、告警。

8. **告警链路。** Prometheus 导出器读取评估分数聚合和延迟百分位数；Alertmanager 将警告路由到 Slack，将关键违规路由到 PagerDuty。

9. **回归探针。** 注入一个缺陷：被评估的聊天机器人开始有 1% 的概率泄漏虚假的社会安全号码。测量 MTTR：从缺陷部署到 Slack 告警的时间。

## 使用方式

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[collector]  已接受 1 个 trace，3 个 spans
[clickhouse] 已插入 3 个 spans (app=chat, user=u_42)
[eval]       DeepEval 忠实度 0.82，毒性 0.03
[drift]      每周 PSI 0.08（低于 0.2 阈值）
[ui]         实时访问 https://obs.example.com
```

## 交付物

`outputs/skill-llm-observability.md` 是交付产物。给定一个 LLM 应用，仪表盘采集其追踪数据，运行评估，对漂移发出告警，并在 Next.js 中展示成本/用户细分。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 追踪模式覆盖度 | 能够产生规范 GenAI spans 的 SDK 家族数量（目标：6+） |
| 20 | 评估正确性 | DeepEval / RAGAS 分数与人工标注集的对比 |
| 20 | 仪表盘用户体验 | 注入回归的平均修复时间（MTTR）（目标：5 分钟以内） |
| 20 | 成本/规模 | 以 1k spans/秒的速率持续采集而无积压 |
| 15 | 告警 + 漂移检测 | Prometheus/Alertmanager 链路端到端演练 |
| **100** | | |

## 练习

1. 为 Haystack 框架添加自定义仪器化。验证规范的 spans 能携带正确的 `gen_ai.*` 属性落入 ClickHouse。

2. 在相同的追踪数据上，将 DeepEval 替换为 Phoenix 评估器。测量两个评估引擎之间的分数漂移。

3. 优化漂移检测器：按 app-id 而非全局计算 PSI。展示按应用的漂移轨迹。

4. 添加一个"用户影响"页面：展示每个用户的成本、每个用户的失败率，并附有迷你走势图。

5. 构建一个尾采样策略，100% 保留毒性 > 0.5 的追踪，并对其余追踪进行 10% 的分层采样。测量引入的采样偏差。

## 关键术语

| 术语 | 日常说法 | 实际含义 |
|------|----------|----------|
| GenAI semconv | "OTel LLM 属性" | 2025 年 OpenTelemetry 关于 LLM span 属性的规范（系统、模型、令牌数） |
| 尾采样 | "事后追踪采样" | 采集器在追踪完成后决定保留还是丢弃（可以查看错误情况） |
| PSI | "群体稳定性指数" | 衡量两个分布之间差异的漂移指标；> 0.2 通常表示有意义的漂移 |
| LLM-judge | "以模型评估" | 一个 LLM 根据评分标准对另一个 LLM 的输出进行评分（忠实度、毒性、PII） |
| 尾采样策略 | "保留规则" | 决定哪些追踪要持久化、哪些要丢弃的规则；错误 + 采样率 |
| 评估 span | "关联的评估追踪" | 携带评估分数并与原始 LLM 调用 span 关联的子 span |
| 每用户成本 | "单位经济学" | 在一段时间内归属于某个 user_id 的美元成本；关键产品指标 |

## 延伸阅读

- [Langfuse](https://github.com/langfuse/langfuse) — 参考级开源核心可观测性平台
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — 备选参考实现，漂移检测支持强大
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) — 自动仪器化 SDK 家族
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 采集模式
- [Helicone](https://www.helicone.ai) — 备选托管式可观测性平台
- [Braintrust](https://www.braintrust.dev) — 备选评估优先平台
- [ClickHouse 文档](https://clickhouse.com/docs) — 列式 span 存储
- [DeepEval](https://github.com/confident-ai/deepeval) — 评估器库
