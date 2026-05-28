---
name: skill-advanced-rag
description: hybrid search、reranking、evaluationを使って本番級RAGを構築する
version: 1.0.0
phase: 11
lesson: 7
tags: [rag, hybrid-search, bm25, reranking, hyde, evaluation]
---

# Advanced RAG Pattern

Basic RAG: embed query -> vector search -> top-k -> generate.
Advanced RAG: embed query + BM25 -> fuse ranks -> rerank -> top-k -> generate.

```
query -> [vector search (top-50)] -+-> RRF fusion -> reranker (top-5) -> prompt -> LLM
                                   |
query -> [BM25 search (top-50)]  --+
```

## basic RAGからアップグレードする場面

- 検索品質がRecall@5で70%を下回る
- ユーザーが誤答や無関係な回答を報告している
- コーパスが100Kチャンクを超える
- クエリ語彙と文書語彙が違う
- multi-hop questionsが一貫して失敗する

## 実装チェックリスト

1. ベクトルインデックスと並行してBM25インデックスを追加する
2. 両方の検索を並列に実行する（各top-50）
3. Reciprocal Rank Fusion（k=60）で統合する
4. 上位候補をcross-encoderでrerankする
5. 最終プロンプト用にtop-5を取る
6. テストセットでfaithfulness evaluationを追加する

## 技術選択ガイド

- **Hybrid search**: 本番では常に使う。クエリ時の追加コストはほぼない。
- **Reranking**: Recall@50は良いがRecall@5が悪いときに使う。50-200msのレイテンシを追加する。
- **HyDE**: クエリが曖昧、または文書と語彙が違うときに使う。LLM呼び出しが1回増える。
- **Parent-child chunks**: 小チャンクでは文脈不足だが大チャンクでは関連度が薄まるときに使う。
- **Metadata filtering**: コーパスに明確なカテゴリ（日付、ソース種別、部署）があるときに使う。
- **Query decomposition**: 複数文書の情報を必要とするmulti-hop questionsに使う。

## よくある間違い

- BM25とvector searchで異なるチャンク集合を使う（同じコーパスを検索する必要がある）
- rerankingの候補プールが小さすぎる（top-10では少ない。top-50を使う）
- すべてのクエリにHyDEを追加する（語彙不一致がボトルネックのときだけ効く）
- 変更を評価しない（各技術の前後でRecall@kを測る）
- 失敗箇所を測る前にパイプラインを過剰設計する

## 評価ワークフロー

1. 既知の答えチャンクを持つ50件以上のテスト質問を作る
2. 各検索手法でRecall@5とRecall@10を測る
3. 検索が成功したクエリについて、生成回答のfaithfulnessを測る
4. コーパス成長に合わせてメトリクスを毎週追跡する
5. 技術を追加する前に個別失敗を調査する
