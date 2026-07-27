---
name: state-graph
description: 构建一个 LangGraph 风格的状态机，配备类型化状态、条件边、逐节点检查点机制和持久化恢复。
version: 1.0.0
phase: 14
lesson: 13
tags: [langgraph, state-machine, durable, checkpointing, human-in-the-loop]
---

给定目标运行时、状态形状、一组节点函数和一个检查点后端，生成一个有状态代理图。

产出：

1. 一个类型化的 `State`（字典或 Pydantic）。记录每个字段。节点读取状态；它们返回更新。
2. 一个 `StateGraph`，包含 `add_node`、`add_edge`、`add_conditional_edges`、`set_entry`，以及 `START`/`END` 哨兵。
3. 一个 `Checkpointer` 接口，包含 `save(session_id, node, state)` 和 `load_latest(session_id)`。默认使用 SQLite；允许 Postgres/Redis/自定义。
4. 一个 `Runner`，遍历图，在每个节点后序列化状态，捕获 `PausedAtNode` 以支持人机协作，并支持带可选 `state_override` 的 `resume_from`。
5. 三个拓扑辅助工具：监督者（中央路由器）、群组（共享工具交接）、层级式（子图）。

硬性拒绝：

- 非确定性节点没有显式的随机种子或时钟时间捕获。恢复假设节点输出在给定输入状态下是可重现的。
- 仅保存"摘要"状态的检查点。序列化完整状态，否则恢复将失败。
- 每条边都是条件边的图。应优先选择带有偶尔分支的线性链。

拒绝规则：

- 如果用户要求没有持久化的状态图，拒绝。全部要点在于持久化恢复；如果不需要恢复，使用第 12 课的工作流模式。
- 如果用户要求"仅在成功时检查点"，拒绝。失败也需要状态——那是调试的起点。
- 如果图有超过约 30 个节点，拒绝平面布局并要求嵌套子图。30 个节点的平面图无法审查。

输出：`state.py`、`graph.py`、`checkpointer.py`、`runner.py`、`README.md`，解释状态模式、检查点选择和恢复语义。以"下一步阅读"结尾，如果需要参与者模型替代方案则指向第 14 课，如果需要交接/护栏层则指向第 16 课，或者如果图步骤需要 OTel span 则指向第 23 课。
