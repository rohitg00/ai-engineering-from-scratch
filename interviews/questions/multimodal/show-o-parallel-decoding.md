---
id: show-o-parallel-decoding
title: Three ways to generate an image from one transformer
card: multimodal
kind: tradeoff
level: 3
roles: [applied-ai-engineer, inference-engineer]
rounds: [system-design, ml-depth]
tags: [masked-diffusion, parallel-decoding, inpainting, unified-models]
minutes: 12
lessons: [phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified, phases/12-multimodal-ai/12-emu3-next-token-for-generation, phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion]
manuals: []
practice: []
cheatsheet: [unified-multimodal, image-generation-compared]
related: [multimodal/emu3-generation-cost, multimodal/vq-tokenizer-ceiling]
updated: 2026-11-03
---

Your team needs one open model for answering questions about images, text-to-image generation and inpainting, with a usable generation latency. One candidate generates images one code at a time; another denoises continuous patches; a third stays with discrete codes and fills them in parallel over a few passes. Compare the three on passes, training complexity and what comes for free.

## Short answer

Next-token generation over codes needs one pass per code, 1024 to 4096 passes per image, with one simple loss. Continuous diffusion in a shared transformer needs about 20 passes, but it trains two losses on different scales. Masked discrete decoding keeps codes and one cross-entropy loss, predicts all masked positions at once and commits the most confident ones each pass, so an image takes about 16 passes; inpainting is free, because the training objective is to fill masked codes from the rest. For a product that wants all three tasks in one open model at a usable latency, the masked discrete design is the fit, and the continuous design is the pick when fidelity is paramount.

## Full answer

### How masked discrete decoding works

Training samples a masking ratio uniformly, masks that share of an image's codes, and trains the transformer to recover them. That generalizes next-token prediction: for text only the last position is masked, for an image a random subset is. At inference, start from a fully masked grid, predict every masked position in parallel, keep the most confident predictions, re-mask the rest, and repeat on a schedule. A cosine schedule, the mask ratio as the cosine of pi times the step over twice the total steps, concentrates the work at mid-range ratios where predictions are most informative.

### The attention mask

Text tokens are causal. Image codes attend to every other code of the same image, so a masked position can see all of its neighbors. Text attends to prior images, and image codes attend to prior text.

### The comparison

| Design | Passes per image | Losses | Free extras |
|---|---|---|---|
| Next-token over codes | one per code, 1024 to 4096 | one cross-entropy | video with a 3D tokenizer; one stack for everything |
| Continuous diffusion in the transformer | about 20 | cross-entropy plus a diffusion loss on patches | the highest fidelity, no quantizer |
| Masked discrete decoding | about 16 | one cross-entropy on masked positions | inpainting; one checkpoint for answering, writing and generating |

Per pass, the masked design is cheaper than continuous diffusion, because it emits discrete logits rather than a continuous regression at every patch.

### What the masked design pays

It keeps the tokenizer ceiling of every discrete design: the image can be no better than the quantizer's reconstruction. Unmasking everything in one pass fails, because the codes are predicted independently and the result is incoherent; the schedule exists so that committed codes condition the rest.

### Inpainting for free

Mask the codes of a region, feed the rest plus a text prompt, and predict the masked ones. No new objective and no new head: the training task was exactly this.

## Follow-ups

- **Level 3:** Why can the model not unmask everything in one pass? Expected: each masked position is predicted from a marginal that ignores the others, so the sampled codes do not agree; committing the confident ones first gives the rest conditioning.
- **Level 3:** Why does a cosine schedule beat a linear one? Expected: it spends more steps at the mid-range ratios where each prediction is most informative, while a linear schedule plateaus earlier.
- **Level 4:** Where does the per-step cost differ between masked discrete and continuous diffusion? Expected: both are full transformer passes, but the discrete head emits logits over the codebook while the continuous head regresses a velocity for every patch; the discrete pass is cheaper per step.
- **Level 4:** What would make you give up the one-model simplicity for a specialist? Expected: a fidelity requirement above the tokenizer ceiling, or a latency budget that even sixteen full passes cannot meet, where a dedicated continuous generator wins.

## Wrong answers

- "Masked decoding is diffusion, so it needs a noise schedule." It is discrete: positions are masked, not noised, and the schedule sets how many codes to commit per pass.
- "Next-token generation is the fastest because each pass is small." Each pass is a full transformer pass over the sequence, and there are thousands of them per image.
- "Inpainting needs a separate model." The masked objective is inpainting; masking a region at inference is the task the model trained on.

## Taught in

The [Show-o lesson](../../../phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/) walks the masked decoding, the schedule and the task list, the [Emu3 lesson](../../../phases/12-multimodal-ai/12-emu3-next-token-for-generation/) gives the per-code cost, and the [Transfusion lesson](../../../phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/) gives the continuous alternative.
