---
name: skill-bpe-vs-wordpiece
description: 为给定的语料库和部署目标选择分词器算法、词汇量大小和库
version: 1.0.0
phase: 5
lesson: 19
tags: [nlp, tokenization]
---

给定一个语料库（规模、语言、领域）和部署目标（从头训练 / 微调 / API 兼容推理），输出：

1. 算法。BPE、Unigram 或 WordPiece。一句话解释原因。
2. 库。SentencePiece、HF Tokenizers 或 tiktoken。说明理由。
3. 词汇量大小。四舍五入到最接近的1k。理由与模型规模和语言覆盖相关。
4. 覆盖设置。`character_coverage`、`byte_fallback`、特殊词元列表。
5. 验证计划。在保留集上的平均每词词元数、未登录词率、压缩比、往返解码一致性。

拒绝在含有稀有文字内容的语料库上训练字符覆盖率小于0.995的分词器。拒绝在没有 CI 中冻结 `tokenizer.json` 哈希检查的情况下发布词汇表。将任何低于16k词汇量的单语言分词器标记为可能欠规格。
