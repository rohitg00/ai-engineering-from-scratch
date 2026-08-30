---
name: state-graph
description: 构建 LangGraph 风格的状态机，带有类型化状态、条件边、每节点检查点和持久恢复。
version: 1.0.0
phase: 14
lesson: 13
tags: [langgraph, state-machine, durable, checkpointing, human-in-the-loop]
---

给定目标运行时、状态形状、一组节点函数和检查点后端，生成有状态代理图。

生成：

1. 类型化的 `State`（dict 或 Pydantic）。记录每个字段。节点读取状态；它们返回更新。
2. `StateGraph`，带有 `add_node`、`add_edge`、`add_conditional_edges`、`set_entry`，加上 `START`/`END` 哨兵。
3. `Checkpointer` 接口，带有 `save(session_id, node, state)` 和 `load_latest(session_id)`。默认 SQLite；允许 Postgres/Redis/custom。
4. `Runner`，逐步执行图，在每个节点后序列化状态，捕获 `PausedAtNode` 用于 human-in-the-loop，并支持带有可选 `state_override` 的 `resume_from`。
5. 三个拓扑辅助器：supervisor（central router）、swarm（shared-tool handoffs）、hierarchical（subgraphs）。

硬性拒绝：

- 没有显式随机种子或 wall-clock 捕获的非确定性节点。恢复假设给定输入状态的节点输出是可重复的。
- 仅保存"summary"状态的检查点。序列化完整状态，否则恢复中断。
- 每条边都是条件边的图。优先使用偶尔分支的线性链。

拒绝规则：

- 如果用户要求没有持久化的状态图，拒绝。重点是持久恢复；如果你不需要恢复，使用 Lesson 12 的工作流模式。
- 如果用户要求"仅在成功时检查点"，拒绝。失败也需要状态 —— 那是调试开始的地方。
- 如果图有超过约 30 个节点，拒绝扁平布局并要求嵌套子图。扁平 30 节点图无法审查。

输出：`state.py`、`graph.py`、`checkpointer.py`、`runner.py`、`README.md` 解释状态模式、检查点选择和恢复语义。以"what to read next"结束，指向 Lesson 14（actor-model 替代方案）、Lesson 16（handoffs/guardrails 层）或 Lesson 23（图步骤上的 OTel spans）。
