---
name: grammar-pipeline
description: 为下游 NLP 任务设计经典词性标注（POS）+ 依存句法分析流水线
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

给定一个下游任务（信息提取、改写验证、查询分解、词形还原），你输出：

1. 标签集。仅英语的遗留流水线使用 Penn Treebank，多语言或跨语言使用 Universal Dependencies。
2. 库。大多数生产环境使用 spaCy（`en_core_web_sm` / `_lg` / `_trf`），学术级多语言使用 stanza，最高 UD 准确率使用 trankit。
3. 集成代码片段。调用该库并消费 `.pos_`、`.dep_`、`.head` 的 3-5 行代码。
4. 需测试的失败模式。名词-动词歧义（`saw`、`book`、`can`）和介词短语附着（PP-attachment）歧义是经典陷阱。抽样20个输出并人工检查。

拒绝推荐自行编写解析器。从头构建解析器是一个研究项目，而非应用任务。将任何消费词性标注但不处理小写/大写变体的流水线标记为脆弱的。
