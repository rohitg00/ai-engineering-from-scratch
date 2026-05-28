# ColPali and Vision-Native Document RAG

> Traditional RAG は PDFs を text に parse し、chunks に分割し、chunks を embed し、vectors を保存する。各stepで signal が失われる。OCR は chart data を落とし、chunking は table rows を壊し、text embeddings は figures を無視する。ColPali (Faysse et al., 2024年7月) はもっと単純な問いを立てた。そもそもなぜ text を抽出するのか。Page image を PaliGemma で直接 embed し、retrieval には ColBERT-style late interaction を使い、document が持つ layout、figures、fonts、formatting signal を保つ。公開benchmarksでは、visually-rich documents で text-RAG より end-to-end accuracy が20-40%高い。ColQwen2、ColSmol、VisRAG がこのpatternを拡張した。このレッスンでは vision-native RAG の主張を読み、小さな ColPali-like indexer を作る。

**種別:** 構築
**言語:** Python (stdlib、multi-vector indexer + MaxSim scorer)
**前提条件:** Phase 11 (LLM Engineering — RAG basics)、Phase 12 · 05 (LLaVA)
**所要時間:** 約180分

## 学習目標

- Bi-encoder retrieval (documentあたり1 vector) と late-interaction retrieval (documentあたり多vector) の違いを説明する。
- ColBERT の MaxSim operation と、ColPali がそれを text tokens から image patches へ一般化する方法を説明する。
- Tiny ColPali-like indexer を作る: page → patch embeddings → query-term embeddings 上の MaxSim → top-k pages。
- Invoices / financial reports の use case で ColPali + Qwen2.5-VL generator と text-RAG + GPT-4 を比較する。

## 問題

PDF に対する Text-RAG は document の大半を捨てる。Financial report の Q3 revenue growth はたいてい chart にあり、medical report の findings は annotated images にあり、legal contract の signature block は text fact ではなく layout fact である。

Text-RAG pipeline:

1. PDF → OCR / pdftotext による text。
2. Text → 300-500 token chunks。
3. Chunk → bi-encoder embedding (one vector)。
4. User query → embedding → cosine similarity → top-k chunks。
5. Chunks + query → LLM。

5つの lossy steps。Charts は捕まらない。Tables は chunks にまたがって壊れる。Multi-column layout は flat になる。Figure annotations は消える。

ColPali の fix は、OCR を skip して page image を直接 embed することだ。Retrieval では ColBERT-style late interaction を使い、query time に model が fine-grained patches を見ることができる。

## 概念

### ColBERT (2020)

ColBERT (Khattab & Zaharia, arXiv:2004.12832) は text retrieval method である。Documentあたり1 vector ではなく、tokenあたり1 vector を作る。Query time では:

- Query tokens はそれぞれ embeddings を持つ (N_q vectors)。
- Document tokens も embeddings を持つ (N_d vectors、通常は cached)。
- Score = query token ごとに document tokens 上の cosine similarity 最大値を取り、それを合計する: Σ_i max_j cos(q_i, d_j)。

これが MaxSim operation である。各 query token が最も近い document token を「選ぶ」。Final score はその合計。

Pros: recall が強く、term-level semantics を扱える。Cons: documentあたり N_d vectors が必要で、storage が高い。

### ColPali

ColPali (Faysse et al., arXiv:2407.01449) は ColBERT pattern を images に適用する。

- 各 page は PaliGemma (ViT + language) で patch embeddings に encode される: pageあたり N_p vectors。
- User query (text) は query-token embeddings に encode される: N_q vectors。
- Score = Σ_i max_j cos(q_i, p_j)。つまり query-text-tokens と page-image-patches 上の MaxSim。
- Total score で top-k pages を retrieve する。

Document ingestion 時: すべてのpageを PaliGemma で embed し、すべての patch embeddings を保存する。Query time: query tokens を embed し、保存された page embeddings 全体に MaxSim を計算し、top-k pages を返す。

Pros: visually rich documents では end-to-end で text-RAG を20-40%上回る。各 patch-vector が local layout と content を捉える。

Cons: pageあたり N_p patches × 4-byte floats × D-dim vectors で storage がすぐ増える。PQ / OPQ quantization で緩和する。

### ColQwen2 and ColSmol

ColQwen2 (illuin-tech, 2024-2025) は PaliGemma を Qwen2-VL に置き換える。より良い base encoder により retrieval quality が上がる。

ColSmol は local / edge use 向けの小規模variantである。約1B paramsの ColSmol retriever は consumer GPU で動く。

### VisRAG

VisRAG (Yu et al., arXiv:2410.10594) は別variantだ。Patches上の MaxSim ではなく、VLM で各pageを single vector に pool して bi-encoder retrieve する。Indexing は速く、storage は小さいが、recall は弱い。

Quality-vs-cost trade-off: quality なら ColPali、scale なら VisRAG。

### M3DocRAG

M3DocRAG (Cho et al., arXiv:2411.04952) は multi-modal retrieval を multi-page multi-document reasoning に拡張する。Documents 間で pages を retrieve し、VLM 向けに multi-page context を組み立てる。

### ViDoRe — the benchmark

ColPali の companion benchmark。Visual Document Retrieval Evaluation。Tasks は financial reports、scientific papers、administrative documents、medical records、manuals。Metric は nDCG@5。

ColPali-v1 は ViDoRe で約80% nDCG@5。同じ documents 上の text-RAG は約50-60%。

### The end-to-end RAG pipeline

Vision-native RAG:

1. Ingest: PDF → page images → PaliGemma encoding → all patch embeddings を保存。
2. Query: user text → query-token embeddings → indexed pages 全体への MaxSim → top-k pages。
3. Generate: top-k page images + query → VLM (Qwen2.5-VL or Claude) → answer。

OCR はどこにもない。Figures、charts、fonts、layout がすべて answer へ流れる。

### Storage math

729 patches/page、128-dim embeddings の50-page financial report:

- ColPali: 50 * 729 * 128 * 4 bytes = raw 約18 MB、PQ後約4 MB。
- Text-RAG: 50 chunks * 768-dim * 4 bytes = 約150 kB。

ColPali は documentあたり約30xの storage を使う。Scale では OPQ / PQ により約5-10xまで下げられ、通常は許容範囲に入る。

### When text-RAG still wins

- Layout signal がない pure-text documents (wiki articles, chat logs)。Text-RAG の方が単純で storage が安い。
- Storage cost が支配的な multi-million-page archives。
- Retrieval と並行して extractable OCR text を要求する厳格な regulatory requirements。

2026年のそれ以外、financial reports、scientific papers、legal contracts、medical records、UX documentation では vision-native RAG が勝つ。

## 使ってみる

`code/main.py`:

- Toy patch encoder: "page" (small grid of feature vectors) を patch embeddings の array に map する。
- MaxSim scorer: query token embedding set と page patch set の間で ColBERT-style score を計算する。
- 5つの toy pages を index し、3 queries を走らせ、top-k と scores を返す。

## 仕上げ

このレッスンは `outputs/skill-vision-rag-designer.md` を作る。Document-RAG project が与えられたら、ColPali / ColQwen2 / VisRAG / text-RAG を選び、storage を見積もる。

## 演習

1. 200-page annual report、pageあたり729 patches、128-dim emb、4-byte floats。Raw storage と PQ-compressed (8x) storage を計算せよ。

2. MaxSim は Σ_i max_j cos(q_i, p_j)。これは simple mean similarity では捉えられない何を捉えるか。

3. ColPali は pages を patch sets として index する。代わりに ColBERT のように word level で index すると何が変わるか。Trade-offs は何か。

4. 1M-page corpus、queryあたり500ms latency budget の end-to-end pipeline を設計せよ。ColQwen2 / VisRAG を選び、正当化せよ。

5. M3DocRAG (arXiv:2411.04952) を読め。Multi-page attention pattern と、それが single-page ColPali retrieval とどう違うかを説明せよ。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Late interaction | "ColBERT-style" | Single doc vector ではなく、per-token / per-patch embeddings + MaxSim を使う retrieval |
| MaxSim | "Max-over-patches" | 各 query token について最も similarity が高い document token を選び、query全体で合計する |
| Bi-encoder | "Single-vector" | Documentあたり1 vector。速いが granularity を失う |
| Multi-vector | "Many-vectors-per-doc" | Document / page あたり N_p vectors を保存する。storage cost は増えるが recall が上がる |
| Patch embedding | "Page feature" | VLM encoder からの image patch あたり1 vector。pageごとにcacheする |
| ViDoRe | "Vision doc bench" | Visual document retrieval の ColPali benchmark suite |
| PQ quantization | "Product quantization" | Vector similarity を保ちながら storage を約8x縮小する compression |

## 参考文献

- [Faysse et al. — ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia — ColBERT (arXiv:2004.12832)](https://arxiv.org/abs/2004.12832)
- [Yu et al. — VisRAG (arXiv:2410.10594)](https://arxiv.org/abs/2410.10594)
- [Cho et al. — M3DocRAG (arXiv:2411.04952)](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
