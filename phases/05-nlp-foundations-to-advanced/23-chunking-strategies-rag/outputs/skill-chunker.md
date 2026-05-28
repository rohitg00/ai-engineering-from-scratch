---
name: chunker
description: 与えられたコーパスと query distribution に対して、chunking strategy、size、overlap を選ぶ。
version: 1.0.0
phase: 5
lesson: 23
tags: [nlp, rag, chunking]
---

コーパス (document types、avg length、domain) と query distribution (factoid / analytical / multi-hop) が与えられたら、次を出力してください。

1. 戦略。Recursive / sentence / semantic / parent-document / late / contextual。理由。
2. Chunk size。Token count。query type に結びついた理由。
3. Overlap。デフォルト 0。>0 の場合は正当化する。
4. Min/max enforcement。`min_tokens`、`max_tokens` guards。
5. 評価計画。50-query stratified eval set (factoid、analytical、multi-hop) 上の Recall@5。

min/max chunk size enforcement のない chunking strategy は拒否する。効果があることを示す ablation なしに 20% を超える overlap は拒否する。min-token floor のない semantic chunking recommendations は警告する。
