---
id: qformer-or-mlp
title: Query bridge or MLP for the connector
card: multimodal
kind: tradeoff
level: 2
roles: [applied-ai-engineer, inference-engineer]
rounds: [system-design, ml-depth]
tags: [q-former, mlp-projector, token-budget, connector]
minutes: 12
lessons: [phases/12-multimodal-ai/03-blip2-qformer-bridge, phases/12-multimodal-ai/05-llava-visual-instruction-tuning, phases/12-multimodal-ai/07-open-weight-vlm-recipes]
manuals: []
practice: []
cheatsheet: [vlm-architectures, vlm-model-families]
related: [multimodal/image-tokens-per-image]
updated: 2026-11-03
---

You are choosing the bridge between a frozen vision encoder and a language model that stays frozen, for a new product. One architect wants a query-based transformer that compresses each image to a fixed set of tokens. Another wants a plain MLP that passes every patch through. How do you decide?

## Short answer

Decide on the token budget, not on quality in the abstract. At a fixed number of visual tokens, the ablation studies find the connector architecture a wash, within about a point between an MLP on mean-pooled patches, a query bridge and a resampler; a full-patch MLP spends more tokens, so it sits at a different budget. The query bridge caps an image at 32 tokens whatever its resolution and costs 188M parameters plus a two-stage pretraining of its own; the MLP emits every patch, 576 for a 336-pixel image, with about 22M parameters and one language-modeling loss. Pick the compressing bridge when context binds, as with long video or many images; pick the MLP when quality per token and simplicity matter and the context is long enough.

## Full answer

### The two bridges

| | Query bridge | MLP |
|---|---|---|
| Visual tokens per image | 32, fixed | 576 at 336 pixels, about 2880 with tiling |
| Trainable parameters, language model frozen | 188M | about 22M |
| Pretraining | a representation stage with contrastive, matching and generation losses, then a generative stage | the language-modeling loss throughout |
| Swap the language model | retrain the bridge | retrain a small head |
| Many images and video | awkward, but cheap in tokens | natural concatenation, expensive in tokens |

### What the ablations say

Several controlled studies reached one result. At a fixed visual-token count, the connector explains about 5 percent of the variance in benchmark scores, the per-image token count about 60 percent, and the encoder about 20. An MLP on pooled patches lands within 1 point of a 32-query bridge at the same budget. So the question is how many tokens you can afford, and which encoder you use.

### Why the field split

The compressing bridge wins where the token budget binds: long video, many images in one prompt, small contexts. The MLP won the single-image case once contexts grew to 32k and beyond, because every patch stays visible to the language model and the recipe has no stage-one losses to tune. Token budgets from the ablations: 64 per image is too few for reading text, 576 to 1024 is the sweet spot for most tasks, and 2048 and above pays only for documents and charts.

### Hidden costs of the query bridge

Its queries learn an intermediate representation that the language model must then decode, so information is lost in the bottleneck. Change the language model or the encoder, and you retrain it. An instruction-aware variant feeds the instruction into the queries so that they can specialize per question, which recovers some of the loss.

### A decision rule

1. Count the tokens per image at your resolution and multiply by the images per prompt.
2. If it fits the context with room for text, use the MLP and spend the effort on the encoder and the data.
3. If it does not, use a compressing bridge, and accept the retraining cost when parts change.

## Follow-ups

- **Level 2:** Why does the query bridge need a pretraining stage of its own? Expected: its queries start random and must learn to pull text-relevant content from the patches before the language model can use them; the MLP starts from patches that already carry the image.
- **Level 2:** What do the three stage-one losses do? Expected: contrastive alignment of pooled queries with text, a matching classifier with hard negatives, and image-grounded text generation that forces the queries to encode what text needs.
- **Level 3:** A team picked the MLP and now serves ten-minute videos. What do they hit first? Expected: the context; tokens per frame times frames exceeds any window, so they need heavy frame sampling or a compressing bridge after all.
- **Level 3:** If the connector barely matters, where does the quality come from? Expected: the encoder, the token count, the data mix and the resolution schedule; the recipes lesson's decomposition puts the connector last.

## Wrong answers

- "The query bridge is more advanced, so it gives better answers." At the same token count the two are within about a point; its advantage is compression, not quality.
- "The MLP is always better because it keeps every patch." Keeping every patch costs tokens; with many images or video the context runs out before quality matters.
- "Pick the bridge first and the encoder later." The encoder and the token count explain most of the variance; the bridge is the last knob to turn.

## Taught in

The [BLIP-2 lesson](../../../phases/12-multimodal-ai/03-blip2-qformer-bridge/) explains the query bridge and its two-stage training, the [LLaVA lesson](../../../phases/12-multimodal-ai/05-llava-visual-instruction-tuning/) tabulates the two bridges, and the [recipes lesson](../../../phases/12-multimodal-ai/07-open-weight-vlm-recipes/) gives the ablation results.
