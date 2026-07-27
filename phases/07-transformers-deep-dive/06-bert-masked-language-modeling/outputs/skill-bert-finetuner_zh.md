---
name: bert-finetuner
description: 为新的分类、提取或检索任务确定BERT微调范围
version: 1.0.0
phase: 7
lesson: 6
tags: [bert, fine-tuning, nlp]
---

给定一个下游任务（分类 / NER / 检索 / 重排序 / NLI）、标注数据大小和部署约束（延迟、设备），输出：

1. **主干网络选择**。模型名称（ModernBERT-base / large、DeBERTa-v3、multilingual-e5等）并附一句话理由。对于需要≤8K上下文的英文任务，优先选择ModernBERT。

2. **头部规格**。分类：`[CLS]` → dropout → linear(num_classes)。NER：每token线性层 + 可选的CRF。检索：均值池化 + 对比学习损失。

3. **训练方案**。优化器（AdamW，典型学习率2e-5）、预热比例（6–10%）、训练轮数（3–5）、批次大小、fp16/bf16。

4. **评估计划**。任务适切的指标（分类用accuracy + F1、NER用实体级F1、检索用MRR/NDCG）。保留集大小。

5. **失败模式检查**。一个命名的风险：标签泄露、类别不平衡、上下文截断、预训练与微调语料之间的tokenizer不匹配。

拒绝在生成式输出（文本生成）上微调BERT——建议改用仅解码器模型。拒绝在少数类低于10%时，不进行按类别分层评估就交付微调模型。标记任何在标注样本不足1000条时就解冻整个骨干网络的微调方案，认为其可能过拟合。
