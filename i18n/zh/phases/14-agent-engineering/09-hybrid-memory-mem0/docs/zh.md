# 混合型内存:向量+图表+KV

> 混合存储器在并行中运行三个存储器 向量用于语义相似性,KV用于快速的事实搜索,图为实体关系推理,并具有在检索时合并它们的分数层.这是外部存储器的广泛使用的生产模式;Mem0 (Chhikara等,2025) 是一个参考实现.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## 学习目标

- 解释为什么单个存储器 (仅为向量,仅为图,仅为KV) 为代理记忆不够.
- 给Mem0的三个平行商店一个名称,每个商店都为什么优化.
- 描述Mem0的融合评分 相关性,重要性,近期性 以及为什么它是一个权重的数量,而不是一个层次.
- 通过一个   应用一个玩具三层内存在 stdlib`add()`这写给三个和一个`search()`这会导致结.

## 问题

每个商店只适合三个查询类别之一:

- **Semantic similarity**"我们上周讨论了什么关于代理漂移?" 矢量获胜;KV和图表失败.
- **Fact lookup**"用户的电话号码是什么?"KV获胜;向量是浪费的,图表是过度的.
- **Relationship reasoning** "哪些客户共享相同的发票实体?"图表获胜;向量和KV无法回答.

制作代理人在一次会议中发布了所有三个. 一个单店内存总是对两个错误的. Mem0的贡献是将所有三个连接到一个单个内存.`add`现在,我们要去.`search`表面具有分数函数,将它们合并.

## 概念

### 连续三家商店

关于"联合国"的决议`add(text, user_id, metadata)`其他:

1. 从文本中提取候选事实 (基于LLM的步骤).
2. 写每一个事实到向量存储 (嵌入) 中进行语义搜索.
3. 写每个事实到按键 (user_id, fact_type, entity) 的 KV存储中.$O(1)$查看.
4. 写每一个事实到图库 (Mem0g) 作为键入边缘关系查询.

现在`search(query, user_id)`其他:

1. 通过嵌入 cosine,向量商店返回 top-k.
2. 查询来源 (user_id,类型,实体) 上键入的直接击中返回.
3. 图库返回从查询实体可访问的子图.
4. 结合了三种.

### 聚合分数

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **Relevance**向量共数,KV的确切匹配,图路径重量.
- **Importance**标记在写作时间或学习 (一些事实更重要:名称,身份证,政策).
- **Recency**自上一次写或阅读以来,随时间的推移而呈指数级衰退.

按产品调整的重量.`w_recency`对于聊天代理人;更高`w_importance`对于合规代理人;`w_relevance`为了检索人员.

### 记忆和时间推理

Mem0g添加了冲突探测器.当一个新的事实与现有边缘相矛盾时,现有边缘被标记为无效但不会被删除.时间查询 ("3月用户的城市是什么?") 穿越了有效时代子图.

这就是Letta的无效模式一般化的合规性行为.

### 基准号码

报告 (2025):

- **LoCoMo**(长时间对话记忆): 91.6
- **LongMemEval**长视野事件记忆:93.4
- **BEAM 1M**(M-代币内存基准值): 64.1

比较基线 (全文 128k LLM,平面向量存储,平面KV) 都损失了10+分.仅仅的基准不证明选择的操作形状是,但数字显示融合设计不是圆形错误.

### 范围分类

Mem0 分开记忆范围:

- **User memory**持续在整个会议中,按键开.`user_id`现在,我们要去.
- **Session memory**在一个线程内持续.
- **Agent memory**每代理实例状态.

每个写作都会选择一个范围. 检索可以通过每个范围的权重进行查询. 混合范围是如何得到"助理告诉爱丽丝关于勃的项目"事件.

### 在这个模式出现错误的地方

- **Embedding drift.**随着体积的增长,向量结果在第一百个查询中会降低.
- **KV schema creep.** `(user_id, type, entity)`看起来很简单,直到每个团队都加入了自己的团队.`type`季度检查类型.
- **Graph explosion.**一个噪音的提取器每条消息增加了50个边缘.`add`让人们放弃低信心的边缘.

```figure
ae-memory-fusion
```

## 建立它

`code/main.py`在 stdlib 中实现了三层格式:

- `VectorStore`作为嵌入式替代品的无明的代币重叠相似性.
- `KVStore` 按键键键`(user_id, fact_type, entity)`现在,我们要去.
- `GraphStore`打字边缘 (主体,关系,对象,有效).
- `Mem0`顶层面面`add()`现在`search()`合分数,以及意识到范围的检索.
- 通过多个用户进行的对话,

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

输出显示了三个独立的召回路径加上合并的顶-k.`main()`看到排名变化.

## 用它

- **Mem0 (Apache 2.0)** 准备生产.自主主持人使用Postgres + Qdrant + Neo4j,或使用管理云.
- **Letta**三层核心/回忆/档案;带你自己的向量和图形后端.
- **Zep**商业替代品,即时间KG和事实提取.
- **Custom builds**需要对取器 (合规性) 或合权重 (声源主导的声源) 的确控制.

## 运送它

`outputs/skill-hybrid-memory.md`产生一个三层内存架子, 配有合分数, 范围分类和时间无效的电缆.

## 运动

1. 取代玩具向量相似性用一个真正的嵌入模型 (句子变换器,Ollama,OpenAI嵌入).在合成长对话中测量回忆@10.排名漂移超过1000写?
2. 添加时间查询:`search(query, as_of=timestamp)`返回只有在那个时间或之前有效的记录.哪家商店需要最多的工作?
3. 实现冲突检测器:如果一个传入的事实与图表边缘相矛盾,请无效取消旧边缘并记录两者.
4. 移植合分数器,包括一个`user_feedback`如何防止游戏 (代理只返回已喜欢的记录)?
5. 阅读 Mem0文件 (`docs.mem0.ai`把玩具带到`mem0`根据相同的20个测试查询,

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hybrid memory | "Vector plus graph plus KV" | Three stores written in parallel, fused on retrieval |
| Fact extraction | "Memory ingestion" | LLM step that breaks text into (entity, relation, fact) tuples |
| Fusion scoring | "Relevance ranking" | Weighted sum of relevance, importance, recency |
| Scope | "Memory namespace" | user / session / agent — determines who sees what |
| Mem0g | "Memory graph" | Typed edges with temporal validity for relationship queries |
| Temporal invalidation | "Soft delete" | Mark contradicted edges invalid; never delete |
| Embedding drift | "Retrieval rot" | Vector quality degrades as corpus grows; re-embed periodically |

## 进一步阅读

- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413)原始纸
- [Mem0 docs](https://docs.mem0.ai/platform/overview)生产API,SDK,管理云
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560)虚拟文本前身
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks)三层式的兄弟设计
