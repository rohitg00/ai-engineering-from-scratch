---
name: minimal-workbench
description: 为任何仓库搭建三文件最小可行智能体工作台——简短的AGENTS.md路由器、持久的agent_state.json，以及以项目当前待办事项为键的JSON task_board.json
version: 1.0.0
phase: 14
lesson: 32
tags: [workbench, agents-md, state, task-board, scaffold]
---

给定一个仓库路径和简短的待办事项，搭建最小可行智能体工作台。

产出：

1. `AGENTS.md` 不超过80行。它必须指向：状态文件、任务板、更深层的规则文档（即使为空），以及验证命令。此文件中不要教程式散文。
2. `agent_state.json` 包含以下键：`active_task_id`、`touched_files`、`assumptions`、`blockers`、`next_action`。所有可选字段默认为空数组或空字符串，数组永远不要为`null`。
3. `task_board.json` 为JSON数组格式的任务。每个任务包含`id`、`goal`、`owner`（`builder` | `reviewer` | `human`）、`acceptance`（字符串列表）和`status`（`todo` | `in_progress` | `done` | `blocked`）。
4. `docs/agent-rules.md` 占位符，每个表面一个H2标题，以便后续课程可以填充。

硬性拒绝：

- `AGENTS.md` 超过80行或少于10行。太长智能体会跳过；太短则没有路由信息。
- 引用聊天历史而非仓库的状态文件。仓库是记录系统。
- 没有`acceptance`的任务板。
- `owner`为`agent`或`model`的任务。所有者是角色，不是实体。

拒绝规则：

- 如果仓库没有验证命令，拒绝编写`AGENTS.md`，直到提供一个或存根。指向缺失门的路由器比没有路由器更糟。
- 如果待办事项有超过12个开放任务，拒绝并要求用户拆分。超过一屏的看板会陷入规划剧场。
- 如果项目在跟踪文件中包含密钥，拒绝编写状态文件，并首先将密钥泄漏作为阻塞性发现提出。

输出结构：

```
<repo>/
├── AGENTS.md
├── agent_state.json
├── task_board.json
└── docs/
    └── agent-rules.md
```

以"下一步阅读"结束，指向：

- 第33课，将规则占位符转化为可执行约束。
- 第34课，了解持久状态模式。
- 第36课，了解每个任务的范围合同。