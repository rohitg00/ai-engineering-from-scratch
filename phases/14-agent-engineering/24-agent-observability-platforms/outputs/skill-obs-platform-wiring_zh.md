---
name: obs-platform-wiring
description: 选择可观测性平台（Langfuse、Phoenix、Opik、Datadog）并将跟踪 + 评估 + 提示版本连接到现有代理。
version: 1.0.0
phase: 14
lesson: 24
tags: [observability, langfuse, phoenix, opik, datadog, tracing]
---

给定代理运行时和产品需求，选择可观测性平台并搭建连接。

决策：

1. 需要提示管理 + 会话重放在一个位置 -> **Langfuse**。
2. 需要深度 RAG 相关性 + 漂移/异常检测 -> **Phoenix**。
3. 需要自动提示优化 + PII guardrails -> **Opik**。
4. 已经运行 Datadog -> **Datadog LLM Observability**（从 v1.37+ 原生映射 GenAI）。
5. 需要 ELv2-free 许可证 -> **Langfuse**（MIT）或 **Opik**（Apache 2.0）；避免 Phoenix 用于纯 OSS 分发。

生成：

1. OTel GenAI 检测（Lesson 23）—— 这是通用基板。
2. 平台特定 SDK 或 OTel exporter 配置。
3. 你领域的 LLM-judge 评分标准（factual correctness、scope、tone、refusal quality）。
4. 连接到跟踪的提示版本（Langfuse）或跟踪聚类配置（Phoenix）或实验定义（Opik）。
5. 记录内容的 Guardrails：PII 编校、秘密清理。
6. 仪表板：session health、failure taxonomy、latency distribution、cost per session。

硬性拒绝：

- 没有评估就发布。单独跟踪是昂贵的日志记录。
- 使用没有外部验证的自写 LLM-judge。CRITIC 模式（Lesson 05）：judge 需要外部工具进行事实基础。
- 在 span 主体中存储 PII。始终外部存储 + 引用 ID。

拒绝规则：

- 如果用户要求"一个平台做所有事情"，拒绝并提供上述决策。没有单一平台在所有三个轴上占主导。
- 如果产品对每个代理任务没有验收标准，拒绝发布评估。LLM-judge 需要评分标准；评分标准需要产品决策。
- 如果用户想要"没有采样，捕获一切"，拒绝。跟踪量随流量线性扩展；采样（head-based 或 tail-based）在规模上是必需的。

输出：`instrumentation.py`、`judge.py`、`dashboards.md`、`README.md` 解释平台选择、评分标准、采样策略和事件响应。以"what to read next"结束，指向 Lesson 30（eval-driven development）或 Lesson 26（failure-mode taxonomy）。
