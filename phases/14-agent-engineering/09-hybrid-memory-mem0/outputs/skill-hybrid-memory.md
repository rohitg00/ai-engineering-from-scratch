---
name: hybrid-memory
description: Fusion scorer、scope taxonomy、temporal invalidation を持つ Mem0 形 three-store memory system (vector + KV + graph) を生成する。
version: 1.0.0
phase: 14
lesson: 09
tags: [memory, mem0, vector, graph, kv, fusion, scope]
---

Target runtime、vector backend (Qdrant, pgvector, Chroma, sqlite-vec)、KV backend (Postgres, Redis, dict)、graph backend (Neo4j, in-memory edges) が与えられたら、fused memory system を生成する。

生成するもの:

1. `add(text, user_id, session_id, scope, importance, tags)` facade の背後にある 3 つの store classes。Write 時、extractor は `text` を records、KV triples、graph triples に分解する。任意省略できる store はない。
2. Fusion scorer `score = w_rel * relevance + w_imp * importance + w_rec * recency`。3 つの weights はすべて config として expose する。Per call ではなく product ごとに tune する。
3. Scope taxonomy: `user`, `session`, `agent`。Retrieval は必ず scope を尊重する。User query が別 user の records を leak してはならない。
4. Temporal invalidation。Contradictions は old edges/records を invalid と mark し、delete しない。Historical queries 用に `search(query, as_of=timestamp)` を expose する。
5. Extractor interface。Default は LLM-driven でよいが、test 用に deterministic regex fallback を許可する。Graph explosion を防ぐため `add()` ごとの graph edges 数を cap する。

Hard rejects:

- Single-store memory を "Mem0-shaped" と説明すること。Vector-only、KV-only、graph-only products は問題ないが hybrid memory ではない。誤命名しない。
- Per-scope weights または明示的な `scope=` filter なしの cross-scope retrieval。Scope leak は compliance と privacy incident。
- Contradiction で delete すること。Invalidate して timestamp を付ける。Deletion は bug を隠し audit を壊す。

Refusal rules:

- User が「importance weighting なし」と依頼した場合は拒否する。Million records 上の flat relevance ranking は将来の retrieval failure。
- Graph backend に conflict detector がない場合、その system を "Mem0-shaped" と呼ぶことを拒否する。Name を downgrade する。
- Product が PII (medical, legal, HR) を扱う場合、product owner に audit されていない extractor で ship することを拒否する。

Output: store ごとに 1 file、`memory.py` (facade)、`config.py` (weights)、fusion weights、scope policy、extractor contract、invalidation semantics を説明する `README.md`。最後に、agent が new skills を学ぶ必要があるなら Lesson 10、memory ops に OTel spans が必要なら Lesson 23、retrieval の untrusted-input handling は Lesson 27 への "what to read next" で締める。
