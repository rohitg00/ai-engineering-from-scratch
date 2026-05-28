# Capstone 02 — Codebase 上の RAG (Cross-Repo Semantic Search)

> 2026年の本気の engineering org は、文字列だけでなく意味を理解する internal code search を持っています。Sourcegraph Amp、Cursor の codebase answers、Augment の enterprise graph、Aider の repomap、Pinterest の internal MCP は同じ形です。多数の repo を ingest し、tree-sitter で parse し、function / class level chunk を embed し、hybrid-search し、re-rank し、citation 付きで回答します。この capstone では、10 repo にまたがる 2M lines of code を扱い、git push ごとの incremental re-indexing に耐えるものを作ります。

**種別:** Capstone
**言語:** Python (ingestion), TypeScript (API + UI)
**前提条件:** Phase 5 (NLP foundations), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure)
**Phases exercised:** P5 · P7 · P11 · P13 · P17
**所要時間:** 30時間

## 問題

2026年の frontier coding agent は codebase retrieval layer を備えています。context window だけでは cross-repo question は解けません。Claude の 1M-token context は助けになりますが、ranked retrieval の必要性は消えません。raw chunk への単純な cosine search は、generated code、monorepo duplication、ほとんど import されない symbol の long tail で結果を汚染します。production answer は、re-ranker と symbol reference graph を備えた AST-aware chunk 上の hybrid (dense + BM25) search です。

これを学ぶには、tutorial repo 1つではなく実際の fleet を index します。MRR@10、citation faithfulness、incremental freshness を測ります。failure mode は infrastructure 側にあります: 100k file の monorepo、半分の file を触る push、4 repo をまたがらないと正しく答えられない query です。

## コンセプト

AST-aware ingestion pipeline は各 file を tree-sitter で parse し、function と class node を抽出し、固定 token window ではなく node 境界で chunk 化します。各 chunk は3つの表現を持ちます: dense embedding (Voyage-code-3 または nomic-embed-code)、sparse BM25 terms、短い natural-language summary。summary は第3の retrieval modality です。user が「X はどう authorize されるか」と聞くと、code には `check_permission` しかなくても summary に "authz" が出ます。

retrieval は hybrid です。query は dense search と BM25 search の両方を発火し、top-k を merge し、その union を cross-encoder re-ranker (Cohere rerank-3 または bge-reranker-v2-gemma-2b) に渡します。re-ranked list は long-context synthesizer (prompt caching 付き Claude Sonnet 4.7、または self-hosted Llama 3.3 70B) に入り、各 claim を file と line range で cite するよう指示します。citation のない回答は post-filter で拒否します。

incremental freshness が infrastructure problem です。git push は diff を trigger します。どの file が変わったか、どの symbol が変わったか。影響を受けた chunk だけを re-embed します。影響を受けた cross-file symbol edge (imports, method calls) だけを再計算します。各 commit で 2M lines を再処理せず、index を一貫させます。

## Architecture

```
git push --> webhook --> ingest worker (LlamaIndex Workflow)
                           |
                           v
             tree-sitter parse + AST chunk
                           |
            +--------------+----------------+
            v              v                v
          dense        BM25 index       summary (LLM)
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      symbol graph (Neo4j / kuzu)
                            |
  query --> LangGraph agent (retrieve -> rerank -> synth)
                            |
                            v
                 Claude Sonnet 4.7 1M context
                            |
                            v
                 answer + file:line citations
```

## Stack

- Parsing: 17 language grammar (Python, TS, Rust, Go, Java, C++ など) を持つ tree-sitter
- Dense embeddings: Voyage-code-3 (hosted) または nomic-embed-code-v1.5 (self-host)、fallback は bge-code-v1
- Sparse index: Tantivy (Rust) with BM25F、symbol name と body に field weight
- Vector DB: Qdrant 1.12 with hybrid search、または 50M vectors 未満の team なら pgvector + pgvectorscale
- Chunk summary model: Claude Haiku 4.5 または Gemini 2.5 Flash、prompt-cached
- Re-ranker: Cohere rerank-3 または self-hosted bge-reranker-v2-gemma-2b
- Orchestration: ingestion は LlamaIndex Workflows、query agent は LangGraph
- Synthesizer: prompt caching 付き Claude Sonnet 4.7 (1M context)
- Symbol graph: import / call edge 用の Neo4j (managed) または kuzu (embedded)
- Observability: retrieval + synthesis step ごとの Langfuse spans

## 実装

1. **Ingestion walker.** push hook ごとに git history を walk し、changed files を集めます。各 file を tree-sitter で parse し、function / class node と full source span を抽出します。chunk record `{repo, path, start_line, end_line, symbol, body}` を emit します。

2. **Chunk summarizer.** system preamble を prompt caching し、chunk を Haiku 4.5 call に batch します。Prompt: "Summarize this function in one sentence, naming its public contract and side effects." summary を chunk と並べて保存します。

3. **Embedding pool.** 2つの parallel queue を作ります: dense (Voyage-code-3 batch 128) と summary (同じ model で summary string を embed)。payload `{repo, path, start_line, end_line, symbol, kind}` とともに vector を Qdrant に書きます。

4. **BM25 index.** field-weighted Tantivy index を作ります。symbol name weight 4、symbol body weight 1、summary weight 2。「X という名前の function」query と「X をする function」query の両方に対応します。

5. **Symbol graph.** 各 chunk について edge を記録します: imports (この file が repo Z の symbol Y を使う)、calls (この function が class C の method M を呼ぶ)、inheritance。kuzu に保存します。query 時には repo boundary を越えて retrieval を expand するのに使います。

6. **Query agent.** LangGraph に3つの node を置きます。`retrieve` は dense + BM25 を parallel に発火し、(repo, path, symbol) で deduplicate します。`rerank` は top-50 に cross-encoder を走らせ top-10 を残します。`synth` は reranked chunks を context に入れて Claude Sonnet 4.7 を呼び、system prompt を cache し、file:line citation を要求します。

7. **Citation enforcement.** model output を parse し、`(repo/path:start-end)` anchor のない claim を re-ask または drop 対象として flag します。user には cited-only answer を返します。

8. **Incremental re-index.** 各 webhook で symbol-level diff を計算します。text が変わった chunk だけを re-embed します。import が変わった chunk の symbol edge だけを再計算します。測定目標: 2M-LOC fleet で50ファイル push を60秒未満で re-index。

9. **Eval.** gold file:line answer を持つ100問の cross-repo question を label します。MRR@10、nDCG@10、citation faithfulness (検証可能な anchor を持つ claim の割合)、p50/p99 latency を測ります。

## Use It

```
$ code-rag ask "how is S3 multipart abort wired into our retry budget?"
[retrieve]  12 chunks dense + 7 chunks bm25, 16 unique after dedup
[rerank]    top-5 kept (cohere rerank-3)
[synth]     claude-sonnet-4.7, cache hit rate 68%, 2.1s
answer:
  Multipart aborts are triggered by `AbortMultipartOnFail` in
  services/uploader/retry.go:122-148, which decrements the per-bucket
  retry budget defined in config/budgets.yaml:34-51 ...
  citations: [services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## Ship It

deliverable skill は `outputs/skill-codebase-rag.md` です。repo corpus を受け取り、ingestion pipeline、hybrid index、query agent を立ち上げ、cross-repo question に citation 付きで答えます。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Retrieval quality | 100問 held-out set の MRR@10 と nDCG@10 |
| 20 | Citation faithfulness | answer claim のうち検証可能な file:line anchor を持つ割合 |
| 20 | Latency and scale | indexed corpus size 上で 10k QPS 時の p95 query latency |
| 20 | Incremental indexing correctness | 50ファイル commit の git push から searchable までの時間 |
| 15 | UX and answer formatting | citation clickability、snippet previews、follow-up affordance |
| **100** | | |

## Exercises

1. Voyage-code-3 を self-hosted nomic-embed-code に差し替え、MRR@10 delta を測ります。re-ranking 有効時に gap が縮まるか報告します。

2. corpus に 20% の generated code (LLM-produced boilerplate) を注入して再評価します。retrieval poisoning を観察し、payload に "generated" flag を追加してその hit を down-weight します。

3. corpus size において Qdrant hybrid search と pgvector + pgvectorscale を benchmark します。batch size 1 の p99 を報告します。

4. sampling-based drift check を追加します。週次で100問 eval を再実行し、MRR@10 drop > 5% で alert します。

5. cross-language symbol resolution に拡張します。Python function が gRPC 経由で Go service を呼ぶケースを symbol graph で link します。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AST-aware chunking | 「Function-level splits」 | fixed token window ではなく tree-sitter node 境界で code を切ること |
| Hybrid search | 「Dense + sparse」 | BM25 と vector search を並列に走らせ、top-k を merge して rerank する |
| Cross-encoder rerank | 「Second-stage rank」 | (query, candidate) pair を一緒に score する model。cosine より正確 |
| Prompt caching | 「Cached system prompt」 | repeat prefix token を最大90% discount する2026 Claude / OpenAI feature |
| Symbol graph | 「Code graph」 | file と repo をまたぐ imports、calls、inheritance の edge |
| Citation faithfulness | 「Grounded answer rate」 | user が anchor を click し、参照 span を読んで claim を検証できる割合 |
| Incremental re-index | 「Push-to-search time」 | git push から changed symbols が query 可能になるまでの wall-clock |

## 参考文献

- [Sourcegraph Amp](https://ampcode.com) — production cross-repo code intelligence
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) — この capstone の reference deep-dive
- [Aider repo-map](https://aider.chat/docs/repomap.html) — tree-sitter ranked repo view
- [Augment Code enterprise graph](https://www.augmentcode.com) — commercial symbol-graph RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) — reference implementation
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) — Voyage-code-3 details
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) — cross-encoder reference
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) — internal-platform reference
