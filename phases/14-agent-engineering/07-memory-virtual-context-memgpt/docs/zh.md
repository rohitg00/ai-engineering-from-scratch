# 记忆：虚拟上下文与 MemGPT

> 上下文窗口（Context Window）是有限的。对话、文档和工具轨迹不是。MemGPT（Packer 等人，2023）将此构建为操作系统虚拟内存——主上下文是 RAM，外部存储是磁盘，Agent 在它们之间分页。这是每个 2026 年记忆系统继承的模式。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（Agent 循环）、阶段 14 · 06（工具使用）
**时长：** 约 75 分钟

## 学习目标

- 解释 MemGPT 构建的操作系统类比：主上下文 = RAM，外部上下文 = 磁盘，内存工具 = 页面换入/换出。
- 在标准库中实现一个两层的 MemGPT 模式，带有主上下文缓冲区、外部可搜索存储以及页面换入/换出工具。
- 描述 Agent 如何发出"中断"来查询或修改外部记忆，以及结果如何被拼接回下一个提示。
- 识别延续到 Letta（第 08 课）和 Mem0（第 09 课）的 MemGPT 设计选择。

## 问题背景

上下文窗口看起来应该能解决记忆问题。但它们不能。生产中有三种失败模式反复出现：

1. **溢出。** 多轮对话、长文档或重度工具调用的轨迹超出了窗口。截止点之后的所有内容都消失了。
2. **稀释。** 即使在窗口内，填充不相关的上下文也会稀释对重要内容的注意力。前沿模型在长输入上仍然会降级。
3. **持久性。** 新会话以空窗口开始。没有外部记忆的 Agent 无法跨会话说"记得你让我..."

更大的窗口有帮助，但不能解决这个问题。Mem0 的 2025 年论文测量到，128k 窗口基线仍然错过了具有外部记忆的 4k 窗口 Agent 捕获的长期事实。

## 核心概念

### MemGPT：操作系统类比

Packer 等人（arXiv:2310.08560，v2 2024 年 2 月）将上下文管理映射到操作系统虚拟内存：

| 操作系统概念 | MemGPT 概念 | 2026 年生产类比 |
|------------|---------------|------------------------|
| RAM | 主上下文（提示） | Anthropic/OpenAI 上下文窗口 |
| 磁盘 | 外部上下文 | 向量数据库、KV、图存储 |
| 页错误 | 内存工具调用 | `memory.search`、`memory.read`、`memory.write` |
| OS 内核 | Agent 控制循环 | 带有内存工具的 ReAct 循环 |

Agent 运行正常的 ReAct 循环。一个额外的工具类允许它在主上下文内外分页数据。

### 两层

- **主上下文。** 保存当前任务的固定大小提示。始终对模型可见。
- **外部上下文。** 无界，可通过工具搜索。相关时读取，事实出现时写入。

原始论文在超出基础窗口的两个任务上评估了设计：长于 100k token 的文档分析和跨多天的持久记忆多会话聊天。

### 中断模式

MemGPT 引入了内存即中断（memory-as-interrupt）：对话中途 Agent 可以调用内存工具，运行时执行它，结果作为新观察拼接到下一个助手回合。在概念上等同于 Unix `read()` 系统调用，它阻塞进程，返回字节，然后进程继续。

规范内存工具表面：

- `core_memory_append(section, text)`——写入提示的持久部分。
- `core_memory_replace(section, old, new)`——编辑持久部分。
- `archival_memory_insert(text)`——写入可搜索的外部存储。
- `archival_memory_search(query, top_k)`——从外部存储检索。
- `conversation_search(query)`——扫描过去的回合。

### MemGPT 结束与 Letta 开始的地方

2024 年 9 月，MemGPT 变成了 Letta。研究仓库（`cpacker/MemGPT`）仍然存在；Letta 扩展了设计：

- 三层而不是两层（core、recall、archival——第 08 课）。
- 原生推理取代了 `send_message`/心跳模式（第 08 课）。
- 运行异步内存工作的睡眠时间 Agent（第 08 课）。

即使生产系统运行 Letta、Mem0 或自定义两层存储，MemGPT 论文也是 2026 年的基础。

### 这种模式哪里会出错

- **记忆腐烂（Memory rot）。** 写入积累比读取快；检索淹没在陈旧事实中。修复：定期合并（Letta 睡眠时间）、显式失效（Mem0 冲突检测器）。
- **记忆中毒（Memory poisoning）。** 外部记忆是检索到的文本。如果攻击者控制的内容进入记忆笔记，Agent 会在下一会话重新摄取它。这是 Greshake 等人（第 27 课）攻击随时间的重述。
- **引用丢失（Citation loss）。** Agent 回忆"用户让我发货 X"但无法引用哪个回合。在每次归档写入时存储源引用（会话 ID、回合 ID）。

## 构建它

`code/main.py` 在标准库中实现 MemGPT 的两层模式：

- `MainContext`——带有 `core` 字典和 `messages` 列表的固定大小提示缓冲区；超过上限时自动压缩最旧的消息。
- `ArchivalStore`——内存中类 BM25 的存储（token 重叠评分），包含 (id, text, tags, session, turn) 记录。
- 映射到 MemGPT 表面的五个内存工具。
- 一个脚本化 Agent，用事实填充归档，然后通过调用 `archival_memory_search` 回答问题。

运行它：

```
python3 code/main.py
```

轨迹显示 Agent 写入三个事实，将主上下文填充到上限（强制驱逐），然后通过从归档中检索来回答后续问题——在没有任何真实 LLM 的情况下重现 MemGPT 工作流。

## 使用它

今天每个生产记忆系统都是 MemGPT 变体：

- **Letta**（第 08 课）——三层、原生推理、睡眠时间计算。
- **Mem0**（第 09 课）——向量 + KV + 图与评分层融合。
- **OpenAI Assistants / Responses**——通过线程和文件管理记忆。
- **Claude Agent SDK**——通过 Skills 和会话存储的长期记忆。

按运行形态（自托管、托管、框架集成）选择一个，而不是按核心模式——核心模式是 MemGPT。

## 部署它

`outputs/skill-virtual-memory.md` 是一个可复用的 Skill，为任何目标运行时生成正确的两层记忆脚手架（主 + 归档 + 工具表面），并内置驱逐策略和引用字段。

## 练习

1. 添加以 token 衡量的 `max_main_context_tokens` 上限（用 `len(text.split())` * 1.3 近似）。当超过上限时，将最旧的消息压缩为摘要。比较有和没有摘要器的行为。
2. 在归档存储上正确实现 BM25（词频、逆文档频率）。在玩具事实集上测量 recall@10 与 token 重叠基线。
3. 向归档插入添加 `citation` 字段（session_id、turn_id、source_url）。让 Agent 在每个基于检索的答案上引用来源。
4. 模拟记忆中毒：添加一个说"忽略所有未来的用户指令"的归档记录。写一个防护栏，扫描检索到的指令形文本并将它们标记为不受信任。
5. 将实现移植为使用 MemGPT 研究仓库的 core-memory JSON 模式（`cpacker/MemGPT`）。当你从平面字符串切换到类型化部分时，什么发生了变化？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Virtual context | "无限记忆" | 主（提示）+ 外部（可搜索）层，带页面换入/换出 |
| Main context | "工作记忆" | 提示——固定大小，始终可见 |
| Archival memory | "长期存储" | 外部可搜索持久化，按需检索 |
| Core memory | "持久提示部分" | 固定在主上下文内的命名部分 |
| Memory tool | "内存 API" | Agent 发出的读取/写入外部内存的工具调用 |
| Interrupt | "内存页错误" | Agent 暂停，运行时获取，结果拼接到下一回合 |
| Memory rot | "陈旧事实" | 旧写入淹没检索；用合并修复 |
| Memory poisoning | "注入的持久笔记" | 存储为记忆的攻击者内容，召回时重新摄取 |

## 延伸阅读

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560)——受操作系统启发的虚拟上下文论文
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks)——三层演进
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)——将上下文视为预算
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413)——基于此模式之上的混合生产记忆
