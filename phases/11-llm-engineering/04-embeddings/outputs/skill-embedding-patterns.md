---
name: skill-embedding-patterns
description: embeddings、vector search、similarity の本番パターン
version: 1.0.0
phase: 11
lesson: 4
tags: [embeddings, vectors, similarity, search, chunking, quantization]
---

# Embedding パターン

すべての embedding workflow はこの契約に従います。

```
text -> embed(text) -> vector (float array)
similarity(vector_a, vector_b) -> score (float)
```

重要な判断は embedding model と similarity metric の 2 つだけです。それ以外は配管です。

## embeddings を使う場面

- 文書横断の semantic search (キーワードではなく意味で探す)
- 類似 item の clustering (support tickets、product reviews、bug reports)
- nearest neighbors による classification (ラベル付き例との類似度で新規 item に label 付け)
- recommendation systems (ユーザーが好んだものに似た items を探す)
- deduplication (similarity threshold で near-duplicate content を探す)

## embeddings を使わない場面

- 厳密な keyword matching (full-text search を使う)
- structured queries (SQL、filters を使う)
- 手作業ラベル付けのほうが速い小規模データセット (<100 items)
- accuracy より explainability が重要なタスク (embeddings は不透明)

## モデル選択

制約に基づいて選びます。

- **API が必要で最高の value**: OpenAI text-embedding-3-small (1536d, $0.02/1M tokens)
- **最大 accuracy が必要**: Voyage-3 (1024d, $0.06/1M tokens, highest MTEB)
- **local/private が必要**: BGE-M3 (1024d, free, multilingual, GPU recommended)
- **高速 local prototyping が必要**: all-MiniLM-L6-v2 (384d, free, runs on CPU)
- **multilingual が必要**: Cohere embed-v3 (1024d) または BGE-M3 (どちらも multilingual に強い)

ルール: indexing と querying で embedding models を混ぜないでください。異なるモデルの vectors は互換性のない空間にあります。

## Chunking ルール

1. chunk あたり 256-512 tokens、50-token overlap を目標にする
2. 可能なら文の途中で分割しない
3. すべての chunk に metadata (source file、section title、position) を含める
4. structured docs (Markdown、HTML) では、まず heading boundaries で分割する
5. 既知の答えを検索し retrieval を確認して chunk quality をテストする

## Similarity metric 選択

- **Cosine similarity**: デフォルト選択。可変長テキストを扱いやすく、normalized vectors と相性がよい
- **Dot product**: vectors が unit-normalized 済みのときに使う (OpenAI models はそうです)。少し高速
- **Euclidean distance**: clustering や absolute position が重要な場合に使う

vectors が normalized されている場合、3 つは同じ ranking を与えます。選択が重要になるのは non-normalized vectors の場合だけです。

## Storage 最適化

3 段階の圧縮があり、重ねて使えます。

1. **Matryoshka truncation**: dimensions を減らす (1536 -> 256 = 6x savings、3-5% accuracy loss)
2. **Float16 quantization**: dimension あたりの storage を半減する (2x savings、<1% accuracy loss)
3. **Binary quantization**: 1 bit per dimension (32x savings、5-10% accuracy loss、rescoring と併用)

本番パターン: full corpus では binary search を行い、top-1000 を float32 vectors で rescore します。

## Retrieve-then-rerank

最高 accuracy のための 2 段階 pipeline です。

1. Bi-encoder が top-100 candidates を取得する (高速、pre-computed embeddings を使用)
2. Cross-encoder が top-10 に rerank する (低速、各 query-doc pair を処理)

これは precision metrics で single-stage retrieval を 10-15% 上回ります。latency より accuracy が重要な場合に使います。

## よくある間違い

- indexing と querying で異なる embedding models を使う
- documents 全体を chunks ではなく丸ごと embed する (embedding が全体の平均になってしまう)
- cosine similarity の前に vectors を normalize しない (多くのモデルは事前 normalize するが確認する)
- chunk overlap を無視する (境界で文が分断されると文脈が失われる)
- original text なしで vectors だけ保存する (retrieval には両方必要)
- model 変更時に re-embedding しない (古い vectors は互換性がない)
- accuracy だけで dimensions を選ぶ (storage と latency は dimensions に線形比例する)

## embeddings のデバッグ

検索結果が悪い場合:

1. query embedding が non-zero か確認する (空または whitespace input は zero vectors になる)
2. 既知の relevant document の similarity score を手動で確認する
3. document vocabulary に合うよう query を言い換えてみる
4. relevant content が chunks をまたいで分断されていないか chunk boundaries を確認する
5. metrics (cosine、dot、euclidean) 間で top-k results を比較し normalization issues を見つける
6. 自明に一致する query (document から 1 文をコピー) で pipeline が動くことを確認する

## 本番パラメータ

- Chunk size: 256-512 tokens
- Chunk overlap: 50 tokens (chunk size の 10-20%)
- Top-k retrieval: 直接利用なら 5-10、reranking なら 50-100
- Similarity threshold: cosine で 0.7+ (これ未満は通常 irrelevant)
- Batch embedding: throughput のため API call あたり 100-500 texts を処理する
- Index rebuild: model 変更時または documents が大きく更新された時に re-embed する
