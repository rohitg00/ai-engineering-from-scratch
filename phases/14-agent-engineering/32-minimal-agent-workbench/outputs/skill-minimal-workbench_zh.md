---
name: minimal-workbench
description: 为任何仓库铺设三个文件的最小可行智能体工作台——简短的 AGENTS.md 路由器、持久的 agent_state.json 和键控到项目当前积压的 JSON task_board.json。
version: 1.0.0
phase: 14
lesson: 32
tags: [workbench, agents-md, state, task-board, scaffold]
---

给定一个仓库路径和一个简短的积压，搭建最小可行智能体工作台。

产出：

1. `AGENTS.md` 不超过 80 行。它必须路由到：状态文件、任务板、更深的规则文档（即使为空）和验证命令。此文件中没有散文教程。
2. `agent_state.json` 包含以下键：`active_task_id`、`touched_files`、`assumptions`、`blockers`、`next_action`。所有可选字段默认为空数组或空字符串，数组绝不使用 `null`。
3. `task_board.json` 作为任务的 JSON 数组。每个任务有 `id`、`goal`、`owner`（`builder` | `reviewer` | `human`）、`acceptance`（字符串列表）和 `status`（`todo` | `in_progress` | `done` | `blocked`）。
4. `docs/agent-rules.md` 占位符，每个表面一个 H2，以便后续课程可以填充。

硬性拒绝：

- `AGENTS.md` 超过 80 行或少于 10 行。太长则智能体跳过；太短则不携带路由。
- 引用聊天历史而非仓库的状态文件。仓库是记录系统。
- 没有 `acceptance` 的任务板。没有验收标准的任务变成"看起来不错"的橡皮图章。
- `owner` 为 `agent` 或 `model` 的任务。所有者是角色，而非实体。

拒绝规则：

- 如果仓库没有验证命令，拒绝编写 `AGENTS.md`，直到提供或存根一个。指向缺失门控的路由器比没有路由器更差。
- 如果积压有超过 12 个开放任务，拒绝并要求用户拆分。超过一屏的面板会沦为规划剧场。
- 如果项目在被追踪的文件中包含秘密，拒绝编写状态文件并首先将秘密泄露作为阻塞性问题提出来。

输出结构：

```
<repo>/
├── AGENTS.md
├── agent_state.json
├── task_board.json
└── docs/
    └── agent-rules.md
```

以"下一步阅读"结尾，指向：

- 第 33 课以将规则占位符转换为可执行约束。
- 第 34 课以了解持久状态模式。
- 第 36 课以了解每任务范围契约。
