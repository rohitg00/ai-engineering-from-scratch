# 内存块与睡眠时计算（Memory Blocks and Sleep-Time Compute · Letta）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> MemGPT 在 2024 年改名为 Letta。2026 年的演进加上了两个新想法：模型可以直接编辑的离散功能性 memory block（内存块），以及一个在主 agent 空闲时异步整合记忆的睡眠时（sleep-time）agent。这就是把记忆扩展到一次对话之外的方式。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 07 (MemGPT)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 说出 Letta 用的三层记忆（core、recall、archival）以及各自的角色。
- 解释 memory block 模式：Human block、Persona block、以及用户自定义 block 作为一等的、带类型的对象。
- 描述什么是 sleep-time compute，为什么它处在关键路径之外，以及为什么它可以跑比主 agent 更强的模型。
- 实现一个脚本化的双 agent 循环：一个主 agent 负责回应，一个 sleep-time agent 在两轮之间整合 block。

## 问题（The Problem）

MemGPT（第 07 课）解决了虚拟内存式的控制流。在生产环境又冒出了三个问题：

1. **延迟。** 每一次记忆操作都堵在关键路径上。如果 agent 必须在用户等待时去裁剪、摘要、调和事实，尾部 latency（延迟）会爆。
2. **记忆腐化。** 写入不断累积。已被推翻的事实还赖在原地。检索被陈旧内容淹没。
3. **结构丢失。** 一个扁平的 archival 存储无法表达「Human block 永远在 prompt 里；Persona block 永远在 prompt 里；Task block 每个 session 切换」这种结构。

Letta（letta.com）是 2026 年的重写版本。memory block 把结构显式化；sleep-time compute 把整合工作搬出关键路径。

## 概念（The Concept）

### 三层（Three tiers）

| 层级 | 范围 | 存放位置 | 由谁写入 |
|------|-------|----------------|------------|
| Core | 始终可见 | 主 prompt 内部 | agent 的 tool call + 睡眠时改写 |
| Recall | 对话历史 | 可检索 | 自动按轮次记录 |
| Archival | 任意事实 | 向量 + KV + 图 | agent 的 tool call + 睡眠时摄入 |

Core 就是 MemGPT 的核心。Recall 是带「被驱逐尾巴」的对话缓冲。Archival 是外部存储。这种切分清理了 MemGPT 双层语义被反复重载的混乱。

### 内存块（Memory blocks）

block 是 core 层中带类型、可持久、可编辑的一段。最早的 MemGPT 论文定义了两个：

- **Human block** —— 关于用户的事实（姓名、角色、偏好、目标）。
- **Persona block** —— agent 的自我认知（身份、语气、约束）。

Letta 把它推广到任意用户自定义 block：当前目标用 `Task` block，代码库事实用 `Project` block，硬性约束用 `Safety` block。每个 block 都有 `id`、`label`、`value`、`limit`（字符上限）、`description`（让模型知道何时该编辑它）。

block 通过 tool 接口可编辑：

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` —— 当 block 接近上限时压缩它。

### 睡眠时计算（Sleep-time compute）

2025 年 Letta 的新增设计：在后台跑第二个 agent，处于关键路径之外。sleep-time agent 处理对话记录和代码库上下文，把 `learned_context` 写入共享 block，并对 archival 记录做整合或失效化。

由此自然得到几条性质：

- **没有延迟代价。** 主回应不必等记忆操作。
- **允许更强的模型。** sleep-time agent 不受 latency 约束，可以用更贵、更慢的模型。
- **自然的整合窗口。** 在用户没在等的时候去去重、摘要、把被推翻的事实失效掉。

这个形态对应人类工作的方式：你做完事，睡一觉，长期记忆在夜里沉淀下来。

### Letta V1 与原生 reasoning（Letta V1 and native reasoning）

Letta V1（`letta_v1_agent`，2026）废弃了 `send_message`/heartbeat 以及行内 `Thought:` token，改用原生 reasoning。Responses API（OpenAI）和带 extended thinking 的 Messages API（Anthropic）把 reasoning 放在一条独立通道里输出，跨轮次透传（在生产里跨 provider 时是加密的）。控制循环依然是 ReAct。但思维轨迹（thought trace）变成了结构化的，不再是 prompt 形态的。

### 这个模式会在哪里翻车（Where this pattern goes wrong）

- **block 膨胀。** 无止境地 `block_append` 很快就撞上限。在那一次会越过上限的写入之前接一个 block 摘要器。
- **静默漂移。** sleep-time agent 改写了某个 block，主 agent 完全察觉不到。给 block 做版本，并在 trace 里把 diff 暴露出来。
- **被污染的整合。** sleep-time agent 把攻击者可达的内容处理进了 core。第 27 课同样适用于 sleep-time 这层。

## 动手实现（Build It）

`code/main.py` 实现：

- `Block` —— id、label、value、limit、description。
- `BlockStore` —— CRUD 加 `near_limit(label)` 辅助方法。
- 两个脚本化 agent —— `PrimaryAgent` 处理一轮回应，`SleepTimeAgent` 在两轮之间做整合。
- 一段 trace，展示一段三轮对话伴随的 block 写入，以及一次 sleep-time 处理：摘要某个 block，并把一个陈旧事实置为失效。

跑起来：

```
python3 code/main.py
```

记录展示了这种切分：主轮次又快又只产出原始写入；sleep 这趟会做压缩和清理。

## 用起来（Use It）

- **Letta**（letta.com）作为参考实现。可自托管，也有托管云。
- **Claude Agent SDK skills** 当成 block 形态的知识 —— 一个 skill 就是一个有名字、有版本、可检索的指令 block，agent 按需加载。
- **自建实现** 适合想自己掌控存储后端的团队。沿用 Letta 的 API 契约，方便以后迁移。

## 上线部署（Ship It）

`outputs/skill-memory-blocks.md` 会生成一套 Letta 形态的 block 系统，自带 sleep-time 钩子，可用于任意 runtime，包含安全规则和引用接线。

## 练习（Exercises）

1. 加一个 `block_summarize` tool：当 `near_limit` 返回 true 时，用模型生成的摘要替换 block 值。哪个触发阈值能同时把摘要调用次数和 block 溢出都压到最低？
2. 在 archival 上实现 sleep-time 去重：两条记录的文本如果 token 重叠率 >90%，就合并成一条。只在 sleep 那趟做，绝不能放到关键路径上。
3. 给 block 加版本。每次写入都记录旧值和 diff。暴露 `block_history(label)`，让运维可以排查「为什么 agent 把 X 忘了」。
4. 把 sleep-time agent 当成不可信的写入者。当它们碰 Persona 或 Safety block 时，要求第二个 agent 先 review 再提交。
5. 把示例移植到 Letta API（`letta_v1_agent`）。block schema 有什么变化？原生 reasoning 又如何改变 trace 的形态？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Memory block | 「可编辑的 prompt 段」 | core 记忆里带类型、可持久、LLM 可编辑的一段 |
| Human block | 「用户记忆」 | 关于用户的事实，钉在 core 里 |
| Persona block | 「agent 身份」 | 自我认知、语气、约束，钉在 core 里 |
| Sleep-time compute | 「异步记忆工作」 | 第二个 agent 在关键路径之外做整合 |
| Core / Recall / Archival | 「三层」 | 三层记忆切分：始终可见 / 对话 / 外部 |
| Block limit | 「上限」 | 每个 block 的字符限制；强制触发摘要 |
| Native reasoning | 「思考通道」 | provider 层面的 reasoning 输出，而不是 prompt 层面的 `Thought:` |
| Learned context | 「sleep 输出」 | sleep-time agent 写入共享 block 的事实 |

## 延伸阅读（Further Reading）

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) —— block 模式
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) —— 异步整合
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) —— 原生 reasoning 重写
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) —— 起源
