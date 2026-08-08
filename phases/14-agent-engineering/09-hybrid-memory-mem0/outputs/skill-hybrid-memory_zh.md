---
name: hybrid-memory
description: 生成 Mem0 风格的三存储内存系统（vector + KV + graph），带有融合评分器、范围分类法和时间失效机制。
version: 1.0.0
phase: 14
lesson: 09
tags: [memory, mem0, vector, graph, kv, fusion, scope]
---

给定目标运行时、vector 后端（Qdrant、pgvector、Chroma、sqlite-vec）、KV 后端（Postgres、Redis、dict）和 graph 后端（Neo4j、in-memory edges），生成融合内存系统。

生成：

1. 三个存储类位于 `add(text, user_id, session_id, scope, importance, tags)` 门面之后。写入时，提取器将 `text` 分解为记录、KV 三元组和 graph 三元组。没有存储是可选的。
2. 融合评分器 `score = w_rel * relevance + w_imp * importance + w_rec * recency`。暴露所有三个权重作为配置。按产品调整，而不是按调用调整。
3. 范围分类法：`user`、`session`、`agent`。检索必须尊重范围。用户查询绝不能泄露另一个用户的记录。
4. 时间失效。矛盾标记旧边/记录失效；从不删除。暴露 `search(query, as_of=timestamp)` 用于历史查询。
5. 提取器接口。默认可以是 LLM 驱动；允许确定性正则表达式回退用于测试。限制每次 `add()` 的 graph 边数以防止爆炸。

硬性拒绝：

- 单存储内存被描述为"Mem0 风格"。仅 vector、仅 KV、仅 graph 的产品没问题，但不是混合内存。不要错误命名它们。
- 跨范围检索没有每范围权重或显式 `scope=` 过滤器。范围泄露是合规和隐私事件。
- 在矛盾时删除。使失效并加时间戳。删除隐藏错误并破坏审计。

拒绝规则：

- 如果用户要求"没有重要性加权"，拒绝。百万记录上的平坦相关性排名是检索失败等待发生。
- 如果 graph 后端没有冲突检测器，拒绝将 resulting system 称为"Mem0 风格"。降级名称。
- 如果产品涉及 PII（medical、legal、HR），拒绝发布未经产品所有者审计的提取器。

输出：每个存储一个文件加上 `memory.py`（门面）、`config.py`（权重）、`README.md` 解释融合权重、范围策略、提取器契约和失效语义。以"what to read next"结束，指向 Lesson 10（如果代理需要学习新技能）、Lesson 23（如果内存操作需要 OTel spans）或 Lesson 27（用于检索上的不受信任输入处理）。
