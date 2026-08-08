---
name: state-schema
description: 为代理状态和任务板生成项目特定的 JSON Schemas，带有原子写入的 Python StateManager，以及迁移脚手架，以便模式提升不会损坏工作台。
version: 1.0.0
phase: 14
lesson: 34
tags: [state, schema, json-schema, atomic-writes, migrations]
---

给定仓库和在其中运行的代理产品，为工作台生成模式优先的状态文件。

生成：

1. `schemas/agent_state.schema.json`，覆盖必需键、允许的状态值、数组与空值规则，以及 `schema_version` 整数。
2. `schemas/task_board.schema.json`，覆盖任务 id 模式、允许的所有者、允许的状态和验收数组。
3. `tools/state_manager.py`，暴露带有 temp-and-rename 原子写入的 `load`、`commit` 和 `update`。
4. `tools/migrate_state.py` 脚手架，用于下一个模式提升，如果文件来自未知版本则 fail-loud。
5. `agent_state.json` 和 `task_board.json`，在 `schema_version: 1` 和新鲜待办事项时播种。

硬性拒绝：

- 没有 `schema_version` 字段的模式。迁移不是可选的。
- 在预期数组的地方允许 `null`。`null` 是伪装成数据的写入时错误。
- 使用普通 `open(path, "w")` 的写入器。仅原子写入；部分文件损坏真相来源。
- 在状态中存储 tokens、原始聊天记录或 PII。状态用于仓库相关事实。

拒绝规则：

- 如果仓库没有版本控制，拒绝发布状态文件。原子写入加 git diff 是持久性故事。
- 如果项目没有至少一个验收命令来验证 `done` 转换，拒绝 `status: done` 枚举值。添加没有验收检查的 `done` 是戏剧。
- 如果项目打算在没有锁定策略的情况下跨进程共享状态，在发布之前提出该发现；原子重命名是必要但不充分的。

输出结构：

```
<repo>/
├── agent_state.json
├── task_board.json
├── schemas/
│   ├── agent_state.schema.json
│   └── task_board.schema.json
└── tools/
    ├── state_manager.py
    └── migrate_state.py
```

以"what to read next"结束，指向：

- Lesson 35 用于在启动时调用管理器的初始化脚本。
- Lesson 38 用于读取状态以评分完成的验证门。
- Lesson 40 用于消耗相同模式的交接生成器。
