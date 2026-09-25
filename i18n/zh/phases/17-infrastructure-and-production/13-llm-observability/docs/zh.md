# LLM 可观测性技术栈选型

> 2026 年的可观测性市场分为两大类。开发平台（LangSmith、Langfuse、Comet Opik）将监控与评测、prompt 管理、会话回放捆绑在一起。网关/插桩工具（Helicone、SigNoz、OpenLLMetry、Phoenix）专注于遥测。Langfuse 核心采用 MIT 许可证，在开源与商业化之间取得了良好平衡（云版本每月 5 万事件免费）。Phoenix 原生支持 OpenTelemetry，采用 Elastic License 2.0 —— 非常适合漂移/RAG 可视化，但不是持久化的生产后端。Arize AX 使用零拷贝的 Iceberg/Parquet 集成，声称比单体式可观测性便宜 100 倍。LangSmith 在 LangChain/LangGraph 生态中领先，价格为每用户每月 $39，仅 Enterprise 版支持自托管。Helicone 基于代理，15-30 分钟即可完成设置，每月 10 万请求免费，但对 agent 链路的深度追踪较弱。常见的生产模式：网关（Helicone/Portkey）+ 评测平台（Phoenix/TruLens），通过 OpenTelemetry 粘合。

**Type:** Learn
**Languages:** Python（标准库，玩具级追踪采样模拟器）
**Prerequisites:** Phase 17 · 08（推理指标）、Phase 14（Agent 工程）
**Time:** 约 60 分钟

## 学习目标

- 区分开发平台（捆绑：评测 + prompt + 会话）与网关/遥测工具（仅追踪 + 指标）。
- 将六个主要工具（Langfuse、LangSmith、Phoenix、Arize AX、Helicone、Opik）与其许可证、定价和最佳适用场景对应起来。
- 解释 OpenTelemetry 粘合模式，它使你能将网关工具与独立的评测平台组合使用。
- 说出 2026 年的成本差异点（Arize AX 的零拷贝方案 vs 单体式摄入），并说出约 100 倍的量级。

## 问题所在

你上线了一个 LLM 功能。它能运行。但你无法洞察 prompt 失败、工具循环、延迟回退、成本飙升或 prompt 缓存命中率。你搜索"LLM 可观测性"，得到八个工具，全都声称在三个不同价位上解决同一个问题。

它们解决的并不是同一个问题。LangSmith 回答"这次 LangGraph 运行为什么失败？"Phoenix 回答"我的 RAG 流水线是否在漂移？"Helicone 回答"哪个应用在烧 token？"Langfuse 回答"我能把整套东西自托管吗？"不同的工具，不同的受众。

选型涉及四个维度：技术栈（LangChain？原生 SDK？多供应商？）、许可证容忍度（仅 MIT？Elastic 可以？商业无妨？）、预算（免费层？$100/mo? $1000/月？）、自托管（必须？加分项？绝不？）。

## 核心概念

### 两大类别

**开发平台**将可观测性与评测、prompt 管理、数据集版本控制、会话回放捆绑。你运行实验、查看哪个 prompt 有效、用新 prompt 对旧赢家做数据集回归测试。LangSmith、Langfuse、Comet Opik。

**网关/遥测工具**对推理调用进行插桩——prompt、响应、token、延迟、模型、成本。Helicone、SigNoz、OpenLLMetry、Phoenix。极简。可以通过 OpenTelemetry 与独立的评测工具组合。

### Langfuse —— 开源与商业的平衡

- 核心采用 Apache / MIT 许可证；通过 Docker 自托管。
- 云免费层：每月 5 万事件。付费版：团队版 $29/月。
- 评测、prompt 管理、追踪、数据集。对开发平台的四项功能均有合理覆盖。
- 最佳场景：你想要 LangSmith 级别的功能，但必须自托管或坚持开源许可证。

### Phoenix（Arize）—— 遥测优先，OpenTelemetry 原生

- Elastic License 2.0；自托管轻而易举。
- 在 RAG 和漂移可视化方面表现出色。嵌入空间散点图作为一等公民提供。
- 并非为持久化生产后端而设计——主要用于开发期可观测性。
- 最佳场景：RAG 流水线开发、漂移调试，生产环境搭配独立的网关。

### Arize AX —— 规模化之选

- 商业产品。通过 Iceberg/Parquet 实现零拷贝数据湖集成。
- 声称在规模化场景下比单体式可观测性（Datadog 级别）便宜约 100 倍。原理：你把追踪数据存储在自己 S3 上的 Parquet 中，Arize 直接读取。
- 最佳场景：每天超过 1000 万条追踪、已有数据湖、想要 LLM 专属仪表盘但不想付 Datadog 的价格。

### LangSmith —— LangChain/LangGraph 优先

- 商业产品，$39/用户/月。仅 Enterprise 版支持自托管。
- 在 LangChain 和 LangGraph 技术栈中属同类最佳。如果你两者都不用，吸引力就较弱。
- 最佳场景：团队坚定使用 LangChain，且愿意付费。

### Helicone —— 基于代理的最小可用方案

- 把你的 `OPENAI_API_BASE` 切换到 Helicone 代理，15-30 分钟即可完成设置。
- MIT 许可证；每月 10 万请求免费，付费版 $20/月起。
- 包含故障转移、缓存、限流——也充当网关。
- 对 agent / 多步追踪的深度较弱。
- 最佳场景：快速上手、单一技术栈应用、需要网关 + 可观测性二合一。

### Opik（Comet）—— 开源开发平台

- Apache 2.0，完全开源。
- 功能集与 Langfuse 相似，带有 Comet 的传承。
- 最佳场景：已在用 Comet 的 ML 团队，希望在同一界面中获得 LLM 可观测性。

### SigNoz —— OpenTelemetry 优先的全栈 APM

- Apache 2.0。通过 OpenTelemetry 处理通用 APM 以及 LLM。
- 最佳场景：跨服务和 LLM 调用的统一可观测性。

### 粘合剂：OpenTelemetry + GenAI 语义约定

OpenTelemetry 于 2025 年末发布了 GenAI 语义约定（`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`）。支持 OTel 的工具可以互操作。正在形成中的生产模式：

1. 在每次 LLM 调用中按 GenAI 约定发出 OTel 数据。
2. 路由到网关（Helicone / Portkey）用于日常运行。
3. 双写（Dual-ship）到评测平台（Phoenix / Langfuse）用于回归检测。
4. 归档到数据湖（Iceberg）用于长期分析，借助 Arize AX 或 DuckDB。

### 陷阱：在错误的层进行插桩

在你的 agent 框架内部插桩（例如添加 LangSmith 追踪）会使你与该框架耦合。在 HTTP/OpenAI-SDK 层插桩（通过 OpenLLMetry 或你的网关）则具备可移植性。

### 采样——你不可能保留一切

在每天超过 100 万请求的规模下，全量追踪的保留成本会超过 LLM 调用本身。按规则采样：错误 100%、高成本 100%、成功 5%。始终保留聚合数据；仅为长尾保留原始数据。

### 你应该记住的数字

- Langfuse 免费云版：每月 5 万事件。
- LangSmith：$39/用户/月。
- Helicone 免费版：每月 10 万请求。
- Arize AX 声称：规模化场景下比单体式便宜约 100 倍。
- OpenTelemetry GenAI 约定：2025 年发布，2026 年被广泛采用。

```figure
i4-otel-glue
```

## 动手使用

`code/main.py` 在不同保留策略（100% 摄入、采样、采样 + 错误全采）下模拟一天 100 万条追踪。报告每种策略下的存储成本以及丢失的内容。

## 上线交付

本课产出 `outputs/skill-observability-stack.md`。给定技术栈、规模、预算、许可证立场，选出合适的工具。

## 练习

1. 你的团队使用 LangChain，想要开源的自托管可观测性。选择 Langfuse 或 Opik 并说明理由。
2. 每天 500 万条追踪，Datadog 报价 $15 万/月，计算 Arize AX 的盈亏平衡点。
3. 设计一套你们组织规范应在每次 LLM 调用中强制要求的 OpenTelemetry GenAI 属性集合。
4. 论证 Phoenix 单独使用是否足以支撑生产环境。什么时候不够？
5. Helicone 代理带来 20ms 开销。当 P99 TTFT 为 300ms 时，这是否可接受？如果 SLA 是 100ms 呢？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| OpenLLMetry | "面向 LLM 的 OTel" | 面向 LLM 的开源 OpenTelemetry 插桩 |
| GenAI conventions | "OTel 属性" | LLM 调用的标准 OTel 属性名 |
| LangSmith | "LangChain 可观测性" | 与 LangChain 生态捆绑的商业平台 |
| Langfuse | "开源版 LangSmith" | MIT 开源，功能集相似 |
| Phoenix | "Arize 开发工具" | OpenTelemetry 原生的开发/评测平台 |
| Arize AX | "规模化可观测性" | 商业零拷贝 Iceberg/Parquet 可观测性 |
| Helicone | "代理式可观测性" | 收集 LLM 遥测并具备网关功能的 HTTP 代理 |
| Opik | "Comet LLM" | 来自 Comet 的 Apache 2.0 开源开发平台 |
| Session replay | "追踪重放" | 重放包含工具调用的完整 agent 会话 |
| Eval | "离线测试" | 在标注数据集上运行候选模型/prompt |

## 延伸阅读

- [SigNoz — Top LLM Observability Tools 2026](https://signoz.io/comparisons/llm-observability-tools/)
- [Langfuse — Arize AX Alternative analysis](https://langfuse.com/faq/all/best-phoenix-arize-alternatives)
- [PremAI — Setting Up Langfuse, LangSmith, Helicone, Phoenix](https://blog.premai.io/llm-observability-setting-up-langfuse-langsmith-helicone-phoenix/)
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Arize Phoenix docs](https://docs.arize.com/phoenix)
- [Helicone docs](https://docs.helicone.ai/)