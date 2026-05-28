---
name: skill-rag-pipeline
description: 第一原理からRAGパイプラインを構築しデバッグする
version: 1.0.0
phase: 11
lesson: 6
tags: [rag, retrieval, embeddings, vector-search, llm-engineering]
---

# RAG Pipeline Pattern

すべてのRAGシステムはこのパターンに従います。

```
documents -> chunk -> embed -> store
query -> embed -> search(top_k) -> build_prompt -> generate
```

インデックス作成は文書ごとに一度行います。クエリ処理はユーザーリクエストごとに行います。

## RAGを使う場面

- LLMが非公開または最新の文書にアクセスする必要がある
- fine-tuningが高すぎる、または更新が遅すぎる
- 回答に出典を付ける必要がある
- ナレッジベースが頻繁に変わる

## RAGを使わない場面

- 答えがLLMの既存知識で十分な一般知識である
- タスクが事実回答ではなく創造的作業（執筆、ブレインストーミング）である
- 特定の推論スタイルをモデルに採用させたい（fine-tuningを使う）

## 実装チェックリスト

1. 文書を256-512トークン、50トークンoverlapのセグメントに分割する
2. 一貫したembedding modelで各チャンクを埋め込む
3. 埋め込みと元テキストをvector databaseに保存する
4. クエリ時に同じモデルでユーザー質問を埋め込む
5. cosine similarityで最も近いtop-k（5-10）チャンクを取得する
6. system instruction + retrieved context + user questionでプロンプトを作る
7. 検索コンテキストに基づいて回答を生成する
8. 出典参照とともに回答を返す

## よくある間違い

- インデックス時とクエリ時で異なるembedding modelを使う（ベクトルに互換性がない）
- チャンクが小さすぎる（文脈を失う）または大きすぎる（関連度が薄まる）
- チャンク間overlapを入れない（境界で文が分断される）
- 文書変更時に再インデックスし忘れる
- 一貫した回答を生成せず、取得チャンクをそのままユーザーに返す
- 事実RAGクエリでtemperature=0を設定しない（高温度ほどhallucinationが増える）

## 検索デバッグ

正しいチャンクが取得されない場合:

1. クエリ埋め込みを出力し、ゼロでないことを確認する
2. 既知の関連チャンクについてcosine similarityを手計算で確認する
3. 文書語彙に合わせてクエリを言い換える
4. インデックス時とクエリ時でembedding modelが一致しているか確認する
5. 関連内容がchunking中に失われていないか確認する

## 本番パラメータ

- Chunk size: 256-512 tokens
- Overlap: 50 tokens（チャンクサイズの10-20%）
- Top-k: 多くのユースケースで5-10
- Temperature: 事実回答では0
- Embedding model: text-embedding-3-small（費用対効果）またはtext-embedding-3-large（高精度）
