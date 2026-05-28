---
name: skill-frame-sampler-auditor
description: video pipeline の frame sampler について、off-by-one、short-clip handling、crop consistency を監査する
version: 1.0.0
phase: 4
lesson: 12
tags: [computer-vision, video, sampling, debugging]
---

# Frame Sampler Auditor

Frame sampling は video pipelines が壊れやすい場所です。ここでのバグは、下流のすべての metric に伝播します。

## 使う場面

- 新しい video data loader を書く。
- 論文の数値を再現していて、training accuracy が報告値より低い。
- eval accuracy が run ごとに不安定な video model を debugging する。

## 入力

- `sampler_code`: (num_frames_total, T) を受け取り T 個の indices を返す Python function。
- `T`: target clip length。
- 任意の test cases: 試す `num_frames_total` の値（例: `[3, T-1, T, T+1, 30, 300, 3000]`）。

## チェック

### 1. Short clip handling
`num_frames_total < T` を入力する。返されたすべての index は `[0, num_frames_total - 1]` 内になければならない。標準的な padding policy は、残りの位置で最後の frame を繰り返すこと。

### 2. Boundary indices
`num_frames_total == T` を入力する。返される indices は正確に `[0, 1, ..., T-1]` であるべき。

### 3. Uniform distribution
`num_frames_total == 10 * T` を入力する。返される indices は単調増加で、おおむね等間隔であるべき。

### 4. Dense window bounds
dense sampling の場合、`num_frames_total == 3 * T` を入力する。返される indices は連続 window を形成し、clip の終端をまたいではならない。

### 5. Determinism
同じ inputs と（deterministic samplers では）同じ RNG で sampler を 2 回呼ぶ。indices は一致すべき。

### 6. Crop consistency
pipeline が frame ごとの spatial crop も返す場合、同じ clip と同じ seed で sampler を 2 回実行し、すべての frame が同じ crop box（同じ `(x, y, w, h)`）を使うことを確認する。1 つの clip 内で frame ごとに crop が異なると temporal coherence が壊れ、典型的な silent bug になる。許容される変動: augmentation は *per clip* に適用され、clip 内では一貫している。

## レポート

```
[sampler audit]
  name: <function name>
  T:    <int>

[short-clip handling]
  passed | failed (<details>)

[boundary]
  passed | failed

[uniform spacing]
  passed | failed (<stddev of gaps>)

[dense window]
  passed | failed (<details>)

[determinism]
  passed | failed

[crop consistency]
  passed | failed (<per-frame crop varies: yes/no>)

[verdict]
  ok | fix required
```

## ルール

- short-clip handling が範囲外 indices を返す場合、sampler を "ok" と判定してはならない。
- Dense samplers は `num_frames_total - 1` を越える window を返してはならない。
- sampler が stochastic（dense）の場合、determinism は explicit seeded RNG でのみ test する。
- canonical policies（最後の frame で pad、window を終端に clamp、half-open intervals を round）は提案するが、黙って修正しない。
