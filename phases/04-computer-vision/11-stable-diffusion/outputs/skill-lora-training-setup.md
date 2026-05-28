---
name: skill-lora-training-setup
description: custom dataset 用に、captions、rank、batch size、learning rate を含む完全な LoRA training config を書く
version: 1.0.0
phase: 4
lesson: 11
tags: [computer-vision, stable-diffusion, lora, fine-tuning]
---

# LoRA Training Setup

fine-tune の目的説明を、`diffusers` または `kohya_ss` に渡せる具体的な training config に変換します。

## 使う場面

- subject（person、object、character）、style（artist、brand）、concept（pose、lighting）の LoRA を学習する。
- 既存の LoRA を追加データで拡張する。
- 出力が training images に対して underfit または overfit している LoRA run を debugging する。

## 入力

- `purpose`: subject | style | concept
- `num_images`: 利用可能な training images の枚数
- `base_model`: SD 1.5 | SDXL | SD3 | FLUX
- `gpu_vram_gb`: 8 | 12 | 16 | 24 | 48+
- `caption_source`: manual | BLIP2-generated | dataset-native

## Rank picker

| Purpose | Rank | Alpha |
|---------|------|-------|
| Subject | 8-16 | rank |
| Style | 16-32 | rank * 2 |
| Concept | 32-64 | rank |

rank が高いほど capacity は増えますが、小さな dataset では overfitting risk も増えます。Alpha は LoRA の効果の強さをスケールします。`alpha == rank` が安全なデフォルトです。Styles は文書化された例外で、`alpha == rank * 2` は style の押し出しを強めますが、style を焼き込みすぎる risk が増えます。subject fidelity が目的でない場合にだけ使います。

## Training step target

- 5-20 images の `subject`: 500-1500 steps。
- 30-100 images の `style`: 1500-4000 steps。
- 100+ images の `concept`: 4000-10000 steps。

やりすぎには注意してください。training images を記憶した LoRA は generalise できません。

## Learning rate

- Text encoder LoRA: SD 1.5 では `1e-4`、SDXL では `5e-5`。
- U-Net LoRA: SD 1.5 では `1e-4`、SDXL では `1e-4`。
- FLUX / SD3: transformer は `5e-5`、text encoders は通常 frozen。
- `num_images < 15`（subject）または 3000 steps を超えて学習する場合は LR を半分にする。小さすぎる dataset と長い run はどちらも穏やかな更新が有利。

## Scheduler

- `cosine_with_warmup`（デフォルト）: 最初の 5-10% の steps で warmup し、その後 cosine decay。`steps >= 1000` で使う。decay tail が最終サンプルをよりシャープにする。
- `constant`: 非常に短い run（`steps < 500`）か、既存の LoRA を resume して現在学習済みの特徴を re-annealing せず保ちたい場合だけ使う。

## Caption format

- Subject: rare な unique trigger token（"myperson"）をすべての caption の先頭に付ける。既存 concept を上書きしないよう、trigger token は rare にする。実在語や一般名は避ける。
- Style: unique style tag をすべての caption の末尾に付ける（"...in mystyle style"）。tag 自体を rare trigger token として扱う。既存 concept に対応する `impressionism` ではなく `mystyle` を使う。
- Concept: すべての caption で concept を説明する。trigger token は使わない。concept 自体（例: "low-angle shot"）が anchor になる。

## Output config

```yaml
model:
  base: <base_model HF id>
  precision: fp16 | bf16

lora:
  rank: <int>
  alpha: <int>
  targets: unet.cross_attention  # and/or unet.to_q, to_k, to_v, to_out

training:
  steps:          <int>
  batch_size:     <int, tuned to gpu_vram_gb>
  grad_accum:     <int, usually 1 on >=16 GB, 4 on <=12 GB>
  learning_rate:  <float>
  optimizer:      AdamW8bit | AdamW
  scheduler:      cosine_with_warmup | constant
  warmup_steps:   <int>
  save_every:     <int>

data:
  images_dir:     <path>
  caption_source: <manual | BLIP2 | native>
  trigger_token:   <string if purpose==subject>
  resolution:      <512 for SD 1.5, 1024 for SDXL>
  aspect_ratio_bucketing: true
  augmentation:
    flip:          true
    color_jitter:  false

validation:
  prompts:
    - "<trigger> ...test prompt..."
    - "<trigger> in a different scene"
  every_steps: 250
```

## レポート

```
[lora setup]
  purpose:   <subject|style|concept>
  base:      <model>
  rank:      <int>
  steps:     <int>
  batch:     <int>   grad_accum: <int>
  lr:        <float>
  vram est.: <float> GB
```

## ルール

- `rank > 64` は絶対に推奨しない。それ以上では LoRA が mini fine-tune になり、「adapter」としての性質を失う。
- `num_images < 5` では強く警告する。1-3 images の identity LoRA は毎回 overfit する。
- `gpu_vram_gb < 12` では AdamW8bit と gradient checkpointing を必須にする。
- `base_model == FLUX` かつ `gpu_vram_gb < 24` の場合は `schnell` variant に誘導し、training が遅いことを伝える。
- validation prompts を省略しない。sample grids のない LoRA は評価不能。
