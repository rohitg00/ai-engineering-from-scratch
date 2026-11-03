---
id: extend-context-past-training
title: Take a model from 8K to 128K
card: transformers
kind: design
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [system-design, ml-depth]
tags: [long-context, rope, yarn, positional-encoding, fine-tuning]
minutes: 12
lessons: [phases/07-transformers-deep-dive/04-positional-encoding, phases/19-capstone-projects/32-token-positional-embeddings]
manuals: []
practice: [rope]
cheatsheet: [positional-encoding]
related: [transformers/rope-relative-from-absolute, transformers/permutation-blind-attention]
updated: 2026-11-03
---

A model was trained with a context of 8K tokens. The product now needs 128K. You have a modest fine-tuning budget and no budget to pretrain again. Lay out the options by the way the model encodes position, and give me the plan you would run.

## Short answer

The answer depends on the positional scheme, so read the config first. A learned absolute table has no row past the trained length and cannot be extended without new parameters. With rotary embeddings you scale the base or interpolate the positions, with NTK-aware scaling, YaRN or LongRoPE, and fine-tune on long sequences; the lesson's reference is a model family that went from 8K to 128K this way. Linear-bias attention extrapolates by construction, but you cannot switch a trained model to it for free.

## Full answer

### Option by scheme

| Scheme in the checkpoint | Can it reach 128K? | How |
|---|---|---|
| Learned absolute table | Not without new rows | Add rows and train them, or retrain |
| Fixed sinusoid | The formula extends, the model does not | The model never saw those phases; expect poor quality |
| Rotary | Yes | Scale the base or interpolate positions, then fine-tune |
| Linear bias | Yes by design | Already extrapolates; a training-time choice |

### The rotary toolbox

- **Position interpolation plus fine-tuning.** Shrink the positions by the extension factor so the angles stay inside the trained range, then fine-tune for 1 to 5B tokens. Simple and effective.
- **NTK-aware scaling.** Rescale the base to `base * scale_factor ** (d / (d - 2))` when going from 4K to 16K and beyond, so the high-frequency pairs are not squeezed.
- **YaRN.** A per-dimension mix of interpolation and extrapolation that preserves the entropy of attention on long contexts; it needs a fine-tuning stage.
- **LongRoPE.** A search over per-dimension scale factors; used for very long contexts.

### The plan

1. Confirm the scheme from the model config and read the current rope scaling block.
2. Pick YaRN or position interpolation, set the factor for 128K, and build a long-sequence fine-tuning set.
3. Before training, measure perplexity on sequences longer than the trained length with and without the scaling, the way the lesson's exercise does at lengths 256 and 1024.
4. Fine-tune, then measure again at the target length and at the original length, so that a win on long inputs does not hide a regression on short ones.
5. Budget the memory. The cache of keys and values grows linearly with the context, and 128K is sixteen times 8K.

### What to tell the product team

The positional scheme is the gate. A rotary model gives you a clean knob and a short fine-tuning job. A model with a learned table or a sinusoid needs a retrain or a different model.

## Follow-ups

- **Level 3:** Why does a rotary model fail when you just run it at 128K with no change? Expected: the fast-turning coordinate pairs reach angles the model never saw, so the scores at long distance are noise.
- **Level 3:** What two measurements do you insist on before shipping? Expected: perplexity or task quality at the new length, and the same at the original length to catch a regression.
- **Level 4:** The team proposes to switch the model to linear-bias attention because it extrapolates well. Your answer? Expected: that is a training-time choice; a checkpoint trained with rotation cannot be swapped to a score bias without retraining.
- **Level 4:** What breaks on the serving side at 128K even if quality is fine? Expected: memory for each token's keys and values, which grows with the context; the attention stack needs grouped-query or latent attention and a tiled kernel.

## Wrong answers

- "Set the maximum position in the config higher and ship." A learned table has no row for the new positions, and a rotary model needs its base scaled and a fine-tune.
- "The sinusoid extends to any length, so the model works." The formula extends; the model was never trained to read those phases and its quality drops.
- "Position interpolation needs no training." The lesson's recipe is to shrink the positions and then fine-tune for 1 to 5B tokens.

## Taught in

The [positional encoding lesson](../../../phases/07-transformers-deep-dive/04-positional-encoding/) lists the scaling tricks and the extension to 128K, and the [embedding capstone](../../../phases/19-capstone-projects/32-token-positional-embeddings/) explains why a learned table is bounded.
