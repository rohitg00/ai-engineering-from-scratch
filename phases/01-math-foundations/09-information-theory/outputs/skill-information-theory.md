---
name: skill-information-theory
description: 情報理論の概念をMLの損失関数、モデル評価、特徴量選択に適用する
version: 1.0.0
phase: 1
lesson: 9
tags: [information-theory, entropy, loss-functions]
---

# MLのための情報理論

機械学習システムで、エントロピー、クロスエントロピー、KLダイバージェンス、相互情報量をいつ使うか。

## 判断チェックリスト

1. 単一の分布における不確実性を測る？ **エントロピー**を使う。
2. モデルが真のラベルをどれだけよく近似しているかを測る？ **クロスエントロピー**を使う（分類損失）。
3. 2つの分布の距離を測る？ **KLダイバージェンス**を使う。
4. 2つの変数が関係しているかを調べる？ **相互情報量**を使う。
5. 言語モデルの品質を報告する？ **パープレキシティ**を使う（クロスエントロピーの指数）。
6. あるモデルを別のモデルへ蒸留する？ teacherからstudentへの**KLダイバージェンス**を最小化する。

## 各尺度をいつ使うか

| 尺度 | 公式 | 使いどころ | MLでの応用 |
|---|---|---|---|
| Entropy H(P) | -sum(p log p) | この分布はどれだけ不確実か？ | データの複雑さ、maximum entropy models |
| Cross-entropy H(P,Q) | -sum(p log q) | モデルQは真のPをどれだけよく予測しているか？ | 分類損失、言語モデル損失 |
| KL divergence D(P\|\|Q) | sum(p log(p/q)) | PとQはどれだけ異なるか？ | VAE loss（ELBO）、knowledge distillation、RLHF |
| Mutual information I(X;Y) | H(X) - H(X\|Y) | YはXについてどれだけ教えてくれるか？ | 特徴量選択、表現学習 |
| Perplexity | exp(H(P,Q)) or 2^H | モデルはどれだけ迷っているか？ | 言語モデル評価 |
| Conditional entropy H(X\|Y) | -sum(p(x,y) log p(x\|y)) | Yを知った後のXの残り不確実性 | 特徴量の情報量 |

## 重要な関係

```
Cross-entropy  = Entropy + KL divergence
H(P, Q)        = H(P)   + D_KL(P || Q)

訓練中、H(P) は定数なので:
  クロスエントロピーの最小化 = KLダイバージェンスの最小化

相互情報量 = エントロピー - 条件付きエントロピー
I(X; Y) = H(X) - H(X|Y) = H(Y) - H(Y|X)

Perplexity = exp(cross-entropy in nats)
           = 2^(cross-entropy in bits)
```

## クイックリファレンス: 公式と単位

| 公式 | Bits（log base 2） | Nats（log base e） |
|---|---|---|
| 情報量: -log(p) | -log2(p) | -ln(p) |
| エントロピー: -sum(p log p) | bits | nats |
| 1 nat = | 1.4427 bits | 1 nat |
| PyTorchのデフォルト | -- | nats |
| 情報理論の論文 | bits | -- |

## 値の解釈

| エントロピー値 | 意味 |
|---|---|
| 0 | 決定的。1つの結果の確率が1。 |
| log(n) | 最大の不確実性。n個の結果にわたる一様分布。 |
| 低い | 分布が尖っている。モデルは自信がある。 |
| 高い | 分布が平坦。モデルは不確実。 |

| パープレキシティ値 | 言語モデルの品質 |
|---|---|
| 1 | 完全な予測（実務では起こらない） |
| 10 | 平均して約10個の等確率トークンから選んでいる |
| 50 | 標準ベンチマーク上のGPT-2水準 |
| < 10 | 十分に表現されたドメインでの最先端水準 |

## よくある間違い

- KLダイバージェンスを計算して、対称であるかのように扱う。D_KL(P||Q) != D_KL(Q||P)。対称な尺度が必要なら、Jensen-Shannon divergenceを使う: JS = 0.5 * KL(P||M) + 0.5 * KL(Q||M)、ただし M = 0.5*(P+Q)。
- one-hotラベルでのクロスエントロピーが -log(p_true_class) に単純化されることを忘れる。真の分布がone-hotなら、全クラスを足し合わせる必要はない。
- コードではlogの底2を使いながらnatsで報告する（またはその逆）。PyTorchはデフォルトで自然対数を使う。natsをbitsへ変換するには log2(e) = 1.4427 を掛ける。
- 空の事象や確率ゼロの事象のエントロピーを計算する。慣例として 0 * log(0) = 0 とする。lim(p->0) p*log(p) = 0 だからである。
- 異なる語彙にまたがってパープレキシティを比較する。語彙サイズ50kでパープレキシティ30のモデルは、語彙サイズ10kでパープレキシティ30のモデルと直接比較できない。

## 本番MLで各概念が現れる場所

| 概念 | どこで見るか |
|---|---|
| Cross-entropy loss | あらゆる分類モデル（nn.CrossEntropyLoss） |
| KL divergence | VAE ELBO、PPO clipping、knowledge distillation |
| Entropy regularization | RLの探索ボーナス（高いエントロピー = より多い探索） |
| Mutual information | 特徴量選択、InfoNCE loss（contrastive learning） |
| Perplexity | 言語モデルベンチマーク（低いほどよい） |
| Label smoothing | one-hotをsoft targetに置き換え、クロスエントロピーの自信過剰を減らす |
| Temperature scaling | softmax前にlogitsをTで割り、出力のエントロピーを制御する |
