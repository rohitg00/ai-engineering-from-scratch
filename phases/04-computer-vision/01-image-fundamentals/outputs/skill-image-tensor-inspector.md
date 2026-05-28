---
name: skill-image-tensor-inspector
description: 任意の image-shaped tensor または array を調べ、dtype、layout、range、raw / normalized / standardized のどれに見えるかを報告する
version: 1.0.0
phase: 4
lesson: 1
tags: [computer-vision, debugging, preprocessing, tensors]
---

# 画像テンソルインスペクター

vision pipeline の任意の地点で image-shaped array を保持していて、それがどの状態にあるのかを正確に知る必要があるときの診断 skill です。

## 使うタイミング

- pretrained model が意味のない予測を返しており、preprocessing を疑っている。
- pipeline を OpenCV と torchvision の間で移行していて、channel order が曖昧である。
- 複数の framework の layer を stack していて、batch axis が間違った場所に現れ続ける。
- loss が `log(num_classes)` に張り付いた training loop を debug している。

## 入力

- `x`: 任意の 2-D、3-D、または 4-D array-like（NumPy、PyTorch、JAX）。
- 任意の `expected`: 照合する invariant の dict。例: `{"layout": "CHW", "range": "standardized"}`。

## 手順

1. **backend を解決する** — `x` が NumPy、Torch、JAX のどれかを検出する。元の入力を変更せずに、調査用に NumPy へ変換する。

2. **rank を分類する**:
   - rank 2 -> single-channel image (H, W)。
   - rank 3 -> 最後の axis が 1、3、4 のいずれかで、他の 2 つより明確に小さい場合は `HWC`。それ以外は `CHW`。
   - rank 4 -> axis 1 が {1, 3, 4} に含まれ、**かつ** axis 2 または axis 3 が 16 より大きい場合は `NCHW` を優先する。それ以外は `NHWC` を優先する。axis 1 だけを見ると、`(3, 4, 224, 3)` のような small-image NHWC batch を誤分類する。
   - `(1, 3, 3, 3)` のような曖昧な case は常に推測せず `ambiguous` として flag し、caller に `expected` の提供を求める。

3. **dtype と range を分類する**:
   - [0, 255] の `uint8` -> `raw`。
   - min >= 0 かつ max <= 1.01 の `float*` -> `normalized`。
   - min < 0、|mean| < 0.5、0.5 <= std <= 1.5 の `float*` -> `standardized`。
   - それ以外 -> `unusual`、histogram を出力する。

4. **channel ごとの stats** — channel ごとの mean と std を報告する。array が standardized に見える場合は ImageNet mean/std と比較し、match confidence を表面化する。

5. **報告** はこの正確な block で行う:

```
[inspector]
  backend:   numpy | torch | jax
  rank:      2 | 3 | 4
  layout:    HW | HWC | CHW | NHWC | NCHW
  dtype:     <dtype>
  shape:     <shape>
  range:     raw | normalized | standardized | unusual
  min/max:   <min> / <max>
  per-channel mean: [ ... ]
  per-channel std:  [ ... ]
  likely source:    camera | PIL | OpenCV | torchvision | random init
  likely target:    display | training | inference
```

6. `likely target` に基づいて **次の action を推奨する**:
   - `display` の場合: HWC に transpose し、clip して uint8 に変換する。
   - `training` の場合: dataset stats で standardize し、CHW に transpose して batch axis を追加する。
   - `inference` の場合: model card の正確な invariant に合わせる。

## ルール

- 入力を絶対に mutate しない。diagnostics のみを出力する。
- `expected` が与えられた場合、すべての mismatch を `[expected X got Y]` で flag する。
- layout または channel order が曖昧な場合は、silent-failure risk を明示する。
- 複数 option の list ではなく、1 つずつ action を推奨する。
