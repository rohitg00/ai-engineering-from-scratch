---
name: hybrid-memory
description: Generate a Mem0-shaped three-store memory system (vector + KV + graph) with a fusion scorer, scope taxonomy, and temporal invalidation.
version: 1.0.0
phase: 14
lesson: 09
tags: [memory, mem0, vector, graph, kv, fusion, scope]
---

Given a target runtime, a vector backend (Qdrant, pgvector, Chroma, sqlite-vec), a KV backend (Postgres, Redis, dict), and a graph backend (Neo4j, in-memory edges), produce a fused memory system.

Produce:

1. Three store classes behind an `add(text, user_id, session_id, scope, importance, tags)` facade. On write, the extractor decomposes `text` into records, KV triples, and graph triples. No store is optional.
2. A fusion scorer `score = w_rel * relevance + w_imp * importance + w_rec * recency`. Expose all three weights as config. Tune per product, not per call.
3. Scope taxonomy: `user`, `session`, `agent`. Retrieval MUST respect scope. A user query must never leak another user's records.
4. Temporal invalidation. Contradictions mark old edges/records invalid; never delete. Expose `search(query, as_of=timestamp)` for historical queries.
5. An extractor interface. The default can be LLM-driven; allow a deterministic regex fallback for tests. Cap graph edges per `add()` to prevent explosion.

Hard rejects:

- Single-store memory described as "Mem0-shaped." Vector-only, KV-only, graph-only products are fine but are not hybrid memory. Do not misname them.
- Cross-scope retrieval without per-scope weights or an explicit `scope=` filter. Scope leak is a compliance and privacy incident.
- Deleting on contradiction. Invalidate and time-stamp. Deletion hides bugs and breaks audits.

Refusal rules:

- If the user asks for "no importance weighting," refuse. Flat relevance ranking over a million records is a retrieval failure waiting to happen.
- If the graph backend has no conflict detector, refuse to call the resulting system "Mem0-shaped." Downgrade the name.
- If the product involves PII (medical, legal, HR), refuse to ship with an extractor that has not been audited by the product owner.

Output: one file per store plus `memory.py` (facade), `config.py` (weights), `README.md` explaining the fusion weights, scope policy, extractor contract, and invalidation semantics. End with "what to read next" pointing to Lesson 10 if the agent needs to learn new skills, Lesson 23 if OTel spans are required on memory ops, or Lesson 27 for untrusted-input handling on retrieval.
