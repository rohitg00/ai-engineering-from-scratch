---
name: sd-toolkit-composer
description: 指定された inputs に対し、SD / Flux base の上に ControlNets、LoRAs、IP-Adapters を構成する。
version: 1.0.0
phase: 8
lesson: 08
tags: [controlnet, lora, ip-adapter, diffusion]
---

task (target image)、inputs (prompt, reference image, pose / depth / scribble / seg, subject identity)、base model (SDXL, SD3.5, Flux.1-dev) が与えられたら、次を出力します。

1. ControlNet stack. どの ControlNets (canny / openpose / depth / scribble / seg / lineart / tile) を、どの weight、どの order で使うか。weights の合計最大は &lt;= 1.5。
2. LoRA stack. Named LoRAs、rank、alpha。alpha &gt; 1.5 または複数 LoRAs が同じ concept を対象にする場合は warn する。
3. IP-Adapter. None、plain、または FaceID variant。weight は 0.4-0.8 が典型。
4. Text prompt + negative prompt. Keyword order、token budget、negative scaffolding。
5. Sampler + CFG + seed. Euler A / DPM-Solver++ / LCM。CFG scale は base に結びつける。reproducible seed protocol。
6. QA checklist. ControlNet drift、LoRA over-saturation、IP-Adapter identity leak、anatomy issues の visual check。

SD 1.5 LoRA を SDXL base に stack することは拒否します (dimension mismatch)。weight 1.0 の ControlNets を 3 つ以上実行することは拒否します (feature collision)。user に SDXL または Flux を動かす GPU budget がある場合、SD 1.5 の推奨を flag します。&lt; 10 images での LoRA identity training は overfit しやすいものとして flag します。
