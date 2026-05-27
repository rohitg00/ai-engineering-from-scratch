# 记忆块与睡眠时间计算（Letta）

> MemGPT 在 2024 年变成了 Letta。2026 年的演进增加了两个想法：模型可以直接编辑的离散功能记忆块，以及在主 Agent 空闲时异步合并记忆的睡眠时间 Agent。这就是你如何扩展记忆超越一次对话。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 07（MemGPT）
**时长：** 约 75 分钟

## 学习目标

- 说出 Letta 使用的三种记忆层级（core、recall、archival）以及每种的作用。
- 解释记忆块模式：Human 块、Persona 块和用户定义的块作为一等类型化对象。
- 描述什么是睡眠时间计算，为什么它位于关键路径之外，以及为什么它可以运行比主 Agent 更强的模型。
- 实现一个脚本化的双 Agent 循环，其中主 Agent 提供响应，睡眠时间 Agent 在回合之间合并块。

## 问题背景

MemGPT（第 07 课）解决了虚拟内存控制流。出现了三个生产问题：

1. **延迟。** 每个内存操作都位于关键路径上。如果 Agent 必须在用户等待时修剪、汇总或核对，尾部延迟会爆炸。
2. **记忆腐烂。** 写入积累。被反驳的事实保留。检索淹没在陈旧内容中。
3. **结构丢失。** 扁平的归档存储无法表达"Human 块始终在提示中；Persona 块始终在提示中；Task 块按会话交换。"

Letta（letta.com）是 2026 年的重写。记忆块使结构显式；睡眠时间计算将合并移出关键路径。

## 核心概念

### 三层

| 层级 | 范围 | 位置 | 写入者 |
|------|------|------|--------|
| Core | 始终可见 | 在主提示内 | Agent 工具调用 + 睡眠时间重写 |
| Recall | 对话历史 | 可检索 | 自动回合记录 |
| Archival | 任意事实 | 向量 + KV + 图 | Agent 工具调用 + 睡眠时间摄取 |

Core 是 MemGPT 核心。Recall 是带有驱逐尾部的对话缓冲区。Archival 是外部存储。这种拆分清理了 MemGPT 的两层重载。

### 记忆块

块是 core 层的一个类型化、持久化、可编辑的部分。原始 MemGPT 论文定义了两个：

- **Human 块**——关于用户的事实（姓名、角色、偏好、目标）。
- **Persona 块**——Agent 的自我概念（身份、语气、约束）。

Letta 泛化到任意用户定义的块：用于当前目标的 `Task` 块、用于代码库事实的 `Project` 块、用于硬约束的 `Safety` 块。每个块都有一个 `id`、`label`、`value`、`limit`（字符上限）、`description`（以便模型知道何时编辑它）。

块可通过工具表面编辑：

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)`——压缩接近上限的块。

### 睡眠时间计算

2025 年 Letta 的添加：在后台运行第二个 Agent，离开关键路径。睡眠时间 Agent 处理对话转录和代码库上下文，将 `learned_context` 写入共享块，并合并或使归档记录失效。

自然产生的属性：

- **无延迟成本。** 主要响应不等待内存操作。
- **允许更强的模型。** 睡眠时间 Agent 可以是更昂贵、更慢的模型，因为它不受延迟约束。
- **自然合并窗口。** 当用户不等待时，去重、汇总、使被反驳的事实失效。

这个形态符合人类的工作方式：你做任务，你睡一觉，长期记忆在一夜之间沉淀。

### Letta V1 与原生推理

Letta V1（`letta_v1_agent`，2026）弃用了 `send_message`/心跳和内联 `Thought:` token，转而支持原生推理。Responses API（OpenAI）和带有扩展思考的 Messages API（Anthropic）在单独通道上发出推理，在回合之间传递（在生产中跨提供商加密）。控制循环仍然是 ReAct。思考轨迹是结构性的，而不是提示形的。

### 这种模式哪里会出错

- **块膨胀。** 无限的 `block_append` 快速达到上限。在写入推高上限之前接入块摘要器。
- **静默漂移。** 睡眠时间 Agent 重写块，主 Agent 从未注意到。在轨迹中对块进行版本控制并显示差异。
- **中毒合并。** 睡眠时间 Agent 将攻击者可达的内容处理到核心中。第 27 课也适用于睡眠时间表面。

## 构建它

`code/main.py` 实现：

- `Block`——id、label、value、limit、description。
- `BlockStore`——CRUD + `near_limit(label)` 辅助函数。
- 两个脚本化 Agent——`PrimaryAgent` 服务一个回合，`SleepTimeAgent` 在回合之间合并。
- 一个显示三回合对话（带有块写入）加上睡眠时间通行证的轨迹，后者汇总一个块并使陈旧事实失效。

运行它：

```
python3 code/main.py
```

转录显示拆分：主回合快速并产生原始写入；睡眠通行证压缩和清理。

## 使用它

- **Letta**（letta.com）用于参考实现。自托管或托管云。
- **Claude Agent SDK Skills** 作为块形知识——Skill 是一个命名的、版本化的、可检索的指令块，Agent 按需加载。
- **自定义构建**适用于想要控制存储后端的团队。使用 Letta API 契约，以便稍后迁移。

## 部署它

`outputs/skill-memory-blocks.md` 为任何运行时生成带有睡眠时间钩子的 Letta 形块系统，包括安全规则和引用连接。

## 练习

1. 添加一个 `block_summarize` 工具，当 `near_limit` 返回 true 时，用模型生成的摘要替换块值。哪个触发阈值最小化了摘要调用和块溢出？
2. 在归档上实现睡眠时间去重：文本具有 >90% token 重叠的两个记录合并为一个。仅在睡眠通行证中执行，绝不在关键路径上。
3. 版本控制块。每次写入记录旧值和差异。公开 `block_history(label)` 以便操作员可以调试"为什么 Agent 忘记了 X"。
4. 将睡眠时间 Agent 视为不受信任的写入者。当他们触及 Persona 或 Safety 块时，在提交之前需要第二个 Agent 审查。
5. 将示例移植为使用 Letta API（`letta_v1_agent`）。块模式发生了什么变化，原生推理如何改变轨迹形态？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Memory block | "可编辑提示部分" | Core 记忆的类型化、持久化、LLM 可编辑段 |
| Human block | "用户记忆" | 关于用户的事实，固定在核心中 |
| Persona block | "Agent 身份" | 自我概念、语气、约束，固定在核心中 |
| Sleep-time compute | "异步内存工作" | 在关键路径之外进行合并的第二个 Agent |
| Core / Recall / Archival | "层级" | 三层记忆拆分：始终可见 / 对话 / 外部 |
| Block limit | "上限" | 每个块的字符限制；强制汇总 |
| Native reasoning | "思考通道" | 提供商级推理输出，而非提示级 `Thought:` |
| Learned context | "睡眠输出" | 睡眠时间 Agent 写入共享块的事实 |

## 延伸阅读

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks)——块模式
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute)——异步合并
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent)——原生推理重写
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560)——起源
