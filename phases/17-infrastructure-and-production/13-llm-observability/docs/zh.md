# LLM 可观测性技术栈选型

> 2026 年的可观测性市场分为两类。开发平台（LangSmith、Langfuse、Comet Opik）将监控与评估、提示管理、会话回放捆绑在一起。网关/仪表工具（Helicone、SigNoz、OpenLLMetry、Phoenix）专注于遥测。Langfuse 采用 MIT 许可证核心，开源平衡性出色（免费云服务每月 5 万事件）。Phoenix 基于 OpenTelemetry 原生，采用 Elastic License 2.0——在漂移/RAG 可视化方面表现出色，但不是永久性的生产后端。Arize AX 使用零拷贝 Iceberg/Parquet 集成，声称比单体可观测性方案便宜 100 倍。LangSmith 在 LangChain/LangGraph 方面领先，每人每月 39 美元，仅企业版支持自托管。Helicone 基于代理，15-30 分钟即可完成设置，每月免费 10 万请求，但在代理追踪方面深度不足。常见生产模式：网关（Helicone/Portkey）+ 评估平台（Phoenix/TruLens），通过 OpenTelemetry 粘合。

**类型：** 学习
**语言：** Python（标准库，玩具级追踪采样模拟器）
**前置知识：** 阶段 17 · 08（推理指标），阶段 14（智能体工程）
**时长：** ~60 分钟

## 学习目标

- 区分开发平台（捆绑：评估 + 提示 + 会话）与网关/遥测工具（仅追踪 + 指标）。
- 对比六种主要工具（Langfuse、LangSmith、Phoenix、Arize AX、Helicone、Opik）的许可证、定价和最佳适用场景。
- 解释 OpenTelemetry 粘合模式，该模式允许你将网关工具与单独的评估平台结合使用。
- 指出 2026 年的成本差异化因素（Arize AX 的零拷贝方式 vs 单体摄取），并说明约 100 倍的倍数关系。

## 问题

你上线了一个 LLM 功能。它能工作。但你对提示失败、工具循环、延迟退化、成本飙升或提示缓存命中率毫无可见性。你搜索"LLM 可观测性"，得到八个工具，都说自己解决相同的问题，价格却分三个档次。

它们解决的问题并不相同。LangSmith 回答"这个 LangGraph 运行为什么失败？"Phoenix 回答"我的 RAG 管道是否在漂移？"Helicone 回答"哪个应用在烧 Token？"Langfuse 回答"我能自托管整个方案吗？"不同的工具，不同的受众。

选择涉及四个维度：技术栈（LangChain？原始 SDK？多供应商？）、许可证容忍度（仅 MIT？Elastic 可以？商业版没问题？）、预算（免费层？每月 100 美元？每月 1000 美元？）、自托管（必须？锦上添花？绝不？）。

## 概念

### 两类平台

**开发平台**将可观测性与评估、提示管理、数据集版本控制、会话回放捆绑在一起。你运行实验，查看哪个提示有效，用旧胜出者对新提示进行数据集回归测试。LangSmith、Langfuse、Comet Opik。

**网关/遥测工具**对推理调用进行仪表化——提示、响应、Token、延迟、模型、成本。Helicone、SigNoz、OpenLLMetry、Phoenix。极简主义。可通过 OpenTelemetry 与单独的评估工具结合使用。

### Langfuse —— 开源平衡

- 核心采用 Apache / MIT 许可证；通过 Docker 自托管。
- 免费云服务：每月 5 万事件。付费：团队版每月 29 美元。
- 评估、提示管理、追踪、数据集。合理覆盖所有四个开发平台功能。
- 最佳场景：你需要 LangSmith 级别的功能，但必须自托管或保持开源许可证。

### Phoenix (Arize) —— 遥测优先，OpenTelemetry 原生

- Elastic License 2.0；自托管非常简单。
- 在 RAG 和漂移可视化方面表现出色。嵌入空间散点图作为一等公民提供。
- 并非设计为持久化生产后端——主要是开发时可观测性。
- 最佳场景：RAG 管道开发、漂移调试、与单独的网关配对用于生产环境。

### Arize AX —— 规模化的玩法

- 商业产品。通过 Iceberg/Parquet 实现零拷贝数据湖集成。
- 声称在大规模下比单体可观测性（Datadog 级别）便宜约 100 倍。原理：你将追踪数据存储在自己的 S3 Parquet 中；Arize 直接读取。
- 最佳场景：每天超过 1000 万追踪数据、已有数据湖、需要 LLM 特定仪表板但不想承受 Datadog 的价格。

### LangSmith —— LangChain/LangGraph 优先

- 商业产品，每人每月 39 美元。仅企业版支持自托管。
- 对于 LangChain 和 LangGraph 技术栈来说是最好的选择。如果你不使用这两者，它的吸引力就大打折扣。
- 最佳场景：团队致力于使用 LangChain，愿意付费。

### Helicone —— 基于代理的最小可行方案

- 通过将你的 `OPENAI_API_BASE` 切换到 Helicone 代理，15-30 分钟完成设置。
- MIT 许可证；每月免费 10 万请求，付费每月 20 美元起。
- 包含故障转移、缓存、速率限制——同时充当网关。
- 在智能体/多步骤追踪方面深度不足。
- 最佳场景：快速起步、单栈应用、需要网关和可观测性一体方案。

### Opik (Comet) —— 开源开发平台

- Apache 2.0，完全开源。
- 功能集与 Langfuse 类似，带有 Comet 血统。
- 最佳场景：机器学习团队已在使用 Comet，希望在同一个面板中获得 LLM 可观测性。

### SigNoz —— OpenTelemetry 优先的完整 APM

- Apache 2.0。通过 OpenTelemetry 处理通用 APM 以及 LLM。
- 最佳场景：跨服务和 LLM 调用的统一可观测性。

### 粘合剂：OpenTelemetry + GenAI 语义约定

OpenTelemetry 在 2025 年末发布了 GenAI 语义约定（`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`）。消费 OTel 的工具可以互操作。正在形成的生产模式：

1. 从每个 LLM 调用中发出带有 GenAI 约定的 OTel。
2. 路由到网关（Helicone / Portkey）用于日常使用。
3. 双路发送到评估平台（Phoenix / Langfuse）用于回归测试。
4. 归档到数据湖（Iceberg）中，通过 Arize AX 或 DuckDB 进行长期分析。

### 陷阱：在错误的层级进行仪表化

在你的智能体框架内部进行仪表化（例如添加 LangSmith 追踪）会将你与该框架耦合。在 HTTP/OpenAI-SDK 层（通过 OpenLLMetry 或你的网关）进行仪表化是可移植的。

### 采样——你无法保留所有数据

每天超过 100 万次请求时，全量追踪保留的成本比 LLM 调用本身还高。按规则采样：100% 错误，100% 高成本，5% 成功。始终保留聚合数据；原始数据只保留长尾部分。

### 你应该记住的数字

- Langfuse 免费云服务：每月 5 万事件。
- LangSmith：每人每月 39 美元。
- Helicone 免费：每月 10 万请求。
- Arize AX 声称：大规模下比单体方案便宜约 100 倍。
- OpenTelemetry GenAI 约定：2025 年发布，2026 年被广泛采用。

## 使用

`code/main.py` 模拟了在多种保留策略下（100% 摄取、采样、采样 + 错误）的 100 万追踪数据日。报告每种策略下的存储成本和丢失内容。

## 交付

本课程生成 `outputs/skill-observability-stack.md`。根据技术栈、规模、预算和许可证姿态，选择对应的工具。

## 练习

1. 你的团队使用 LangChain，需要开源自托管可观测性。选择 Langfuse 或 Opik 并说明理由。
2. 每天 500 万追踪数据，Datadog 报价每月 15 万美元，计算 Arize AX 的盈亏平衡点。
3. 设计一组 OpenTelemetry GenAI 属性，作为你所在组织的指南应强制要求在每个 LLM 调用中记录。
4. 论述仅使用 Phoenix 是否足以用于生产环境。在什么情况下它不够用？
5. Helicone 带来 20ms 代理开销。在 P99 TTFT 300ms 的情况下，这是否可接受？如果 SLA 是 100ms 呢？

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| OpenLLMetry | "LLM 的 OTel" | 面向 LLM 的开源 OpenTelemetry 仪表化方案 |
| GenAI 约定 | "OTel 属性" | LLM 调用的标准 OTel 属性名称 |
| LangSmith | "LangChain 可观测性" | 与 LangChain 生态系统捆绑的商业平台 |
| Langfuse | "开源版 LangSmith" | 功能集类似的开源 MIT 方案 |
| Phoenix | "Arize 开发工具" | OpenTelemetry 原生开发/评估平台 |
| Arize AX | "规模化可观测性" | 商业版零拷贝 Iceberg/Parquet 可观测性方案 |
| Helicone | "代理可观测性" | 收集 LLM 遥测数据并具备网关功能的 HTTP 代理 |
| Opik | "Comet 的 LLM 方案" | Comet 推出的 Apache 2.0 开源开发平台 |
| 会话回放 | "追踪重放" | 重放包含工具调用的完整智能体会话 |
| 评估 | "离线测试" | 在有标注的数据集上运行候选模型/提示 |

## 延伸阅读

- [SigNoz —— 2026 年顶级 LLM 可观测性工具](https://signoz.io/comparisons/llm-observability-tools/)
- [Langfuse —— Arize AX 替代方案分析](https://langfuse.com/faq/all/best-phoenix-arize-alternatives)
- [PremAI —— 搭建 Langfuse、LangSmith、Helicone、Phoenix](https://blog.premai.io/llm-observability-setting-up-langfuse-langsmith-helicone-phoenix/)
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Arize Phoenix 文档](https://docs.arize.com/phoenix)
- [Helicone 文档](https://docs.helicone.ai/)
