---
name: skill-probability-reasoning
description: 与えられた機械学習問題に適した確率分布を選ぶ
version: 1.0.0
phase: 1
lesson: 6
tags: [probability, distributions, modeling]
---

# 確率分布の選択

データをモデル化するとき、損失関数を設計するとき、または事前分布を設定するときに、適切な分布を選ぶためのガイドです。

## 判断チェックリスト

1. 結果は離散（カテゴリ、カウント）ですか、それとも連続（測定値、スコア）ですか。
2. 結果には範囲の制約（例: [0, 1]）がありますか、それとも非有界ですか。
3. 起こり得る結果はいくつありますか。2つですか。k 個ですか。無限ですか。
4. データは対称ですか、それとも歪んでいますか。
5. 事象は独立ですか、それとも相関していますか。
6. 率、カウント、割合、測定値のどれをモデル化していますか。

## 分布の判断木

```
Is the variable discrete?
  Yes --> Only 2 outcomes? --> Bernoulli (p)
     |    k outcomes, one trial? --> Categorical (p1...pk)
     |    k outcomes, n trials? --> Multinomial (n, p1...pk)
     |    Count of successes in n trials? --> Binomial (n, p)
     |    Count of events per interval? --> Poisson (lambda)
     |    Count of trials until first success? --> Geometric (p)
     |    Count of trials until r successes? --> Negative Binomial (r, p)
  No --> Symmetric, bell-shaped? --> Normal (mu, sigma)
     |   Positive values, right-skewed? --> Log-normal or Exponential
     |   Bounded in [0, 1]? --> Beta (alpha, beta)
     |   Positive values, flexible shape? --> Gamma (alpha, beta)
     |   Time between events? --> Exponential (lambda)
     |   Heavy tails needed? --> Student's t (nu) or Cauchy
     |   Multivariate, bell-shaped? --> Multivariate Normal
     |   On a simplex (sums to 1)? --> Dirichlet (alpha)
```

## 実世界の機械学習シナリオと分布の対応

| シナリオ | 分布 | パラメータ |
|---|---|---|
| 二値分類の出力 | Bernoulli | p = sigmoid(logit) |
| 多クラス分類の出力 | Categorical | p = softmax(logits) |
| 言語モデルのトークン予測 | 語彙上の Categorical | softmax から得た p |
| ピクセル強度（正規化済み） | Beta または Uniform [0, 1] | 画像統計に依存 |
| 文書内の単語数 | Poisson | lambda = 平均単語数 |
| ユーザーリクエスト間の時間 | Exponential | lambda = リクエスト率 |
| 測定誤差 | Normal | mu = 0、sigma はデータから |
| 重み初期化 | Normal または Uniform | Kaiming/Xavier ルール |
| VAE 潜在空間の事前分布 | Standard Normal | mu = 0、sigma = 1 |
| 割合に対するベイズ事前分布 | Beta | 信念から決める alpha、beta |
| カテゴリ重みに対するベイズ事前分布 | Dirichlet | alpha ベクトル |
| 回帰ターゲットのノイズ | Normal | mu = 0、sigma を推定 |
| 外れ値に頑健な回帰 | Student's t | 低い自由度 |
| 期間・寿命モデリング | Weibull または Gamma | shape と scale |
| 文書ごとのトピック分布（LDA） | Dirichlet | 疎にするなら alpha < 1 |

## 分布の選択を間違えるとき

- データに明確な下限がある（例: 価格、距離）のに Normal を使う。正規分布は負の値にも非ゼロ確率を割り当てます。代わりに log-normal または gamma を使います。
- 分散が平均と異なるのに Poisson を使う。Poisson は平均 = 分散を仮定します。分散 > 平均なら negative binomial を使います。
- 多クラス問題に Bernoulli を使う。Bernoulli は厳密に二値です。k > 2 では categorical を使います。
- 観測値が相関しているのに独立だと仮定する。時系列、空間データ、グループ化されたデータは独立性を破ります。自己回帰モデルや階層モデルを使います。

## よくある間違い

- PDF の値と確率を混同する。PDF は 1 を超えることがあります。確率は PDF を区間上で積分して得ます。
- softmax 出力を独立な Bernoulli 確率だと思う。softmax 出力は categorical 確率であり、構成上合計が 1 になります。
- ドメイン知識があるのに一様事前分布を使う。よく選ばれた情報的事前分布は、結果を偏らせずに分散を減らします。
- 対数確率を確率として扱う。log-probs は常に負（またはゼロ）です。合計しても 1 にはなりません。

## クイックリファレンス: 分布の性質

| 分布 | 台 | 平均 | 分散 | 重要な性質 |
|---|---|---|---|---|
| Bernoulli(p) | {0, 1} | p | p(1-p) | 最も単純な離散分布 |
| Binomial(n, p) | {0..n} | np | np(1-p) | n 個の Bernoulli の和 |
| Poisson(lam) | {0, 1, 2, ...} | lam | lam | 平均 = 分散 |
| Normal(mu, s^2) | (-inf, inf) | mu | s^2 | 与えられた平均・分散で最大エントロピー |
| Exponential(lam) | [0, inf) | 1/lam | 1/lam^2 | 無記憶性 |
| Beta(a, b) | [0, 1] | a/(a+b) | ab/((a+b)^2(a+b+1)) | Binomial の共役事前分布 |
| Gamma(a, b) | (0, inf) | a/b | a/b^2 | Poisson の共役事前分布 |
| Dirichlet(alpha) | Simplex | alpha_i/sum | (see formula) | Categorical の共役事前分布 |
