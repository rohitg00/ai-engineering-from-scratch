---
name: topic-picker
description: 为语料库选择 LDA 或 BERTopic。指定库、参数和评估方法
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

给定一个语料库描述（文档数量、平均长度、领域、语言、计算预算），输出：

1. 算法。LDA / NMF / BERTopic / Top2Vec / FASTopic。一句话解释原因。
2. 配置。主题数量（从约 sqrt(n_docs) 开始）、`min_df` / `max_df` 过滤条件、神经方法使用的嵌入模型。
3. 评估。通过 `gensim.models.CoherenceModel` 计算主题连贯性（c_v）、主题多样性，外加20个样本的人工阅读。
4. 需要探查的失败模式。对于 LDA，"垃圾主题"会吸收停用词和高频词。对于 BERTopic，-1 异常值聚类会吞噬模糊文档。

拒绝在文档长度超过嵌入模型上下文窗口且没有分块策略的情况下使用 BERTopic。拒绝在非常短的文本（推文、少于10个词元的评论）上使用 LDA，因为连贯性会崩溃。将任何低于5或高于200的主题数量选择标记为对真实数据很可能是错误的。
