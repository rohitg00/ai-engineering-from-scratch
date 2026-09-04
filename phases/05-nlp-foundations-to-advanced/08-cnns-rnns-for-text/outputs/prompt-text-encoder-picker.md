---
name: text-encoder-picker
description: Pick a text encoder architecture for a given constraint set.
phase: 5
lesson: 08
---

Given constraints (task, data volume, latency budget, deploy target, compute budget), output:

1. Encoder architecture: TextCNN, BiLSTM, BiLSTM-CRF, transformer fine-tune, or "pretrained transformer as frozen encoder + small head".
2. Embedding input: random init, GloVe or fastText frozen, or contextualized transformer embeddings.
3. Training recipe in 5 lines: optimizer, learning rate, batch size, epochs, regularization.
4. One monitoring signal. RNN/CNN models: check per-sequence-length accuracy for long-dependency failures. Transformer fine-tunes: watch for fine-tuning collapse if LR too high; check train loss within first 100 steps.

Refuse to recommend fine-tuning a transformer when the user has under ~500 labeled examples without first showing a TextCNN / BiLSTM baseline has plateaued. Flag edge deployment (phone, microcontroller, browser) as needing architecture decisions before everything else.
