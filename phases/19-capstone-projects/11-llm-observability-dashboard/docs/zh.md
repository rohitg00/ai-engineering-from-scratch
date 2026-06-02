# 毕业项目 11 — LLM 可观测性与评估仪表盘

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Langfuse 走向 open-core。Arize Phoenix 发布了 2026 年 GenAI semconv 映射。Helicone 与 Braintrust 都在「按用户成本归因」上加倍下注。Traceloop 的 OpenLLMetry 已成为事实标准的 SDK 插桩方案。生产形态长成这样：trace 用 ClickHouse、metadata 用 Postgres、UI 用 Next.js，再加上一队跑在采样 trace 上的 eval 任务（DeepEval、RAGAS、LLM-judge）。自托管搭一套，至少接入 4 个 SDK 家族，并演示在 5 分钟内捕获一次注入式回归。

**Type:** Capstone
**Languages:** TypeScript (UI), Python / TypeScript (ingest + evals), SQL (ClickHouse)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P11 · P13 · P17 · P18
**Time:** 25 hours

## 问题（Problem）

每一支 2026 年跑生产流量的 AI 团队，都会在模型旁边放一套可观测性平面。成本归因。幻觉（hallucination）检测。漂移监控。越狱信号。SLO 仪表盘。PII 泄露告警。开源参照系——Langfuse、Phoenix、OpenLLMetry——已经收敛到 OpenTelemetry GenAI 语义约定（semantic conventions）作为接入 schema。如今你可以用一套 SDK 同时给 OpenAI、Anthropic、Google、LangChain、LlamaIndex、vLLM 插桩，并产出兼容的 span。

你要构建一个自托管仪表盘，从至少 4 个 SDK 家族 ingest 数据，对采样 trace 跑一组小型 eval 任务，检测漂移，并发出告警。衡量门槛：给定一个故意注入的回归（一段 prompt 开始输出 PII），仪表盘要在 5 分钟内捕获并触发告警。

## 概念（Concept）

Ingest 走 OTLP HTTP。SDK 产出 GenAI-semconv span：`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`、`gen_ai.response.id`、`llm.prompts`、`llm.completions`。Span 落入 ClickHouse 用于列式分析；metadata（用户、会话、应用）落入 Postgres。

Eval 以批处理任务形式跑在采样 trace 上。DeepEval 给 faithfulness、toxicity、answer relevance 打分。当 trace 携带 retrieval（检索）上下文时，RAGAS 给检索指标打分。自定义 LLM-judge 跑领域专属检查（PII 泄露、违反策略的回复）。Eval 结果会以「与父 trace 关联的 eval span」形式写回同一个 ClickHouse。

漂移检测随时间跟踪 embedding 空间的分布（对 prompt embedding 计算 PSI 或 KL 散度），并叠加 eval 分数趋势。告警输入 Prometheus Alertmanager，再分发到 Slack / PagerDuty。UI 用 Next.js 15 + Recharts。

## 架构（Architecture）

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

## 技术栈（Stack）

- Ingest：OpenTelemetry SDK + GenAI 语义约定；OTLP HTTP 传输
- Collector：OpenTelemetry Collector，带 tail-sampling processor（用于成本控制）
- 存储：ClickHouse 存 span，Postgres 存 metadata，S3 存原始事件归档
- Eval：DeepEval、RAGAS 0.2、Arize Phoenix evaluator pack、自定义 LLM-judge
- 漂移：每周对池化的 prompt embedding（sentence-transformers）算 PSI / KL
- 告警：Prometheus Alertmanager → Slack / PagerDuty
- UI：Next.js 15 App Router + Recharts + server actions
- 开箱支持的 SDK：OpenAI、Anthropic、Google GenAI、LangChain、LlamaIndex、vLLM

## 动手实现（Build It）

1. **Collector 配置。** OpenTelemetry Collector 配上 OTLP HTTP receiver、一个 tail-sampler（保留 100% 出错的 trace 加 10% 成功的 trace），以及导出到 ClickHouse 和 S3 的 exporter。

2. **ClickHouse schema。** 表 `spans`，列结构对应 GenAI semconv：`gen_ai_system`、`gen_ai_request_model`、`input_tokens`、`output_tokens`、`latency_ms`、`prompt_hash`、`trace_id`、`parent_span_id`，再加一个装大 payload 的 JSON 包。按 user_id 和 app_id 加二级索引。

3. **SDK 覆盖测试。** 用每个 SDK（OpenAI、Anthropic、Google、LangChain、LlamaIndex、vLLM）写一个小客户端 app，搭配 OpenLLMetry 自动插桩。验证每个都能产出标准 GenAI span 并落入 ClickHouse。

4. **Eval 任务。** 一个定时任务读取最近 15 分钟的采样 trace，跑 DeepEval 的 faithfulness、toxicity、answer relevance。输出是与父 trace 关联的 eval span。

5. **自定义 LLM-judge。** 一个 PII-泄露 judge：给定一段回复，调用一个守护 LLM 给「PII 泄露可能性」打分。高分回复进入排查队列。

6. **漂移检测。** 周任务计算「本周池化 prompt embedding」与「过去 4 周基线」之间的 PSI。若 PSI 超过阈值，告警。

7. **仪表盘。** Next.js 15，页面包括：概览（每秒 span 数、按用户成本、p95 延迟）、traces（搜索 + 瀑布图）、evals（faithfulness 趋势、toxicity）、drift（PSI 时间序列）、alerts。

8. **告警链路。** Prometheus exporter 读取 eval 分数聚合与延迟分位；Alertmanager 路由到 Slack 处理 warning，PagerDuty 处理 critical 级别违规。

9. **回归探针。** 注入一个 bug：受评 chatbot 1% 概率开始泄露假 SSN。测量 MTTR：从 bug 部署到 Slack 告警之间的时长。

## 用起来（Use It）

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[collector]  accepted 1 trace, 3 spans
[clickhouse] inserted 3 spans (app=chat, user=u_42)
[eval]       DeepEval faithfulness 0.82, toxicity 0.03
[drift]      weekly PSI 0.08 (below 0.2 threshold)
[ui]         live at https://obs.example.com
```

## 上线部署（Ship It）

`outputs/skill-llm-observability.md` 是交付物。给定一个 LLM 应用，仪表盘要能 ingest 它的 trace，跑 eval，对漂移告警，并在 Next.js 中呈现按用户成本拆分。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Trace-schema 覆盖度 | 能产出标准 GenAI span 的 SDK 家族数量（目标 6+） |
| 20 | Eval 正确性 | DeepEval / RAGAS 分数 vs 人工标注集 |
| 20 | 仪表盘 UX | 注入回归的 MTTR（目标 5 分钟以内） |
| 20 | 成本 / 规模 | 持续 1k spans/sec ingest 不积压 |
| 15 | 告警 + 漂移检测 | Prometheus/Alertmanager 链路端到端打通 |
| **100** | | |

## 练习（Exercises）

1. 为 Haystack 框架增加自定义插桩。验证标准 span 能落入 ClickHouse，并带有忠实的 `gen_ai.*` 属性。

2. 在同一批 trace 上把 DeepEval 换成 Phoenix evaluator。测量两套 eval 引擎之间的分数漂移。

3. 把漂移检测做精：按 app-id 计算 PSI，而不是全局。展示每个 app 的漂移轨迹。

4. 加一个「用户影响」页：每用户成本与每用户失败率，配 sparkline。

5. 构造一个 tail-sampling 策略：保留 100% toxicity > 0.5 的 trace，加上其余 10% 的分层采样。测量引入的采样偏差。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GenAI semconv | "OTel LLM attributes" | 2025 OpenTelemetry 关于 LLM span 属性（system、model、token）的规范 |
| Tail sampling | "Post-trace sample" | Collector 在 trace 完成后再决定保留还是丢弃（可以窥见错误） |
| PSI | "Population stability index" | 比较两个分布的漂移指标；> 0.2 通常意味着有意义的漂移 |
| LLM-judge | "Eval as model" | 用一个 LLM 按评分卡（faithfulness、toxicity、PII）给另一个 LLM 的输出打分 |
| Tail-sampling policy | "Keep-rule" | 决定哪些 trace 持久化、哪些丢弃的规则；错误 + 采样率 |
| Eval span | "Linked eval trace" | 携带 eval 分数、与原 LLM 调用 span 关联的子 span |
| Cost per user | "Unit economics" | 在某时间窗口内归因到 user_id 的美元成本；关键产品指标 |

## 延伸阅读（Further Reading）

- [Langfuse](https://github.com/langfuse/langfuse) — 参考级 open-core 可观测性平台
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — 漂移支持很强的另一参考实现
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) — 自动插桩 SDK 家族
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — ingest schema
- [Helicone](https://www.helicone.ai) — 另一种托管可观测性
- [Braintrust](https://www.braintrust.dev) — 另一种 eval 优先平台
- [ClickHouse documentation](https://clickhouse.com/docs) — 列式 span 存储
- [DeepEval](https://github.com/confident-ai/deepeval) — evaluator 库
