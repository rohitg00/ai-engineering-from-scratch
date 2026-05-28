---
name: skill-embeddings-picker
description: 新しい言語モデルまたはテキストパイプライン向けに、tokenization手法を選びます。
version: 1.0.0
phase: 5
lesson: 04
tags: [nlp, tokenization, embeddings]
---

タスクとデータセットの説明が与えられたら、次を出力します。

1. Tokenization戦略 (word-level、BPE、WordPiece、SentencePiece、byte-level BPE)。理由を1文で述べます。
2. 語彙サイズの目標。英語のみのLM: 32k。多言語: 64k-100k。コード: 50k-100k。
3. 正確な学習コマンドを含むライブラリ呼び出し。ライブラリ名 (Hugging Face `tokenizers`、`sentencepiece`) を明記し、引数を引用します。
4. 再現性に関する落とし穴を1つ。tokenizerとモデルの不一致は、最もよくある静かな本番バグです。どのtokenizerがどの事前学習済みチェックポイントと対応するかを明記し、差し替えないよう警告します。

ユーザーが事前学習済みLLMをfine-tuningしている場合は、カスタムtokenizerの学習を勧めることを拒否してください (fine-tuneでは事前学習済みtokenizerを使う必要があります)。本番推論パスでword-level tokenizationを勧めることを拒否してください。英語以外または複数文字体系のコーパスには、byte fallback付きSentencePieceが必要であると指摘してください。
