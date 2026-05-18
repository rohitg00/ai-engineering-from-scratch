---
name: codebase-rag
description: 构建跨仓库语义搜索系统，具备AST感知分块、混合检索、增量重索引和引用答案。
version: 1.0.0
phase: 19
lesson: 02
tags: [capstone, rag, code-search, tree-sitter, qdrant, bm25, hybrid-retrieval]
---

给定10个以上总计至少200万行代码的仓库，构建摄取管道、混合索引和强制引用的查询代理，以可验证的file:line锚点回答跨仓库问题。

构建计划：

1. 用tree-sitter解析每个文件。在函数和类节点边界分块。存储`{repo, path, start_line, end_line, symbol, body}`。
2. 使用Claude Haiku 4.5或Gemini 2.5 Flash及提示缓存系统提示为每个块生成摘要。将一句话摘要存储在块旁边。
3. 索引到三个结构：Qdrant（密集，Voyage-code-3或nomic-embed-code）、Tantivy（带字段权重的BM25）和kuzu（导入、调用、继承的符号图边）。
4. 构建LangGraph查询代理，包含三个节点：retrieve（密集并行BM25）、rerank（Cohere rerank-3或bge-reranker-v2-gemma-2b）、synth（Claude Sonnet 4.7，带提示缓存和file:line引用要求）。
5. 后过滤：拒绝任何没有可验证`(repo/path:start-end)`锚点的声明；重新询问或丢弃。
6. 连接git push webhook，计算符号级差异并仅重嵌入变更的块。目标：在200万行代码舰队上，50文件提交在60秒内可搜索。
7. 用100个问题保留集评估。报告MRR@10、nDCG@10、引用忠实度和延迟百分位数。
8. 运行每周漂移作业，重新执行评估并在MRR@10下降>5%时告警。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | 检索质量 | 100个问题保留集上的MRR@10和nDCG@10 |
| 20 | 引用忠实度 | 带可验证file:line锚点的答案声明比例 |
| 20 | 延迟和规模 | 索引语料库规模上10k QPS的p95查询延迟 |
| 20 | 增量索引正确性 | 50文件提交从git push到可搜索的时间 |
| 15 | UX和答案格式 | 引用可点击性、片段预览、跟进便利性 |

硬性拒绝：
- 固定大小token分块而非AST感知分块。会污染生成代码繁重的语料库。
- 没有BM25或rerank的仅余弦检索。已知在精确符号名查询上失败。
- 没有强制file:line引用的答案。
- 每次git push全量重嵌入；必须是增量式。

拒绝规则：
- 拒绝在未阅读许可证的情况下索引仓库。有些禁止在第三方向量存储中嵌入。
- 拒绝回答声称引用索引从未见过的文件的查询；始终在返回前验证锚点。
- 拒绝在p95高于4秒时提供答案；返回带跟进句柄的部分结果。

输出：包含摄取管道、LangGraph查询代理、100问题标记评估集、Langfuse仪表板链接的仓库，以及一份说明修复的三种检索失败模式（生成代码污染、长尾符号召回、跨仓库符号解析）及修复每个模式的确切变更的撰写。
