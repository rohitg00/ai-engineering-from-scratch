---
name: skill-embeddings-picker
description: 为新的语言模型或文本流水线选择分词方法
version: 1.0.0
phase: 5
lesson: 04
tags: [nlp, tokenization, embeddings]
---

给定一个任务和数据集描述，你输出：

1. 分词策略（词级、BPE、WordPiece、SentencePiece、字节级 BPE）。一句话解释原因。
2. 词汇表大小目标。仅英语语言模型：32k。多语言：64k-100k。代码：50k-100k。
3. 包含确切训练命令的库调用。指明库名称（Hugging Face `tokenizers`、`sentencepiece`）。引用参数。
4. 一个可重复性陷阱。分词器-模型不匹配是最常见的静默生产错误。指明哪些分词器与哪些预训练检查点配对，并警告不要互换。

如果用户是在微调预训练 LLM，拒绝推荐训练自定义分词器（微调必须使用预训练的分词器）。拒绝为任何生产推理路径推荐词级分词。将非英语或多脚本语料库标记为需要使用带字节回退的 SentencePiece。
