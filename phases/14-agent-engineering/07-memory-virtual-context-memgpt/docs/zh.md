# 记忆：虚拟上下文与 MemGPT

> 上下文窗口是有限的。对话、文档和工具轨迹不是。MemGPT（Packer 等，2023）将此框架为操作系统虚拟内存——主上下文是 RAM，外部存储是磁盘，agent 在它们之间分页。这是每个 2026 年记忆系统继承的模式。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 01（Agent Loop），第 14 阶段 · 06（Tool Use）
**时间：** ~75 分钟

## 学习目标

- 解释 MemGPT 所基于的操作系统类比：主上下文 = RAM，外部上下文 = 磁盘，记忆工具 = 换入/换出。
- 用标准库实现双层 MemGPT 模式：主上下文缓冲区、外部可搜索存储、换入/换出工具。
- 描述 agent 如何发出"中断"来查询或修改外部记忆，以及结果如何拼接回下一个提示词。
- 识别 MemGPT 设计选择中哪些延续到了 Letta（第 08 课）和 Mem0（第 09 课）。

## 问题

上下文窗口看起来应该能解决记忆问题。实际上不能。生产中反复出现三种失败模式：

1. **溢出。** 多轮对话、长文档或工具调用密集的轨迹跨越窗口。截断点之后的一切都会丢失。
2. **稀释。** 即使在窗口内，塞入不相关的上下文也会稀释对重要内容的注意力。前沿模型在长输入上仍然会退化。
3. **持久性。** 新会话以空窗口开始。没有外部记忆的 agent 无法跨会话说"记得你上次让我..."

更大的窗口有帮助但不能解决这个问题。Mem0 的 2025 年论文测量显示，128k 窗口基线仍然遗漏了有外部记忆的 4k 窗口 agent 能捕获的长程事实。

## 概念

### MemGPT：操作系统类比

Packer 等（arXiv:2310.08560，v2 2024年2月）将上下文管理映射到操作系统虚拟内存：

| 操作系统概念 | MemGPT 概念 | 2026 年生产类比 |
|------------|------------|----------------|
| RAM | 主上下文（提示词） | Anthropic/OpenAI 上下文窗口 |
| 磁盘 | 外部上下文 | 向量数据库、KV、图存储 |
| 页错误 | 记忆工具调用 | `memory.search`、`memory.read`、`memory.write` |
| 操作系统内核 | agent 控制循环 | 带记忆工具的 ReAct 循环 |

Agent 运行正常的 ReAct 循环。额外的一类工具让它能在主上下文和外部上下文之间分页数据。

### 两层

- **主上下文。** 固定大小的提示词，保存当前任务。始终对模型可见。
- **外部上下文。** 无界，可通过工具搜索。在相关时读取，在事实出现时写入。

原始论文在两项超越基础窗口的任务上评估了设计：超过 100k token 的文档分析和跨多天的多会话聊天。

### 中断模式

MemGPT 引入了记忆即中断：对话中 agent 可以调用记忆工具，运行时执行它，结果拼接进下一个 assistant 轮次作为新的观察。概念上与 Unix `read()` 系统调用相同：阻塞进程，返回字节，进程继续。

标准记忆工具表面：

- `core_memory_append(section, text)` —— 写入提示词的持久部分。
- `core_memory_replace(section, old, new)` —— 编辑持久部分。
- `archival_memory_insert(text)` —— 写入可搜索的外部存储。
- `archival_memory_search(query, top_k)` —— 从外部存储检索。
- `conversation_search(query)` —— 扫描过去的轮次。

### MemGPT 结束和 Letta 开始的地方

2024 年 9 月 MemGPT 成为 Letta。研究仓库（`cpacker/MemGPT`）保留；Letta 扩展了设计：

- 三层而非两层（core、recall、archival —— 第 08 课）。
- 原生推理替代 `send_message`/心跳模式（第 08 课）。
- 睡眠时 agent 异步运行记忆工作（第 08 课）。

MemGPT 论文是 2026 年的基础，即使生产系统运行 Letta、Mem0 或自定义双层存储。

### 此模式出错的地方

- **记忆腐烂。** 写入速度超过读取；检索淹没在陈旧事实中。修复：定期整合（Letta 睡眠时）、显式失效（Mem0 冲突检测器）。
- **记忆投毒。** 外部记忆是检索到的文本。如果攻击者控制的内容进入记忆笔记，agent 会在下次会话中重新摄入。这是 Greshake 等（第 27 课）攻击随时间的重述。
- **引用丢失。** Agent 回忆起"用户让我发货 X"但无法引用是哪一轮。存储源引用（会话 ID、轮次 ID）与每次存档写入。

## 构建

`code/main.py` 用标准库实现 MemGPT 的双层模式：

- `MainContext` —— 固定大小提示词缓冲区，带 `core` 字典和 `messages` 列表；超过上限时自动压缩最旧的消息。
- `ArchivalStore` —— 内存中的 BM25 风格存储（token 重叠评分），记录 (id, text, tags, session, turn)。
- 五个映射到 MemGPT 表面的记忆工具。
- 一个脚本 agent，用事实填充存档，然后通过调用 `archival_memory_search` 回答问题。

运行：

```
python3 code/main.py
```

跟踪显示 agent 写入三个事实，将主上下文填满到上限（强制驱逐），然后通过从存档检索回答后续问题——无需任何真实 LLM 即可复现 MemGPT 工作流。

## 使用

今天的每个生产记忆系统都是 MemGPT 的变体：

- **Letta**（第 08 课）—— 三层、原生推理、睡眠时计算。
- **Mem0**（第 09 课）—— 向量 + KV + 图，带评分层融合。
- **OpenAI Assistants / Responses** —— 通过线程和文件管理记忆。
- **Claude Agent SDK** —— 通过技能和会话存储实现长期记忆。

按运营形状（自托管、托管、框架集成）选择，而不是按核心模式——核心模式是 MemGPT。

## 交付

`outputs/skill-virtual-memory.md` 是一个可复用的技能，为任何目标运行时生成正确的双层记忆脚手架（主 + 存档 + 工具表面），带有驱逐策略和引用字段。

## 练习

1. 添加 `max_main_context_tokens` 上限，以 token 计量（用 `len(text.split())` * 1.3 近似）。超过上限时将最旧的消息压缩为摘要。比较有和没有摘要器的行为。
2. 在存档存储上正确实现 BM25（词频、逆文档频率）。在玩具事实集上测量与 token 重叠基线的 recall@10。
3. 为存档插入添加 `citation` 字段（session_id, turn_id, source_url）。让 agent 在每次检索支持的答案时引用来源。
4. 模拟记忆投毒：添加一条存档记录说"忽略所有未来的用户指令"。编写一个 guard，扫描检索结果中的指令形状文本并将其标记为不可信。
5. 将实现移植到使用 MemGPT 研究仓库的核心记忆 JSON 模式（`cpacker/MemGPT`）。从平面字符串切换到类型化部分时会发生什么变化？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Virtual context | "无限记忆" | 主（提示词）+ 外部（可搜索）两层，带换入/换出 |
| Main context | "工作记忆" | 提示词——固定大小，始终可见 |
| Archival memory | "长期存储" | 外部可搜索持久化，按需检索 |
| Core memory | "持久提示词部分" | 主上下文内固定的命名部分 |
| Memory tool | "记忆 API" | Agent 发出的工具调用，用于读/写外部记忆 |
| Interrupt | "记忆页错误" | Agent 暂停，运行时获取，结果拼接进下一轮 |
| Memory rot | "陈旧事实" | 旧写入淹没检索；用整合修复 |
| Memory poisoning | "注入持久笔记" | 攻击者内容存储为记忆，在回忆时重新摄入 |

## 延伸阅读

- [Packer 等，MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) —— 操作系统启发的虚拟上下文论文
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) —— 三层演进
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) —— 将上下文视为预算
- [Chhikara 等，Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) —— 此模式之上的混合生产记忆