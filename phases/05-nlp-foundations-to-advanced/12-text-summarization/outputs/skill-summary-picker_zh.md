---
name: summary-picker
description: 选择抽取式或生成式摘要，指明库名称，添加事实性检查
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

给定一个任务（文档类型、合规要求、长度、计算预算），输出：

1. 方法。抽取式或生成式。用一句话解释原因。
2. 起始模型/库。指明名称。`sumy.TextRankSummarizer`、`facebook/bart-large-cnn`、`google/pegasus-pubmed` 或 LLM 提示。
3. 评估计划。ROUGE-1、ROUGE-2、ROUGE-L（使用带词干提取的 `rouge-score`）。如果是生成式摘要，额外进行事实性检查。
4. 一个需要探查的失败模式。实体交换在生成式新闻摘要中最常见；标记那些源文档实体未出现在摘要中的样本。

拒绝为医疗、法律、金融或受监管内容使用生成式摘要而不设置事实性检查门控。将输入超过模型上下文窗口的情况标记为需要使用分块 map-reduce 摘要策略，而非仅仅截断。
