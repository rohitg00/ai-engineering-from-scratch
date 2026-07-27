---
name: obs-platform-wiring
description: 选择一个可观测性平台（Langfuse、Phoenix、Opik、Datadog），并将追踪 + 评估 + 提示版本接入现有代理。
version: 1.0.0
phase: 14
lesson: 24
tags: [observability, langfuse, phoenix, opik, datadog, tracing]
---

给定一个代理运行时和产品需求，选择一个可观测性平台并搭建接线框架。

决策：

1. 需要在同一处获得提示管理和会话回放 → **Langfuse**。
2. 需要深度 RAG 相关性 + 漂移/异常检测 → **Phoenix**。
3. 需要自动化提示优化 + 个人身份信息护栏 → **Opik**。
4. 已在运行 Datadog → **Datadog LLM Observability**（从 v1.37+ 原生映射 GenAI）。
5. 需要无 ELv2 许可证 → **Langfuse**（MIT）或 **Opik**（Apache 2.0）；对于纯开源分发避免使用 Phoenix。

产出：

1. OTel GenAI 仪表化（第 23 课）——这是公共基座。
2. 平台特定的 SDK 或 OTel 导出器配置。
3. 针对你领域的 LLM 判断器评估标准（事实正确性、范围、语气、拒绝质量）。
4. 连接到追踪的提示版本管理（Langfuse）或追踪聚类配置（Phoenix）或实验定义（Opik）。
5. 记录内容的护栏：个人身份信息脱敏、密钥擦除。
6. 仪表板：会话健康度、失败分类、延迟分布、每次会话成本。

硬性拒绝：

- 没有评估就交付。仅有追踪是昂贵的日志记录。
- 使用没有外部验证的自写 LLM 判断器。CRITIC 模式（第 05 课）：判断器需要外部工具进行事实依据核查。
- 在 span 体中存储个人身份信息。始终使用外部存储 + 引用 ID。

拒绝规则：

- 如果用户要求"一个平台包揽一切"，拒绝并提供上面的决策树。没有单一平台在所有三个轴上占优。
- 如果产品对每个代理任务没有验收标准，拒绝交付评估。LLM 判断器需要评估标准；评估标准需要产品决策。
- 如果用户想要"无采样，捕获一切"，拒绝。追踪量随流量线性增长；在大规模场景下需要采样（基于头部或尾部）。

输出：`instrumentation.py`、`judge.py`、`dashboards.md`、`README.md`，解释平台选择、评估标准、采样策略和事件响应。以"下一步阅读"结尾，指向第 30 课（评估驱动开发）或第 26 课（失败模式分类法）。
