---
id: train-only-the-projector
title: Why the first VLM stage trains only the bridge
card: multimodal
kind: concept
level: 1
roles: [applied-ai-engineer]
rounds: [screen, ml-depth]
tags: [projector, frozen-backbone, alignment, vlm]
minutes: 8
lessons: [phases/19-capstone-projects/60-projection-layer-modality-align, phases/12-multimodal-ai/05-llava-visual-instruction-tuning, phases/12-multimodal-ai/03-blip2-qformer-bridge]
manuals: []
practice: []
cheatsheet: [vlm-from-scratch, vlm-architectures]
related: [multimodal/vlm-three-parts]
updated: 2026-11-03
---

In the first training stage of most open vision-language models, both the vision encoder and the decoder are frozen, and only the small projector learns. A junior engineer asks why anyone would train the smallest part first instead of the parts that matter. Answer them.

## Short answer

The two big parts already work: the encoder represents images, and the language model writes text. What is missing is a translation between their two vector spaces, and that translation is small. Training only the bridge costs a few hundred steps on one GPU, cannot damage either pretrained part, and gives the language model inputs it can read before anyone unfreezes it. Unfreezing the language model comes in the second stage, once the bridge produces tokens that look like language.

## Full answer

### What the projector is

A two-layer MLP: linear, GELU, linear. The capstone's head maps 768 to 1024 to 512 and holds about 1.3M parameters next to an encoder of 86M. The reference open recipe's head maps 1024 to 4096 to 4096, about 22M parameters next to a 303M encoder and a 7B language model.

### Why the frozen big parts are the point

- Stability. Gradients from a few thousand noisy pairs would overwrite features that the encoder learned from hundreds of millions of images.
- Cost. The alignment stage of the reference recipe trains on 558k caption pairs in a few hours at a batch of 128. The capstone's version drives its loss from about 1.07 to about 0.80 in 200 steps.
- A clean signal. With both big parts fixed, the loss moves only through the bridge, so you can read whether the two spaces align.
- Swappability. Change the language model and retrain the bridge; the encoder stays.

### What the loss is

The reference recipe uses the language-modeling loss on the caption, conditioned on the projected image tokens. The capstone uses a per-pair cosine alignment loss, one minus the cosine between a pooled image vector and a mean-pooled caption embedding, so that the dynamics stay visible; a contrastive batch version is the next lesson.

### What comes after

Stage two unfreezes the language model, fully or through adapters, keeps the bridge trainable, and trains on instruction data. A bridge that was never aligned first gives the language model noise at the start of that stage.

### The other kind of bridge

A query-based bridge with a fixed set of learned vectors compresses the image to a fixed token count. It is larger, 188M parameters in the original, and it still trains with the backbones frozen; the principle is the same.

## Follow-ups

- **Level 1:** What does a frozen parameter mean in code? Expected: `requires_grad=False`, so the optimizer never sees it, and no memory goes to its gradient or optimizer state.
- **Level 2:** Why pool the image tokens before the cosine loss in the capstone? Expected: the caption side is one vector, so the image side needs one vector too; the first token or the mean over all tokens are the usual choices.
- **Level 2:** One linear layer would be smaller still. Why two? Expected: a single linear map can rotate and rescale but cannot bend; the GELU between two layers gives the one non-linear bend that aligns contrastive vision features to language embeddings.
- **Level 3:** What breaks if you skip the alignment stage and start with instruction tuning with everything unfrozen? Expected: the language model receives unaligned inputs, and its gradients on a small set damage its text ability; the two stages exist to give it readable inputs first.

## Wrong answers

- "Train the encoder; it is the part that sees." It already sees, and a small dataset cannot teach it more than it loses by overwriting features; the missing part is the translation.
- "The projector is too small to carry an image." It does not carry the image; it maps tokens that already encode the image into the space the language model reads.
- "Freezing is only a memory trick." Memory is one gain; the larger ones are stability, a clean training signal, and the ability to swap the language model.

## Taught in

The [projection capstone](../../../phases/19-capstone-projects/60-projection-layer-modality-align/) trains the bridge alone with a cosine loss, the [LLaVA lesson](../../../phases/12-multimodal-ai/05-llava-visual-instruction-tuning/) gives the two-stage recipe and its parameter counts, and the [BLIP-2 lesson](../../../phases/12-multimodal-ai/03-blip2-qformer-bridge/) explains the frozen-backbone economics.
