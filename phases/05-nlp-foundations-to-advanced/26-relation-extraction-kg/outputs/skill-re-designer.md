---
name: re-designer
description: provenance と canonicalization を備えた relation extraction pipeline を設計する。
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

corpus (domain、language、volume) と downstream use (KG-RAG、analytics、compliance) が与えられたら、次を出力してください。

1. Extractor。Pattern-based / supervised / LLM / AEVS hybrid。precision vs recall target に結びついた理由。
2. Ontology。Closed property list (Wikidata / domain)、または canonicalization pass 付きの open IE。
3. Provenance。すべての triple が source char-span + doc id を持つ。audit では譲れない条件。
4. Merge strategy。Canonical entity id + relation id + temporal qualifiers。dedup policy。
5. Evaluation。200 hand-labelled triples 上の precision / recall + LLM-extracted sample の hallucination-rate。

span verification (source provenance) のない LLM-based RE pipeline は拒否する。canonicalization なしに open-IE output を production graph へ流す設計は拒否する。time-bounded relations (employer、spouse、position) に temporal qualifier がない pipeline は警告する。
