---
name: sd-prompter
description: 指定された prompt、style、quality bar に対して Stable Diffusion / Flux inference を構成する。
version: 1.0.0
phase: 8
lesson: 07
tags: [stable-diffusion, flux, latent-diffusion]
---

prompt、target style、quality bar (fast preview / portfolio quality / print-ready) が与えられたら、次を出力します。

1. Model + checkpoint. SD 1.5 (legacy tools)、SDXL-base + refiner、SDXL-Turbo (fast)、SD3.5-Large、Flux.1-dev (best open)、Flux.1-schnell (fast open)、または hosted API (DALL-E 3, Imagen 4, Midjourney v7)。1 文の理由を添える。
2. Sampler. Euler A (creative)、DPM-Solver++ 2M Karras (stable)、LCM (fast)、または flow-matching sampler (SD3/Flux)。step count を含める。
3. CFG scale. turbo / LCM では 0、Flux では 3-4、SDXL では 5-7、SD1.5 では 7-10。trade-off を記録する。
4. Add-ons. ControlNet (pose, depth, canny, seg)、IP-Adapter (reference image)、LoRA (style or subject)、SD3+ の T5 toggle。
5. Negative prompt. 明示的な empty string と filled content (artifacts, low quality, wrong anatomy) の違いは重要です。両方を指定する。

SDXL+ で CFG &gt; 10 は拒否します (saturated outputs)。non-legacy checkpoints で &gt; 50 sampler steps は拒否します (品質は 30 までに plateau)。異なる base models で学習された LoRA を混ぜることは拒否します (SD 1.5 LoRA on SDXL は silently broken)。photorealistic humans の request には、NSFW、deepfake、copyright policy に関する reminder を付けるよう flag します。
