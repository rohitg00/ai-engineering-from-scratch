# 混合记忆：向量 + 图 + KV（Mem0）

> Mem0（Chhikara 等人，2025）将记忆视为三个并行存储——向量用于语义相似性，KV 用于快速事实查找，图用于实体关系推理。一个评分层在检索时融合这三个。这是 2026 年外部记忆的生产标准。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 07（MemGPT）、阶段 14 · 08（Letta Blocks）
**时长：** 约 75 分钟

## 学习目标

- 解释为什么单个存储（仅向量、仅图、仅 KV）对于 Agent 记忆是不够的。
- 说出 Mem0 的三个并行存储以及每个存储优化的内容。
- 描述 Mem0 的融合评分——相关性（relevance）、重要性（importance）、最近性（recency）——以及为什么它是加权和，而不是层次结构。
- 在标准库中实现一个玩具三存储记忆，带有一个写入所有三个的 `add()` 和一个融合结果的 `search()`。

## 问题背景

对于三类查询中的一类，单个存储都是错误的：

- **语义相似性**——"上周我们讨论了什么关于 Agent 漂移的内容？"向量胜出；KV 和图未命中。
- **事实查找**——"用户的电话号码是什么？"KV 胜出；向量浪费，图过度杀伤。
- **关系推理**——"哪些客户共享同一账单实体？"图胜出；向量和 KV 无法回答。

生产 Agent 在一个会话中发出所有三个。单存储记忆对其中两个总是错误的。Mem0 的贡献是在一个带有融合它们的评分函数的单一 `add`/`search` 表面背后连接所有三个。

## 核心概念

### 三个并行存储

Mem0（arXiv:2504.19413，2025 年 4 月）在 `add(text, user_id, metadata)` 上：

1. 从文本中提取候选事实（一个 LLM 驱动的 step）。
2. 将每个事实写入向量存储（embedding）以进行语义搜索。
3. 将每个事实写入以 (user_id, fact_type, entity) 为键的 KV 存储，用于 O(1) 查找。
4. 将每个事实作为类型化边写入图存储（Mem0g），用于关系查询。

在 `search(query, user_id)` 上：

1. 向量存储按 embedding cosine 返回 top-k。
2. KV 存储返回以查询派生的 (user_id, type, entity) 为键的直接命中。
3. 图存储返回从查询实体可达的子图。
4. 一个评分层融合这三个。

### 融合评分

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **相关性（Relevance）**——向量 cosine、KV 精确匹配、图路径权重。
- **重要性（Importance）**——在写入时标记或学习（某些事实更重要：姓名、ID、策略）。
- **最近性（Recency）**——自上次写入或读取以来的指数衰减。

每个产品的权重都经过调整。对于聊天 Agent，更高的 `w_recency`；对于合规 Agent，更高的 `w_importance`；对于检索 Agent，更高的 `w_relevance`。

### Mem0g 与时间推理

Mem0g 添加了一个冲突检测器。当新事实与现有边矛盾时，现有边被标记为无效但未删除。时间查询（"用户在三月份的城市是什么？"）遍历有效时间子图。

这是 Letta 的失效模式的合规级行为泛化。

### 基准数字

Mem0 论文报告（2025 年）：

- **LoCoMo**（长格式对话记忆）：91.6
- **LongMemEval**（长期情景记忆）：93.4
- **BEAM 1M**（1M-token 记忆基准）：64.1

比较基线（全上下文 128k LLM、扁平向量存储、扁平 KV）都输了 10+ 个百分点。仅靠基准并不能证明选择的合理性——运行形态才能——但数字显示融合设计不是一个舍入误差。

### 范围分类法

Mem0 按范围拆分记忆：

- **用户记忆（User memory）**——跨会话持久化，以 `user_id` 为键。
- **会话记忆（Session memory）**——在一个线程内持久化。
- **Agent 记忆（Agent memory）**——每个 Agent 实例状态。

每次写入选择一个范围。检索可以跨范围查询，带每范围权重。不加思考地混合范围是导致"助手告诉 Alice 关于 Bob 的项目"事件的方式。

### 这种模式哪里会出错

- **Embedding 漂移。** 在前一百个查询上看起来正确的向量结果随着语料库的增长而降级。添加对 top-N-使用记录的周期重新嵌入。
- **KV 模式蠕变。** `(user_id, type, entity)` 看起来很简单，直到每个团队添加他们自己的 `type`。每季度审计类型集。
- **图爆炸。** 一个嘈杂的提取器每条消息添加 50 个边。限制每个 `add` 调用的图写入；丢弃低置信度边。

## 构建它

`code/main.py` 在标准库中实现三存储模式：

- `VectorStore`——朴素 token 重叠相似性作为 embedding 占位符。
- `KVStore`——以 `(user_id, fact_type, entity)` 为键的字典。
- `GraphStore`——类型化边（subject、relation、object、valid）。
- `Mem0`——顶层门面，带有 `add()`、`search()`、融合评分和范围感知检索。
- 一个多用户、多会话对话的工作轨迹。

运行它：

```
python3 code/main.py
```

输出显示三个单独的召回路径加上融合的 top-k。在 `main()` 顶部翻转评分权重，观察排名变化。

## 使用它

- **Mem0（Apache 2.0）**——生产就绪。使用 Postgres + Qdrant + Neo4j 自托管，或使用托管云。
- **Letta**——三层 core/recall/archival；自带向量和图后端。
- **Zep**——带有时间 KG 和事实提取的商业替代品。
- **自定义构建**——当你需要对提取器（合规）或融合权重（最近性占主导地位的语音 Agent）进行精确控制时。

## 部署它

`outputs/skill-hybrid-memory.md` 生成一个带有融合评分器、范围分类法和时间失效连接的三存储记忆脚手架。

## 练习

1. 将玩具向量相似性替换为真实的 embedding 模型（sentence-transformers、Ollama、OpenAI embeddings）。在合成长对话上测量 recall@10。排名在 1000 次写入后是否会漂移？
2. 添加时间查询：`search(query, as_of=timestamp)`。仅返回在该时间或之前有效的记录。哪个存储需要最多工作？
3. 实现冲突检测器：如果传入事实与图边矛盾，则使旧边无效并记录两者。在"用户住在柏林"->"用户住在里斯本"上进行测试。
4. 将融合评分器移植为包含 `user_feedback` 维度（对检索记录的竖起大拇指）。你如何防止博弈（Agent 只返回它已经喜欢的记录）？
5. 阅读 Mem0 文档（`docs.mem0.ai`）。将玩具移植为 `mem0` 客户端调用。在相同 20 个测试查询上比较检索质量。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Hybrid memory | "向量加图加 KV" | 并行写入的三个存储，在检索时融合 |
| Fact extraction | "记忆摄取" | 将文本分解为（实体、关系、事实）元组的 LLM 步骤 |
| Fusion scoring | "相关性排名" | 相关性、重要性、最近性的加权和 |
| Scope | "记忆命名空间" | 用户 / 会话 / Agent——决定谁看到什么 |
| Mem0g | "记忆图" | 带有时间有效性的类型化边，用于关系查询 |
| Temporal invalidation | "软删除" | 标记矛盾的边无效；永远不要删除 |
| Embedding drift | "检索腐烂" | 向量质量随着语料库增长而降级；定期重新嵌入 |

## 延伸阅读

- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413)——原始论文
- [Mem0 docs](https://docs.mem0.ai/platform/overview)——生产 API、SDK、托管云
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560)——虚拟上下文前身
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks)——三层兄弟设计
