# 代理记忆 虚拟文本和记忆页面

> 文本窗口是有限的.对话,文档和工具痕迹是没有的.解决方案是OS虚拟内存重置. 主要文本是 RAM,外部存储是磁盘,它们之间的代理页面. MemGPT (Packer等, 2023) 命名了该模式;许多生产内存系统建立在它上.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## 学习目标

- 解释MemGPT基于的操作系统比喻:主语境 = RAM,外部语境 = 磁盘,内存工具 = 页面输入/输出.
- 实现在 stdlib 中使用主语境缓冲器,外部可搜索的存储器和页面进/出工具的双层 MemGPT 模式.
- 描述代理如何发出"中断"查询或修改外部内存,以及结果如何将其交配到下一个提示中.
- 确定将Letta (课08) 和 Mem0 (课09) 带入 MemGPT设计选择.

## 问题

文本窗户似乎应该解决内存.

1. **Overflow.**经过过截止时间的时间,一切都消失了.
2. **Dilution.**即使在窗口内,填充无关紧要的文本, 便会让人们忽视重要的事情.
3. **Persistence.**没有外部记忆的代理人不能在会议中说"记住你问我...

根据Mem0的2025年论文,128k窗口的基线仍然缺少长视线的事实,

## 概念

### 操作系统比较

基于此,MemGPT (Packer等, arXiv:2310.08560, v2 Feb 2024) 将文本管理映射到操作系统虚拟内存:

| OS concept | MemGPT concept | 2026 production analog |
|------------|---------------|------------------------|
| RAM | main context (prompt) | Anthropic/OpenAI context window |
| Disk | external context | vector DB, KV, graph store |
| Page fault | memory tool call | `memory.search`, `memory.read`, `memory.write` |
| OS kernel | agent control loop | ReAct loop with memory tools |

代理运行一个正常的 ReAct 循环. 一个额外的工具类允许它页面数据进入和退出主语境.

### 两层

- **Main context.**固定尺寸提示,保持当前任务,始终可见于模型.
- **External context.**无限,可通过工具搜索,当有必要时阅读,当事实出现时写下.

原稿评估了设计的两个任务,除了基层窗口之外:超过100万个代币的文件分析和多次会议聊天,持续记忆在几天内.

### 断断模式

MemGPT引入了"记忆作为中断"的过程:对话中,代理可以调用记忆工具,运行时间执行它,结果将作为一个新的观察,作为下一个助理转换.`read()`系统将阻止进程,返回字节,进程继续.

尼卡内存工具表面:

- `core_memory_append(section, text)`写到提示函中的一个持续部分.
- `core_memory_replace(section, old, new)`编辑一个持续的部分.
- `archival_memory_insert(text)`写到可搜索的外部商店.
- `archival_memory_search(query, top_k)`从外部商店中获取.
- `conversation_search(query)`扫描过往的转折.

### 纸质的结束和生产的开始

据悉,在2024年9月,MemGPT成为Letta.`cpacker/MemGPT`) 仍然存在;Letta扩展了设计:

- 两个层次的基础,回忆,档案 课08.
- 替代了原生理`send_message`心跳模式 (第08课).
- 睡眠时间代理运行异步记忆工作 (课程 08).

尽管生产系统运营Letta,Mem0或一个定制的二层商店,但MemGPT纸是2026年基础.

### 在这个模式出现错误的地方

- **Memory rot.**写作积累速度比读取速度快;检索陷入过时的事实. 修正:定期整合 (Letta睡眠时间),明确无效 (Mem0冲突探测器).
- **Memory poisoning.**攻击者控制的内容如果落入记忆录,代理将其重新摄入下一次.这是Greshake等. (课 27) 攻击随着时间的推移.
- **Citation loss.**代理记得"用户要求我发送X",但无法引用哪个转换.

```figure
context-budget
```

## 建立它

`code/main.py`在 stdlib 中实现 MemGPT 的双层模式:

- `MainContext` 设置尺寸的快速缓冲器`core`和`messages`列表;在超过封顶时自动缩小最古老的消息.
- `ArchivalStore`存储记录 (ID,文字,标签,会议,转换) 的内存BM25-esque (代币重叠分数).
- 五个记忆工具将地图映射到MemGPT表面.
- 编写的代理人,填写档案,然后打电话回答问题.`archival_memory_search`现在,我们要去.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

后续的调查结果显示,代理人写了三个事实,填写了主要文本 (强迫驱逐),然后通过从档案中获取后续问题

## 用它

现在每一个生产内存系统都是MemGPT的变体:

- **Letta**三层,本土推理,睡眠时间计算.
- **Mem0**向量+KV+图,与一个分数层合并.
- **OpenAI Assistants / Responses**通过线程和文件管理内存.
- **Claude Agent SDK**通过技能和会议存储的长期记忆.

根据操作形状 (自主托管,管理,框架集成) 选择一个,而不是根据核心模式.

### 代理记忆的形状

页面化解决了容量.它不决定要存储什么.四种内存类型在生产系统中重复,每个类型都回答不同的问题:

- **Working memory**现在重要的是什么? 背景层次:当前任务,最近的转变,固定的核心部分.
- **Episodic memory**发生了什么?过去的转折和轨迹,存储与会议和转折参考,可按需播放.
- **Semantic memory**关于用户,域名,世界的真实信息,随着变化而更新和复制.
- **Procedural memory**如何做到这一点? 我学会了规律,偏好和规则,

开源实现选择不同的攻击点:

| Type | Implementation | How it tackles it |
|------|----------------|-------------------|
| Working | MemGPT / Letta | Pages content in and out of a fixed prompt budget via memory tools (this lesson, Lesson 08) |
| Episodic | Zep | Temporal knowledge graph — facts carry validity intervals, so "what was true when" is queryable |
| Semantic | Mem0 | Extraction pipeline that dedupes and updates facts across vector, KV, and graph stores (Lesson 09) |
| Semantic + procedural | LangMem | Background extraction of facts and behavioral rules into a store the agent consults between turns |
| Episodic + semantic | agentmemory | Captures sessions as they run, consolidates them into typed, searchable records |

## 运送它

`outputs/skill-virtual-memory.md`是可重复使用的技能,可为任何目标运行时间产生正确的两层内存架 (主 + 档案 + 工具表面),并有驱逐政策和引用字段.

## 运动

1. 添加一个`max_main_context_tokens`按代币计量的上限 (约为`len(text.split())`* 1.3. 超过限时将最古老的信息缩写成总结.
2. 按档案存储器 (期限频率,反文档频率) 执行BM25. 测量回忆@10在玩具事实集上与代币重叠基线相比.
3. 加入`citation`让代理引用每个获取支持的答案中的来源.
4. 模拟记忆中毒:添加一个档案记录,上面写道"忽略所有未来用户指令".
5. 实现将MemGPT研究备忘录的核心内存JSON模式 (`cpacker/MemGPT`) 当你从平线字符串转换为打字段时,什么会发生变化?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Virtual context | "Unlimited memory" | Main (prompt) + external (searchable) tiers with page in/out |
| Main context | "Working memory" | The prompt — fixed-size, always visible |
| Archival memory | "Long-term store" | External searchable persistence, retrieved on demand |
| Core memory | "Persistent prompt section" | Named sections pinned inside the main context |
| Memory tool | "Memory API" | Tool call the agent issues to read/write external memory |
| Interrupt | "Memory page fault" | Agent pauses, runtime fetches, result splices into next turn |
| Memory rot | "Stale facts" | Old writes drown retrieval; fix with consolidation |
| Memory poisoning | "Injected persistent note" | Attacker content stored as memory, re-ingested on recall |

## 进一步阅读

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560)基于OS的虚拟文本论文
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks)三层次的进化
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)将环境视为预算
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) 混合生产内存,
- [Zep (getzep/zep)](https://github.com/getzep/zep)类别表中的时间知识图记忆
- [Mem0 (mem0ai/mem0)](https://github.com/mem0ai/mem0)课09的混合商店背后的采集管道
- [LangMem (langchain-ai/langmem)](https://github.com/langchain-ai/langmem) 背景调查事实和行为规则
- [agentmemory (rohitg00/agentmemory)](https://github.com/rohitg00/agentmemory)集成成类型,可搜索的记录
