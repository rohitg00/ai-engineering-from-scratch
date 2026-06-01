# 13 · LLM 可观测性技术栈选型

> 2026 年的「可观测性（observability）」市场分为两大阵营。开发平台（LangSmith、Langfuse、Comet Opik）将监控与评估、提示词管理、会话回放打包在一起；网关/插桩工具（Helicone、SigNoz、OpenLLMetry、Phoenix）则专注于遥测（telemetry）。Langfuse 核心采用 MIT 许可证，在开源平衡上表现强劲（云端免费额度 50K 事件/月）。Phoenix 原生支持 OpenTelemetry，采用 Elastic License 2.0——在漂移（drift）/RAG 可视化方面表现出色，但并非一个可持久化的生产后端。Arize AX 采用零拷贝（zero-copy）的 Iceberg/Parquet 集成，号称在规模化场景下比一体化可观测性方案便宜 100 倍。LangSmith 在 LangChain/LangGraph 场景下处于领先，定价 $39/用户/月，仅企业版支持私有部署。Helicone 基于代理（proxy），15-30 分钟即可接入，免费额度 100K 请求/月，但在智能体（agent）轨迹追踪上深度不足。常见的生产模式：网关（Helicone/Portkey）+ 评估平台（Phoenix/TruLens），通过 OpenTelemetry 黏合在一起。

**类型：** 学习
**语言：** Python（标准库，玩具级别的轨迹采样模拟器）
**前置：** 阶段 17 · 08（推理指标）、阶段 14（智能体工程）
**时长：** 约 60 分钟

## 学习目标

- 区分开发平台（打包式：评估 + 提示词 + 会话）与网关/遥测工具（仅轨迹 + 指标）。
- 将六大主流工具（Langfuse、LangSmith、Phoenix、Arize AX、Helicone、Opik）对应到各自的许可证、定价以及最适用的使用场景。
- 解释「OpenTelemetry 黏合」模式：它如何让你把一个网关工具与一个独立的评估平台组合起来。
- 说出 2026 年的成本差异化点（Arize AX 的零拷贝方案 vs 一体化摄取），并给出大致的 100 倍倍率。

## 问题所在

你上线了一个 LLM 功能。它能跑。但你对提示词失败、工具循环、延迟回归、成本飙升或提示词缓存命中率毫无可见性。你 Google 搜索「LLM observability」，得到八个工具，全都声称在三种不同的价位上解决同一个问题。

它们并不是在解决同一个问题。LangSmith 回答的是「这个 LangGraph 运行为什么失败了？」Phoenix 回答的是「我的 RAG 管线是否在漂移？」Helicone 回答的是「哪个应用在烧 token？」Langfuse 回答的是「我能不能把整套东西私有部署？」不同的工具，不同的受众。

选型涉及四个维度：技术栈（用 LangChain？裸 SDK？多供应商？）、许可证容忍度（只接受 MIT？Elastic 可以？商业许可也行？）、预算（免费额度？$100/月？$1000/月？），以及私有部署（必须？最好有？永远不需要？）。

## 核心概念

### 两大阵营

**开发平台（development platforms）** 把可观测性与评估、提示词管理、数据集版本管理、会话回放打包在一起。你跑实验、看哪个提示词奏效、把新提示词与旧的优胜者做数据集回归。代表：LangSmith、Langfuse、Comet Opik。

**网关/遥测工具（gateway/telemetry tools）** 对推理调用进行插桩——提示词、响应、token、延迟、模型、成本。代表：Helicone、SigNoz、OpenLLMetry、Phoenix。极简主义。可以通过 OpenTelemetry 与一个独立的评估工具组合使用。

### Langfuse——开源平衡

- 核心采用 Apache / MIT 许可证；可通过 Docker 私有部署。
- 云端免费额度：50K 事件/月。付费：$29/月起（团队版）。
- 评估、提示词管理、轨迹、数据集。对开发平台四大特性都有合理覆盖。
- 最适用场景：你想要 LangSmith 级别的功能，但必须私有部署或坚持使用开源许可证。

### Phoenix（Arize）——遥测优先，原生 OpenTelemetry

- Elastic License 2.0；私有部署极其简单。
- 在 RAG 与漂移可视化方面表现出色。嵌入空间（embedding-space）散点图作为一等公民内置。
- 并非设计为可持久化的生产后端——主要面向开发期的可观测性。
- 最适用场景：RAG 管线开发、漂移调试，与一个独立的网关搭配用于生产。

### Arize AX——规模化打法

- 商业产品。通过 Iceberg/Parquet 实现零拷贝数据湖集成。
- 号称在规模化场景下比一体化可观测性方案（Datadog 级别）便宜约 100 倍。其原理：你把轨迹以 Parquet 格式存在自己的 S3 上，Arize 直接读取。
- 最适用场景：>10M 轨迹/天、已有数据湖、想要 LLM 专属仪表盘但不想承受 Datadog 的价格。

### LangSmith——LangChain/LangGraph 优先

- 商业产品，$39/用户/月。仅企业版支持私有部署。
- 对 LangChain 与 LangGraph 技术栈是同类最佳。如果你不用这两者，它的吸引力会下降。
- 最适用场景：团队已绑定 LangChain，且愿意付费。

### Helicone——基于代理的最小可行方案

- 15-30 分钟即可接入，只需把你的 `OPENAI_API_BASE` 切换到 Helicone 代理。
- MIT 许可证；免费额度 100K 请求/月，付费 $20/月起。
- 内置故障转移、缓存、限流——同时也充当网关。
- 在智能体/多步轨迹上深度不足。
- 最适用场景：快速起步、单一技术栈应用、需要网关 + 可观测性一体化。

### Opik（Comet）——开源开发平台

- Apache 2.0，完全开源。
- 功能集与 Langfuse 类似，承袭 Comet 血统。
- 最适用场景：已经在用 Comet 的机器学习团队，想在同一个界面里获得 LLM 可观测性。

### SigNoz——OpenTelemetry 优先的完整 APM

- Apache 2.0。处理通用 APM，同时通过 OpenTelemetry 处理 LLM。
- 最适用场景：跨服务与 LLM 调用的统一可观测性。

### 黏合剂：OpenTelemetry + GenAI 语义约定

OpenTelemetry 在 2025 年底发布了 GenAI 语义约定（`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`）。能消费 OTel 的工具之间可以互操作。正在形成的生产模式如下：

1. 从每一次 LLM 调用发出带 GenAI 约定的 OTel。
2. 路由到网关（Helicone / Portkey）用于日常运营。
3. 双发（dual-ship）到评估平台（Phoenix / Langfuse）用于回归检测。
4. 归档到数据湖（Iceberg），通过 Arize AX 或 DuckDB 做长期分析。

### 陷阱：在错误的层插桩

在你的智能体框架内部插桩（例如添加 LangSmith 轨迹）会把你绑死在那个框架上。在 HTTP/OpenAI-SDK 层插桩（通过 OpenLLMetry 或你的网关）则是可移植的。

### 采样——你没法把所有东西都留下

在 >1M 请求/天的规模下，全量轨迹保留的成本会超过 LLM 调用本身。按规则采样：错误 100% 保留、高成本 100% 保留、成功 5% 保留。聚合数据始终保留；原始数据为长尾保留。

### 你应该记住的数字

- Langfuse 云端免费：50K 事件/月。
- LangSmith：$39/用户/月。
- Helicone 免费：100K 请求/月。
- Arize AX 宣称：规模化下比一体化方案便宜约 100 倍。
- OpenTelemetry GenAI 约定：2025 年发布，2026 年广泛采用。

## 动手实践

`code/main.py` 模拟了一天 1M 条轨迹在不同保留策略下的情况（100% 摄取、采样、采样 + 错误）。报告每种策略的存储成本以及各自损失了什么。

## 交付成果

本课产出 `outputs/skill-observability-stack.md`。给定技术栈、规模、预算、许可证立场，挑选出工具。

## 练习

1. 你的团队使用 LangChain，想要开源的、可私有部署的可观测性。在 Langfuse 与 Opik 之间选一个并给出理由。
2. 在 5M 轨迹/天、Datadog 报价 $150K/月的情况下，计算 Arize AX 的盈亏平衡点。
3. 设计一套 OpenTelemetry GenAI 属性集，作为你所在组织在每一次 LLM 调用中都应强制要求的规范。
4. 论证 Phoenix 单独使用是否足以支撑生产。它在什么情况下不够用？
5. Helicone 有 20ms 的代理开销。在 P99 TTFT 为 300 ms 时，这可以接受吗？如果 SLA 是 100 ms 呢？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| OpenLLMetry | 「面向 LLM 的 OTel」 | 面向 LLM 的开源 OpenTelemetry 插桩 |
| GenAI conventions | 「OTel 属性」 | 用于 LLM 调用的标准 OTel 属性名 |
| LangSmith | 「LangChain 可观测性」 | 与 LangChain 生态打包的商业平台 |
| Langfuse | 「开源版 LangSmith」 | 具备类似功能集的 MIT 开源产品 |
| Phoenix | 「Arize 开发工具」 | 原生 OpenTelemetry 的开发/评估平台 |
| Arize AX | 「规模化可观测性」 | 商业的零拷贝 Iceberg/Parquet 可观测性 |
| Helicone | 「代理式可观测性」 | 采集 LLM 遥测的 HTTP 代理 + 网关功能 |
| Opik | 「Comet 版 LLM」 | Comet 出品的 Apache 2.0 开源开发平台 |
| Session replay | 「轨迹重跑」 | 重放包含工具调用的完整智能体会话 |
| Eval | 「离线测试」 | 在带标注的数据集上运行候选模型/提示词 |

## 延伸阅读

- [SigNoz——2026 年顶级 LLM 可观测性工具](https://signoz.io/comparisons/llm-observability-tools/)
- [Langfuse——Arize AX 替代方案分析](https://langfuse.com/faq/all/best-phoenix-arize-alternatives)
- [PremAI——配置 Langfuse、LangSmith、Helicone、Phoenix](https://blog.premai.io/llm-observability-setting-up-langfuse-langsmith-helicone-phoenix/)
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Arize Phoenix 文档](https://docs.arize.com/phoenix)
- [Helicone 文档](https://docs.helicone.ai/)
