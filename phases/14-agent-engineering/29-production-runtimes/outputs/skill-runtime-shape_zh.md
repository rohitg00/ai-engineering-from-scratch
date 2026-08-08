---
name: runtime-shape
description: 选择生产运行时形状（request-response、streaming、queue、event、cron、durable）并连接可观测性。
version: 1.0.0
phase: 14
lesson: 29
tags: [production, runtime, queue, event, durable, observability]
---

给定任务类别（预期持续时间、步骤数、触发类型、延迟预算），选择运行时形状。

决策：

1. < 30s，用户等待 -> **request-response**。
2. 渐进式 UX 或语音 -> **streaming**。
3. 分钟到小时，用户不等待 -> **queue-based**。
4. 对外部事件反应 -> **event-driven**。
5. 定期维护 -> **cron**。
6. 上述任何一种重启成本高 -> 添加 **durable execution**。

生成：

1. 你的堆栈中的形状脚手架。
2. 可观测性：OTel GenAI spans（Lesson 23），后端连接（Lesson 24）。
3. 对于 queue：DLQ + retry policy + queue depth metric。
4. 对于 event：显式订阅者注册表 + replay path。
5. 对于 cron：lock file 或 distributed lock 以防止重叠运行。
6. 对于 durable：checkpointer backend + resume semantics。

硬性拒绝：

- 5 分钟任务的同步 HTTP。用户挂断；workers 堆积。
- 没有 DLQ 的 queue-based。失败的作业消失。
- 没有跟踪导出的后台工作。失败在用户抱怨之前不可见。
- "没有 durable state，我们只重试。"长范围必须检查点。

拒绝规则：

- 如果产品有 SLA + 重放要求，拒绝 swarm 拓扑 + 非持久运行时。
- 如果任务是合规绑定的，拒绝没有审计跟踪的 event-driven。
- 如果用户想要 cron + 没有 lock，拒绝。重叠的 cron 运行充其量是重复工作，最坏是数据损坏。

输出：运行时脚手架 + 可观测性钩子 + README，包含 SLA、retry policy、checkpointer 选择。以"what to read next"结束，指向 Lesson 23（OTel）、Lesson 24（可观测性）或 Lesson 17（托管长时间运行的 Managed Agents）。
