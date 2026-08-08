# 混合记忆：向量 + 图 + KV（Mem0）

> Mem0（Chhikara 等，2025）将记忆视为三个并行存储——向量用于语义相似性，KV 用于快速事实查找，图用于实体关系推理。评分层在检索时融合三者。这是 2026 年外部记忆的生产标准。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 07（MemGPT），第 14 阶段 · 08（Letta 块）
**时间：** ~75 分钟

## 学习目标

- 解释为什么单一存储（仅向量、仅图、仅 KV）对 agent 记忆不足。
- 说出 Mem0 的三个并行存储及其各自优化什么。
- 描述 Mem0 的融合评分——相关性、重要性、时效性——以及为什么它是加权和而非层次结构。
- 用标准库实现一个玩具三存储记忆，`add()` 写入所有三个，`search()` 融合结果。

## 问题

一种存储对三类查询中的一类是错误的：

- **语义相似性** —— "上周我们讨论了什么关于 agent 漂移？" 向量获胜；KV 和图错过。
- **事实查找** —— "用户的电话号码是什么？" KV 获胜；向量浪费，图过度设计。
- **关系推理** —— "哪些客户共享同一个账单实体？" 图获胜；向量和 KV 无法回答。

生产 agent 在一个会话中发出所有三类。单一存储记忆总是对其中两类是错误的。Mem0 的贡献是将三者连接在单个 `add`/`search` 表面后，用评分函数融合它们。

## 概念

### 三个并行存储

Mem0（arXiv:2504.19413，2025年4月）在 `add(text, user_id, metadata)` 上：

1. 从文本中提取候选事实（LLM 驱动步骤）。
2. 将每个事实写入向量存储（嵌入）用于语义搜索。
3. 将每个事实写入 KV 存储，键为 (user_id, fact_type, entity) 用于 O(1) 查找。
4. 将每个事实作为类型边写入图存储（Mem0g）用于关系查询。

在 `search(query, user_id)` 上：

1. 向量存储按嵌入余弦返回 top-k。
2. KV 存储返回以查询派生的 (user_id, type, entity) 为键的直接命中。
3. 图存储返回从查询实体可达的子图。
4. 评分层融合三者。

### 融合评分

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **相关性** —— 向量余弦、KV 精确匹配、图路径权重。
- **重要性** —— 写入时标记或学习（某些事实更重要：姓名、ID、策略）。
- **时效性** —— 自上次写入或读取以来的指数衰减。

权重按产品调整。聊天 agent 的 `w_recency` 更高；合规 agent 的 `w_importance` 更高；检索 agent 的 `w_relevance` 更高。

### Mem0g 和时序推理

Mem0g 添加冲突检测器。当新事实与现有边矛盾时，现有边被标记为无效但不删除。时序查询（"用户在 3 月的城市是什么？"）遍历当时有效的子图。

这是 Letta 失效模式泛化的合规级行为。

### 基准数字

Mem0 论文报告（2025）：

- **LoCoMo**（长形式对话记忆）：91.6
- **LongMemEval**（长程情景记忆）：93.4
- **BEAM 1M**（1M token 记忆基准）：64.1

比较基线（全上下文 128k LLM、平面向量存储、平面 KV）都落后 10+ 分。仅基准不足以证明选择——运营形状才是——但数字显示融合设计不是舍入误差。

### 范围分类

Mem0 按范围划分记忆：

- **User memory** —— 跨会话持久，以 `user_id` 为键。
- **Session memory** —— 在一个线程内持久。
- **Agent memory** —— 每个 agent 实例状态。

每次写入选择一个范围。检索可以跨范围查询，带每范围权重。不加思考地混合范围会导致"助手告诉 Alice 关于 Bob 的项目"事件。

### 此模式出错的地方

- **嵌入漂移。** 向量结果在前几百个查询上看起来正确，但随着语料库增长而退化。对 top-N 常用记录定期重新嵌入。
- **KV 模式蔓延。** `(user_id, type, entity)` 看起来简单，直到每个团队添加自己的 `type`。每季度审核类型集。
- **图爆炸。** 一个噪声提取器每条消息添加 50 条边。限制每次 `add` 调用的图写入；丢弃低置信度边。

## 构建

`code/main.py` 用标准库实现三存储模式：

- `VectorStore` —— 朴素 token 重叠相似性作为嵌入替代。
- `KVStore` —— 以 `(user_id, fact_type, entity)` 为键的字典。
- `GraphStore` —— 类型边（subject, relation, object, valid）。
- `Mem0` —— 顶层门面，带 `add()`、`search()`、融合评分和范围感知检索。
- 多用户、多会话对话的工作跟踪。

运行：

```
python3 code/main.py
```

输出显示三个独立的回忆路径加上融合的 top-k。在 `main()` 顶部翻转评分权重，观察排名变化。

## 使用

- **Mem0（Apache 2.0）** —— 生产就绪。用 Postgres + Qdrant + Neo4j 自托管，或使用托管云。
- **Letta** —— 三层 core/recall/archival；自带向量和图后端。
- **Zep** —— 商业替代，带时序 KG 和事实提取。
- **自定义构建** —— 当你需要精确控制提取器（合规）或融合权重（语音 agent 中时效性占主导）。

## 交付

`outputs/skill-hybrid-memory.md` 生成三存储记忆脚手架，带融合评分器、范围分类和时序失效。

## 练习

1. 用真实嵌入模型替换玩具向量相似性（sentence-transformers、Ollama、OpenAI 嵌入）。在合成长对话上测量 recall@10。1000 次写入后排名会漂移吗？
2. 添加时序查询：`search(query, as_of=timestamp)`。只返回在该时间或之前有效的记录。哪个存储需要最多工作？
3. 实现冲突检测器：如果传入事实与图边矛盾，使旧边无效并记录两者。在"用户住在柏林" -> "用户住在里斯本"上测试。
4. 将融合评分器移植到包含 `user_feedback` 维度（对检索记录点赞）。如何防止操纵（agent 只返回它已经喜欢的记录）？
5. 阅读 Mem0 文档（`docs.mem0.ai`）。将玩具移植到 `mem0` 客户端调用。在相同 20 个测试查询上比较检索质量。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Hybrid memory | "向量加图加 KV" | 三个并行存储，检索时融合 |
| Fact extraction | "记忆摄入" | LLM 步骤，将文本拆分为 (entity, relation, fact) 元组 |
| Fusion scoring | "相关性排序" | 相关性、重要性、时效性的加权和 |
| Scope | "记忆命名空间" | user / session / agent —— 决定谁看到什么 |
| Mem0g | "记忆图" | 带时序有效性的类型边，用于关系查询 |
| Temporal invalidation | "软删除" | 标记矛盾边无效；永不删除 |
| Embedding drift | "检索腐烂" | 向量质量随语料库增长退化；定期重新嵌入 |

## 延伸阅读

- [Chhikara 等，Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) —— 原始论文
- [Mem0 docs](https://docs.mem0.ai/platform/overview) —— 生产 API、SDK、托管云
- [Packer 等，MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) —— 虚拟上下文前身
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) —— 三层兄弟设计