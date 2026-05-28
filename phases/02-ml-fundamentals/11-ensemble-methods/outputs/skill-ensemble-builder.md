---
name: skill-ensemble-builder
description: 問題に適した ensemble method を選び、設定する
version: 1.0.0
phase: 2
lesson: 11
tags: [ensemble, bagging, boosting, random-forest, xgboost, stacking]
---

# アンサンブル手法選択ガイド

Ensemble は複数のモデルを組み合わせ、単一モデルより良い予測を作ります。常に問うべきことは、どの種類の ensemble をいつ使うかです。

## 判断チェックリスト

1. 現在のモデルの主な問題は何ですか？
   - High variance（overfitting）: bagging（Random Forest）を使う
   - High bias（underfitting）: boosting（Gradient Boosting、XGBoost）を使う
   - 両方、または最大 accuracy が欲しい: stacking を使う

2. どれくらいのデータがありますか？
   - 1,000 rows 未満: Random Forest（頑健で、misconfigure しにくい）
   - 1,000 から 100,000: XGBoost または LightGBM（tabular では総合的に最良）
   - 100,000 超: LightGBM（最速の gradient boosting で、大規模データをうまく扱う）

3. tuning にどれくらい時間を投資できますか？
   - 最小: default の Random Forest（ほぼ常に機能する）
   - 中程度: learning_rate=0.1 の XGBoost、early stopping で n_estimators を調整
   - 最大: Bayesian hyperparameter search を使った LightGBM または XGBoost

4. interpretability は必要ですか？
   - Yes: 単一の decision tree、または feature importance 付きの小さな Random Forest
   - Partial: SHAP values 付きの gradient boosting
   - No: stacking または deep ensemble

5. データは noisy で outlier が多いですか？
   - Yes: Random Forest（bagging は noise に頑健）
   - No: gradient boosting（clean data では accuracy をさらに押し上げられる）

## 各手法をいつ使うか

**Random Forest (Bagging)**: 安全な第一候補です。bootstrap sample 上で多数の tree を学習し、平均します。bias を増やさずに variance を減らします。中規模データではほぼ overfit しません。必要な tuning は最小限で、n_estimators=100-500 を設定して default を残します。

**AdaBoost**: sample reweighting を使う逐次的 boosting です。simple base learner（decision stump）とうまく機能します。誤分類された点の重みを上げるため、outlier と noisy label に敏感です。実務では大部分が gradient boosting に置き換えられました。

**Gradient Boosting**: 各新しい tree をそれまでの ensemble の residual に fit します。bias を減らします。tabular data に対する最も強力な手法です。learning_rate、n_estimators、max_depth、min_child_weight、subsample の tuning が必要です。

**XGBoost**: regularization、second-order optimization、systems-level speedup を備えた gradient boosting です。missing value を native に扱います。Kaggle competition と production tabular ML の default です。

**LightGBM**: level-wise ではなく leaf-wise growth を使う gradient boosting です。大規模 dataset では XGBoost より高速です。histogram-based split を使います。50k rows 超の dataset に最適です。

**CatBoost**: categorical feature を native に扱う gradient boosting です。one-hot encoding は不要です。categorical feature が多い場合に適しています。

**Stacking**: 複数の多様な base model の予測上で meta-learner を学習します。絶対的に最高の accuracy が必要で、compute に余裕がある場合に使います。leakage を避けるため、base model の予測は必ず cross-validation で生成します。

**Voting**: 最も単純な ensemble です。hard voting（majority class）または soft voting（平均確率）を使います。meta-learner なしで 2-3 個の多様なモデルを素早く組み合わせる方法です。

## よくあるミス

- early stopping なしで gradient boosting を使う（round を多く回しすぎると overfit します）
- learning_rate を高くしすぎる（0.3 超は通常不安定になります）
- gradient boosting の max_depth を tuning しない（unlimited または非常に深い tree の default は overfit します）
- すべて同じ type のモデルで stacking する（stacking の要点は diversity です）
- noisy data に AdaBoost を使う（outlier は round ごとに重みがどんどん高くなります）
- Random Forest が underfitting を直すと期待する（variance を減らすのであり、bias ではありません）

## 手法別 tuning 優先度

**Random Forest:**
1. n_estimators: 100-500（増やして悪くなることはまれで、遅くなるだけ）
2. max_depth: None（tree を完全に成長させる）、または速度のため 10-20 に制限
3. max_features: classification では "sqrt"、regression では "log2" または n/3

**XGBoost / LightGBM:**
1. learning_rate: 0.01-0.3（より多くの tree に使う compute があるなら低い方がよい）
2. n_estimators: 推測せず、validation set 上の early stopping を使う
3. max_depth: 3-8（6 から始める）
4. min_child_weight / min_data_in_leaf: 1-20（高いほど overfitting を防ぐ）
5. subsample: 0.7-1.0
6. colsample_bytree: 0.7-1.0
7. reg_alpha (L1) and reg_lambda (L2): 0-10

## クイックリファレンス

| 手法 | 減らすもの | 速度 | tuning effort | 最適な用途 |
|--------|---------|-------|--------------|----------|
| Random Forest | Variance | 速い | 低い | noisy data、quick baseline |
| AdaBoost | Bias | 速い | 低い | simple base learner、ノイズの少ないデータ |
| Gradient Boosting | Bias | 中程度 | 高い | 表形式データ、competition |
| XGBoost | 両方 | 速い | 高い | 本番の tabular ML |
| LightGBM | 両方 | 最速 | 高い | large dataset（50k+ rows） |
| CatBoost | 両方 | 中程度 | 中程度 | categorical feature が多い |
| Stacking | 両方 | 遅い | 高い | maximum accuracy、多様なモデル |
| Voting | Variance | 速い | なし | 2-3 個のモデルの素早い組み合わせ |
