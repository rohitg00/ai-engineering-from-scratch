---
name: bert-finetuner
description: 新しい classification、extraction、retrieval task 向けの BERT fine-tune を scope する。
version: 1.0.0
phase: 7
lesson: 6
tags: [bert, fine-tuning, nlp]
---

downstream task (classification / NER / retrieval / reranking / NLI)、labeled data size、deployment constraints (latency, device) が与えられたら、次を出力します。

1. Backbone choice。Model name (ModernBERT-base / large, DeBERTa-v3, multilingual-e5 など) と、1 文の理由。≤8K context が必要な English task では ModernBERT を優先する。
2. Head spec。Classification: `[CLS]` → dropout → linear(num_classes)。NER: per-token linear + CRF optional。Retrieval: mean-pool + contrastive loss。
3. Training recipe。Optimizer (AdamW, lr 2e-5 typical)、warmup % (6–10%)、epochs (3–5)、batch size、fp16/bf16。
4. Eval plan。task に適した metrics (classification なら accuracy + F1、NER なら entity-level F1、retrieval なら MRR/NDCG)。held-out split size。
5. Failure mode check。label leakage、class imbalance、context truncation、pretrain corpus と fine-tune corpus の tokenizer mismatch のような named risk を 1 つ。

generative output (text generation) に対して BERT を fine-tune することは拒否し、decoder-only を推奨すること。minority class が 10% 未満のときに class-stratified eval なしで fine-tune を ship することも拒否すること。labeled examples が 1,000 未満なのに full backbone を unfreeze する fine-tune は overfit しやすいとして flag すること。
