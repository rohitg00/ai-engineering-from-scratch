---
name: skill-classification-diagnostics
description: confusion matrix と class names を受け取り、クラス別の失敗を表に出して、最も効果の大きい fix を 1 つ提案する
version: 1.0.0
phase: 4
lesson: 4
tags: [computer-vision, classification, evaluation, debugging]
---

# 分類診断

confusion matrix を読むための lens です。Aggregate accuracy は分類器が動いていることを教えてくれます。confusion matrix は、分類器が *まだ何を知らないか* を教えてくれます。

## 使う場面

- 学習済み classifier の validation performance を最初に見るとき。
- training run の合間に、次に何を変えるか決めるとき。
- model を出荷する前に、重要な class が静かに失敗していないことを確認するとき。
- production regression を debug するとき。overall accuracy が 1 point 落ち、理由を知る必要がある場合。

## 入力

- `cm`: CxC confusion matrix（rows = true、cols = predicted）。
- `labels`: 同じ順序の C 個の class name の list。
- 任意の `class_priors`: per-class training frequency（省略時は `cm` の row sum）。

## 手順

1. **クラス別 metric を計算する。** zero division は、その class で metric が undefined であるものとして扱い、`n/a` と報告します。静かに 0 で置き換えてはいけません。
   - precision_i = cm[i,i] / sum(cm[:, i])   (その class が一度も予測されていない場合は undefined)
   - recall_i    = cm[i,i] / sum(cm[i, :])   (その class に ground-truth samples がない場合は undefined)
   - f1_i        = 2 * p * r / (p + r)        (どちらかの component が undefined の場合は undefined)

2. **F1 によって worst class を最大 3 つ rank する。** confusion matrix の class が 3 未満なら、存在する数だけ rank します。すべての metric が undefined の class は除外します。

3. **row ごとの top off-diagonal cell を見つける** — その class から最も頻繁に奪っている 1 つの class です。`true -> predicted` として報告します。

4. **各 worst class の failure mode を分類する。** label を再現可能にするため、以下の quantitative threshold を使います。
   - `ambiguity` — 別 class との bidirectional confusion: `cm[i,j] / sum(cm[i, :]) >= 0.15` と `cm[j,i] / sum(cm[j, :]) >= 0.15` の両方。
   - `imbalance` — その class の training count が、top confuser の `< 0.5x`。
   - `label_noise` — `|precision_i - recall_i| >= 0.2` かつ、その class が imbalance / ambiguity path 上にない。
   - `systematic` — この class の error share で 0.2 を超える single confuser がない。error が 3 つ以上の他 class に広がっている。

5. **最も効果の大きい次の action を 1 つ推奨する**:
   - `ambiguity` -> discriminative examples を収集または合成し、区別に必要な feature を保存する targeted augmentation を追加する。
   - `imbalance` -> minority class を oversample するか、class-weighted loss を適用する。
   - `label_noise` -> その class の stratified sample を audit する。他の変更より前に mislabels を修正する。
   - `systematic` -> その class の data を増やすか、この class の loss に高い weight をかけて fine-tune する。

## レポート

```
[diagnostics]
  aggregate accuracy: X.XX
  macro F1:           X.XX

[top-3 worst classes]
  1. class <name>  F1 = X.XX  prec = X.XX  rec = X.XX
     top confusion: <name> -> <other>  (N cases)
     failure mode:  ambiguity | imbalance | label_noise | systematic
     action:        <one sentence>

  2. ...
  3. ...

[recommendation]
  single biggest lever: <one sentence naming the class and the fix>
```

## ルール

- 返す class は最大 3 つです。それ以上は signal を隠します。
- 各 worst class について dominant confuser を名指ししてください。`confuses with many` のように要約してはいけません。
- すべての recommendation を confusion matrix の evidence に基づけてください。どの class かを指定しない generic な `add more data` は不可です。
- precision と recall が 0.2 を超えて食い違う場合は、label noise を常に candidate として flag してください。実在する class では、training 後の P と R は通常そろいます。
