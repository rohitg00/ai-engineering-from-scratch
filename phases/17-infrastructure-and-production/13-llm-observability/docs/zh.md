# LLM 可观测性技术栈选型（LLM Observability Stack Selection）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年的可观测性市场分裂为两大阵营。开发平台（LangSmith、Langfuse、Comet Opik）把监控与评估（eval）、prompt 管理、会话回放（session replay）打包在一起；网关 / 埋点工具（Helicone、SigNoz、OpenLLMetry、Phoenix）则只聚焦遥测（telemetry）。Langfuse 核心采用 MIT 许可，OSS 平衡做得不错（云上 50K 事件 / 月免费）。Phoenix 原生基于 OpenTelemetry、采用 Elastic License 2.0——非常适合做漂移（drift）/ RAG 可视化，但不是一个长期的生产环境后端。Arize AX 采用零拷贝（zero-copy）的 Iceberg/Parquet 集成方案，号称比一体式可观测性方案便宜 100 倍。LangSmith 在 LangChain/LangGraph 场景里一骑绝尘，$39/用户/月，自托管仅在 Enterprise 套餐里开放。Helicone 走代理（proxy）路线，15-30 分钟即可接入，100K 请求/月免费，但在 agent 轨迹上深度不足。生产环境常见的组合是：网关（Helicone/Portkey）+ 评估平台（Phoenix/TruLens），用 OpenTelemetry 串起来。

**Type:** Learn
**Languages:** Python (stdlib, toy trace-sampling simulator)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 14 (Agent Engineering)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 区分开发平台（捆绑 evals + prompts + sessions）与网关 / 遥测工具（只做 traces + metrics）。
- 把六款主流工具（Langfuse、LangSmith、Phoenix、Arize AX、Helicone、Opik）映射到各自的许可证、定价与最佳应用场景。
- 解释 OpenTelemetry-glue 模式：如何用 OTel 把网关工具和独立的评估平台粘起来。
- 说出 2026 年的成本分水岭（Arize AX 的零拷贝方案 vs 一体式 ingest），并给出大约 100 倍的差距数量级。

## 问题（Problem）

你上线了一个 LLM 功能。它能跑。但你对 prompt 失败、工具调用死循环（tool loop）、延迟回归、成本飙升、prompt 缓存命中率一无所知。你 Google 「LLM observability」，跳出八个工具，每个都说自己能解决同一个问题，价格档位却分了三档。

它们解决的并不是同一个问题。LangSmith 回答的是「这次 LangGraph 跑挂了为什么？」Phoenix 回答的是「我的 RAG 流水线是不是漂移了？」Helicone 回答的是「哪个 app 在烧 token？」Langfuse 回答的是「整套能不能自托管？」工具不同，受众不同。

选型涉及四个维度：技术栈（用 LangChain？裸 SDK？多供应商？）、许可证容忍度（只接受 MIT？Elastic 也行？商业的也无所谓？）、预算（免费档？$100/月？$1000/月？）、自托管（必须？锦上添花？永远不要？）。

## 概念（Concept）

### 两大阵营（Two categories）

**开发平台（Development platforms）** 把可观测性和评估、prompt 管理、数据集版本化、会话回放捆绑在一起。你做实验、看哪条 prompt 跑赢了、把新 prompt 拿去和老冠军做数据集回归。代表：LangSmith、Langfuse、Comet Opik。

**网关 / 遥测工具（Gateway/telemetry tools）** 只对推理调用埋点——prompt、响应、token、延迟、模型、成本。代表：Helicone、SigNoz、OpenLLMetry、Phoenix。极简风。可以通过 OpenTelemetry 跟独立的评估工具组合使用。

### Langfuse —— OSS 平衡派

- 核心采用 Apache / MIT 许可；通过 Docker 自托管。
- 云免费档：50K 事件 / 月。付费档：团队版 $29/月。
- evals、prompt 管理、traces、数据集——四项开发平台核心功能覆盖得相当全面。
- 最佳场景：你想要 LangSmith 级别的功能，但必须自托管或坚守 OSS 许可。

### Phoenix（Arize）—— 遥测优先、原生 OpenTelemetry

- Elastic License 2.0；自托管极简单。
- 在 RAG 和漂移可视化上非常强。embedding 空间散点图作为一等公民开箱即用。
- 不是按长期生产后端设计的——主要面向开发期可观测性。
- 最佳场景：RAG 流水线开发、漂移调试，配合一个独立网关跑生产。

### Arize AX —— 大规模玩法

- 商业产品。通过 Iceberg/Parquet 做零拷贝数据湖集成。
- 号称在大规模下比一体式可观测性（Datadog 级）便宜约 100 倍。算式是：你把 traces 存在自家 S3 上的 Parquet 里，Arize 直接读。
- 最佳场景：> 1000 万 traces/天、已有数据湖、想要 LLM 专属仪表盘但不想付 Datadog 价格。

### LangSmith —— LangChain/LangGraph 优先

- 商业产品，$39/用户/月。自托管仅 Enterprise 套餐开放。
- 在 LangChain 和 LangGraph 技术栈上是最佳选择。如果你不在这两个生态里，吸引力就要打折。
- 最佳场景：团队全面拥抱 LangChain，且愿意付费。

### Helicone —— 基于代理的最小可用方案

- 15-30 分钟接入：把 `OPENAI_API_BASE` 改成 Helicone 代理就行。
- MIT 许可；100K 请求/月免费，付费 $20/月起。
- 自带故障转移、缓存、限流——同时也是个网关。
- 在 agent / 多步轨迹上的深度不够。
- 最佳场景：快速起步、单一栈应用、想要网关 + 可观测性一体的方案。

### Opik（Comet）—— OSS 开发平台

- Apache 2.0，完全 OSS。
- 功能集与 Langfuse 类似，带 Comet 血统。
- 最佳场景：已经在用 Comet 的 ML 团队，想在同一面板里看 LLM 可观测性。

### SigNoz —— OpenTelemetry 优先的全功能 APM

- Apache 2.0。同时处理通用 APM 和走 OpenTelemetry 的 LLM。
- 最佳场景：跨服务和 LLM 调用的统一可观测性。

### 粘合剂：OpenTelemetry + GenAI 语义约定（GenAI semantic conventions）

OpenTelemetry 在 2025 年底发布了 GenAI 语义约定（`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`）。消费 OTel 的工具之间从此可以互操作。正在浮现的生产模式是：

1. 每次 LLM 调用都按 GenAI 约定发 OTel。
2. 路由到网关（Helicone / Portkey）做日常观察。
3. 双发到评估平台（Phoenix / Langfuse）跑回归。
4. 归档到数据湖（Iceberg），后续通过 Arize AX 或 DuckDB 做长期分析。

### 陷阱：在错误的层埋点

在 agent 框架内部埋点（比如往里塞 LangSmith traces）会把你和那个框架绑死。在 HTTP / OpenAI-SDK 这一层埋点（通过 OpenLLMetry 或你的网关）才是可移植的。

### 采样（Sampling）—— 你不可能全留

> 100 万请求 / 天的量级下，全量 trace 留存的成本会超过 LLM 调用本身。要按规则采样：错误 100%、高成本 100%、成功 5%。聚合数据永远留；原始数据只留长尾。

### 你应该记住的几个数字

- Langfuse 免费云：50K 事件 / 月。
- LangSmith：$39/用户/月。
- Helicone 免费：100K 请求 / 月。
- Arize AX 宣称：大规模下比一体式便宜约 100 倍。
- OpenTelemetry GenAI 约定：2025 发布，2026 广泛采纳。

## 用起来（Use It）

`code/main.py` 模拟一个 100 万 trace 的日子，在不同留存策略下（100% ingest、采样、采样 + errors）跑一遍，报告每种策略下的存储成本和丢失了什么。

## 上线部署（Ship It）

本课产出 `outputs/skill-observability-stack.md`。给定技术栈、规模、预算、许可证立场，输出推荐的工具组合。

## 练习（Exercises）

1. 你的团队在用 LangChain，想要 OSS 自托管的可观测性。在 Langfuse 与 Opik 之间二选一并说明理由。
2. 在 500 万 traces/天的规模下，Datadog 报价 $150K/月，算一算切到 Arize AX 的盈亏平衡点。
3. 设计一份 OpenTelemetry GenAI 属性集，作为公司规范要求每次 LLM 调用都必须带上。
4. 论证 Phoenix 单独是否足以撑生产。它在什么时候撑不住？
5. Helicone 代理开销是 20ms。如果 P99 TTFT 是 300 ms，这个开销可接受吗？如果 SLA 是 100 ms 呢？

## 关键术语（Key Terms）

| 术语 | 大家是怎么说的 | 实际是什么 |
|------|----------------|------------------------|
| OpenLLMetry | 「面向 LLM 的 OTel」 | 面向 LLM 的开源 OpenTelemetry 埋点方案 |
| GenAI conventions | 「OTel 属性」 | 用于 LLM 调用的标准 OTel 属性名 |
| LangSmith | 「LangChain 可观测性」 | 与 LangChain 生态捆绑的商业平台 |
| Langfuse | 「OSS 版 LangSmith」 | 功能集相似的 MIT 开源版 |
| Phoenix | 「Arize 的开发工具」 | 原生 OpenTelemetry 的开发 / 评估平台 |
| Arize AX | 「大规模可观测性」 | 商业零拷贝 Iceberg/Parquet 可观测性方案 |
| Helicone | 「代理式可观测性」 | 收集 LLM 遥测 + 网关功能的 HTTP 代理 |
| Opik | 「Comet 的 LLM 工具」 | Comet 出品的 Apache 2.0 OSS 开发平台 |
| Session replay | 「trace 重跑」 | 连同 tool 调用回放整个 agent 会话 |
| Eval | 「离线测试」 | 在带标注数据集上跑候选模型 / prompt |

## 延伸阅读（Further Reading）

- [SigNoz — Top LLM Observability Tools 2026](https://signoz.io/comparisons/llm-observability-tools/)
- [Langfuse — Arize AX Alternative analysis](https://langfuse.com/faq/all/best-phoenix-arize-alternatives)
- [PremAI — Setting Up Langfuse, LangSmith, Helicone, Phoenix](https://blog.premai.io/llm-observability-setting-up-langfuse-langsmith-helicone-phoenix/)
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Arize Phoenix docs](https://docs.arize.com/phoenix)
- [Helicone docs](https://docs.helicone.ai/)
