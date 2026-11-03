---
id: emu3-generation-cost
title: What one generated image costs in codes and seconds
card: multimodal
kind: estimate
level: 2
roles: [applied-ai-engineer, inference-engineer]
rounds: [screen, system-design]
tags: [emu3, tokens, latency, image-generation, video]
minutes: 10
lessons: [phases/12-multimodal-ai/12-emu3-next-token-for-generation, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified, phases/12-multimodal-ai/11-chameleon-early-fusion-tokens]
manuals: []
practice: []
cheatsheet: [unified-multimodal, image-generation-compared]
related: [multimodal/early-or-late-fusion]
updated: 2026-11-03
---

A unified next-token model generates a 512 by 512 image as a sequence of discrete codes. Estimate how long one image takes at a typical decode speed, compare it with a diffusion model, and say what a four-second video clip at low resolution costs in codes. Then name the levers that change the answer.

## Short answer

The reference model's tokenizer reduces 8 by 8 pixels to one code, so a 512 by 512 image is 4096 codes; at about 30 codes per second that is about 2 minutes per image, against 2 to 5 seconds for a diffusion model of the same quality tier. A 4-second clip at 8 frames per second is 32 frames; with the same 8 times spatial reduction and a 4-frame temporal reduction, a 256 by 256 clip is 32 times 32 times 8, which is 8,192 codes. The levers are the codes per image, the decode speed through speculative decoding or the KV cache, and a different decoding scheme such as masked parallel decoding, which needs about 16 passes instead of one pass per code.

## Full answer

### The image

```text
512 / 8 = 64 codes per side
64 x 64 = 4096 codes per image
4096 codes at about 30 per second = about 2 minutes
```

A diffusion model samples a continuous latent in a few dozen steps and finishes in 2 to 5 seconds. Autoregressive image generation is compute-heavy by construction: one pass per code.

### The video

The video tokenizer is three-dimensional: one code covers 4 frames by 8 by 8 pixels.

```text
frames: 4 s x 8 per second = 32
codes: (256 / 8) x (256 / 8) x (32 / 4) = 32 x 32 x 8 = 8,192
```

### Why the model pays this price

The same weights do image generation, image understanding and video with one next-token loss, no diffusion schedule and no separate text encoder. The tokenizer's quality is the ceiling: the reference reports a reconstruction of 30.5 dB against about 32 for a continuous latent space, with four times the codes and four times the codebook of the earlier early-fusion model.

### The inference knobs

- Classifier-free guidance: generate with and without the caption and mix the logits with a weight, typically 3.0 to 7.0; it doubles the forward passes per code.
- Temperature: 0.8 for image generation and 1.0 for understanding in the reference recipe.
- Speculative decoding narrows the gap to diffusion, and so does the KV cache, but neither closes it.

### A different decoding scheme

Masked parallel decoding keeps discrete codes but predicts all masked positions at once and commits the most confident ones, in about 16 passes for an image, against about 20 for continuous diffusion and one pass per code for plain next-token generation.

## Follow-ups

- **Level 2:** Why does guidance double the cost? Expected: each step needs a conditional and an unconditional forward pass to mix.
- **Level 2:** What happens to the per-image time at 1024 by 1024? Expected: four times the codes at the same reduction, so about four times the decode time; the lesson's exercise asks for that count.
- **Level 3:** Where does the quality ceiling of this model sit, and what moved it up from the first shared-vocabulary model? Expected: in the tokenizer's reconstruction; four times the codes per image and a four times larger codebook lifted it to 30.5 dB.
- **Level 3:** When do you still pick this over a diffusion model? Expected: when one model must understand and generate across image, video and text with one loss, and the latency budget allows minutes per image or a batch pipeline.

## Wrong answers

- "An image is a few hundred tokens, like a VLM input." Those are projected encoder tokens for understanding; generation needs discrete codes at the tokenizer's density, 4096 for this image size.
- "Diffusion is slower because it iterates." Diffusion takes a few dozen passes over all pixels at once; next-token generation takes one pass per code, thousands per image.
- "A larger codebook makes generation faster." It raises the reconstruction quality; the pass count is set by the number of codes, not by the codebook size.

## Taught in

The [Emu3 lesson](../../../phases/12-multimodal-ai/12-emu3-next-token-for-generation/) counts the image and video codes and gives the decode cost, and the [Show-o lesson](../../../phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/) compares the pass counts of the three decoding schemes.
