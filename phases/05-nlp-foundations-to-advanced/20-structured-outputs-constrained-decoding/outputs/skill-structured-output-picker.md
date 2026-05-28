---
name: structured-output-picker
description: 構造化出力の方式、スキーマ設計、検証計画を選ぶ。
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

ユースケース（プロバイダ、レイテンシ予算、スキーマの複雑さ、失敗許容度）が与えられたら、次を出力してください。

1. 仕組み。ベンダーのネイティブstructured output、Instructor retries、Outlines FSM、XGrammar CFGのいずれか。理由を1文で述べる。
2. スキーマ設計。フィールド順序（reasoningを先、answerを最後）、`"unknown"` に対するnullable fields、enum vs regex、required fields。
3. 失敗戦略。最大リトライ数、fallback model、自然な `null` handling、out-of-distribution refusal。
4. 検証計画。schema compliance rate（target 100%）、semantic validity（LLM-judge）、field-coverage rate、latency p50/p99。

`answer` または `decision` をreasoning fieldsより前に置く設計は拒否してください。スキーマなしのbare JSON modeの使用は拒否してください。FSM-only libraryで再帰スキーマを扱おうとしている場合は警告してください。
