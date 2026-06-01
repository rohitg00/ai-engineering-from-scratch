# 09 · 混合记忆：向量 + 图 + KV（Mem0）

> Mem0（Chhikara 等人，2025）将记忆视为三个并行的存储——向量（vector）用于语义相似度，KV 用于快速事实查找，图（graph）用于实体关系推理。检索时由一个打分层将三者融合。这是 2026 年外部记忆的生产级标准。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置：** 阶段 14 · 07（MemGPT），阶段 14 · 08（Letta Blocks）
**时长：** 约 75 分钟

## 学习目标

- 解释为什么单一存储（仅向量、仅图、仅 KV）不足以支撑智能体（agent）记忆。
- 说出 Mem0 的三个并行存储，以及每一个各自优化的目标。
- 描述 Mem0 的融合打分（fusion scoring）——相关性（relevance）、重要性（importance）、新近度（recency）——以及为什么它是加权求和，而非层级结构。
- 用标准库实现一个玩具级三存储记忆：`add()` 同时写入三个存储，`search()` 融合三者的结果。

## 问题所在

对于三类查询中的某一类，单一存储总是错误的选择：

- **语义相似度（Semantic similarity）**——"上周我们讨论智能体漂移（agent drift）时说了什么？"向量胜出；KV 和图都会漏掉。
- **事实查找（Fact lookup）**——"用户的电话号码是多少？"KV 胜出；用向量是浪费，用图则杀鸡用牛刀。
- **关系推理（Relationship reasoning）**——"哪些客户共用同一个开票主体？"图胜出；向量和 KV 都无法回答。

生产环境的智能体会在同一个会话里发起全部三类查询。单一存储记忆对其中两类总是错误的。Mem0 的贡献在于把三者接到统一的 `add`/`search` 接口背后，并用一个打分函数将它们融合。

## 核心概念

### 三个并行存储

Mem0（arXiv:2504.19413，2025 年 4 月）在 `add(text, user_id, metadata)` 时：

1. 从文本中抽取候选事实（一个由 LLM 驱动的步骤）。
2. 将每个事实写入向量存储（embedding），用于语义搜索。
3. 将每个事实以 (user_id, fact_type, entity) 为键写入 KV 存储，实现 O(1) 查找。
4. 将每个事实作为带类型的边写入图存储（Mem0g），用于关系查询。

在 `search(query, user_id)` 时：

1. 向量存储按 embedding 余弦相似度返回 top-k。
2. KV 存储按从查询派生出的 (user_id, type, entity) 返回直接命中。
3. 图存储返回从查询实体可达的子图。
4. 一个打分层将三者融合。

### 融合打分

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **相关性（Relevance）**——向量余弦、KV 精确匹配、图路径权重。
- **重要性（Importance）**——在写入时打标或通过学习获得（有些事实更重要：姓名、ID、策略）。
- **新近度（Recency）**——自上次写入或读取以来随时间指数衰减。

权重按产品调优。聊天智能体的 `w_recency` 更高；合规智能体的 `w_importance` 更高；检索智能体的 `w_relevance` 更高。

### Mem0g 与时序推理

Mem0g 增加了一个冲突检测器。当新事实与已有的边相矛盾时，已有的边被标记为无效（invalid），但不会被删除。时序查询（"三月份时用户所在的城市是哪里？"）会遍历"在该时刻有效"的子图。

这正是 Letta 的失效（invalidation）模式所概括的合规级行为。

### 基准测试数据

Mem0 论文报告（2025）：

- **LoCoMo**（长篇对话记忆）：91.6
- **LongMemEval**（长程情景记忆）：93.4
- **BEAM 1M**（百万 token 记忆基准）：64.1

对比基线（全上下文 128k LLM、扁平向量存储、扁平 KV）全都落后 10 分以上。基准测试本身不足以决定选型——运营形态才是关键——但这些数字表明，融合设计带来的提升并非舍入误差级别的微小差异。

### 作用域分类

Mem0 按作用域（scope）划分记忆：

- **用户记忆（User memory）**——跨会话持久化，以 `user_id` 为键。
- **会话记忆（Session memory）**——在单个线程内持久化。
- **智能体记忆（Agent memory）**——单个智能体实例的状态。

每次写入都要选定一个作用域。检索可以跨作用域查询，并对每个作用域使用不同权重。不假思索地混用作用域，正是"助手把 Bob 的项目情况告诉了 Alice"这类事故的根源。

### 这个模式容易出错的地方

- **Embedding 漂移（Embedding drift）。** 在前一百次查询里看起来正确的向量结果，会随着语料库增长而退化。对使用频率最高的前 N 条记录定期重新做 embedding。
- **KV 模式蔓延（KV schema creep）。** `(user_id, type, entity)` 看起来很简单，直到每个团队都加上自己的 `type`。每季度审计一次类型集合。
- **图爆炸（Graph explosion）。** 一个噪声很大的抽取器会给每条消息加 50 条边。为每次 `add` 调用设置图写入上限；丢弃低置信度的边。

## 动手构建

`code/main.py` 用标准库实现了三存储模式：

- `VectorStore`——用朴素的 token 重叠相似度作为 embedding 的替身。
- `KVStore`——以 `(user_id, fact_type, entity)` 为键的 dict。
- `GraphStore`——带类型的边（subject, relation, object, valid）。
- `Mem0`——顶层外观（facade），提供 `add()`、`search()`、融合打分和作用域感知的检索。
- 一段在多用户、多会话对话上的完整执行追踪。

运行它：

```
python3 code/main.py
```

输出展示了三条独立的召回路径，外加融合后的 top-k。修改 `main()` 顶部的打分权重，观察排名如何变化。

## 实战运用

- **Mem0（Apache 2.0）**——生产就绪。可用 Postgres + Qdrant + Neo4j 自托管，或使用托管云服务。
- **Letta**——三层 core/recall/archival；可自带向量与图后端。
- **Zep**——商业替代方案，带时序知识图谱（temporal KG）和事实抽取。
- **自研方案**——当你需要对抽取器（合规场景）或融合权重（新近度占主导的语音智能体）进行精确控制时。

## 交付产物

`outputs/skill-hybrid-memory.md` 生成一个三存储记忆脚手架，内置融合打分器、作用域分类和时序失效逻辑。

## 练习

1. 用真实的 embedding 模型（sentence-transformers、Ollama、OpenAI embeddings）替换玩具级的向量相似度。在一段合成的长对话上测量 recall@10。排名在 1000 次写入后会发生漂移吗？
2. 增加一个时序查询：`search(query, as_of=timestamp)`。只返回在该时刻或之前有效的记录。哪个存储改动量最大？
3. 实现一个冲突检测器：如果传入的事实与某条图边相矛盾，使旧边失效并把两者都记录下来。在 "user lives in Berlin" -> "user lives in Lisbon" 上测试。
4. 给融合打分器移植一个 `user_feedback` 维度（对检索到的记录点赞）。你如何防止被刷分（智能体只返回它已经喜欢过的记录）？
5. 阅读 Mem0 文档（`docs.mem0.ai`）。把玩具实现移植到 `mem0` 客户端调用上。在同一组 20 个测试查询上比较检索质量。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|----------------|------------------------|
| 混合记忆（Hybrid memory） | "向量加图加 KV" | 三个存储并行写入，检索时融合 |
| 事实抽取（Fact extraction） | "记忆摄取" | LLM 步骤，把文本拆成 (entity, relation, fact) 元组 |
| 融合打分（Fusion scoring） | "相关性排名" | 相关性、重要性、新近度的加权求和 |
| 作用域（Scope） | "记忆命名空间" | user / session / agent——决定谁能看到什么 |
| Mem0g | "记忆图" | 带时序有效性的类型化边，用于关系查询 |
| 时序失效（Temporal invalidation） | "软删除" | 把被矛盾的边标记为无效；从不删除 |
| Embedding 漂移（Embedding drift） | "检索腐化" | 向量质量随语料库增长而退化；定期重新做 embedding |

## 延伸阅读

- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413)——原始论文
- [Mem0 文档](https://docs.mem0.ai/platform/overview)——生产 API、SDK、托管云
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560)——虚拟上下文的前身
- [Letta, Memory Blocks 博客](https://www.letta.com/blog/memory-blocks)——三层结构的姊妹设计
