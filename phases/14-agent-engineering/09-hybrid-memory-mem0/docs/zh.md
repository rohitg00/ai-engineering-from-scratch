# 混合记忆：Vector + Graph + KV（Mem0）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Mem0（Chhikara 等，2025）把记忆视作三种并行的存储 —— vector 用于语义相似度，KV 用于快速事实查找，graph 用于实体-关系推理。检索时由一个评分层把三者融合。这是 2026 年外部记忆的生产标准。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 解释为什么单一存储（仅 vector、仅 graph、仅 KV）不足以承载 agent 记忆。
- 说出 Mem0 的三种并行存储分别是什么，以及各自针对什么场景做优化。
- 描述 Mem0 的融合评分 —— 相关性（relevance）、重要性（importance）、新鲜度（recency）—— 以及为什么它是加权求和而不是层级结构。
- 用标准库实现一个玩具版三存储记忆：`add()` 同时写入三个存储，`search()` 把结果融合返回。

## 问题（The Problem）

对于以下三类查询，任何单一存储都会在其中两类上犯错：

- **语义相似度（Semantic similarity）** —— "上周我们关于 agent drift 聊了什么？"vector 胜出，KV 和 graph 都会漏召。
- **事实查找（Fact lookup）** —— "用户的电话号码是多少？"KV 胜出，vector 是浪费，graph 是杀鸡用牛刀。
- **关系推理（Relationship reasoning）** —— "哪些客户共享同一个计费实体？"graph 胜出，vector 和 KV 根本答不出来。

生产环境里的 agent 在一次会话里就会同时发出这三类请求。单存储记忆对其中两类总是错的。Mem0 的贡献，是把这三种存储统一在一个 `add` / `search` 接口背后，再用一个评分函数把它们融合。

## 概念（The Concept）

### 三种并行存储

Mem0（arXiv:2504.19413，2025 年 4 月）在 `add(text, user_id, metadata)` 时：

1. 从文本中抽取候选事实（由 LLM 驱动的一步）。
2. 把每条事实写入 vector store（embedding），用于语义检索。
3. 把每条事实写入 KV store，以 `(user_id, fact_type, entity)` 为键，做 O(1) 查找。
4. 把每条事实以带类型的边写入 graph store（Mem0g），用于关系查询。

在 `search(query, user_id)` 时：

1. Vector store 按 embedding 余弦返回 top-k。
2. KV store 按从 query 推导出的 `(user_id, type, entity)` 直接命中。
3. Graph store 返回从 query 实体可达的子图。
4. 评分层把三者融合。

### 融合评分

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **相关性（Relevance）** —— vector 余弦、KV 精确匹配、graph 路径权重。
- **重要性（Importance）** —— 写入时打标，或学习得到（有些事实更重要：姓名、ID、政策）。
- **新鲜度（Recency）** —— 距离上次写入或读取的时间做指数衰减。

权重按产品调优。聊天 agent 把 `w_recency` 调高；合规 agent 把 `w_importance` 调高；检索 agent 把 `w_relevance` 调高。

### Mem0g 与时间推理

Mem0g 增加了一个冲突检测器。当新事实与已有边冲突时，旧边被标记为失效，但不会被删除。时间相关的查询（"用户在三月份住在哪个城市？"）会遍历"在某时刻有效"的子图。

这就是 Letta 的失效模式所概括的、合规级（compliance-grade）的行为。

### 基准（Benchmark）数据

Mem0 论文报告（2025）：

- **LoCoMo**（长篇对话记忆）：91.6
- **LongMemEval**（长链路情景记忆）：93.4
- **BEAM 1M**（百万 token 记忆基准）：64.1

对照基线（128k 全 context LLM、扁平 vector store、扁平 KV）都落后 10 分以上。基准本身不能决定选型 —— 真正决定选型的是工程形态 —— 但这些数字说明融合设计带来的不是测量误差。

### 作用域（Scope）分类法

Mem0 按作用域切分记忆：

- **User memory** —— 跨会话持久化，以 `user_id` 为键。
- **Session memory** —— 单个会话线程内持久化。
- **Agent memory** —— 单个 agent 实例的状态。

每次写入只挑一个作用域。检索时可以跨作用域查询，并对每个作用域设不同权重。不假思索地混用作用域，就是"助手把 Bob 项目的事告诉了 Alice"这类事故的源头。

### 这个模式会在哪里翻车

- **Embedding drift（embedding 漂移）。**前一百次查询里看起来对的 vector 结果，会随着语料增长而退化。要定期对最常用的 top-N 记录重做 embedding。
- **KV schema 蔓延。**`(user_id, type, entity)` 看着简单，直到每个团队都加上自己的 `type`。每季度审计一次 type 集合。
- **Graph 爆炸。**一个噪声大的抽取器，每条消息能加 50 条边。给每次 `add` 调用的 graph 写入设上限；丢弃低置信度的边。

## 动手实现（Build It）

`code/main.py` 用标准库实现三存储模式：

- `VectorStore` —— 用朴素的 token 重叠相似度作为 embedding 替身。
- `KVStore` —— 以 `(user_id, fact_type, entity)` 为键的 dict。
- `GraphStore` —— 带类型的边（subject、relation、object、valid）。
- `Mem0` —— 顶层 facade，提供 `add()`、`search()`、融合评分以及作用域感知的检索。
- 一个跑通的多用户、多会话对话 trace。

跑起来：

```
python3 code/main.py
```

输出会展示三条独立的召回路径，加上融合后的 top-k。改一下 `main()` 顶部的评分权重，看排名怎么变。

## 用起来（Use It）

- **Mem0（Apache 2.0）** —— 生产可用。可以用 Postgres + Qdrant + Neo4j 自建，也可以用托管云。
- **Letta** —— core / recall / archival 三层；vector 与 graph 后端自带。
- **Zep** —— 商用替代品，带 temporal KG 和事实抽取。
- **自建** —— 当你需要对抽取器（合规场景）或融合权重（语音 agent，新鲜度主导）有精确控制时再考虑。

## 上线部署（Ship It）

`outputs/skill-hybrid-memory.md` 会生成一个三存储记忆脚手架，已经接好融合打分器、作用域分类法和时间失效逻辑。

## 练习（Exercises）

1. 把玩具 vector 相似度替换成真实 embedding 模型（sentence-transformers、Ollama、OpenAI embeddings）。在一段合成的长对话上测 recall@10。1000 次写入之后，排名是否漂移了？
2. 加一个时间维度的查询：`search(query, as_of=timestamp)`。只返回在该时间点或之前有效的记录。哪个存储需要改的最多？
3. 实现一个冲突检测器：如果新进事实与某条 graph 边冲突，就让旧边失效并把两者都记日志。在 "user lives in Berlin" → "user lives in Lisbon" 上测一下。
4. 给融合打分器加一个 `user_feedback` 维度（对召回记录点赞）。怎么防止刷分（agent 只返回它自己之前喜欢过的记录）？
5. 读一遍 Mem0 文档（`docs.mem0.ai`）。把玩具版迁移到 `mem0` 客户端调用。在同样 20 条测试 query 上比较召回质量。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际指什么 |
|------|----------------|------------|
| Hybrid memory（混合记忆） | "vector 加 graph 加 KV" | 三种存储并行写入，检索时融合 |
| Fact extraction（事实抽取） | "记忆入库" | LLM 步骤，把文本切成 `(entity, relation, fact)` 三元组 |
| Fusion scoring（融合评分） | "相关性排序" | 相关性、重要性、新鲜度的加权求和 |
| Scope（作用域） | "记忆 namespace" | user / session / agent —— 决定谁能看到什么 |
| Mem0g | "记忆图" | 带类型的边，附带时间有效性，用于关系查询 |
| Temporal invalidation（时间失效） | "软删除" | 把冲突的边标为失效；永不删除 |
| Embedding drift（embedding 漂移） | "检索腐烂" | vector 质量随语料增长而退化；定期 re-embed |

## 延伸阅读（Further Reading）

- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) —— 原始论文
- [Mem0 docs](https://docs.mem0.ai/platform/overview) —— 生产 API、SDK、托管云
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) —— virtual-context 的前作
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) —— 三层结构的兄弟设计
