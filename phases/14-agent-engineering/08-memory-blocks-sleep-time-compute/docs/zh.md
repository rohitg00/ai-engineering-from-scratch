# 08 · 记忆块与睡眠时计算（Letta）

> MemGPT 在 2024 年更名为 Letta。2026 年的演进增加了两个理念：模型可以直接编辑的离散功能性记忆块（memory block），以及一个在主智能体空闲时异步整合记忆的睡眠时智能体（sleep-time agent）。这正是把记忆扩展到单次对话之外的方式。

**类型：** 实操构建（Build）
**语言：** Python（标准库）
**前置：** 阶段 14 · 07（MemGPT）
**时长：** 约 75 分钟

## 学习目标

- 说出 Letta 使用的三层记忆（核心 core、回忆 recall、归档 archival）及各自的作用。
- 解释记忆块模式：人类块（Human block）、人格块（Persona block）以及用户自定义块，它们都是一等的类型化对象。
- 描述什么是睡眠时计算（sleep-time compute）、它为何处于关键路径之外，以及它为何可以运行比主智能体更强的模型。
- 实现一个脚本化的双智能体循环：主智能体负责响应，睡眠时智能体在回合之间整合记忆块。

## 问题所在

MemGPT（第 07 课）解决了虚拟内存式的控制流。但随之出现了三个生产环境中的问题：

1. **延迟。** 每一次记忆操作都处于关键路径上。如果智能体必须在用户等待时执行修剪、摘要或对账，尾部延迟（tail latency）就会暴涨。
2. **记忆腐烂（memory rot）。** 写入不断累积。被推翻的事实仍然留存。检索淹没在陈旧内容中。
3. **结构丢失。** 一个扁平的归档存储无法表达「人类块始终在提示词中；人格块始终在提示词中；任务块（Task block）按会话切换」这样的语义。

Letta（letta.com）是其 2026 年的重写版本。记忆块让结构显式化；睡眠时计算把整合工作移出关键路径。

## 核心概念

### 三个层级

| 层级 | 范围 | 存放位置 | 写入方 |
|------|------|----------|--------|
| Core（核心） | 始终可见 | 主提示词内部 | 智能体工具调用 + 睡眠时重写 |
| Recall（回忆） | 对话历史 | 可检索 | 自动回合记录 |
| Archival（归档） | 任意事实 | 向量 + KV + 图 | 智能体工具调用 + 睡眠时摄入 |

Core 就是 MemGPT 的核心层。Recall 是带有被驱逐尾部的对话缓冲区。Archival 是外部存储。这种拆分理清了 MemGPT 两层架构中职责过载的问题。

### 记忆块

块（block）是核心层中一个类型化、持久化、可编辑的片段。最初的 MemGPT 论文定义了两种：

- **人类块（Human block）** —— 关于用户的事实（姓名、角色、偏好、目标）。
- **人格块（Persona block）** —— 智能体的自我概念（身份、语气、约束）。

Letta 将其泛化为任意的用户自定义块：用于当前目标的 `Task` 块、用于代码库事实的 `Project` 块、用于硬性约束的 `Safety` 块。每个块都有 `id`、`label`、`value`、`limit`（字符上限）、`description`（让模型知道何时该编辑它）。

块可以通过工具接口进行编辑：

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` —— 压缩一个接近上限的块。

### 睡眠时计算

这是 Letta 在 2025 年新增的能力：在后台运行第二个智能体，处于关键路径之外。睡眠时智能体处理对话记录和代码库上下文，把 `learned_context` 写入共享块中，并整合或作废归档记录。

由此自然衍生出几个特性：

- **零延迟成本。** 主响应无需等待记忆操作。
- **允许使用更强的模型。** 睡眠时智能体可以用更昂贵、更慢的模型，因为它不受延迟约束。
- **天然的整合窗口。** 在用户不等待的时候做去重、摘要、作废被推翻的事实。

这种形态与人类的工作方式相吻合：你先完成任务，然后「睡一觉再想想」，长期记忆在夜里沉淀下来。

### Letta V1 与原生推理

Letta V1（`letta_v1_agent`，2026 年）弃用了 `send_message`/心跳（heartbeat）以及内联的 `Thought:` 标记，转而采用原生推理（native reasoning）。Responses API（OpenAI）和带扩展思维（extended thinking）的 Messages API（Anthropic）在一个独立通道上输出推理内容，并在回合之间传递（生产环境中跨提供商时会加密）。控制循环仍然是 ReAct。思维轨迹是结构化的，而非提示词形态的。

### 这个模式会在哪里出错

- **块膨胀（block bloat）。** 无限的 `block_append` 会很快触及上限。在写入即将超出上限之前接入一个块摘要器。
- **静默漂移（silent drift）。** 睡眠时智能体重写了某个块，而主智能体毫不知情。给块加上版本管理，并在轨迹中暴露差异（diff）。
- **被污染的整合。** 睡眠时智能体把攻击者可触达的内容处理进了核心层。第 27 课同样适用于睡眠时这一面。

## 动手构建

`code/main.py` 实现了：

- `Block` —— id、label、value、limit、description。
- `BlockStore` —— CRUD 操作 + `near_limit(label)` 辅助方法。
- 两个脚本化智能体 —— `PrimaryAgent` 负责一个回合的响应，`SleepTimeAgent` 在回合之间进行整合。
- 一段轨迹，展示包含块写入的三回合对话，外加一次睡眠时处理：它会摘要某个块并作废一条陈旧的事实。

运行它：

```
python3 code/main.py
```

记录展示了这种拆分：主回合很快并产生原始写入；睡眠处理则对其进行压缩和清理。

## 实际运用

- **Letta**（letta.com）作为参考实现。可自托管或使用托管云。
- **Claude Agent SDK 技能（skills）** 作为块形态的知识 —— 一个技能就是一个命名、带版本、可检索的指令块，智能体按需加载。
- **自定义实现** 适用于希望掌控存储后端的团队。请遵循 Letta API 契约，以便日后迁移。

## 交付上线

`outputs/skill-memory-blocks.md` 为任意运行时生成一套 Letta 形态的块系统，带有睡眠时钩子，并包含安全规则与引用接线（citation wiring）。

## 练习

1. 增加一个 `block_summarize` 工具：当 `near_limit` 返回 true 时，用模型生成的摘要替换块的值。哪个触发阈值能同时最小化摘要调用次数与块溢出？
2. 在归档上实现睡眠时去重：两条文本 token 重叠度 >90% 的记录合并为一条。只在睡眠处理中做，绝不在关键路径上做。
3. 给块加版本管理。每次写入时记录旧值和差异（diff）。暴露 `block_history(label)`，让运维人员能调试「智能体为什么忘了 X」。
4. 把睡眠时智能体当作不可信的写入者。当它们触及人格块或安全块时，要求第二个智能体审核后再提交。
5. 把示例移植到 Letta API（`letta_v1_agent`）上。块的 schema 会发生什么变化？原生推理又会如何改变轨迹的形态？

## 关键术语

| 术语 | 人们怎么说 | 它实际是什么 |
|------|-----------|--------------|
| Memory block（记忆块） | 「可编辑的提示词片段」 | 核心记忆中类型化、持久化、可被 LLM 编辑的片段 |
| Human block（人类块） | 「用户记忆」 | 关于用户的事实，固定在核心层 |
| Persona block（人格块） | 「智能体身份」 | 自我概念、语气、约束，固定在核心层 |
| Sleep-time compute（睡眠时计算） | 「异步记忆工作」 | 第二个智能体在关键路径之外做整合 |
| Core / Recall / Archival（核心/回忆/归档） | 「层级」 | 三层记忆拆分：始终可见 / 对话 / 外部 |
| Block limit（块上限） | 「上限」 | 每个块的字符上限；强制触发摘要 |
| Native reasoning（原生推理） | 「思考通道」 | 提供商层面的推理输出，而非提示词层面的 `Thought:` |
| Learned context（习得上下文） | 「睡眠输出」 | 睡眠时智能体写入共享块的事实 |

## 延伸阅读

- [Letta，《Memory Blocks》博客](https://www.letta.com/blog/memory-blocks) —— 记忆块模式
- [Letta，《Sleep-time Compute》博客](https://www.letta.com/blog/sleep-time-compute) —— 异步整合
- [Letta，《Rearchitecting the Agent Loop》](https://www.letta.com/blog/letta-v1-agent) —— 原生推理重写
- [Packer 等人，MemGPT（arXiv:2310.08560）](https://arxiv.org/abs/2310.08560) —— 起源
