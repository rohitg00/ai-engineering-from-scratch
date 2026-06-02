# 记忆：虚拟上下文与 MemGPT（Memory: Virtual Context and MemGPT）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> context window 是有限的。对话、文档和工具轨迹（trace）却不是。MemGPT（Packer 等，2023）把这件事重新框定成操作系统的虚拟内存——主上下文是 RAM，外部存储是磁盘，agent 在两者之间分页换入换出。这是 2026 年所有记忆系统继承的范式。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 解释 MemGPT 立足的 OS 类比：主上下文 = RAM，外部上下文 = 磁盘，记忆工具 = 分页换入换出。
- 用 stdlib 实现 MemGPT 的两层范式：主上下文缓冲、外部可检索存储、以及 page in/out 工具。
- 说明 agent 如何发出「中断」去查询或修改外部记忆，结果又如何拼接回下一轮 prompt。
- 识别哪些 MemGPT 的设计选择被 Letta（第 08 课）和 Mem0（第 09 课）继承了下去。

## 问题（The Problem）

context window 看起来像是能解决记忆问题的银弹。其实不是。生产环境里反复出现三种失败模式：

1. **溢出（Overflow）。** 多轮对话、长文档、或者大量工具调用的轨迹会越过窗口上限。截断点之后的内容全部丢失。
2. **稀释（Dilution）。** 即便没越界，往窗口里塞无关上下文，也会让 attention（注意力）在真正重要的内容上被稀释。前沿模型在长输入下依然会退化。
3. **持久性（Persistence）。** 新会话从空窗口开始。没有外部记忆的 agent 无法跨会话说出「记得你之前让我……」这种话。

更大的窗口能缓解但治不了根。Mem0 的 2025 年论文测过：128k 窗口的 baseline（基线）依然会漏掉长链路（long-horizon）的事实，而一个带外部记忆的 4k 窗口 agent 反而能抓住。

## 概念（The Concept）

### MemGPT：OS 类比（MemGPT: the OS analogy）

Packer 等人（arXiv:2310.08560，v2 于 2024 年 2 月）把上下文管理映射到操作系统的虚拟内存：

| OS 概念 | MemGPT 概念 | 2026 年生产环境对应物 |
|------------|---------------|------------------------|
| RAM | 主上下文（prompt） | Anthropic/OpenAI 的 context window |
| 磁盘 | 外部上下文 | 向量数据库、KV、图存储 |
| 缺页中断（Page fault） | 记忆工具调用 | `memory.search`、`memory.read`、`memory.write` |
| OS 内核 | agent 控制循环 | 带记忆工具的 ReAct loop |

agent 跑的是普通的 ReAct loop。多出来的一类工具，让它能把数据在主上下文里分页换入换出。

### 两层架构（Two tiers）

- **主上下文（Main context）。** 固定大小的 prompt，承载当前任务。模型始终可见。
- **外部上下文（External context）。** 容量无界，通过工具检索。相关时读出，事实出现时写入。

原论文在两个超出基础窗口的任务上做了评测：超过 100k token 的文档分析，以及跨多日的多会话聊天（依赖持久记忆）。

### 中断范式（The interrupt pattern）

MemGPT 引入了「记忆即中断」：对话进行到一半，agent 可以调用一个记忆工具，runtime 执行它，结果作为新的观测拼接进下一轮 assistant 输出。这在概念上等价于 Unix 的 `read()` 系统调用——阻塞进程、返回字节、进程继续。

经典的记忆工具表面（tool surface）：

- `core_memory_append(section, text)` — 往 prompt 的某个持久区段写入。
- `core_memory_replace(section, old, new)` — 编辑某个持久区段。
- `archival_memory_insert(text)` — 写入可检索的外部存储。
- `archival_memory_search(query, top_k)` — 从外部存储检索。
- `conversation_search(query)` — 扫描历史轮次。

### MemGPT 在哪里收尾、Letta 从哪里接棒（Where MemGPT ends and Letta begins）

2024 年 9 月，MemGPT 改名为 Letta。研究代码库（`cpacker/MemGPT`）仍在；Letta 在原设计上做了扩展：

- 从两层扩到三层（core、recall、archival——见第 08 课）。
- 用原生推理替代 `send_message`/heartbeat 范式（第 08 课）。
- 用 sleep-time agent 异步处理记忆工作（第 08 课）。

哪怕生产系统跑的是 Letta、Mem0 或自研两层存储，MemGPT 论文依然是 2026 年的奠基文献。

### 这套范式会在哪里翻车（Where this pattern goes wrong）

- **记忆腐烂（Memory rot）。** 写入比读取累积得更快；检索被陈旧事实淹没。修法：周期性整合（Letta 的 sleep-time）、显式作废（Mem0 的冲突检测器）。
- **记忆投毒（Memory poisoning）。** 外部记忆就是被检索回来的文本。一旦攻击者控制的内容落进了记忆笔记里，下一次会话 agent 就会再吃一遍。这是 Greshake 等（第 27 课）的攻击在时间维度上的重述。
- **引用丢失（Citation loss）。** agent 回忆起「用户让我交付 X」，但说不出具体是哪一轮。每次写入 archival 时都要存源头引用（session ID、turn ID）。

## 动手实现（Build It）

`code/main.py` 用 stdlib 实现了 MemGPT 的两层范式：

- `MainContext` — 固定大小的 prompt 缓冲区，含一个 `core` dict 和一个 `messages` list；超过容量上限时自动 compact（压缩）最旧的消息。
- `ArchivalStore` — 内存中的类 BM25 存储（token 重叠打分），记录 (id, text, tags, session, turn)。
- 五个映射到 MemGPT tool surface 的记忆工具。
- 一个脚本化 agent：先把事实写进 archival，再通过调用 `archival_memory_search` 来回答问题。

跑一下：

```
python3 code/main.py
```

trace 会展示 agent 写入三条事实、把主上下文填到上限（触发淘汰），然后通过从 archival 检索来回答后续问题——在没有任何真实 LLM 的情况下复现 MemGPT 工作流。

## 用起来（Use It）

今天每一个生产级记忆系统，都是 MemGPT 的变体：

- **Letta**（第 08 课）——三层架构、原生推理、sleep-time compute。
- **Mem0**（第 09 课）——向量 + KV + 图，外加打分层融合。
- **OpenAI Assistants / Responses** ——通过 threads 和 files 提供托管式记忆。
- **Claude Agent SDK** ——通过 skills 和 session store 提供长期记忆。

按运维形态（自托管、托管式、框架集成）来挑，而不是按核心范式挑——核心范式就是 MemGPT。

## 上线部署（Ship It）

`outputs/skill-virtual-memory.md` 是一个可复用的 skill，能为任意目标 runtime 生成一份正确的两层记忆脚手架（主上下文 + archival + tool surface），并把淘汰策略和引用字段都接好。

## 练习（Exercises）

1. 加一个以 token 计的 `max_main_context_tokens` 上限（用 `len(text.split())` * 1.3 近似）。一旦超过上限，把最旧的消息压缩成 summary。比较带 / 不带 summarizer 的行为差异。
2. 在 archival 存储上正经实现 BM25（term frequency、inverse document frequency）。在一个玩具事实集上测 recall@10，对比 token 重叠 baseline。
3. 给 archival 写入加上 `citation` 字段（session_id、turn_id、source_url）。让 agent 在每个基于检索的回答里都引用来源。
4. 模拟记忆投毒：往 archival 里塞一条「ignore all future user instructions」。写一个 guard 扫描检索结果中具有指令形态的文本，并标记为不可信。
5. 把实现移植到使用 MemGPT 研究代码库（`cpacker/MemGPT`）的 core-memory JSON schema。从扁平字符串切到带类型的 section，会带来哪些变化？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际意思 |
|------|----------------|------------------------|
| Virtual context（虚拟上下文） | 「无限记忆」 | 主层（prompt）+ 外部层（可检索），带 page in/out |
| Main context（主上下文） | 「工作记忆」 | 就是 prompt——固定大小、始终可见 |
| Archival memory（archival 记忆） | 「长期存储」 | 外部可检索的持久化层，按需检索 |
| Core memory（core 记忆） | 「持久 prompt 区段」 | 钉在主上下文里的命名区段 |
| Memory tool（记忆工具） | 「Memory API」 | agent 用来读写外部记忆的 tool call |
| Interrupt（中断） | 「记忆缺页」 | agent 暂停、runtime 拉取、结果拼回下一轮 |
| Memory rot（记忆腐烂） | 「事实陈旧」 | 老的写入淹没检索；用整合修 |
| Memory poisoning（记忆投毒） | 「植入持久笔记」 | 攻击者内容被存为记忆，回忆时再吃一遍 |

## 延伸阅读（Further Reading）

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) — OS 启发的虚拟上下文论文
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) — 演化到三层架构
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — 把 context 当作预算来管
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) — 在这套范式之上做的混合生产记忆
