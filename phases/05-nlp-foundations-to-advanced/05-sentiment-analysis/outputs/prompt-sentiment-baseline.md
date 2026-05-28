---
name: sentiment-baseline
description: 新しいデータセット向けの感情分析ベースラインを設計します。
phase: 5
lesson: 05
---

データセットの説明 (ドメイン、言語、サイズ、ラベル粒度、レイテンシ予算) が与えられたら、次を出力します。

1. 特徴抽出レシピ。tokenizer、n-gram範囲、stopwordポリシー (通常は残す)、否定処理 (スコープ付きprefixまたはbigram) を指定します。
2. 分類器。ベースラインにはNaive Bayes、本番にはlogistic regression、transformerはドメインが皮肉、アスペクトベース出力、またはクロスリンガル対応を必要とする場合のみ使います。
3. 評価計画。precision、recall、F1、混同行列、クラス別エラー例を報告します。不均衡データでaccuracyだけを報告してはいけません。
4. デプロイ後に監視すべき失敗モードを1つ。domain driftと皮肉が上位2つです。週次のサンプル監査を提案します。

感情分析タスクでstopword削除を推奨することは拒否してください。クラスが不均衡な場合、accuracyを唯一の指標として報告することを拒否してください。サブワードの多い言語 (German、Finnish、Turkish) では、word-level TF-IDFよりFastTextまたはtransformer embeddingsが必要だと指摘してください。
