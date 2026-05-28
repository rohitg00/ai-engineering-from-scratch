---
name: skill-feature-selector
description: Quick reference decision tree for choosing the right feature selection method
version: 1.0.0
phase: 2
lesson: 18
tags: [feature-selection, mutual-information, rfe, lasso, tree-importance]
---

# Feature Selection Strategy

適切な feature selection 手法を選んで適用するためのクイックリファレンスです。

## Step 1: クリーンアップから始める

どの手法を適用する前にも、明らかに役に立たない特徴量を削除します。

- **Constant features**: variance = 0。削除する。
- **Near-constant features**: variance < 0.01（または自分の threshold）。削除する。
- **Duplicate features**: 同一の列。1 つだけ残し、残りを削除する。
- **ID columns**: 行ごとに一意で、一般化可能な情報を持たない。削除する。

これには数秒しかかからず、雑な実データセットでは 10-30% の特徴量を削除できることがあります。

## Step 2: 状況に応じて手法を選ぶ

### Quick Decision Tree

1. **< 50 features?** mutual information ranking から始める。top K を残す。
2. **50 - 500 features?** まず variance threshold を使い、linear model なら L1 (Lasso)、trees なら tree importance を使う。
3. **> 500 features?** 手法を連鎖させる: variance threshold -> mutual information filter (top 50%) -> 残った特徴量に RFE。
4. **解釈性が必要か？** L1 regularization は正確な zero/nonzero を与える。Tree importance は順位付きスコアを与える。
5. **非線形関係を捉える必要があるか？** Mutual information または tree-based importance。L1 は避ける（linear only）。
6. **特徴量相互作用が必要か？** RFE または tree-based importance。Filter methods は相互作用を見逃す。

### Method Reference

| Method | 使う場面 | 避ける場面 |
|--------|------------|---------------|
| Variance threshold | 常に、最初のステップとして | 省略しない |
| Mutual information | 高速なランキング、非線形関係 | 特徴量相互作用の検出が必要なとき |
| RFE | 丁寧な選択、中程度の特徴量数 | 非常に高コストなモデル、> 1000 features |
| L1 / Lasso | Linear models、高速な embedded selection | 非線形問題、強く相関した特徴量 |
| Tree importance | 非線形関係、特徴量相互作用 | high-cardinality features によるバイアスがある |
| Permutation importance | model-agnostic validation、最終確認 | 初期スクリーニングには遅すぎる |

## Step 3: 選択結果を検証する

- selected features と all features でモデル性能を比較する
- 単一の train/test split ではなく cross-validation を使う
- 性能が 1-2% 以上低下した場合、有用な特徴量を削除した可能性がある
- 性能が向上した場合、ノイズをうまく削除できている

## Step 4: よくある落とし穴に対処する

### 相関した特徴量
- L1 は相関したグループから任意に 1 つを選び、残りを zero にする
- まず correlation matrix を計算し、どの相関特徴量を残すか決める
- Tree importance は相関特徴量に importance を分散させる

### Data leakage
- feature selection は training data のみに fit する
- 同じ selection を test data に適用する
- cross-validation では、feature selection は各 fold の内側で行う必要がある

### Feature selection への過学習
- 反復回数が多すぎる RFE は training set に過学習することがある
- selection に使ったデータではなく、held-out data で検証する
- よりロバストな結果には stability selection（subsamples で繰り返す）を使う

## Step 5: 本番チェックリスト

- [ ] Variance threshold を最初の filter として適用した
- [ ] Feature selection を training data のみに fit した
- [ ] Selected features を記録した（names, method used, scores）
- [ ] 性能を比較した: selected features vs all features
- [ ] 単一 split ではなく cross-validation で検証した
- [ ] Feature selection を training pipeline に統合した（手作業で行わない）
- [ ] feature drift の監視を用意した（selected features は古くなる可能性がある）
