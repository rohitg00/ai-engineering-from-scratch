---
name: bert-finetuner
description: 为新的分类、提取或检索任务确定 BERT 微调范围。
version: 1.0.0
phase: 7
lesson: 6
tags: [bert, fine-tuning, nlp]
---

给定一个下游任务（分类 / NER / 检索 / 重排序 / NLI）、标注数据大小和部署约束（延迟、设备），输出：

1. 骨干选择。模型名称（ModernBERT-base / large、DeBERTa-v3、multilingual-e5 等），一句话说明原因。对于需要 ≤8K 上下文的英语任务，优先使用 ModernBERT。
2. 头部规范。分类：`[CLS]` → dropout → linear(num_classes)。NER：逐 token linear + 可选 CRF。检索：mean-pool + 对比损失。
3. 训练配方。优化器（AdamW，典型 lr 2e-5）、预热 %（6–10%）、epoch（3–5）、批次大小、fp16/bf16。
4. 评估计划。任务适当的指标（分类的 accuracy + F1、NER 的 entity-level F1、检索的 MRR/NDCG）。保留集大小。
5. 故障模式检查。一个命名风险：标签泄漏、类别不平衡、上下文截断、预训练和微调语料库之间的分词器不匹配。

拒绝在生成输出（文本生成）上微调 BERT——推荐仅解码器模型。拒绝在少数类别低于 10% 时没有类别分层评估的情况下交付微调。标记任何在 <1,000 标注示例下解冻完整骨干的微调为过拟合。
