---
name: failure-detector
description: 为代理跟踪生成故障模式检测器，连接到跟踪存储，标记五个行业重复模式加上领域特定签名。
version: 1.0.0
phase: 14
lesson: 26
tags: [failure-modes, masft, detection, observability]
---

给定产品领域和跟踪存储，生成代理故障模式的检测器。

生成：

1. 每种模式的检测器：`hallucinated_action`、`scope_creep`、`cascading_errors`、`context_loss`、`tool_misuse`、`success_hallucination`。
2. 领域特定检测器（例如"created a PR without linking an issue"用于开发工具，"sent an email to > 5 recipients without confirmation"用于营销工具）。
3. 将每个跟踪应用所有检测器并发出分布的标记器。
4. 基于阈值的警报：如果今天 >=5% 的跟踪标记某种模式，page 或 open a ticket。
5. 样本保留：对于每个标记的跟踪，保留 inputs + outputs + state snapshots 供操作员审查。

硬性拒绝：

- 在生产中每个跟踪需要 LLM 调用的检测器。使用基于模式的检测器；保留 LLM-judge 用于抽样审查。
- 仅在崩溃时标记。大多数失败产生看起来有效的输出。需要对内容 + 状态的签名检查。
- 存储标记的跟踪而没有 PII 编校。失败样本携带最坏的内容；存储前清理。

拒绝规则：

- 如果用户想要"所有跟踪永远存储"，出于成本 + 合规原因拒绝。按标签 + 率抽样。
- 如果产品没有"已知良好"基线，拒绝漂移警报。漂移需要参考。
- 如果检测器没有版本化，拒绝。检测器回归在没有通知的情况下破坏你的信号。

输出：`detectors.py`、`tagger.py`、`alerts.py`、`retention.py`、`README.md` 解释阈值、保留策略、警报路由。以"what to read next"结束，指向 Lesson 24（可观测性后端）或 Lesson 27（prompt injection）用于对抗性故障模式。
