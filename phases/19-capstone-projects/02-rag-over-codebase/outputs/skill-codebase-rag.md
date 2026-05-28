---
name: codebase-rag
description: AST-aware chunking、hybrid retrieval、incremental re-index、citation 付き回答を備えた cross-repo semantic search system を構築する。
version: 1.0.0
phase: 19
lesson: 02
tags: [capstone, rag, code-search, tree-sitter, qdrant, bm25, hybrid-retrieval]
---

合計200万行以上のコードを含む10以上のリポジトリを対象に、ingestion pipeline、hybrid index、citation を必須にする query agent を構築し、cross-repo question に検証可能な file:line anchor 付きで答える。

構築計画:

1. すべてのファイルを tree-sitter で parse する。function と class の node 境界で chunk 化し、`{repo, path, start_line, end_line, symbol, body}` を保存する。
2. prompt-cached system prompt を使い、Claude Haiku 4.5 または Gemini 2.5 Flash で各 chunk を要約する。1文 summary を chunk と一緒に保存する。
3. 3つの構造へ index する: Qdrant (dense, Voyage-code-3 または nomic-embed-code)、Tantivy (field weights 付き BM25)、kuzu (imports, calls, inheritance の symbol graph edge)。
4. 3 node の LangGraph query agent を構築する: retrieve (dense と BM25 を並列)、rerank (Cohere rerank-3 または bge-reranker-v2-gemma-2b)、synth (prompt caching と file:line citation requirement 付き Claude Sonnet 4.7)。
5. post-filter: 検証可能な `(repo/path:start-end)` anchor のない claim を拒否し、再質問または削除する。
6. symbol-level diff を計算し、変更された chunk だけを re-embed する git push webhook を配線する。目標: 200万 LOC fleet の50ファイル commit を60秒未満で検索可能にする。
7. 100問の held-out set で評価し、MRR@10、nDCG@10、citation faithfulness、latency percentile を報告する。
8. eval を再実行し、MRR@10 が 5% を超えて低下したら alert する weekly drift job を走らせる。

評価 rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Retrieval quality | 100問 held-out set での MRR@10 と nDCG@10 |
| 20 | Citation faithfulness | 回答 claim のうち、検証可能な file:line anchor を持つ割合 |
| 20 | Latency and scale | indexed corpus size 上で 10k QPS 時の p95 query latency |
| 20 | Incremental indexing correctness | 50ファイル commit の git push から検索可能になるまでの時間 |
| 15 | UX and answer formatting | citation の clickability、snippet preview、follow-up affordance |

ハードリジェクト:

- AST-aware chunking ではなく fixed-size token chunking を使うこと。generated-code-heavy corpus を汚染する。
- BM25 または rerank のない cosine-only retrieval。exact-symbol-name query で失敗することが分かっている。
- mandatory file:line citation のない回答。
- git push ごとに full-corpus re-embedding すること。incremental でなければならない。

拒否ルール:

- license を読まずに repo を index することを拒否する。一部は第三者 vector store への embedding を禁じている。
- index が見ていない file を cite していると主張する query には回答しない。返す前に必ず anchor を検証する。
- p95 が4秒を超える回答提供を拒否する。代わりに partial result と follow-up handle を返す。

出力: ingestion pipeline、LangGraph query agent、100問 labeled eval set、Langfuse dashboard link、修正した3つの retrieval failure mode (generated-code poisoning、long-tail symbol recall、cross-repo symbol resolution) と、それぞれを直した具体的変更を記した write-up を含むリポジトリ。
