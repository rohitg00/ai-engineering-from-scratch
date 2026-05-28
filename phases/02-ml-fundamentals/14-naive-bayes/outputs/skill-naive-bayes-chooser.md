---
name: skill-naive-bayes-chooser
description: 分類タスクに適した Naive Bayes variant を選ぶ
phase: 2
lesson: 14
---

あなたは probabilistic classification の専門家です。Naive Bayes variant の選択が必要な人には、次の decision process に沿って案内します。

## Decision Checklist

### Step 1: features は何か

- **Word counts または TF-IDF values** -> MultinomialNB
- **Continuous measurements（temperature、height、sensor readings）** -> GaussianNB
- **Binary indicators（word present/absent、checkbox states）** -> BernoulliNB
- **Mixed types** -> subsets に分けるか、すべてを 1 つの type に変換する

### Step 2: data はどれくらいあるか

- **1,000 samples 未満**: Naive Bayes は有力な選択肢です。強い prior（independence assumption）が overfitting を防ぎます。
- **1,000 から 50,000 samples**: NB はまだ競争力があります。logistic regression と比較してください。
- **50,000 samples 超**: Logistic regression や gradient boosting が NB を上回る可能性が高いです。NB は baseline として使います。

### Step 3: smoothing を tune する

- alpha=1.0（Laplace smoothing）から始めます。
- accuracy が低く、十分な data があるなら alpha=0.1 や 0.01 を試します。
- model が overfitting している（train >> test accuracy）なら alpha を 5.0 や 10.0 に上げます。
- smoothing は単一の train/test split ではなく、必ず cross-validation で検証します。

### Step 4: assumptions を確認する

- **MultinomialNB**: features は non-negative である必要があります。negative values がある場合は shift するか GaussianNB を使います。
- **GaussianNB**: class 内で features がだいたい bell-shaped のとき最もよく機能します。histograms で確認します。
- **BernoulliNB**: 先に features を binarize します。threshold を慎重に選びます（text では present=1、absent=0）。

## よくある間違い

1. **text data に GaussianNB を使う。** Word counts は Gaussian ではありません。MultinomialNB を使います。
2. **Laplace smoothing を忘れる。** unseen word が 1 つあるだけで probability 全体が zero になります。必ず smooth します。
3. **probability outputs を信頼しすぎる。** NB probabilities は calibration が悪いです。confidence scores ではなく ranking に使います。calibrated probabilities が必要なら CalibratedClassifierCV を使います。
4. **class imbalance を無視する。** NB priors は class frequencies を反映します。99% negative、1% positive では prior が likelihood を圧倒します。priors を手動調整するか resample します。

## Quick Reference

| Question | MultinomialNB | GaussianNB | BernoulliNB |
|----------|:---:|:---:|:---:|
| Text classification? | Yes | No | Maybe (short text) |
| Continuous features? | No | Yes | No |
| Binary features? | No | No | Yes |
| Very fast training needed? | Yes | Yes | Yes |
| Small training set? | Good | Good | Good |
| Need calibrated probabilities? | No | No | No |

## Naive Bayes を使わない方がよい場合

- features が強く correlated しており、correlations を扱える model（logistic regression、gradient boosting）を訓練するだけの data がある
- 十分な data があり、可能な限り最高の accuracy が必要
- features が images、sequences、graphs である（neural networks を使う）
- feature interactions を捉える model が必要（tree-based methods を使う）
