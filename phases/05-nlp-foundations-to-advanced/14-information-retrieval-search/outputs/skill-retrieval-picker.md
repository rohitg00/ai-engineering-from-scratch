---
name: retrieval-picker
description: 与えられたコーパスとクエリパターンに合う検索スタックを選ぶ。
version: 1.0.0
phase: 5
lesson: 14
tags: [nlp, retrieval, rag, search]
---

要件 (コーパスサイズ、クエリパターン、レイテンシ予算、品質基準、インフラ制約) が与えられたら、次を出力する。

1. スタック。BM25のみ、denseのみ、hybrid (BM25 + dense + RRF)、hybrid + cross-encoder rerank、または3方式 (BM25 + dense + learned-sparse)。
2. Dense encoder。具体的なモデル名 (`all-MiniLM-L6-v2`, `bge-large-en-v1.5`, `e5-large-v2`, `paraphrase-multilingual-MiniLM-L12-v2`) を挙げる。言語、ドメイン、コンテキスト長に合わせる。
3. Reranker。使う場合はcross-encoderモデル名 (`cross-encoder/ms-marco-MiniLM-L-6-v2`, `BAAI/bge-reranker-large`) を挙げる。top-30に約30-100msの追加レイテンシが生じることを明記する。
4. 評価計画。Recall@10を主要なretrieverメトリクスにする。複数答えにはMRR。まずベースラインを作り、増分改善をそれと比較して測る。

固有表現、エラーコード、製品SKUを含むコーパスでは、denseが完全一致を扱える証拠がない限り、dense-onlyの推奨を拒否する。法務や医療のように最終top-5がユーザーの答えを決める高リスク検索では、rerankingの省略を拒否する。
