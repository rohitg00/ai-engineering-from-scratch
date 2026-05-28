---
name: embedding-picker
description: 与えられたコーパスとデプロイ条件に対して、embedding model、次元、retrieval mode を選ぶ。
version: 1.0.0
phase: 5
lesson: 22
tags: [nlp, embeddings, retrieval]
---

コーパス（サイズ、言語、ドメイン、平均長）、デプロイ先（cloud / edge / on-prem）、latency budget、storage budget が与えられたら、次を出力してください。

1. モデル。名前つき checkpoint または API。1 文の理由。
2. 次元。Full / Matryoshka-truncated / int8-quantized。ストレージ予算に結びついた理由。
3. モード。Dense / sparse / multi-vector / hybrid。理由。
4. model card で必要とされる場合の query prefix / template。
5. 評価計画。ドメインに関連する MTEB tasks + nDCG@10 を使ったホールドアウトの domain eval。

ドメイン検証なしに Matryoshka を <64 dims へ切り詰める推奨は拒否する。10k passages 未満のコーパスに ColBERTv2 を推奨することは拒否する (overhead に見合わない)。長文コーパス (>8k tokens) が 512-token windows のモデルに送られている場合は警告する。
