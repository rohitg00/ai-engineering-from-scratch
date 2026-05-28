---
name: dst-designer
description: Dialogue state tracker を設計する。schema、extractor、update policy、evaluation を含める。
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

ユースケース（domain、languages、vocab openness、compliance needs）が与えられたら、次を出力する。

1. Schema. domain list、domain ごとの slots、slot ごとの open vs closed vocabulary。
2. Extractor. Rule-based / seq2seq / LLM-with-Pydantic。理由も示す。
3. Update policy. Regenerate-whole-state / incremental、correction handling、negation handling。
4. Evaluation. held-out dialogue set 上の Joint Goal Accuracy、slot-level precision/recall、最も難しい slot の confusion。
5. Confirmation flow. ユーザーに明示的な確認を求める条件（destructive actions、low-confidence extractions）。

compliance-sensitive slots に対して rule-based secondary check なしの LLM-only DST は拒否する。user correction で slot を roll back できない DST は拒否する。version tags のない schema は警告する。
