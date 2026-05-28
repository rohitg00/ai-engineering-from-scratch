---
name: skill-lora-training-setup
description: Escreva uma config completa de treinamento LoRA pra um dataset customizado, incluindo captions, rank, batch size e learning rate
version: 1.0.0
phase: 4
lesson: 11
tags: ['computer-vision', 'stable-diffusion', 'lora', 'fine-tuning']
---


# Setup de Treinamento LoRA

Transforme uma descrição da intenção de fine-tune em uma config concreta de treinamento pronta pra ser passada pra `diffusers` ou `kohya_ss`.

## Quando usar

- Treinando um LoRA pra um subject (pessoa, objeto, personagem), um style (artista, marca) ou um concept (pose, iluminação).
- Estendendo um LoRA existente com mais dados.
- Debugando um run de LoRA cujo output underfit ou overfit nas imagens de treinamento.

## Entradas

- `purpose`: subject | style | concept
- `num_images`: quantas imagens de treinamento estão disponíveis
- `base_model`: SD 1.5 | SDXL | SD3 | FLUX
- `gpu_vram_gb`: 8 | 12 | 16 | 24 | 48+
- `caption_source`: manual | gerado por BLIP2 | nativo do dataset

## Seleção de rank

| Propósito | Rank | Alpha |
|---------|------|-------|
| Subject | 8-16 | rank |
| Style | 16-32 | rank * 2 |
| Concept | 32-64 | rank |

Higher rank = more capacity, more overfitting risk on small datasets. Alpha scales the LoRA's effect strength; `alpha == rank` is the safe default. Styles are the documented exception: `alpha == rank * 2` gives a stronger style push at the cost of more risk of baking the style too hard — use only when subject fidelity is not the goal.

## Meta de steps de treinamento

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

## Formato de caption

- Subject: prepend a unique trigger token ("myperson") to every caption. Keep trigger token rare so it does not overwrite existing concepts. Avoid real words and common names.
- Style: append a unique style tag at the end of every caption ("...in mystyle style"). Treat the tag itself as a rare trigger token — `mystyle`, not `impressionism`, which already maps to a real concept.
- Concept: describe the concept in every caption; no trigger token. The concept itself (e.g. "low-angle shot") is the anchor.

## Config de saída

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

## Relatório

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

## Regras

- Nunca recomende `rank > 64`; acima disso o LoRA vira um mini fine-tune e perde a natureza de "adapter".
- Pra `num_images < 5`, avise fortemente — LoRAs de identidade com 1-3 imagens fazem overfit toda hora.
- Pra `gpu_vram_gb < 12`, exija AdamW8bit e gradient checkpointing.
- Se `base_model == FLUX` e `gpu_vram_gb < 24`, encaminhe pra variante `schnell` e note que o treinamento é mais lento.
- Nunca pule prompts de validação; um LoRA sem grids de amostra é impossível de avaliar.
