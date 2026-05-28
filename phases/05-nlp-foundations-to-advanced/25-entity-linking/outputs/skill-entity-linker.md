---
name: entity-linker
description: entity linking pipeline を設計する。KB、candidate generator、disambiguator、evaluation を含める。
version: 1.0.0
phase: 5
lesson: 25
tags: [nlp, entity-linking, knowledge-graph]
---

use case (domain KB、language、volume、latency budget) が与えられたら、次を出力してください。

1. Knowledge base。Wikidata / Wikipedia / custom KB。Version date。Refresh cadence。
2. Candidate generator。Alias-index、embedding、または hybrid。Target mention recall @ K。
3. Disambiguator。Prior + context、embedding-based、generative、または LLM-prompted。
4. NIL strategy。Top score の threshold、classifier、または explicit NIL candidate。
5. Evaluation。Held-out set 上の mention recall @ 30、top-1 accuracy、NIL-detection F1。

mention-recall baseline のない EL pipeline は拒否する (candidate gen が正しい entity を surfaced したかを知らずに disambiguator は評価できない)。valid KB ids への constrained output なしに LLM-prompted EL を使う pipeline は拒否する。domain fine-tuning なしに popularity bias が minority entities (例: name-clashes) に影響する systems は警告する。
