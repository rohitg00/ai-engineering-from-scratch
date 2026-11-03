---
id: early-or-late-fusion
title: Adapter tokens or one shared vocabulary for images
card: multimodal
kind: tradeoff
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, ml-breadth]
tags: [early-fusion, late-fusion, vq-vae, image-generation]
minutes: 12
lessons: [phases/12-multimodal-ai/11-chameleon-early-fusion-tokens, phases/19-capstone-projects/61-cross-attention-fusion, phases/12-multimodal-ai/12-emu3-next-token-for-generation]
manuals: []
practice: []
cheatsheet: [unified-multimodal, vlm-architectures]
related: [multimodal/vlm-three-parts]
updated: 2026-11-03
---

A product needs a model that reads screenshots and answers questions today, and might need to draw diagrams later. Two designs are on the table: an adapter model, where a vision encoder feeds projected tokens into a text-only decoder, and a model that turns images into discrete codes in the same vocabulary as text and trains one next-token loss over interleaved sequences. Compare them and pick for this product.

## Short answer

The adapter design is late fusion: images enter as projected continuous tokens or through cross-attention, the decoder reuses all its text pretraining, and the output is text only. The shared-vocabulary design is early fusion: a quantizer maps an image to discrete codes, the transformer trains one loss over text and image codes, and it can emit image codes, so it generates pictures. For a product that must read screenshots now, pick the adapter: it reuses more pretrained compute, has no quantizer ceiling for understanding, and is cheaper to serve; add the early-fusion model only when drawing becomes a real requirement, because its image quality is capped by the quantizer and each generated image costs a decoder pass over a thousand or more codes.

## Full answer

### Two paths into the model

| | Late fusion, adapter | Early fusion, shared vocabulary |
|---|---|---|
| Image input | encoder features projected into the embedding space, or read through cross-attention | discrete codes from a learned quantizer, looked up like text tokens |
| Loss | language-modeling loss on text | a single next-token loss on text and image codes together |
| Output | text only | text and images, interleaved as the model chooses |
| Reuse of the pretrained LLM | full | the model trains on the mixed stream from the start |
| Ceiling for understanding | the encoder | the quantizer's reconstruction |
| Serving cost per answer | one decoder step per generated text token | one decoder step per generated text token, plus 1024 sequential decoding steps per generated image, one per code, then a decoder pass for the pixels |

### What early fusion buys

One sequence, one loss, and mixed-modality output. The reference model's quantizer maps a 512 by 512 image to 1024 codes from a codebook of 8192, inside a single vocabulary of 65,536 entries that also holds the text tokens and the separators. When the model emits the image-start separator, the next 1024 codes go to the decoder for pixels.

### What it costs

- A quality ceiling. The quantizer is lossy; at that codebook and code count the reconstruction peaks around 26 to 28 dB, below the 32 and more of continuous latent diffusion. A better quantizer lifts the ceiling, but the ceiling is the quantizer.
- Training stability. Early-fusion training at scale diverged without normalization of the attention queries and keys, dropout after every residual, and an extra normalization on the last block.
- Compute. Every generated image is a decoder pass over its codes.

### What late fusion buys

It bolts onto any pretrained decoder, keeps the text stream clean so that text ability survives, and computes the image once; with cross-attention the image keys and values are cached across decode steps. It cannot emit images.

### The pick

Reading screenshots is understanding, and the adapter is the simpler and stronger tool for it today. When drawing arrives, measure whether a separate generation model behind a tool call meets the need before you move the whole stack to early fusion.

## Follow-ups

- **Level 2:** Why can the adapter model not generate an image? Expected: its output head covers the text vocabulary only; images enter as embeddings and never exist as tokens it could predict.
- **Level 2:** What is the shared vocabulary made of? Expected: text tokens, image codes and modality separators in one id space, so one embedding table and one output projection cover all of them.
- **Level 3:** Where does the quality ceiling of the early-fusion model come from, and what moves it? Expected: the quantizer's reconstruction; a larger codebook and more codes per image raise it, as the next generation of tokenizers showed.
- **Level 3:** A hybrid keeps images continuous and trains a diffusion loss on patches next to the text loss. What does it trade? Expected: no quantizer and higher image fidelity, against two losses on different scales to balance and a diffusion sampling loop at generation time.

## Wrong answers

- "Early fusion is the future, so start there." For understanding alone it reuses less pretrained compute and caps quality at the quantizer; the adapter is the simpler, stronger choice until generation is required.
- "The adapter can draw if you add a decoder head." Its images never exist as predictable tokens; drawing needs either image codes in the vocabulary or a separate generation model.
- "The quantizer is a detail; the transformer does the work." In the early-fusion family the quantizer sets the ceiling on every image the model produces.

## Taught in

The [Chameleon lesson](../../../phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/) sets out the early-fusion thesis and its costs, the [cross-attention fusion capstone](../../../phases/19-capstone-projects/61-cross-attention-fusion/) builds the late-fusion path, and the [Emu3 lesson](../../../phases/12-multimodal-ai/12-emu3-next-token-for-generation/) shows what a better quantizer changes.
