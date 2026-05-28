---
name: skill-noise-schedule-designer
description: T と target corruption level から linear、cosine、sigmoid の beta schedule を作り、SNR plot も出力する
version: 1.0.0
phase: 4
lesson: 10
tags: [computer-vision, diffusion, noise-schedule, training]
---

# Noise Schedule Designer

beta schedule は、各 diffusion step でどれだけの signal を保持するかを制御します。悪い schedule は、その後のあらゆる判断において学習効率とサンプル品質の上限を下げます。

## 使う場面

- 新しい diffusion training run を始め、T と beta を選ぶ。
- ぼやけたサンプルを出す diffusion model（schedule が強すぎる）や、構造を学習できない model（schedule が弱すぎる）を debugging する。
- 異なる schedule を報告している論文間で設計を比較する。

## 入力

- `T`: timesteps の数。通常は 100-1000。
- `type`: linear | cosine | sigmoid。
- `target_alpha_bar_final`: t=T で残す signal の割合。デフォルトは 0.001（99.9% corrupted）。
- 任意の `image_resolution` — 大きな画像では、よりゆっくり corrupt する schedule（cosine または shifted schedules）が有利。

## Schedule formulas

### Linear
```
beta_t = beta_start + (beta_end - beta_start) * (t - 1) / (T - 1)
```
デフォルト: beta_start=1e-4、beta_end=0.02（DDPM paper）。

### Cosine (Nichol & Dhariwal, 2021)
```
alpha_bar_t = cos^2((t/T + s) / (1 + s) * pi/2)
beta_t = 1 - alpha_bar_t / alpha_bar_{t-1}
```
s = 0.008。signal を長く保つため、低い step counts で優れる。

### Sigmoid
```
alpha_bar_t = 1 / (1 + exp(k * (t/T - 0.5)))
```
k = 6 から 12。中庸な選択肢。一部の SDXL variants で使われる。

## 手順

1. formula ごとに betas を計算する。
2. `alphas`、`alphas_cumprod`、`sqrt_alphas_cumprod`、`sqrt_one_minus_alphas_cumprod` を事前計算する。
3. SNR_t = alpha_bar_t / (1 - alpha_bar_t) を計算し、時間に対する SNR summary を作る。
4. `alphas_cumprod[T-1]` が `target_alpha_bar_final` の 10% 以内にあることを確認する。そうでなければ beta_end（linear）、s（cosine）、k（sigmoid）を調整して再試行する。
5. 3 つの checkpoint を報告する。
   - `t=T*0.25` — early corruption
   - `t=T*0.5` — midway
   - `t=T*0.75` — near-final

## レポート

```
[schedule]
  type:   <name>
  T:      <int>
  beta_start: <float>   beta_end: <float>

[signal retention]
  t=0.25T:  alpha_bar=<X>  SNR=<X>
  t=0.5T:   alpha_bar=<X>  SNR=<X>
  t=0.75T:  alpha_bar=<X>  SNR=<X>
  t=T:      alpha_bar=<X>  SNR=<X>

[warnings]
  - <if alpha_bar collapses before 0.75T>
  - <if beta_end produces NaN in log-SNR>
```

## ルール

- `alpha_bar_t <= 0` を含む schedule は絶対に出力しない。1e-5 未満の値は clamp し、警告する。
- 低い step-count sampling（< 30 steps）では cosine をデフォルト推奨にする。
- `quality_target == research` では linear をデフォルトにする。DDPM baselines は linear schedules で報告されているため。
- `image_resolution > 256` の場合は、高解像度でより多くの signal を保持するため schedule の shifting（Chen, 2023）を推奨する。
