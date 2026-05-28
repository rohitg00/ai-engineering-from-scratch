---
name: coref-picker
description: coreference approach、evaluation plan、integration strategy を選ぶ。
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

use case (single-doc / multi-doc、domain、language) が与えられたら、次を出力してください。

1. アプローチ。Rule-based / neural span-based / LLM-prompted / hybrid。1 文の理由。
2. モデル。neural の場合は名前つき checkpoint。
3. 統合。操作順: tokenize → NER → coref → downstream task。
4. 評価。held-out set 上の CoNLL F1 (MUC + B³ + CEAF-φ4 average) + 20 documents の manual cluster review。

sliding-window merge なしに 2,000 tokens を超える documents に対して LLM-only coref を使うことは拒否する。mention-level precision-recall report なしに coref を実行する pipeline は拒否する。demographically diverse text に deploy された gender-heuristic systems は警告する。
