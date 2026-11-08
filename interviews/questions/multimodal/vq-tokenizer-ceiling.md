---
id: vq-tokenizer-ceiling
title: Why the tokenizer caps a generated image
card: multimodal
kind: concept
level: 3
roles: [applied-ai-engineer]
rounds: [ml-depth]
tags: [vq-vae, tokenizer-ceiling, transfusion, image-generation]
minutes: 12
lessons: [phases/12-multimodal-ai/11-chameleon-early-fusion-tokens, phases/12-multimodal-ai/12-emu3-next-token-for-generation, phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified]
manuals: []
practice: []
cheatsheet: [unified-multimodal, image-generation-compared]
related: [multimodal/emu3-generation-cost, multimodal/early-or-late-fusion]
updated: 2026-11-03
---

In the unified-generation family, the quality of a generated image is said to be capped by the tokenizer, not by the transformer. Explain why, show what moved the cap between two generations of models, and say which design avoids the cap entirely and at what cost.

## Short answer

A discrete image tokenizer is lossy: the decoder can only render what the codes carry, so the best image the model can ever produce is the tokenizer's own reconstruction of a real image. The first shared-vocabulary model used 1024 codes per 512 by 512 image from a codebook of 8192 and reconstructed at about 26 to 28 dB; the next generation used four times the codes, 4096, and a codebook four times larger, 32768, and reached 30.5 dB, close to the 32 dB of continuous latent diffusion. The design that avoids the cap keeps image patches continuous and trains a diffusion loss on them next to the text loss in one transformer; it drops the quantizer and gains fidelity, and pays with two losses on different scales to balance and a sampling loop at generation time.

## Full answer

### Why the cap exists

The transformer predicts codes. The decoder turns codes into pixels with no other input. Whatever detail the quantizer threw away at encoding time cannot come back: a perfect transformer that predicts the exact codes of a real image renders the tokenizer's reconstruction of that image, nothing better. The reconstruction quality is therefore an upper bound on fidelity to a real image, which is what the dB figures below measure. Distribution metrics measure a different property and do not share this bound.

### What moved the cap

| Model generation | Codes per 512 by 512 image | Codebook | Reconstruction |
|---|---|---|---|
| the first shared-vocabulary model | 1024 | 8192 | about 26 to 28 dB |
| the next-token generation model | 4096 | 32768 | 30.5 dB |
| continuous latent diffusion, for reference | continuous | none | about 32 dB |

Four times the codes carry four times the spatial detail, and a codebook four times larger carries finer values per code. The newer model's main contribution is a better tokenizer, and with it next-token prediction matched a diffusion model on an image generation benchmark.

### The cost of more codes

Each code is one decode pass in plain next-token generation, so four times the codes is four times the generation time. Masked parallel decoding keeps discrete codes and predicts all masked positions at once in about 16 passes, which pays back the cost of the larger grid.

### The design without a cap

Keep the image continuous. Project patches with a linear layer, as a vision transformer does at its input, and train one transformer with two losses: cross-entropy on text tokens and a flow-matching loss on noisy image patches. There is no quantizer to bound the detail. The paper reports a better image score than a same-size discrete model by 3 to 5 points. The price: two losses of different magnitude whose weights need tuning, a block-triangular attention mask, and a denoising loop of a few dozen steps per image at generation time.

### Which to pick

Discrete codes when one next-token stack must handle understanding and the generation of images and video with one loss, and you accept the tokenizer's ceiling. Continuous patches when image fidelity is the priority and the two-loss plumbing is acceptable.

## Follow-ups

- **Level 3:** Why is the reconstruction score of the tokenizer the right number to read before you train the transformer? Expected: it is the ceiling; no amount of transformer scale lifts a generated image above what the decoder can render from the codes.
- **Level 3:** What else besides the codebook and the code count lifts a tokenizer? Expected: the quantizer design; the newer models use an inverse-bottleneck quantizer family that uses the larger codebook well, where a naive larger codebook leaves codes unused.
- **Level 4:** How does the attention mask differ in the continuous design? Expected: causal over text tokens, bidirectional among the patches of one image, text attends to images that closed before it, and image patches attend to the preceding text; a block-triangular mask.
- **Level 4:** Which side of this trade-off does the masked discrete design sit on? Expected: discrete, with the tokenizer ceiling, but with parallel decoding in a few passes; it trades the fidelity of continuous diffusion for simpler training and fast sampling.

## Wrong answers

- "Scale the transformer and the images get sharper." The transformer predicts codes; sharpness beyond the tokenizer's reconstruction does not exist in the codes to predict.
- "A bigger codebook is enough." The code count sets the spatial detail and the codebook sets the value detail; the newer tokenizer raised both, and the quantizer design decides whether a large codebook is used.
- "Continuous patches are strictly better, so discrete codes are obsolete." Continuous patches cost two losses to balance and a denoising loop per image; the discrete family keeps one loss and one decoder for every modality, which is why both survive.

## Taught in

The [Chameleon lesson](../../../phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/) names the tokenizer as the reconstruction ceiling, the [Emu3 lesson](../../../phases/12-multimodal-ai/12-emu3-next-token-for-generation/) shows how a better tokenizer moved it, and the [Transfusion lesson](../../../phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/) gives the continuous design and its costs.
