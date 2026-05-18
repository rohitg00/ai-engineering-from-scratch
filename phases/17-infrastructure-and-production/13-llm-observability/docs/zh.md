# LLM可观测性栈选择

> 2026年可观测性市场分为两类。开发平台（LangSmith、Langfuse、Comet Opik）将监控与评估、提示管理、会话回放捆绑。网关/仪器工具（Helicone、SigNoz、OpenLLMetry、Phoenix）专注于遥测。Langfuse是MIT许可核心，具有强大的OSS平衡（50K事件/月免费云）。Phoenix是Elastic License 2.0下的OpenTelemetry原生 —— 非常适合漂移/RAG可视化，不是持久生产后端。Arize AX使用零拷贝Iceberg/Parquet集成，声称比单体可观测性便宜100倍。LangSmith领先于LangChain/LangGraph，$39/用户/月，仅企业版自托管。Helicone是基于代理的，15-30分钟设置，100K请求/月免费，但在代理跟踪上深度较少。常见生产模式：网关（Helicone/Portkey）+ 评估平台（Phoenix/TruLens）通过OpenTelemetry粘合。

**类型：** 学习
**语言：** Python（标准库，玩具跟踪采样模拟器）
**前置知识：** 第17阶段 · 08（推理指标），第14阶段（代理工程）
**时间：** 约60分钟

## 学习目标

- 区分开发平台（捆绑：评估 + 提示 + 会话）与网关/遥测工具（仅跟踪 + 指标）。
- 将六个主要工具（Langfuse、LangSmith、Phoenix、Arize AX、Helicone、Opik）映射到其许可、定价和最佳用例。
- 解释OpenTelemetry粘合模式，让你组合网关工具与单独评估平台。
- 命名2026年成本差异化因素（Arize AX的零拷贝方法 vs 单体摄取）并陈述大致100倍乘数。

## 问题

你发布了一个LLM功能。它工作了。你对提示失败、工具循环、延迟回归、成本飙升或提示缓存命中率没有可见性。你Google"LLM可观测性"并得到八个工具，都声称在三个不同价格点解决相同问题。

它们不解决相同问题。LangSmith回答"为什么这个LangGraph运行失败？"Phoenix回答"我的RAG管道是否在漂移？"Helicone回答"哪个应用在燃烧token？"Langfuse回答"我能自托管整个东西吗？"不同工具，不同受众。

选择涉及四个轴：栈（LangChain？原始SDK？多供应商？）、许可容忍（仅MIT？Elastic可以？商业可以？）、预算（免费层？$100/月？$1000/月？）和自托管（必须？ nice-to-have？从不？）。

## 概念

### 两类

**开发平台**将可观测性与评估、提示管理、数据集版本控制、会话回放捆绑。你运行实验，看哪个提示有效，对旧赢家进行数据集回归新提示。LangSmith、Langfuse、Comet Opik。

**网关/遥测工具**检测推理调用 —— 提示、响应、token、延迟、模型、成本。极简。可以通过OpenTelemetry与单独评估工具组合。

### Langfuse —— OSS平衡

- 核心Apache / MIT许可；通过Docker自托管。
- 云免费层：50K事件/月。付费：团队$29/月。
- 评估、提示管理、跟踪、数据集。合理覆盖所有四个开发平台功能。
- 最佳点：你想要LangSmith级功能但必须自托管或保持OSS许可。

### Phoenix（Arize）—— 遥测优先，OpenTelemetry原生

- Elastic License 2.0；自托管简单。
- 擅长RAG和漂移可视化。嵌入空间散点图作为一等公民发布。
- 不是设计为持久生产后端 —— 主要是开发时可观测性。
- 最佳点：RAG管道开发、漂移调试，与单独网关配对用于生产。

### Arize AX —— 规模玩法

- 商业。通过Iceberg/Parquet零拷贝数据湖集成。
- 声称比单体可观测性（Datadog级）规模上约便宜100倍。数学：你在S3上自己的Parquet中存储跟踪；Arize直接读取。
- 最佳点：>10M跟踪/天，现有数据湖，想要LLM特定仪表板而不付Datadog价格。

### LangSmith —— LangChain/LangGraph优先

- 商业，$39/用户/月。仅企业版自托管。
- LangChain和LangGraph栈的最佳级。如果你不在任一上，它不太有说服力。
- 最佳点：团队致力于LangChain，愿意付费。

### Helicone —— 基于代理的最小可行

- 通过将你的`OPENAI_API_BASE`交换到Helicone代理，15-30分钟设置。
- MIT许可；100K请求/月免费，付费$20/月+。
- 包括故障转移、缓存、速率限制 —— 也充当网关。
- 代理/多步跟踪深度较少。
- 最佳点：快速启动、单栈应用、需要网关 + 可观测性合一。

### Opik（Comet）—— OSS开发平台

- Apache 2.0，完全OSS。
- 与Langfuse类似的功能集，带Comet遗产。
- 最佳点：已在Comet上的ML团队，想要同一窗格中的LLM可观测性。

### SigNoz —— OpenTelemetry优先完整APM

- Apache 2.0。通过OpenTelemetry处理通用APM加LLM。
- 最佳点：跨服务和LLM调用的统一可观测性。

### 粘合剂：OpenTelemetry + GenAI语义约定

OpenTelemetry在2025年末发布GenAI语义约定（`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`）。消费OTel的工具可以互操作。出现的生产模式：

1. 从每个LLM调用发出带GenAI约定的OTel。
2. 路由到网关（Helicone / Portkey）用于日常。
3. 双发到评估平台（Phoenix / Langfuse）用于回归。
4. 在数据湖（Iceberg）中归档，通过Arize AX或DuckDB进行长期分析。

### 陷阱：在错误层检测

在代理框架内部检测（例如，添加LangSmith跟踪）将你耦合到该框架。在HTTP/OpenAI-SDK层检测（通过OpenLLMetry或你的网关）是可移植的。

### 采样 —— 你不能保留一切

在>1M请求/天，完整跟踪保留成本超过LLM调用。按规则采样：100%错误、100%高成本、5%成功。始终保留聚合；为长尾保留原始。

### 你应该记住的数字

- Langfuse免费云：50K事件/月。
- LangSmith：$39/用户/月。
- Helicone免费：100K请求/月。
- Arize AX声称：规模上比单体约便宜100倍。
- OpenTelemetry GenAI约定：2025年发布，2026年广泛采用。

## 使用它

`code/main.py`在保留策略（100%摄取、采样、采样 + 错误）上模拟1M跟踪天。报告存储成本和每种下丢失的内容。

## 交付它

本课程产出`outputs/skill-observability-stack.md`。给定栈、规模、预算、许可姿态，选择工具。

## 练习

1. 你在LangChain上的团队想要OSS自托管可观测性。选择Langfuse或Opik并证明。
2. 在5M跟踪/天，Datadog报价$150K/月，计算Arize AX的盈亏平衡。
3. 设计你的组织指南应在每个LLM调用上强制执行的OpenTelemetry GenAI属性集。
4. 争论Phoenix单独是否足以用于生产。何时不足？
5. Helicone是20毫秒代理开销。在P99 TTFT 300毫秒时，可接受吗？如果SLA是100毫秒呢？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| OpenLLMetry | "LLM的OTel" | LLM的开源OpenTelemetry检测 |
| GenAI约定 | "OTel属性" | LLM调用的标准OTel属性名称 |
| LangSmith | "LangChain可观测性" | 与LangChain生态系统捆绑的商业平台 |
| Langfuse | "OSS LangSmith" | 具有类似功能集的MIT OSS |
| Phoenix | "Arize开发工具" | OpenTelemetry原生开发/评估平台 |
| Arize AX | "规模可观测性" | 商业零拷贝Iceberg/Parquet可观测性 |
| Helicone | "代理可观测性" | 收集LLM遥测 + 网关功能的HTTP代理 |
| Opik | "Comet LLM" | 来自Comet的Apache 2.0 OSS开发平台 |
| 会话回放 | "跟踪重放" | 重放带工具调用的完整代理会话 |
| 评估 | "离线测试" | 在标记数据集上运行候选模型/提示 |

## 延伸阅读

- [SigNoz —— 2026年顶级LLM可观测性工具](https://signoz.io/comparisons/llm-observability-tools/)
- [Langfuse —— Arize AX替代分析](https://langfuse.com/faq/all/best-phoenix-arize-alternatives)
- [PremAI —— 设置Langfuse、LangSmith、Helicone、Phoenix](https://blog.premai.io/llm-observability-setting-up-langfuse-langsmith-helicone-phoenix/)
- [OpenTelemetry GenAI语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Arize Phoenix文档](https://docs.arize.com/phoenix)
- [Helicone文档](https://docs.helicone.ai/)