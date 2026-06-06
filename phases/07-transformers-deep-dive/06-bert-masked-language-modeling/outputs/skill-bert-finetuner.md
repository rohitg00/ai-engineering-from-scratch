---
name: bert-finetuner
description: Scope a BERT fine-tune for a new classification, extraction, or retrieval task.
version: 1.0.0
phase: 7
lesson: 6
tags: [bert, fine-tuning, nlp]
---

Given a downstream task (classification / NER / retrieval / reranking / NLI), labeled data size, and deployment constraints (latency, device), output:

1. Backbone choice. Model name (ModernBERT-base / large, DeBERTa-v3, multilingual-e5, etc.) with a one-sentence reason. Prefer ModernBERT for English tasks requiring ≤8K context.
2. Head spec. Classification: `[CLS]` → dropout → linear(num_classes). NER: per-token linear + CRF optional. Retrieval: mean-pool + contrastive loss.
3. Training recipe. Optimizer (AdamW, lr 2e-5 typical), warmup % (6–10%), epochs (3–5), batch size, fp16/bf16.
4. Eval plan. Task-appropriate metrics (accuracy + F1 for classification, entity-level F1 for NER, MRR/NDCG for retrieval). Held-out split size.
5. Failure mode check. One named risk: label leakage, class imbalance, context truncation, tokenizer mismatch between pretrain and fine-tune corpora.

Refuse to fine-tune a BERT on generative output (text generation) — recommend a decoder-only instead. Refuse to ship a fine-tune without class-stratified eval when the minority class is below 10%. Flag any fine-tune that unfreezes the full backbone with <1,000 labeled examples as likely overfit.
