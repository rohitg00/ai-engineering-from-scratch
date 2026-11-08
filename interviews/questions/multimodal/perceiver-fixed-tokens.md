---
id: perceiver-fixed-tokens
title: Any number of images, a fixed number of tokens each
card: multimodal
kind: concept
level: 2
roles: [applied-ai-engineer]
rounds: [ml-depth]
tags: [perceiver-resampler, gated-cross-attention, interleaved, few-shot]
minutes: 12
lessons: [phases/12-multimodal-ai/04-flamingo-gated-cross-attention, phases/12-multimodal-ai/03-blip2-qformer-bridge]
manuals: []
practice: []
cheatsheet: [vlm-architectures]
related: [multimodal/image-tokens-per-image]
updated: 2026-11-03
---

A model must take a prompt with any number of images, some small and some large, interleaved with text, and then caption the last image from a few in-context examples. Explain the module that makes the number and the size of the images manageable, and how a text token knows which image to look at.

## Short answer

A resampler with a fixed set of learned latent vectors turns the patch tokens of each image into a fixed number of visual tokens. In the reference design, 64 latents attend over however many patches the encoder produced, 196 for a small image or 900 for a large one, through six blocks of cross-attention and self-attention, and every image exits as 64 tokens of one width. Text tokens then read those tokens through gated cross-attention layers inserted between the frozen language model blocks, and a mask lets each text token attend only to the latents of the most recent image before it in the sequence.

## Full answer

### The resampler

Each block does two things. The K latents cross-attend to the N patch tokens, with queries from the latents and keys and values from the patches; then the latents run self-attention and a feed-forward layer among themselves. After six blocks the output is K tokens of width 1024, whatever N was. For video the resampler runs on each frame, with a temporal position encoding, so the frame count times 64 is the token count of the clip.

### Why fixed matters

Interleaved prompts have zero, one or many images. With a fixed count per image, what any one text token sees in cross-attention has the same shape whatever the prompt. The total grows with the image count, but each text token reads one image's latents.

### The gated bridge

Between every fourth block of the frozen language model sits a new cross-attention layer with a residual gate: the output equals the block output plus the hyperbolic tangent of a learned scalar times the cross-attention. The scalar starts at zero, so at initialization the new layers do nothing, and the model is exactly the pretrained text model.

### The mask

In a sequence like image A, caption A, image B, caption B, image C, question, a text token attends only to the resampler tokens of the most recent image before it; the other images are masked. Attending to all preceding images is a valid alternative; the reference design chose the most recent one.

### In-context few-shot

Three image and caption pairs followed by a new image form a prompt that the frozen language model already knows how to complete. The gated layers feed it image content, and its in-context learning carries over without a gradient step. That is the point of keeping the language model frozen and the gate at zero.

### Against the single-input bridge

The query-based bridge from the earlier lesson also uses learned queries, but once, at the input layer, with 32 queries. The resampler plus gated cross-attention reads the latents every few layers, which costs more parameters and compute and buys interleaving and few-shot behavior.

## Follow-ups

- **Level 2:** Why does the latent side supply the query vectors and the patch side the rest, not the other way around? Expected: the output has one row per query, so queries from the latents give a fixed number of rows; the reverse would give one row per patch again.
- **Level 2:** What does the temporal encoding do for video? Expected: each frame gives the same 64 latents, so without a time signal the model cannot tell the first frame from the last; the encoding marks the frame index.
- **Level 3:** Why mask to the most recent image instead of all preceding images? Expected: it keeps the shape each text token sees constant and matches the interleaved reading order, where a caption describes the image before it; seeing all images is the alternative with a different trade-off.
- **Level 3:** A fine-tune of a model like this lost text-only quality. Where do you look? Expected: the gate; if it opened too wide too fast, visual noise overwrote the text residual stream, so compare the gate values by layer with the base.

## Wrong answers

- "Pad every image to the same number of patches." Padding wastes compute on large images and loses detail on small ones; the resampler gives a fixed count without either.
- "Let the text tokens attend to all image patches directly." The count then varies per image and per prompt, and a prompt with many images floods the attention; the latents keep it fixed.
- "Initialize the gate open so that the model learns faster." An open gate at step zero destroys the frozen language model's text behavior; a start at zero is what preserves it.

## Taught in

The [Flamingo lesson](../../../phases/12-multimodal-ai/04-flamingo-gated-cross-attention/) walks the resampler, the gated layers and the interleaved mask, and the [BLIP-2 lesson](../../../phases/12-multimodal-ai/03-blip2-qformer-bridge/) gives the query bridge that it is compared with.
