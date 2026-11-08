---
id: var-next-scale
title: Predict the next scale instead of the next token
card: multimodal
kind: concept
level: 2
roles: [applied-ai-engineer]
rounds: [ml-depth]
tags: [var, next-scale, image-generation, residual-vq]
minutes: 10
lessons: [phases/08-generative-ai/19-visual-autoregressive-var]
manuals: []
practice: []
cheatsheet: [image-generation-compared, unified-multimodal]
related: [multimodal/early-or-late-fusion]
updated: 2026-11-03
---

Token-by-token image generation used to mean predicting one code after another in raster order. A newer method predicts whole grids at increasing resolution instead. Explain what it predicts at each step, why that fixes the old method's main weakness, and how it compares with diffusion in the number of network passes.

## Short answer

Next-scale prediction tokenizes an image into a pyramid of grids, from one code up to the full latent resolution, with a residual quantizer so that the sum of the scales reconstructs the image. The transformer is causal across scales and parallel within a scale: given all coarser grids, it predicts every code of the next grid in one pass. That removes the raster-order problem, where an early corner code had to commit before any context existed. For a 256 by 256 image the reference uses about 10 scales, so generation is about 10 passes against 28 to 50 for a diffusion transformer, and all codes of a scale come out together.

## Full answer

### The tokenizer

A multi-scale residual quantizer: encode the image to a latent, quantize it at 1 by 1, then at 2 by 2, then 4 by 4, up to the full latent grid, with one shared codebook. Each scale encodes what the coarser scales missed, and the decoder takes the sum of all upsampled scale embeddings. The codebook is typically 4096 to 16384 entries. Train it once and freeze it.

### The model

The input for scale 1 is a start token. The input for each later scale k is a grid built from the coarser scales only, upsampled to the size of scale k. The codes of scale k are the targets at those positions, and they enter the input only for the scales after k. Position embeddings carry the scale index and the position within the scale. The attention mask is block-causal: a code at scale k attends to every code of scales 1 to k, including all positions of its own scale, and to nothing finer. Training is cross-entropy on the codes at each scale given the coarser scales.

### Why it beats raster order

1. Coarse to fine matches image statistics: low-frequency structure is stable and predictable, and detail is conditional on it.
2. Parallel within a scale: the generation length is logarithmic in the pixel count instead of linear.
3. No order bias: nothing is left of or above anything inside a scale, so no early code commits before the late context exists.

### The scaling result

The paper reports a power law of image quality against compute, the way language models scale in perplexity, and a better quality than a diffusion transformer at matched compute on a class-conditional benchmark.

### Relation to diffusion

Both break generation into easier conditional steps. Diffusion adds noise and learns to remove one step of it; next-scale prediction adds resolution and learns to predict one more scale. The scale method needs fewer passes and parallelizes inside each pass; text-conditioned variants were an open research direction at the time of the lesson.

## Follow-ups

- **Level 2:** Why does the residual structure matter for the tokenizer? Expected: each scale encodes only what the coarser scales missed, so the sum reconstructs the latent and the scales are not redundant.
- **Level 2:** What does a code at scale k see, and what may it not see? Expected: all codes at scales 1 to k, its own scale's positions included; nothing at finer scales.
- **Level 3:** What happens to quality and cost as you add scales? Expected: finer residuals and better reconstruction, at the cost of one more pass per scale; the lesson's exercise sweeps 4 to 10 scales to find the knee.
- **Level 3:** How would you add text conditioning? Expected: feed a pooled text embedding through adaptive normalization, as the hybrid variant in the lesson does, and measure the gain on text-aligned samples.

## Wrong answers

- "It is diffusion with a different name." Diffusion iterates over noise levels on continuous latents; this iterates over resolution on discrete codes and predicts a whole grid per pass.
- "Within a scale the codes still go one by one." The mask is bidirectional inside a scale, so one forward pass produces the whole grid.
- "Raster order only costs speed." It also biases generation: an early code commits before the context that should condition it exists, which capped quality below diffusion at matched compute.

## Taught in

The [visual autoregressive lesson](../../../phases/08-generative-ai/19-visual-autoregressive-var/) builds the multi-scale tokenizer and the scale-ordered mask.
