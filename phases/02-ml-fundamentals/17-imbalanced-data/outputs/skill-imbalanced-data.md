---
name: skill-imbalanced-data
description: Decision checklist for handling imbalanced classification problems
version: 1.0.0
phase: 2
lesson: 17
tags: [imbalanced-data, smote, class-weights, threshold-tuning, evaluation]
---

# Imbalanced Data Strategy

不均衡分類に対処するための判断チェックリストです。この順序に従って、問題に合った手法を選んでください。

## Step 1: 不均衡の程度を測る

- クラスごとのサンプル数を数える
- 不均衡比（majority / minority）を計算する
- 軽度: ratio < 3:1（例: 70/30）
- 中程度: ratio 3:1 to 20:1（例: 95/5）
- 重度: ratio > 20:1（例: 99/1）

## Step 2: 適切な指標を選ぶ

不均衡データセットでは、accuracy より precision/recall/F1 を優先します。問題に応じて選んでください。

| 状況 | 主要指標 | 補助指標 |
|-----------|---------------|-----------------|
| positive の見逃しが非常に高コスト（fraud, disease） | Recall | F2 score |
| 誤警報が高コスト（spam filter, recommendations） | Precision | F0.5 score |
| 両方がほぼ同じくらい重要 | F1 score | MCC |
| 単一のランキング指標が必要 | AUPRC | AUC-ROC |
| データセット間で比較したい | MCC | AUPRC |

## Step 3: リバランス戦略を選ぶ

### 不均衡の深刻さ別

| 不均衡 | 最初に試す | 次に試す | 避ける |
|-----------|-----------|------------|-------|
| 軽度 (< 3:1) | Class weights | Threshold tuning | Oversampling（不要） |
| 中程度 (3:1 to 20:1) | SMOTE + class weights | さらに threshold tuning | Undersampling（データ損失が大きすぎる） |
| 重度 (> 20:1) | SMOTE + class weights + threshold | balanced bagging の ensemble | Undersampling 単独 |

### データセットサイズ別

| Dataset Size | 推奨戦略 | 理由 |
|-------------|-------------------|--------|
| < 1,000 samples | Oversampling または SMOTE | majority data を失う余裕がない |
| 1,000 - 10,000 | SMOTE + threshold tuning | k-NN に十分な minority samples がある |
| > 10,000 | Class weights または undersampling | 高速で、minority data も十分ある |

## Step 4: 手法を適用する

### Class weights（常に最初に試す）
- sklearn では `class_weight='balanced'`
- データ変更は不要
- loss ベースの任意のモデルで使える
- 期待値として oversampling と等価

### SMOTE
- training data のみに適用する（test/validation には絶対に適用しない）
- k=5 neighbors を使う（デフォルト）
- 最良の結果を得るには class weights と組み合わせる
- 境界付近のノイズの多い合成点に注意する

### Threshold tuning
- モデルを学習し、validation set で予測確率を得る
- 0.05 から 0.95 までしきい値を走査する
- 選んだ指標を最大化するしきい値を選ぶ
- 必ず validation data で調整し、test data では調整しない

## Step 5: 正しく検証する

- stratified cross-validation を使う（各 fold のクラス比を保つ）
- 元の（リサンプリングしていない）test set で指標を報告する
- 分割前に SMOTE を適用しない。training folds のみに適用する
- 「常に majority を予測する」ベースラインと比較する

## Step 6: 避けるべきよくある間違い

- train/test split の前にデータセット全体へ SMOTE を適用する（data leakage）
- 評価指標として accuracy を使う
- class weights を最初に試さない（最も単純で、十分なことも多い）
- oversampling してから cross-validation する（合成点が folds 間で漏れる）
- threshold tuning を無視する（再学習なしで得られる性能改善）
- 小さなデータセットで random undersampling を使う（データを捨てすぎる）

## Quick Decision Tree

1. imbalance ratio < 3:1 か？ -> class weights のみを試す
2. dataset > 10,000 samples か？ -> class weights + threshold tuning
3. dataset < 1,000 samples か？ -> SMOTE + class weights
4. それ以外 -> SMOTE + class weights + threshold tuning
5. まだ十分でない？ -> Balanced bagging ensemble
