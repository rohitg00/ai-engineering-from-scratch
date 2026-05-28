---
name: text-encoder-picker
description: 与えられた制約セットに合わせてテキストエンコーダのアーキテクチャを選ぶ。
phase: 5
lesson: 08
---

制約 (タスク、データ量、レイテンシ予算、配布先、計算予算) が与えられたら、次を出力する。

1. エンコーダアーキテクチャ: TextCNN、BiLSTM、BiLSTM-CRF、Transformer fine-tune、または「事前学習済みTransformerを凍結エンコーダとして使い、小さなヘッドを載せる」。
2. 埋め込み入力: ランダム初期化、凍結したGloVeまたはfastText、または文脈化Transformer埋め込み。
3. 5行の訓練レシピ: optimizer、learning rate、batch size、epochs、regularization。
4. 監視シグナルを1つ。RNN/CNNモデルでは、長距離依存の失敗を検出するため系列長ごとの精度を見る。Transformer fine-tuneでは、learning rateが高すぎる場合のfine-tuning collapseに注意し、最初の100ステップ以内のtrain lossを確認する。

ラベル付き例が約500件未満のとき、TextCNN / BiLSTMベースラインが頭打ちになったことを示さずにTransformerのfine-tuningを推奨してはいけない。エッジ配布 (スマートフォン、マイクロコントローラ、ブラウザ) では、何より先にアーキテクチャ判断が必要だと指摘する。
