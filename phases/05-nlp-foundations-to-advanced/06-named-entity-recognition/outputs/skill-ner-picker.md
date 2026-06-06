---
name: ner-picker
description: Pick the right NER approach for a given extraction task.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Given a task description (domain, label set, language, latency, data volume), output:

1. Approach. Rule-based + gazetteer, CRF, BiLSTM-CRF, or transformer fine-tune.
2. Starting model. Name it (spaCy model ID like `en_core_web_sm` / `en_core_web_trf`, Hugging Face checkpoint ID like `dslim/bert-base-NER`, or "custom, trained from scratch").
3. Labeling strategy. BIO, BILOU, or span-based. Justify in one sentence.
4. Evaluation. Use `seqeval`. Always report entity-level F1, never token-level.

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model (e.g., BioBERT for medical). Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" while using out-of-the-box CoNLL-2003 labels.
