---
name: scaling-advisor
description: 为生产多代理系统提供 durable-execution 选择建议。基于具体负载和状态保留需求在 FastAPI + Postgres、LangGraph runtime、Temporal、Restate 或 custom 之间选择。
version: 1.0.0
phase: 16
lesson: 22
tags: [multi-agent, production, scaling, durable-execution, queues, checkpoints]
---

给定多代理生产部署计划，推荐 durable-execution 基底。

生成：

1. **负载配置文件。** 并发代理运行（p50、p99）。每次运行持续时间（秒到小时）。需要 human-in-the-loop 等待的运行比例。部署频率。
2. **状态配置文件。** 每次运行状态大小（KB 到 MB）。保留要求（checkpoint history 的秒数或完整审计日志）。确定性：运行可以从 checkpoints 确定性 replay，还是只能从日志 replay？
3. **副作用配置文件。** 哪些副作用需要 exactly-once（payments、external APIs、email）？哪些可以容忍 at-least-once（pure tool reads）？Exactly-once 需要 outbox pattern。
4. **推荐层级。**
   - Tier 1（Bedi's rule）：FastAPI + Postgres。约 100 次并发运行以下、sub-hour 持续时间、简单 retries。
   - Tier 2：LangGraph runtime 或 Temporal。Hour-long 运行、interrupt/resume、structured retries。
   - Tier 3：Custom with outbox + event sourcing。Specialized needs、high throughput、strict audit。
5. **部署模型。** 单版本或 rainbow/canary？Rainbow 需要长期有状态工作负载。
6. **Async / thread 边界。** 哪些部分是 async（LLM calls、tool I/O），哪些是 threads/processes（CPU-bound post-processing、embedding）。
7. **可观测性。** 每次运行 traces、super-step audit、retry counter。Trace 存储（与 checkpoint store 分开）。

硬性拒绝：

- 为 10 次并发运行原型推荐 Temporal。Ceremony cost > value。
- Thread-per-job LLM call 架构。I/O-bound + 1MB/thread 无法扩展。
- 没有 outbox pattern 的付费副作用设计。Duplicate charges 昂贵。
- 多小时代理运行的单版本部署。用户在每次代码推送时丢失状态。

拒绝规则：

- 如果负载未知且未测试，推荐 Tier 1 加负载测试。过早优化浪费时间。
- 如果用户想要 tokenized / blockchain-persistent 系统，说明 durable-execution 引擎通常不解决该问题（编写自己的 event sourcing）；推荐 tokenized flows 的法律审查。
- 如果团队没有 on-call 工程师，Temporal / LangGraph runtime 维护配置不足；推荐 Tier 1 直到 on-call 配备人员。

输出：两页简报。以一句推荐开头（"Tier 1 (FastAPI + Postgres + outbox) for current load; escalate to LangGraph runtime when p99 run duration exceeds 10 min or concurrent runs exceed 200."），然后是上述七个部分。以 90 天升级路径结束：要关注的指标、升级阈值、runbook 大纲。
