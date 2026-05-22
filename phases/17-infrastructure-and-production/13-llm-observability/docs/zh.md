# LLM 可观测性栈选择

> 2026 年的可观测性市场分为两类。开发平台（LangSmith、Langfuse、Comet Opik）将监控与评估、提示管理、会话重放捆绑在一起。网关/检测工具（Helicone、SigNoz、OpenLLMetry、Phoenix）专注于遥测。Langfuse 是 MIT 许可的核心，具有强大的 OSS 平衡（50K 事件/月免费云）。Phoenix 是 Elastic License 2.0 下的 OpenTelemetry 原生——非常适合漂移/RAG 可视化，不是持久的生产后端。Arize AX 使用零拷贝 Iceberg/Parquet 集成，声称比单体可观测性便宜 100 倍。LangSmith 在 LangChain/LangGraph 方面领先，39 美元/用户/月，仅在企业版中自托管。Helicone 是基于代理的，15-30 分钟设置，100K 请求/月免费，但在代理跟踪方面深度较浅。常见的生产模式：网关（Helicone/Portkey）+ 评估平台（Phoenix/TruLens）通过 OpenTelemetry 粘合。

**类型：** 学习
**语言：** Python（标准库，简单的跟踪采样模拟器）
**先修要求：** 阶段 17 · 08（推理指标）、阶段 14（代理工程）
**时间：** 约 60 分钟

## 学习目标

- 区分开发平台（捆绑：评估 + 提示 + 会话）与网关/遥测工具（仅跟踪 + 指标）。
- 将六个主要工具（Langfuse、LangSmith、Phoenix、Arize AX、Helicone、Opik）映射到它们的许可、定价和优势场景用例。
- 解释 OpenTelemetry 粘合模式，它允许你将网关工具与单独的评估平台结合。
- 说出 2026 年的成本差异化因素（Arize AX 的零拷贝方法 vs 单体摄取）并说明粗略的 100 倍乘数。

## 问题

你发布了一个 LLM 功能。它工作了。你对提示失败、工具循环、延迟回归、成本激增或提示缓存命中率没有可见性。你谷歌"LLM observability"，得到八个工具，都声称以三个不同的价格点解决相同的问题。

它们解决的不是同一个问题。LangSmith 回答"为什么这个 LangGraph 运行失败了？" Phoenix 回答"我的 RAG 管道在漂移吗？" Helichone 回答"哪个应用在消耗 token？" Langfuse 回答"我可以自托管整个东西吗？" 不同的工具，不同的受众。

选择涉及四个轴：栈（LangChain？原始 SDK？多供应商？）、许可容忍度（仅 MIT？Elastic 可以吗？商业可以吗？）、预算（免费层？100 美元/月？1000 美元/月？）和自托管（必须？有就好？从不？）。

## 概念

### 两类

**开发平台**将可观测性与评估、提示管理、数据集版本控制、会话重放捆绑在一起。你运行实验，查看哪个提示有效，针对旧赢家对新提示进行数据集回归。LangSmith、Langfuse、Comet Opik。

**网关/遥测工具**检测推理调用——提示、响应、token、延迟、模型、成本。Helicone、SigNoz、OpenLLMetry、Phoenix。极简主义。可以通过 OpenTelemetry 与单独的评估工具结合。

### Langfuse——OSS 平衡

- 核心 Apache / MIT 许可；通过 Docker 自托管。
- 云免费层：50K 事件/月。付费：团队 29 美元/月。
- 评估、提示管理、跟踪、数据集。对所有四个开发平台功能的合理覆盖。
- 优势场景：你想要 LangSmith 级功能，但必须自托管或保持 OSS 许可。

### Phoenix (Arize)——遥测优先，OpenTelemetry 原生

- Elastic License 2.0；自托管简单。
- 擅长 RAG 和漂移可视化。嵌入空间散点图作为一等功能提供。
- 不是设计为持久生产后端——主要是开发时可观测性。
- 优势场景：RAG 管道开发、漂移调试，与用于生产的单独网关配对。

### Arize AX——规模玩法

- 商业。通过 Iceberg/Parquet 实现零拷贝数据湖集成。
- 声称在规模上比单体可观测性（Datadog 级）便宜约 100 倍。数学原理：你将跟踪存储在 S3 上的自己的 Parquet 中；Arize 直接读取。
- 优势场景：>1000 万跟踪/天，现有数据湖，想要 LLM 特定仪表板而无需 Datadog 定价。

### LangSmith——LangChain/LangGraph 优先

- 商业，39 美元/用户/月。仅在企业版中自托管。
- LangChain 和 LangGraph 栈的一流水平。如果你不在任何一个上，它的吸引力就较小。
- 优势场景：团队致力于 LangChain，愿意付费。

### Helichone——基于代理的最低可行方案

- 通过将你的 `OPENAI_API_BASE` 切换到 Helichone 代理，15-30 分钟设置。
- MIT 许可；100K 请求/月免费，付费 20 美元/月+。
- 包括故障转移、缓存、速率限制——也充当网关。
- 在代理 / 多步骤跟踪上的深度较浅。
- 优势场景：快速启动，单栈应用，需要一个网关 + 可观测性合二为一。

### Opik (Comet)——OSS 开发平台

- Apache 2.0，完全 OSS。
- 具有 Comet 传承的与 Langfuse 类似的功能集。
- 优势场景：已经在 Comet 上的 ML 团队，想要同一面板中的 LLM 可观测性。

### SigNoz——OpenTelemetry 优先的完整 APM

- Apache 2.0。通过 OpenTelemetry 处理通用 APM 以及 LLM。
- 优势场景：跨服务和 LLM 调用的统一可观测性。

### 粘合剂：OpenTelemetry + GenAI 语义约定

OpenTelemetry 在 2025 年底发布了 GenAI 语义约定（`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`）。使用 OTel 的工具可以互操作。新兴的生产模式：

1. 从每个 LLM 调用发出带有 GenAI 约定的 OTel。
2. 路由到网关（Helicone / Portkey）用于日常。
3. 双寄送到评估平台（Phoenix / Langfuse）用于回归。
4. 在数据湖（Iceberg）中归档以通过 Arize AX 或 DuckDB 进行长期分析。

### 陷阱：在错误的层进行检测

在你的代理框架内检测（例如，添加 LangSmith 跟踪）将你耦合到该框架。在 HTTP/OpenAI-SDK 层检测（通过 OpenLLMetry 或你的网关）是可移植的。

### 采样——你不能保留一切

在 >100 万请求/天时，全跟踪保留比 LLM 调用成本更高。按规则采样：100% 错误，100% 高成本，5% 成功。始终保留聚合；为长尾部保留原始数据。

### 你应该记住的数字

- Langfuse 免费云：50K 事件/月。
- LangSmith：39 美元/用户/月。
- Helichone 免费：100K 请求/月。
- Arize AX 声称：在规模上比单体便宜约 100 倍。
- OpenTelemetry GenAI 约定：2025 年发布，2026 年广泛采用。

## 使用它

`code/main.py` 模拟跨保留策略（100% 摄取、采样、采样 + 错误）的 100 万跟踪日。报告存储成本和每种策略下丢失的内容。

## 交付它

本课生成 `outputs/skill-observability-stack.md`。给定栈、规模、预算、许可立场，选择工具。

## 练习

1. 你的团队在 LangChain 上想要 OSS 自托管可观测性。选择 Langfuse 或 Opik 并证明。
2. 在 Datadog 报价 15 万美元/月时，计算 Arize AX 的盈亏平衡。
3. 设计你的组织指南应该强制在每个 LLM 调用上的 OpenTelemetry GenAI 属性集。
4. 论证 Phoenix 单独是否足以用于生产。何时它不够？
5. Helichone 是 20 毫秒代理开销。在 P99 TTFT 300 毫秒时，这是可以接受的吗？如果 SLA 是 100 毫秒呢？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| OpenLLMetry | "用于 LLM 的 OTel" | 用于 LLM 的开源 OpenTelemetry 检测 |
| GenAI conventions | "OTel 属性" | 用于 LLM 调用的标准 OTel 属性名称 |
| LangSmith | "LangChain 可观测性" | 与 LangChain 生态系统捆绑的商业平台 |
| Langfuse | "OSS LangSmith" | 具有类似功能集的 MIT OSS |
| Phoenix | "Arize 开发工具" | OpenTelemetry 原生开发/评估平台 |
| Arize AX | "规模可观测性" | 商业零拷贝 Iceberg/Parquet 可观测性 |
| Helichone | "代理可观测性" | 收集 LLM 遥测 + 网关功能的 HTTP 代理 |
| Opik | "Comet LLM" | 来自 Comet 的 Apache 2.0 OSS 开发平台 |
| Session replay | "跟踪重新运行" | 使用工具调用重放完整代理会话 |
| Eval | "离线测试" | 在标记的数据集上运行候选模型/提示 |

## 延伸阅读

- [SigNoz——顶级 LLM 可观测性工具 2026](https://signoz.io/comparisons/llm-observability-tools/)
- [Langfuse——Arize AX 替代分析](https://langfuse.com/faq/all/best-phoenix-arize-alternatives)
- [PremAI——设置 Langfuse、LangSmith、Helicone、Phoenix](https://blog.premai.io/llm-observability-setting-up-langfuse-langsmith-helicone-phoenix/)
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Arize Phoenix 文档](https://docs.arize.com/phoenix)
- [Helichone 文档](https://docs.helicone.ai/)
