---
id: vlm-three-parts
title: The three parts of a vision-language model
card: multimodal
kind: concept
level: 1
roles: [applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-breadth]
tags: [vlm, projector, vision-encoder, alignment]
minutes: 8
lessons: [phases/04-computer-vision/25-vision-language-models, phases/19-capstone-projects/60-projection-layer-modality-align, phases/12-multimodal-ai/05-llava-visual-instruction-tuning]
manuals: []
practice: []
cheatsheet: [vlm-architectures, vlm-from-scratch]
related: [multimodal/train-only-the-projector, multimodal/image-tokens-per-image]
updated: 2026-11-03
---

Draw the standard architecture of a vision-language model that answers questions about an image. Name its three parts, say what each one contributes, and say which part you would expect to train when a team fine-tunes on a few thousand labelled images.

## Short answer

A vision encoder, a projector and a language model. The encoder, a pretrained vision transformer, turns the image into patch tokens. The projector, a small two- to four-layer MLP or a query-based bridge, maps those tokens into the language model's embedding space, where they replace a placeholder token in the prompt. The decoder language model reads image tokens and text tokens as one sequence and writes the answer; in most fine-tunes the encoder and the language model stay frozen or get adapters, and the projector is where the training happens.

## Full answer

### The three parts

1. Vision encoder. A pretrained vision transformer, contrastively trained or self-supervised, produces one token per patch. With a 336-pixel input and a 14-pixel patch, the reference model gets 576 tokens of width 1024.
2. Projector. A two-layer MLP with a GELU between the layers, from the encoder width to the language model width, 1024 to 4096 to 4096 in the reference model. The capstone's toy head, 768 to 1024 to 512, has about 1.3M parameters.
3. Language model. A decoder-only model that receives the projected image tokens in place of an image placeholder and the text tokens after them, then generates text.

### How the pieces meet

The prompt holds a placeholder image token. Before the forward pass, the embeddings at those positions are overwritten with the projected vision tokens, and the batch is padded so that every sample has the same count. The language model sees one sequence; nothing else about it changes.

### Who trains

- Stage one, alignment: freeze the encoder and the language model, and train the projector on image and caption pairs with the language-modeling loss on the caption. The capstone's version uses a cosine alignment loss between a pooled image vector and a caption vector, and that loss falls from about 1.07 to about 0.80 in 200 steps with only the projector moving.
- Stage two, instruction tuning: unfreeze the language model, often through adapters, keep the projector trainable, and train on image, question and answer triples.
- Large pretraining on interleaved image and text data sits between them in frontier recipes and is out of reach for a small team.

### Why the projector is enough

The encoder already represents the image, and the language model already reasons in words. The projector's job is to express one in the vocabulary of the other, which a small bend of the space can do. The capstone's encoder has 86M parameters and its projector about 1.3M; training only the projector means a few hundred steps on one GPU.

## Follow-ups

- **Level 1:** Why does the projector need two layers and not one? Expected: one linear layer rotates and scales; the non-linearity between two layers lets the map bend, which is enough to align contrastive vision features to a language model's embeddings.
- **Level 2:** What does the language model see where the image was? Expected: a run of embeddings, one per projected patch token, in place of the placeholder; the model treats them as tokens with no special handling.
- **Level 2:** What does a bridge with a fixed set of learned queries change? Expected: it compresses the patch tokens to a fixed count, which saves context at the cost of a bottleneck; the MLP keeps every patch.
- **Level 3:** Which part sets the ceiling on reasoning quality? Expected: the language model; the encoder can only feed it, so a larger language model lifts the benchmarks more than a cleverer bridge.

## Wrong answers

- "The language model looks at pixels through cross-attention into the image." In this pattern the image enters as tokens in the input sequence; cross-attention bridges are a different family.
- "Fine-tune the vision encoder first; it is the part that sees." The encoder is pretrained and frozen in stage one; the projector is where a small team's training budget goes.
- "The projector must be a large network to carry the image." It is a two-layer MLP far smaller than the encoder in the capstone, and it trains in minutes.

## Taught in

The [vision-language models lesson](../../../phases/04-computer-vision/25-vision-language-models/) lays out the pattern and its three training stages, the [projection capstone](../../../phases/19-capstone-projects/60-projection-layer-modality-align/) trains the bridge alone, and the [LLaVA lesson](../../../phases/12-multimodal-ai/05-llava-visual-instruction-tuning/) gives the reference recipe.
