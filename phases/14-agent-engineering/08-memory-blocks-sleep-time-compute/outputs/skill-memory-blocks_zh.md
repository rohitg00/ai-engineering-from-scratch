---
name: memory-blocks
description: 生成 Letta 风格的三层内存系统（core blocks、recall、archival），带有非关键路径的 sleep-time 合并代理。
version: 1.0.0
phase: 14
lesson: 08
tags: [memory, letta, blocks, sleep-time, consolidation]
---

给定目标运行时、主模型和（可能更强的）sleep-time 模型，生成具有显式块类型和异步合并的三层内存系统。

生成：

1. `Block` 类型，带有 `label`、`value`、`limit`、`description`、`version`、`history`。每次写入都会增加版本并记录旧值。暴露 `near_limit(threshold=0.8)`。
2. 一个 `BlockStore`，至少有三个默认块：`human`（关于用户的事实）、`persona`（代理自我概念）和 `task`（当前范围）。允许用户定义的块。
3. 一个 `Recall` 存储 —— 按会话分页的轮次日志。自动写入每一轮。尾部在达到上限时驱逐，但仍可检索。
4. 一个 `Archival` 存储 —— 至少两个后端（vector、KV）。插入返回记录 id。在矛盾时使失效而不是删除。
5. 一个 `PrimaryAgent`，处理轮次并只发出原始写入。关键路径上没有摘要。
6. 一个 `SleepTimeAgent`，在轮次之间运行：总结超过阈值的块，使矛盾的归档记录失效，将 `learned_context` 写入共享块。

硬性拒绝：

- 任何在用户面对的轮次期间同步运行的内存操作，除了直接查找。摘要、合并、失效属于 sleep-time pass。
- 在矛盾时删除归档记录。使失效以便历史保持可审计。
- 在没有审查步骤的情况下写入 Persona 或 Safety 块。这些块全局塑造行为；静默写入掩盖错误。

拒绝规则：

- 如果运行时无法跨会话持久化块，拒绝发布被描述为"memory"的产品。降级声明。
- 如果 sleep-time 代理没有跟踪输出，拒绝。静默合并是调试死区。
- 如果用户要求"没有失效，始终信任最新写入"，对于任何历史声明重要的域（compliance、medical、legal）拒绝。

输出：每个组件一个文件加上一个 `README.md`，命名默认块、sleep-time 节奏和矛盾解决策略。以"what to read next"结束，指向 Lesson 09（如果代理需要对内存进行图推理）或 Lesson 23（如果产品需要在内存操作上使用 OTel spans）。
