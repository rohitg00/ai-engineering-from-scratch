---
id: attention-for-128k-context
title: Design the attention stack for 128K context on one card
card: transformers
kind: design
level: 4
roles: [inference-engineer, applied-ai-engineer]
rounds: [system-design, ml-depth]
tags: [long-context, grouped-query-attention, rope, flash-attention, kv-cache, design]
minutes: 15
lessons: [phases/07-transformers-deep-dive/03-multi-head-attention, phases/07-transformers-deep-dive/04-positional-encoding, phases/07-transformers-deep-dive/12-kv-cache-flash-attention]
manuals: []
practice: [grouped-query-attention, rope]
cheatsheet: [attention-variants, positional-encoding, inference-optimization]
related: [transformers/gqa-mla-cache-tradeoff, transformers/extend-context-past-training, transformers/flash-attention-is-exact]
updated: 2026-11-03
---

Design the attention stack of a new 70B-class decoder that must serve 128K-token contexts on a single 80 GB accelerator at batch size one. Cover the head layout, the positional scheme, the kernel, and the memory arithmetic that ties them together.

## Short answer

Start from the memory, because it decides the rest. With 8 key-value heads, 80 layers and a head size of 128 in a 16-bit type, the stored keys and values cost 4096 bytes per token per layer, about 10 GiB at 32K and 40 GiB at 128K before a single weight is loaded. So the head layout is grouped-query or latent attention, the stored type is reduced to FP8 to halve those bytes, the positional scheme is rotation with base scaling so that the model reaches 128K without a position table, and the kernel is a tiled one so that the N by N scores never touch main memory. Then count again: at 16 bits the weights of a 70B-class model alone are larger than the 80 GB card, so the weights also need a 4-bit type before the cache and the activations can fit beside them.

## Full answer

### Head layout

Plain multi-head attention with 64 key-value heads at this scale would hold about 8 times more, about 80 GiB at 32K, which is the whole card. Grouped-query with 8 key-value heads is the production default and keeps nearly full quality. If the memory still does not close, latent attention compresses the keys and values to a low-rank vector and pays FLOPs at each step to decompress. The query heads stay at 64 with a head size of 128 in either case.

### The memory table

```text
per token per layer = 2 * n_kv_heads * d_head * bytes
                    = 2 * 8 * 128 * 2 = 4096 bytes (4 KiB)
32K context         = about 10 GiB
128K context        = about 40 GiB
```

Halve the bytes per value with an FP8 cache and the 128K figure halves. Then add the weights. At 16 bits a 70B-class model needs two bytes per parameter, which is more than the whole 80 GB card before any cache is stored. At 8 bits the weights still fill most of the card. Only a 4-bit weight type leaves room for the FP8 cache at 128K and for the activations. Batch size one is the stated requirement; every additional concurrent request adds another cache.

### Positional scheme

Rotation of the queries and keys, with a base scaled for the target length through NTK-aware scaling or YaRN. It adds no parameters, encodes relative distance, and the lesson's reference family reached 128K from 8K this way. A learned table would need 128K rows and would stop there. Linear-bias attention is a valid training-time alternative with strong extrapolation, but rotation gives a cleaner knob and matches the ecosystem.

### Kernel

Attention is memory-bound from about 2K tokens, so a tiled kernel is not optional at 128K. Use the current tiled implementation for the hardware, with FP8 where the generation supports it, and keep the training kernel on the version that has a backward pass.

### What to measure before committing

1. Perplexity at the target length and at the original short length after the long-context fine-tune.
2. Peak memory at 128K with the quantized weights, the cache and the activations on the card, and the quality loss from the 4-bit weights.
3. Time per token at 128K against 8K, to confirm the kernel and the cache behave linearly.

## Follow-ups

- **Level 3:** Why not pick linear-bias attention for its extrapolation? Expected: it is a fair choice for a new model, but rotation has the long-context tooling and a base to scale, and neither can be swapped after training.
- **Level 4:** The product later asks for batch size 8 at 128K. What changes? Expected: the cache multiplies by 8, so latent attention, a smaller stored type, a shorter maximum length or more cards; the weights do not change.
- **Level 4:** Grouped-query from scratch or convert a multi-head checkpoint? Expected: from scratch for a new model; conversion with a fine-tune is for existing checkpoints and needs a quality check.
- **Level 4:** Where does Flash Attention stop helping? Expected: it removes the N by N traffic; it does not shrink the cache, which still grows linearly with the context, so the cache math dominates at 128K.

## Wrong answers

- "Use full multi-head attention for quality; memory is cheap." At 128K the full cache alone exceeds the card.
- "The sinusoid handles any length, so the position scheme is solved." The formula extends but the model never saw those phases; rotation with base scaling is what reached 128K in practice.
- "Skip the tiled kernel on a quality model because it changes the output." It is exact up to 16-bit reordering and it is what makes long context affordable.

## Taught in

The [multi-head attention lesson](../../../phases/07-transformers-deep-dive/03-multi-head-attention/) gives the head variants, the [positional encoding lesson](../../../phases/07-transformers-deep-dive/04-positional-encoding/) gives the scaling tricks, and the [KV cache and Flash Attention lesson](../../../phases/07-transformers-deep-dive/12-kv-cache-flash-attention/) does the memory arithmetic.
