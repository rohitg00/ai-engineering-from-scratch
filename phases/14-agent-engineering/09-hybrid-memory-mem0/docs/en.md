# Hybrid Memory: Vector + Graph + KV (Mem0)

> Mem0 (Chhikara et al., 2025) は memory を 3 つの store の並列構成として扱います。Semantic similarity 用の vector、高速 fact lookup 用の KV、entity-relationship reasoning 用の graph です。Retrieval では scoring layer が 3 つを fusion します。これは 2026 年の external memory における production standard です。

**種別:** 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**所要時間:** 約75分

## Learning Objectives

- 単一 store (vector only, graph only, KV only) が agent memory に不十分な理由を説明する。
- Mem0 の 3 つの parallel stores と、それぞれが何を最適化するかを述べる。
- Mem0 の fusion scoring — relevance, importance, recency — と、それが hierarchy ではなく weighted sum である理由を説明する。
- `add()` が 3 store すべてへ write し、`search()` が結果を fuse する toy three-store memory を stdlib で実装する。

## 問題

1 つの store は、3 つの query class のうち 1 つで必ず間違います。

- **Semantic similarity** — 「先週 agent drift について何を議論したか」。Vector が勝ち、KV と graph は取り逃がします。
- **Fact lookup** — 「user の phone number は何か」。KV が勝ち、vector は無駄が多く、graph は overkill です。
- **Relationship reasoning** — 「同じ billing entity を共有する customer はどれか」。Graph が勝ち、vector と KV では答えられません。

Production agents は 1 session の中で 3 つすべてを発行します。Single-store memory は常にそのうち 2 つで間違います。Mem0 の貢献は、3 つすべてを single `add`/`search` surface の裏に配線し、scoring function で fusion することです。

## The Concept

### Three stores in parallel

Mem0 (arXiv:2504.19413, April 2025) は `add(text, user_id, metadata)` で次を行います。

1. Text から candidate facts を抽出する (LLM-driven step)。
2. 各 fact を vector store (embedding) へ書き、semantic search に使う。
3. 各 fact を (user_id, fact_type, entity) を key とする KV store に書き、O(1) lookup に使う。
4. 各 fact を graph store (Mem0g) に typed edges として書き、relationship queries に使う。

`search(query, user_id)` では次を行います。

1. Vector store が embedding cosine による top-k を返す。
2. KV store が query から導いた (user_id, type, entity) key の direct hits を返す。
3. Graph store が query entities から reachable な subgraph を返す。
4. Scoring layer が 3 つを fuse する。

### Fusion scoring

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **Relevance** — vector cosine、KV exact match、graph path weight。
- **Importance** — write 時に tag するか learned にする (name, ID, policy など一部の facts はより重要)。
- **Recency** — 最終 write または read からの経過時間に対する exponential decay。

Weights は product ごとに tune します。Chat agents では `w_recency` を高く、compliance agents では `w_importance` を高く、retrieval agents では `w_relevance` を高くします。

### Mem0g and temporal reasoning

Mem0g は conflict detector を追加します。新しい fact が既存 edge と矛盾する場合、既存 edge は delete されず invalid と mark されます。Temporal query (「3 月時点で user の city は何だったか」) は valid-at-time subgraph を traverse します。

これは Letta の invalidation pattern を compliance-grade にした behavior です。

### Benchmark numbers

Mem0 paper は 2025 年に次を報告しています。

- **LoCoMo** (long-form conversation memory): 91.6
- **LongMemEval** (long-horizon episodic memory): 93.4
- **BEAM 1M** (1M-token memory benchmark): 64.1

Comparison baselines (full-context 128k LLM, flat vector store, flat KV) はすべて 10+ points 差で負けています。Benchmark だけで選定は正当化できません。Operational shape が決め手です。ただし、この数字は fusion design が誤差ではないことを示しています。

### Scope taxonomy

Mem0 は memory を scope で分けます。

- **User memory** — session をまたいで persist し、`user_id` で key される。
- **Session memory** — 1 つの thread 内で persist する。
- **Agent memory** — agent instance ごとの state。

すべての write は scope を 1 つ選びます。Retrieval は per-scope weights で scope 横断 query ができます。考えずに scope を混ぜると、「assistant が Alice に Bob の project を話してしまう」incident が起きます。

### Where this pattern goes wrong

- **Embedding drift.** 最初の 100 queries では正しく見えた vector results が corpus growth とともに劣化します。Top-N-used records を periodic re-embedding します。
- **KV schema creep.** `(user_id, type, entity)` は simple に見えますが、team ごとに独自 `type` を追加し始めます。Type set を quarterly audit します。
- **Graph explosion.** Noisy extractor が 1 message あたり 50 edges を追加します。`add` call ごとの graph writes を cap し、low-confidence edges を drop します。

## 実装

`code/main.py` は 3-store pattern を stdlib で実装します。

- `VectorStore` — embedding の stand-in として naive token-overlap similarity を使う。
- `KVStore` — `(user_id, fact_type, entity)` を key とする dict。
- `GraphStore` — typed edges (subject, relation, object, valid)。
- `Mem0` — `add()`, `search()`, fusion scoring、scope-aware retrieval を持つ top-level facade。
- Multi-user, multi-session conversation に対する worked trace。

実行:

```
python3 code/main.py
```

Output は 3 つの separate recall paths と fused top-k を示します。`main()` 冒頭の scoring weights を変えると ranking がどう変わるかを見られます。

## Use It

- **Mem0 (Apache 2.0)** — production-ready。Postgres + Qdrant + Neo4j で self-host するか managed cloud を使う。
- **Letta** — 3-tier core/recall/archival。Vector backend と graph backend は持ち込む。
- **Zep** — temporal KG と fact extraction を持つ commercial alternative。
- **Custom builds** — extractor (compliance) や fusion weights (recency が支配的な voice agents) を厳密に制御したい場合。

## Ship It

`outputs/skill-hybrid-memory.md` は、fusion scorer、scope taxonomy、temporal invalidation を組み込んだ three-store memory scaffold を生成します。

## Exercises

1. Toy vector similarity を real embedding model (sentence-transformers, Ollama, OpenAI embeddings) に置き換える。Synthetic long conversation で recall@10 を測定する。1000 writes を超えると ranking は drift するか。
2. Temporal query `search(query, as_of=timestamp)` を追加する。その時刻以前に valid な records だけを返す。最も手間がかかる store はどれか。
3. Conflict detector を実装する。Incoming fact が graph edge と矛盾したら old edge を invalidate して両方を log する。「user lives in Berlin」->「user lives in Lisbon」で test する。
4. Fusion scorer に `user_feedback` dimension (retrieved records への thumbs-up) を追加する。Gaming (agent が既に好きな records だけを返す) をどう防ぐか。
5. Mem0 docs (`docs.mem0.ai`) を読む。Toy を `mem0` client calls に port する。同じ 20 test queries で retrieval quality を比較する。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hybrid memory | 「Vector plus graph plus KV」 | 3 つの stores に parallel write し retrieval で fuse する |
| Fact extraction | 「Memory ingestion」 | Text を (entity, relation, fact) tuples に分解する LLM step |
| Fusion scoring | 「Relevance ranking」 | Relevance, importance, recency の weighted sum |
| Scope | 「Memory namespace」 | user / session / agent。誰に何が見えるかを決める |
| Mem0g | 「Memory graph」 | Relationship queries 用の temporal validity を持つ typed edges |
| Temporal invalidation | 「Soft delete」 | 矛盾した edges を invalid と mark し、delete しない |
| Embedding drift | 「Retrieval rot」 | Corpus growth で vector quality が劣化する。Periodic re-embed で緩和する |

## 参考文献

- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) — original paper
- [Mem0 docs](https://docs.mem0.ai/platform/overview) — production API, SDKs, managed cloud
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) — virtual-context predecessor
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) — three-tier sibling design
