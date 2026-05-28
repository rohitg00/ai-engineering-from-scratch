---
name: skill-conv-shape-calculator
description: CNN 仕様を layer ごとにたどり、各 block の出力形状、受容野、パラメータ数を報告する
version: 1.0.0
phase: 4
lesson: 2
tags: [computer-vision, cnn, architecture, debugging]
---

# Conv 形状カリキュレーター

CNN の設計やデバッグのための、同じ入力には常に同じ結果を返す helper です。input shape と layer specs のリストを受け取り、モデルを実行せずに shapes、receptive fields、parameter counts を trace します。

## 使う場面

- 新しい CNN を設計していて、すべての downsample がきれいな size に落ちるか確認したいとき。
- 論文を読み、その architecture table を code に変換しているとき。
- pretrained backbone が classifier head で shape mismatch を起こし、どの layer が spatial size を変えたのか知る必要があるとき。
- 学習前に 2 つの backbones の parameter efficiency を比較したいとき。

## 入力

- `input_shape`: `(C, H, W)`。
- `layers`: layer dict の順序付きリスト。各 dict は次をサポートする。
  - `{type: "conv", c_out, k, s, p, groups=1, bias=true}`
  - `{type: "pool", mode: "max"|"avg", k, s, p=0}`
  - `{type: "adaptive_pool", out_h, out_w}`
  - `{type: "flatten"}`
  - `{type: "linear", out_features, bias=true}`

## 手順

1. **Trace を初期化する。** `(C, H, W)`、receptive field `1`、effective stride `1`、cumulative params `0` で始める。

2. **各 layer について、次の順で更新する。**
   - `C_out`（conv/linear）を計算するか、pool では `C_in` をそのまま渡す。
   - spatial output を計算する。conv と pool には `(H + 2P - K) / S + 1`、adaptive pool には `out_h/out_w`、linear 前の flatten output shape `(C * H * W, 1, 1)` には `(1, 1)`、linear には scalar `1x1` を使う。
   - receptive field と effective stride を更新する。
     - Conv/pool: `RF_new = RF_old + (K - 1) * effective_stride`, `effective_stride *= S`。
     - Adaptive pool: effective `S = H_in / out_h`（切り捨て）の pool として扱う。`RF_new = RF_old + (H_in - 1) * effective_stride_old`; `effective_stride *= S`。adaptive pool の RF は直前の spatial extent 全体に等しいことに注意する。
     - Flatten / linear: RF と effective stride は以後意味を持たない。flatten 前の値で固定し、後続行では省略する。
   - params を計算する。
     - Conv: `C_out * (C_in / groups) * K * K + (C_out if bias else 0)`。
     - Linear: `out_features * in_features + (out_features if bias else 0)`。
     - Pool と flatten: 0。

3. **問題を検出して flag する。**
   - Non-integer output size（stride/padding の不整合）。
   - stack の終端より前で `H_out <= 0` になる。
   - receptive field が input size を超える（その後の計算が無駄になっている可能性）。
   - layer ごとの params が突然 10x 増え、channel plan が間違っていることを示唆する。

4. **単一の表として報告する。**

```
idx  layer                C_in  C_out  K  S  P  H_out  W_out  RF    params     cum_params
1    conv 3x3 s=1 p=1     3     32     3  1  1  224    224    3     896        896
2    conv 3x3 s=2 p=1     32    64     3  2  1  112    112    7     18,496     19,392
3    pool max 2x2         64    64     2  2  0  56     56     11    0          19,392
...
```

5. **要約行**: final `(C, H, W)`、final receptive field、total params、warnings。

## ルール

- spatial sizes は常に integer で返す。式が non-integer を生む場合は error として flag し、黙って floor しない。
- `groups > 1` のときは、`C_in % groups == 0` かつ `C_out % groups == 0` を検証する。そうでなければ error。
- depthwise conv（`groups == C_in`）では、params が低い理由を reader が分かるように `layer` column へ label を付ける。
- user が BatchNorm や activation layers を指定した場合、shape 上は無視するが params は引き継ぐ（BatchNorm ごとに `2 * C`）。
- missing fields の default を推測しない。すべての conv と pool に `k`、`s`、`p` を要求する。
