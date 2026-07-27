---
name: ner-picker
description: 为给定的提取任务选择正确的命名实体识别（NER）方法
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

给定一个任务描述（领域、标签集、语言、延迟、数据量），输出：

1. 方法。基于规则 + 地名词典、CRF、BiLSTM-CRF 或 Transformer 微调。
2. 起始模型。指明名称（spaCy 模型 ID 如 `en_core_web_sm` / `en_core_web_trf`，Hugging Face 检查点 ID 如 `dslim/bert-base-NER`，或"从头训练的定制模型"）。
3. 标注策略。BIO、BILOU 或基于跨度（span-based）。用一句话说明理由。
4. 评估。使用 `seqeval`。始终报告实体级 F1，从不报告词元级。

拒绝在标注示例不足500条时推荐微调 Transformer，除非用户已有预训练领域模型（例如用于医学的 BioBERT）。将嵌套实体标记为需要使用基于跨度或多遍模型。如果用户在"生产规模"下使用开箱即用的 CoNLL-2003 标签，要求进行地名词典审计。
