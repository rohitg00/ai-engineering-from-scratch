---
name: retrieval-picker
description: 为给定的语料库和查询模式选择检索栈
version: 1.0.0
phase: 5
lesson: 14
tags: [nlp, retrieval, rag, search]
---

给定需求（语料库规模、查询模式、延迟预算、质量门槛、基础设施约束），输出：

1. 技术栈。仅 BM25、仅稠密检索、混合（BM25 + 稠密 + RRF）、混合 + 交叉编码器重排序、或三路组合（BM25 + 稠密 + 学习型稀疏）。
2. 稠密编码器。指明具体模型（`all-MiniLM-L6-v2`、`bge-large-en-v1.5`、`e5-large-v2`、`paraphrase-multilingual-MiniLM-L12-v2`）。匹配语言、领域和上下文长度。
3. 重排序器。如果使用交叉编码器模型，指明名称（`cross-encoder/ms-marco-MiniLM-L-6-v2`、`BAAI/bge-reranker-large`）。标记在前30名结果上增加的约30-100毫秒延迟。
4. 评估计划。Recall@10 是检索器的主要指标。多答案场景使用 MRR。先建立基线，然后测量增量改进。

拒绝为包含命名实体、错误代码或产品 SKU 的语料库推荐仅稠密检索，除非用户有证据表明稠密检索能处理精确匹配。拒绝为高风险检索（法律、医疗）跳过重排序，因为最终的前5名结果决定了用户的答案。
