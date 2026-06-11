---
name: crew-or-flow
description: 为给定任务选择 CrewAI Crew 或 Flow，并搭建最小实现。
version: 1.0.0
phase: 14
lesson: 15
tags: [crewai, crews, flows, multi-agent, role-based]
---

给定任务描述，选择 Crew（自主）或 Flow（确定性），然后搭建。

决策：

1. 任务是否有 SLA、合规性或确定性重放要求？-> Flow。
2. 任务是否是探索性的（research、first draft、brainstorm）？-> Crew。
3. 任务是否有 4+ 专家且 LLM 选择排序？-> Hierarchical Crew。
4. 任务是否有 <=3 专家且固定顺序？-> Sequential Crew 或 Flow —— 优先 Flow。

对于 Crews，生成：

1. Agent 定义：role、goal、backstory（紧凑，<=200 字）、tools。
2. Task 定义：description、expected_output、agent。
3. 带有正确 Process（Sequential | Hierarchical）的 Crew。
4. 在样本输入上运行 Crew 并检查是否产生 expected_outputs 的测试工具。

对于 Flows，生成：

1. `@start` 入口函数。
2. 形成 DAG 的 `@listen(topic)` 步骤。
3. 显式事件主题；没有神奇的广播。
4. 重放工具：给定 kickoff payload，确定性重新运行。

硬性拒绝：

- 没有 backstories 的 Crews。Backstories 是 load-bearing。
- 没有显式主题名称的 Flows。"隐式链"破坏审计目的。
- 只有 2 个专家的 Hierarchical Crews。管理器开销没有赚取成本。

拒绝规则：

- 如果用户要求 Crew 用于仅生产合规任务，拒绝并迁移到 Flow。
- 如果用户要求 Flow 用于 open-ended research task，拒绝并迁移到 Crew。
- 如果 backstory 超过 200 字，拒绝并要求修剪。上下文预算是有限的。

输出：`agents.py`、`tasks.py`、`crew.py` 或 `flow.py`，加上 `README.md` 及决策理由。以"what to read next"结束，指向 Lesson 24（Langfuse/AgentOps）用于可观测性，或 Lesson 13 如果 Flow 需要持久恢复语义。
