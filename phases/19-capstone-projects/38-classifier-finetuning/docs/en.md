# Capstone Lesson 38: Head Swap による Classifier Fine-Tuning

> pretrained language model は token prediction head で終わります。spam/ham 分類には head が違うため、body を再利用し、2-class classifier head に差し替えます。

**種別:** Build
**言語:** Python (torch, numpy)
**前提条件:** Phase 19 lessons 30-37
**所要時間:** 約90分

## 学習目標
- language-model head を classification head に置き換える。
- body frozen の head-only training と full fine-tuning を同じ loop で実装する。
- padding、attention mask、mean pooling を含む分類用 data pipeline を作る。
- precision、recall、F1、confusion matrix を logits から計算する。
- parameter count、学習時間、性能の trade-off を読む。

## 問題設定
pretrained body は単語の性質や位置、共起をすでに表現しています。800件の SMS だけで transformer をゼロから学習するのは無駄です。まず head を2クラス線形層に交換し、body を凍結するか、全体を fine-tune するかを比較します。

head-only は速く省メモリで小データに強い一方、domain drift が大きいと限界があります。full fine-tuning は遅く過学習しやすい反面、十分な downstream data があれば高い性能を狙えます。

## pooling
分類には sequence 全体を表す1本のベクトルが必要です。このレッスンでは attention mask で pad を除外した mean pooling を使います。padding hidden state を単純平均に入れると、短い文ほど pooled vector が壊れやすくなります。

## データと評価
`main.py` が balanced な synthetic SMS fixture を決定的に生成します。split は 80/20 で stratified です。positive class は spam で、precision、recall、F1、2x2 confusion matrix を表示します。

## 実装
`ByteTokenizer`、`LMBody`、`MeanPool`、`Classifier`、`freeze_body`、`unfreeze_body`、`train_classifier`、`evaluate`、`run_demo` を実装します。デモは body を短く LM pretrain し、head-only と full fine-tuning を同じ条件で比較します。
