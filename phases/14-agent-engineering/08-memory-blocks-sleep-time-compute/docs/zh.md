# 记忆块与睡眠时计算（Letta）

> MemGPT 在 2024 年成为 Letta。2026 年的演进增加了两个想法：模型可直接编辑的离散功能记忆块，以及在主 agent 空闲时异步整合记忆的睡眠时 agent。这就是你如何将记忆扩展到一次对话之外。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 07（MemGPT）
**时间：** ~75 分钟

## 学习目标

- 说出 Letta 使用的三个记忆层（core、recall、archival）及其各自的作用。
- 解释记忆块模式：Human 块、Persona 块和用户定义的块作为一等类型化对象。
- 描述什么是睡眠时计算，为什么它不在关键路径上，以及为什么它可以运行比主 agent 更强的模型。
- 实现一个脚本化的双 agent 循环，其中主 agent 服务响应，睡眠时 agent 在轮次之间整合块。

## 问题

MemGPT（第 07 课）解决了虚拟内存控制流。三个生产问题出现了：

1. **延迟。** 每个记忆操作都在关键路径上。如果 agent 必须在用户等待时修剪、总结或协调，尾部延迟会爆炸。
2. **记忆腐烂。** 写入累积。矛盾的事实留存。检索淹没在陈旧内容中。
3. **结构丢失。** 平面存档存储无法表达"Human 块始终在提示词中；Persona 块始终在提示词中；Task 块按会话交换。"

Letta（letta.com）是 2026 年的重写。记忆块使结构显式；睡眠时计算将整合移出关键路径。

## 概念

### 三层

| 层 | 范围 | 位置 | 写入者 |
|----|------|------|--------|
| Core | 始终可见 | 主提示词内 | Agent 工具调用 + 睡眠时重写 |
| Recall | 对话历史 | 可检索 | 自动轮次记录 |
| Archival | 任意事实 | 向量 + KV + 图 | Agent 工具调用 + 睡眠时摄入 |

Core 是 MemGPT 的核心。Recall 是带驱逐尾部的对话缓冲区。Archival 是外部存储。这种划分清理了 MemGPT 两层过载的问题。

### 记忆块

块是核心层中类型化、持久、可编辑的部分。原始 MemGPT 论文定义了两个：

- **Human 块** —— 关于用户的事实（姓名、角色、偏好、目标）。
- **Persona 块** —— agent 的自我概念（身份、语气、约束）。

Letta 泛化为任意用户定义的块：当前目标的 `Task` 块、代码库事实的 `Project` 块、硬约束的 `Safety` 块。每个块有 `id`、`label`、`value`、`limit`（字符上限）、`description`（让模型知道何时编辑它）。

块可通过工具表面编辑：

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` —— 当块接近上限时压缩。

### 睡眠时计算

2025 年 Letta 新增：在后台运行第二个 agent，不在关键路径上。睡眠时 agent 处理对话记录和代码库上下文，将 `learned_context` 写入共享块，并整合或失效存档记录。

产生的特性：

- **无延迟成本。** 主响应不等待记忆操作。
- **允许更强的模型。** 睡眠时 agent 可以是更昂贵、更慢的模型，因为它不受延迟约束。
- **自然整合窗口。** 当用户不等待时，去重、总结、失效矛盾的事实。

这与人类工作方式匹配：你完成任务，睡一觉，长期记忆在夜间沉淀。

### Letta V1 和原生推理

Letta V1（`letta_v1_agent`，2026）弃用 `send_message`/心跳和内联 `Thought:` token，转而支持原生推理。Responses API（OpenAI）和带扩展思考的 Messages API（Anthropic）在独立通道上发出推理，在生产中跨提供商传递（加密）。控制循环仍然是 ReAct。思考轨迹是结构性的，不是提示词形状的。

### 此模式出错的地方

- **块膨胀。** 无限 `block_append` 很快达到上限。在写入即将超过上限前连接块摘要器。
- **静默漂移。** 睡眠时 agent 重写块，主 agent 从未注意到。对块进行版本控制，在跟踪中显示差异。
- **投毒整合。** 睡眠时 agent 将攻击者可访问的内容处理到核心。第 27 课也适用于睡眠时表面。

## 构建

`code/main.py` 实现：

- `Block` —— id、label、value、limit、description。
- `BlockStore` —— CRUD + `near_limit(label)` 辅助函数。
- 两个脚本 agent —— `PrimaryAgent` 服务轮次，`SleepTimeAgent` 在轮次之间整合。
- 一个跟踪，显示三轮对话带块写入，加上睡眠时通过总结块和失效陈旧事实。

运行：

```
python3 code/main.py
```

记录显示分裂：主轮次快并产生原始写入；睡眠时通过压缩和清理。

## 使用

- **Letta**（letta.com）参考实现。自托管或托管云。
- **Claude Agent SDK 技能** 作为块形状的知识——技能是 agent 按需加载的命名、版本化、可检索的指令块。
- **自定义构建** 用于想要控制存储后端的团队。使用 Letta API 合约，以便以后迁移。

## 交付

`outputs/skill-memory-blocks.md` 为任何运行时生成 Letta 形状的块系统，带睡眠时钩子，包括安全规则和引用连接。

## 练习

1. 添加 `block_summarize` 工具，当 `near_limit` 返回 true 时用模型生成的摘要替换块值。哪个触发阈值最小化摘要调用和块溢出？
2. 在睡眠时实现存档去重：两个文本 token 重叠 >90% 的记录合并为一个。只在睡眠时做，不在关键路径上做。
3. 对块进行版本控制。每次写入记录旧值和差异。暴露 `block_history(label)` 让操作员调试"为什么 agent 忘记了 X"。
4. 将睡眠时 agent 视为不可信的写入者。当它们触及 Persona 或 Safety 块时，要求第二个 agent 审核后再提交。
5. 将示例移植到使用 Letta API（`letta_v1_agent`）。块模式有什么变化，原生推理如何改变跟踪形状？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Memory block | "可编辑提示词部分" | 核心记忆中类型化、持久、LLM 可编辑的段 |
| Human block | "用户记忆" | 关于用户的事实，固定在核心 |
| Persona block | "Agent 身份" | 自我概念、语气、约束，固定在核心 |
| Sleep-time compute | "异步记忆工作" | 第二个 agent 在关键路径外做整合 |
| Core / Recall / Archival | "层" | 三层记忆划分：始终可见 / 对话 / 外部 |
| Block limit | "上限" | 每块字符上限；强制摘要 |
| Native reasoning | "思考通道" | 提供商级推理输出，不是提示词级 `Thought:` |
| Learned context | "睡眠输出" | 睡眠时 agent 写入共享块的事实 |

## 延伸阅读

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) —— 块模式
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) —— 异步整合
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) —— 原生推理重写
- [Packer 等，MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) —— 起源