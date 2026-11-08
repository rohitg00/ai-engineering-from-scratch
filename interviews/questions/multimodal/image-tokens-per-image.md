---
id: image-tokens-per-image
title: How much context one image costs
card: multimodal
kind: estimate
level: 1
roles: [applied-ai-engineer, inference-engineer, forward-deployed-ai-engineer]
rounds: [screen, system-design]
tags: [visual-tokens, context-budget, anyres, q-former]
minutes: 8
lessons: [phases/12-multimodal-ai/05-llava-visual-instruction-tuning, phases/12-multimodal-ai/03-blip2-qformer-bridge, phases/12-multimodal-ai/07-open-weight-vlm-recipes]
manuals: []
practice: []
cheatsheet: [vlm-architectures, vlm-model-families]
related: [multimodal/vlm-three-parts]
updated: 2026-11-03
---

A product manager asks how much of the context window one image uses in a LLaVA-style model with a 336-pixel encoder. Give the number, say where it comes from, and say how it changes with high-resolution tiling or with a query-based bridge.

## Short answer

One image costs 576 tokens: the encoder cuts the 336-pixel image into 14-pixel patches, a 24 by 24 grid, and the projector passes every patch token through. In a 2048-token context that leaves 1472 tokens for text; at 32k or 128k it is a small share. Tiling multiplies it: a 2 by 2 grid of 336-pixel crops plus one global thumbnail gives about 2880 tokens per image, and a 1 by 3 grid plus the thumbnail gives fewer, because it has one crop less. A query-based bridge compresses any image to a fixed 32 tokens, and a resampler to 64.

## Full answer

### Where the count comes from

```text
336 / 14 = 24 patches per side
24 x 24 = 576 patch tokens
each token: 1024 wide from the encoder, 4096 wide after the projector
```

The earlier 224-pixel encoder gave 256 tokens. The move to 336 pixels raised the count to 576, and the training sequences stayed at 2048 tokens.

### What it costs in context

| Context | One image |
|---|---|
| 2048 | 576 tokens, leaving 1472 for text |
| 32k | a small share |
| 128k | a rounding error |

### Tiling for high resolution

Documents and charts need more pixels. The tiling scheme splits the image into a 2 by 2 or 1 by 3 grid of 336-pixel crops, adds one low-resolution global view, and concatenates the tokens of every crop: about 2880 visual tokens per image for the 2 by 2 grid, and fewer for the 1 by 3 grid, which has one crop less. Reading and chart scores jumped with it.

### The compressing bridges

A query-based bridge uses a fixed set of 32 learned query vectors that cross-attend to the patch tokens, so any image becomes 32 tokens. A resampler with 64 latents does the same at 64. The price is a bottleneck: the language model never sees the raw patches.

### How many tokens you need

The ablations in the recipes lesson put the sweet spot for most tasks at 576 to 1024 visual tokens per image, 64 as too few for reading text, and 2048 or more as useful only for documents and charts. The token count explains more of the variance in benchmark scores than the connector architecture does.

## Follow-ups

- **Level 1:** Why does a higher input resolution raise the token count? Expected: the patch size is fixed, so more pixels per side means more patches per side, and the count grows with the square of the side.
- **Level 2:** Which tasks justify the tiling cost? Expected: text in images, charts and documents; general scene questions gain little from it.
- **Level 2:** When does the 32-token bridge win? Expected: when the token budget binds, as with long video or many images per prompt; for one image in a long context the compression buys little.
- **Level 3:** How do you size the budget for video? Expected: tokens per frame times frames, so a compressing bridge or heavy frame sampling is the only way to fit minutes of video; count the tokens before you pick the bridge.

## Wrong answers

- "An image costs one token, the placeholder." The placeholder is replaced by one embedding per patch token before the forward pass; the encoder grid sets the count.
- "Higher resolution is free because the encoder is fixed." More patches means more visual tokens in the language model's sequence, and the language model's compute grows with them.
- "The connector decides the quality, so pick the bridge first." At a fixed token count the connector barely matters; the token count and the encoder matter more.

## Taught in

The [LLaVA lesson](../../../phases/12-multimodal-ai/05-llava-visual-instruction-tuning/) counts the tokens per image and per tiled image, the [BLIP-2 lesson](../../../phases/12-multimodal-ai/03-blip2-qformer-bridge/) explains the fixed-count bridge, and the [recipes lesson](../../../phases/12-multimodal-ai/07-open-weight-vlm-recipes/) gives the token budget ablations.
