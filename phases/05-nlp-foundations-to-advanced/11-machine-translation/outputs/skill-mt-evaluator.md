---
name: mt-evaluator
description: 出荷前に機械翻訳出力を評価する。
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

原文テキストと翻訳候補が与えられたら、次を出力する:

1. 自動スコアの推定。期待される BLEU と chrF の範囲。参照訳が利用可能かどうかを明記する。
2. 人間が検証できる 5 点チェックリスト: 内容保持 (hallucination なし)、正しい target language、register / formality の一致、glossary が提供されている場合は用語の一貫性、truncation や length explosion がないこと。
3. 調べるべきドメイン固有の問題を 1 つ。法律: named entities、statute citations。医療: drug names、dosages。UI: `{name}` のような placeholder variables。
4. 信頼度フラグ。"Ship" / "Ship with review" / "Do not ship"。見つかった問題の深刻度に結び付ける。

出力に対する language-ID check なしで出荷してはならない。ユーザーが reference-free scoring (COMET-QE, BLEURT-QE) を明示的に選択しない限り、参照訳なしで評価してはならない。1000 tokens を超えるコンテンツは chunked translation が必要になりやすいものとして flag する。
