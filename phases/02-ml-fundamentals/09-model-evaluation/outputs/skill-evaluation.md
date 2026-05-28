---
name: skill-evaluation
description: 分類モデルと回帰モデルの評価戦略チェックリスト
version: 1.0.0
phase: 2
lesson: 9
tags: [evaluation, metrics, cross-validation, model-selection]
---

# モデル評価戦略

あらゆる ML モデルを正しく評価するためのチェックリストです。よくある評価ミスを避けるため、この順序に従ってください。

## Step 1: データを正しく分割する

- どの前処理（scaling、imputation、encoding）よりも先に分割する
- 分類タスクでは stratified split を使う
- 最後に一度だけ触れる test set を確保する
- 小さなデータセットでは、単一分割ではなく 5-fold または 10-fold cross-validation を使う
- 時系列では時間ベースの分割を使う（決して shuffle しない）

## Step 2: 適切な metric を選ぶ

### 分類

| 状況 | 使う metric | 理由 |
|-----------|----------------|-----|
| クラスが均衡しており、単純に比較したい | Accuracy | 解釈しやすく、クラスが同程度なら意味がある |
| False positive のコストが高い（スパムフィルタ、不正アラート） | Precision | フラグを立てたもののうち、実際に positive だった数を測る |
| False negative のコストが高い（がん検診、セキュリティ） | Recall | 実際の positive をどれだけ捕捉したかを測る |
| precision と recall のバランスが必要 | F1 Score | 調和平均で、極端な不均衡を罰する |
| threshold をまたいでモデルを比較したい | AUC-ROC | threshold に依存しないランキング品質 |
| imbalanced data | F1、AUC-ROC、または PR-AUC | 不均衡クラスでは accuracy が誤解を招く |

### 回帰

| 状況 | 使う metric | 理由 |
|-----------|----------------|-----|
| 標準的な回帰で、外れ値を許容できる | RMSE | target と同じ単位で、大きな誤差を強く罰する |
| 外れ値に頑健な評価 | MAE | すべての誤差を等しく扱い、外れ値に支配されない |
| 異なるスケールのモデルを比較する | R-squared | 正規化された 0-1 スケール（説明された分散の割合） |
| ビジネス上、金額での解釈が必要 | MAE or RMSE | 誤差の大きさとして直接解釈できる |

## Step 3: baseline を設定する

モデルを評価する前に、baseline performance を計算します。
- Classification: majority class predictor（常に最頻クラスを予測）
- Regression: training target の平均を常に予測
- これらの baseline を上回れないモデルは学習できていない

## Step 4: Cross-validate する

- 安定した推定のために K-fold（K=5 または K=10）を使う
- 分類では stratified K-fold を使う
- fold 全体の平均と標準偏差を報告する
- mean=0.85、std=0.02 のモデルは、mean=0.87、std=0.10 のモデルより信頼しやすい

## Step 5: モデルを統計的に比較する

- 有意性を確認せずに平均スコアが最も高いモデルを選ばない
- cross-validation folds に対して paired t-test を使う
- |t| < 2.78（K=5、df=4、p<0.05）の場合、差は偶然による可能性がある
- 性能差が有意でない場合は、より単純なモデルを検討する

## Step 6: よくあるミスを確認する

- Data leakage: test data の情報が training に流れ込んでいないか？（分割前の scaling、target 由来特徴量）
- Class imbalance: accuracy が minority class の低い性能を隠していないか？
- Overfitting: training performance と validation performance の差が大きくないか？
- Too many evaluations: test set を複数回見ていないか？

## Step 7: 最終性能を報告する

- train + validation を結合したデータで学習する
- hold-out test set でちょうど一度だけ評価する
- 可能であれば、選んだ metric を信頼区間付きで報告する
- baseline との比較（random/mean よりどれだけ良いか）を記載する
