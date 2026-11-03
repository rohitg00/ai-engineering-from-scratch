---
id: llm-size-sets-ceiling
title: Which knob moves a multimodal reasoning score
card: multimodal
kind: concept
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [ml-depth, design-review]
tags: [vlm-recipes, ablation, llm-size, encoder]
minutes: 10
lessons: [phases/12-multimodal-ai/07-open-weight-vlm-recipes, phases/04-computer-vision/25-vision-language-models]
manuals: []
practice: []
cheatsheet: [vlm-model-families, vlm-architectures]
related: [multimodal/qformer-or-mlp]
updated: 2026-11-03
---

Your 7B vision-language model trails a competitor on a multimodal reasoning benchmark by several points. The team's plan is a new connector design. Argue for or against, using what the ablation literature says about where the score comes from.

## Short answer

Against. Across the controlled studies, swapping the connector moved a reasoning benchmark by less than a point at a fixed token count, while swapping the encoder moved it by three or more, and doubling the language model from 7B to 13B added two to four points. The reasoning ceiling of such a model is the text reasoning ceiling of its language model; the visual side can only feed it. Spend the effort on the language model size, the encoder, the token count and the data before the connector.

## Full answer

### The decomposition

The one study that held every axis fixed but one found that the per-image visual-token count explained about 60 percent of the variance in scores, the encoder about 20 percent, the connector about 5 percent, and everything else about 15 percent.

### The language model sets the ceiling

Going from a 7B to a 13B language model reliably added 2 to 4 points on the flagship reasoning benchmark across the papers in the lesson, and at 70B most benchmarks saturate. The reason is structural: the encoder produces features and the connector translates them, but the reasoning happens in the language model. A 7B model cannot stand in for a 70B model through a cleverer connector.

### The encoder is the second lever

Swapping the common contrastive encoder for a stronger one added 3 or more points on the reasoning benchmark in one study, and self-supervised encoders led a vision-centric benchmark by about 5 to 7 points over the common contrastive one. The 2026 default pairs a strong contrastive encoder with a self-supervised one for dense features when grounding matters.

### The connector is a wash

At a fixed token count, an MLP, a query bridge and a resampler landed within about 1 point of each other in several independent studies. The connector is a cost question about tokens, not a quality question.

### What to do instead

1. Check the token count per image; more visual tokens up to the sweet spot helps more than any connector.
2. Check the encoder and the resolution schedule.
3. Check the data: detailed human captions beat distilled synthetic captions at the same token count.
4. If the gap is in reasoning, the honest fix is a larger language model, and the budget question follows.

## Follow-ups

- **Level 2:** Why does a bigger language model help a visual task? Expected: the benchmark asks for reasoning over what the encoder saw, and the reasoning happens in the language model; the visual side sets what it knows, not how well it thinks.
- **Level 2:** When would a connector change still be the right move? Expected: when the token budget binds, because then the connector decides how many tokens you can afford, which is the axis that matters most.
- **Level 3:** Which benchmarks move with the encoder and which do not? Expected: vision-centric benchmarks, counting and grounding, move with a self-supervised encoder, by about 5 to 7 points in one study; the reasoning benchmark also moves, by 3 or more points for a stronger contrastive encoder, so the encoder matters for both kinds.
- **Level 3:** Design the smallest ablation that settles this for your model. Expected: hold the data, the encoder, the token count, the resolution schedule and the training schedule fixed, swap the language model size in one run and the connector in another, and compare both with the baseline on the same eval.

## Wrong answers

- "The connector is where the modalities meet, so it must matter most." Its measured share is about 5 percent of the variance; the token count and the encoder dominate.
- "A better connector lets a small language model reason like a large one." The reasoning ceiling is the language model's; no bridge adds reasoning the language model does not have.
- "More visual tokens always help." They help up to the sweet spot and then give diminishing returns at a growing compute cost; the gain is in the token count, not in the architecture that emits them.

## Taught in

The [open-weight recipes lesson](../../../phases/12-multimodal-ai/07-open-weight-vlm-recipes/) decomposes the variance across the five design axes, and the [vision-language models lesson](../../../phases/04-computer-vision/25-vision-language-models/) lays out the pattern the axes belong to.
