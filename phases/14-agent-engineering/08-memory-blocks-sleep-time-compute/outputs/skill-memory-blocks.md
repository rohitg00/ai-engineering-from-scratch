---
name: memory-blocks
description: Critical path 外の sleep-time consolidation agent を持つ、Letta 形の 3-tier memory system (core blocks, recall, archival) を生成する。
version: 1.0.0
phase: 14
lesson: 08
tags: [memory, letta, blocks, sleep-time, consolidation]
---

Target runtime、primary model、(より強い可能性のある) sleep-time model が与えられたら、明示的な block types と async consolidation を持つ 3-tier memory system を生成する。

生成するもの:

1. `label`, `value`, `limit`, `description`, `version`, `history` を持つ `Block` type。すべての write は version を上げ、old value を記録する。`near_limit(threshold=0.8)` を expose する。
2. 少なくとも 3 つの default blocks を持つ `BlockStore`: `human` (user に関する facts)、`persona` (agent self-concept)、`task` (current scope)。User-defined blocks を許可する。
3. `Recall` store — session ごとに paginate される turn log。すべての turn を auto-write する。Tail は cap で evict されるが retrieve 可能なままにする。
4. `Archival` store — 少なくとも 2 backends (vector, KV)。Insert は record id を返す。Contradiction では delete ではなく invalidate する。
5. Turn を処理し raw writes だけを発行する `PrimaryAgent`。User-facing turn の critical path で summarization は行わない。
6. Turn 間で走る `SleepTimeAgent`: threshold 超過 block の summarize、contradicted archival records の invalidate、shared blocks への `learned_context` write を行う。

Hard rejects:

- Direct lookup 以外の memory op を user-facing turn 中に同期実行すること。Summarization、consolidation、invalidation は sleep-time pass の仕事。
- Contradiction で archival records を delete すること。History が auditable に残るよう invalidate する。
- Review step なしに Persona または Safety block へ書くこと。これらの block は behavior 全体を shaping するため、silent writes は bug を隠す。

Refusal rules:

- Runtime が session をまたいで blocks を persist できない場合、「memory」として product を ship することを拒否する。Claim を downgrade する。
- Sleep-time agent に trace output がない場合は拒否する。Silent consolidation は debugging dead-zone。
- User が「invalidation なしで常に latest write を信じる」と依頼した場合、historical claims が重要な domain (compliance, medical, legal) では拒否する。

Output: component ごとに 1 file と、default blocks、sleep-time cadence、contradiction resolution policy を説明する `README.md`。最後に、agent が memory 上の graph reasoning を必要とするなら Lesson 09、memory ops に OTel spans が必要なら Lesson 23 への "what to read next" で締める。
