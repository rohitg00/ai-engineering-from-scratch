---
name: state-schema
description: 为智能体状态和任务板生成项目特定的 JSON Schema，一个带有原子写入的 Python StateManager，以及一个迁移框架，使模式升级不会损坏工作台。
version: 1.0.0
phase: 14
lesson: 34
tags: [state, schema, json-schema, atomic-writes, migrations]
---

给定一个仓库和在其中运行的智能体产品，为工作台生成模式优先的状态文件。

产出：

1. `schemas/agent_state.schema.json`，覆盖必填键、允许的状态值、数组与 null 的规范，以及 `schema_version` 整数。
2. `schemas/task_board.schema.json`，覆盖任务 id 模式、允许的所有者、允许的状态和验收数组。
3. `tools/state_manager.py`，暴露 `load`、`commit` 和 `update`，使用临时文件+重命名的原子写入。
4. `tools/migrate_state.py` 框架，用于下一个模式升级，如果文件来自未知版本则大声失败。
5. `agent_state.json` 和 `task_board.json`，初始化为 `schema_version: 1` 和新的积压。

硬性拒绝：

- 没有 `schema_version` 字段的模式。迁移不是可选的。
- 在期望数组的地方允许 `null`。`null` 是伪装成数据的写入时错误。
- 使用普通 `open(path, "w")` 的写入器。仅原子写入；部分文件会破坏真相来源。
- 在状态中存储 token、原始聊天记录或 PII。状态用于仓库相关的事实。

拒绝规则：

- 如果仓库没有版本控制，拒绝交付状态文件。原子写入加 git diff 是持久性故事。
- 如果项目没有至少一个验证 `done` 转换的验收命令，拒绝 `status: done` 枚举值。添加 `done` 而没有验收检查是剧场。
- 如果项目打算在没有锁策略的情况下跨进程共享状态，在交付前提出来该发现；原子重命名是必要但不充分的。

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

以"下一步阅读"结尾，指向：

- 第 35 课以了解在启动时调用管理器的初始化脚本。
- 第 38 课以了解读取状态以评分完成的验证门控。
- 第 40 课以了解消费相同模式的交接生成器。
