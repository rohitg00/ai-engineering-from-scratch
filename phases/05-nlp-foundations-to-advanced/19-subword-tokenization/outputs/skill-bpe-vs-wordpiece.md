---
name: skill-bpe-vs-wordpiece
description: 与えられたコーパスとデプロイ対象に対して、トークナイザのアルゴリズム、語彙サイズ、ライブラリを選ぶ。
version: 1.0.0
phase: 5
lesson: 19
tags: [nlp, tokenization]
---

コーパス（サイズ、言語、ドメイン）とデプロイ対象（スクラッチからの学習 / fine-tuning / API互換推論）が与えられたら、次を出力してください。

1. アルゴリズム。BPE, Unigram, WordPieceのいずれか。理由を1文で述べる。
2. ライブラリ。SentencePiece, HF Tokenizers, tiktokenのいずれか。理由も述べる。
3. 語彙サイズ。最も近い1k単位に丸める。モデルサイズと言語カバレッジに結びつけて理由を述べる。
4. カバレッジ設定。`character_coverage`, `byte_fallback`, special tokenの一覧。
5. 検証計画。held-out setでの平均tokens-per-word、OOV率、圧縮率、round-trip decodeの一致。

レアな文字体系を含むコーパスに対して、character-coverage <0.995 のトークナイザを学習することは拒否してください。CIで凍結済み `tokenizer.json` ハッシュチェックがない語彙の出荷は拒否してください。単一言語トークナイザで語彙が16k未満なら、仕様不足の可能性が高いと警告してください。
