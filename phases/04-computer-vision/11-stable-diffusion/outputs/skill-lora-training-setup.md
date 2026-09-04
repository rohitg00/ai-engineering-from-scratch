---
name: skill-lora-training-setup
description: Write a full LoRA training config for a custom dataset, including captions, rank, batch size, and learning rate
version: 1.0.0
phase: 4
lesson: 11
tags: [computer-vision, stable-diffusion, lora, fine-tuning]
---

# LoRA Training Setup

Turn a description of the fine-tune intent into a concrete training config that is ready to pass to `diffusers` or `kohya_ss`.

## When to use

- Training a LoRA for a subject (person, object, character), a style (artist, brand), or a concept (pose, lighting).
- Extending an existing LoRA with more data.
- Debugging a LoRA run whose output underfits or overfits the training images.

## Inputs

- `purpose`: subject | style | concept
- `num_images`: how many training images are available
- `base_model`: SD 1.5 | SDXL | SD3 | FLUX
- `gpu_vram_gb`: 8 | 12 | 16 | 24 | 48+
- `caption_source`: manual | BLIP2-generated | dataset-native

## Rank picker

| Purpose | Rank | Alpha |
|---------|------|-------|
| Subject | 8-16 | rank |
| Style | 16-32 | rank * 2 |
| Concept | 32-64 | rank |

Higher rank = more capacity, more overfitting risk on small datasets. Alpha scales the LoRA's effect strength; `alpha == rank` is the safe default. Styles are the documented exception: `alpha == rank * 2` gives a stronger style push at the cost of more risk of baking the style too hard — use only when subject fidelity is not the goal.

## Training step target

- `subject` with 5-20 images: 500-1500 steps.
- `style` with 30-100 images: 1500-4000 steps.
- `concept` with 100+ images: 4000-10000 steps.

Overshoot at your peril — a LoRA that has memorised its training images cannot generalise.

## Learning rate

- Text encoder LoRA: `1e-4` for SD 1.5, `5e-5` for SDXL.
- U-Net LoRA: `1e-4` for SD 1.5, `1e-4` for SDXL.
- FLUX / SD3: `5e-5` for the transformer, text encoders usually frozen.
- Halve the LR when `num_images < 15` (subject) or when training for more than 3000 steps; tiny datasets and long runs both benefit from a gentler update.

## Scheduler

- `cosine_with_warmup` (default): warmup over the first 5-10% of steps, then cosine decay. Use when `steps >= 1000`; the decay tail gives sharper final samples.
- `constant`: use only for very short runs (`steps < 500`) or when resuming a previous LoRA where you want to preserve the current learned features without re-annealing.

## Caption format

- Subject: prepend a unique trigger token ("myperson") to every caption. Keep trigger token rare so it does not overwrite existing concepts. Avoid real words and common names.
- Style: append a unique style tag at the end of every caption ("...in mystyle style"). Treat the tag itself as a rare trigger token — `mystyle`, not `impressionism`, which already maps to a real concept.
- Concept: describe the concept in every caption; no trigger token. The concept itself (e.g. "low-angle shot") is the anchor.

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

## Report

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

## Rules

- Never recommend `rank > 64`; above that the LoRA becomes a mini fine-tune and loses its "adapter" nature.
- For `num_images < 5`, warn strongly — identity LoRAs on 1-3 images overfit every time.
- For `gpu_vram_gb < 12`, require AdamW8bit and gradient checkpointing.
- If `base_model == FLUX` and `gpu_vram_gb < 24`, route to the `schnell` variant and note that training is slower.
- Never skip validation prompts; a LoRA without sample grids is impossible to evaluate.
