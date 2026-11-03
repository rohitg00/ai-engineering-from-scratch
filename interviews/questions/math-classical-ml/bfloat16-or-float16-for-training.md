---
id: bfloat16-or-float16-for-training
title: Pick a 16-bit format for training and one for inference
card: math-classical-ml
kind: tradeoff
level: 3
roles: [inference-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [ml-depth, system-design]
tags: [numerical-stability, bfloat16, float16, mixed-precision, loss-scaling]
minutes: 12
lessons: [phases/01-math-foundations/13-numerical-stability]
manuals: []
practice: []
cheatsheet: [information-numerics]
related: [math-classical-ml/variance-of-large-numbers, math-classical-ml/softmax-inf-at-large-logits]
updated: 2026-11-03
---

Your training stack can run in float16 or in bfloat16. A teammate picks float16 because it keeps more digits. Which format do you pick for training, which for inference, and what extra mechanism does one of them need?

## Short answer

Pick bfloat16 for training. It has the same 8-bit exponent as float32, so it covers the same range up to about 3.4e38, and activations, logits and gradients that spike past 65,504 do not overflow. float16 has 10 mantissa bits and more precision, but its 5-bit exponent caps at 65,504 and underflows gradients below about 6e-8, so it needs loss scaling to train. For inference, where values are bounded and precision matters more, float16 is the usual choice.

## Full answer

### The two layouts

```text
float16:   [1 sign] [5 exponent]  [10 mantissa]   max about 65,504
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]    max about 3.4e38
```

The mantissa sets precision, the exponent sets range. Training needs range: a loss spike, a large logit or a tiny gradient all live far from 1. Inference values are bounded by the trained weights, so the extra three mantissa bits of float16 are worth more there.

### What goes wrong in float16

- Overflow: an activation above 65,504 becomes inf, and inf poisons every value downstream.
- Underflow: gradients are often around 1e-8 or smaller, and float16 rounds anything below about 6e-8 to zero. The weights stop moving, with no error.

### Loss scaling

Mixed precision keeps a float32 master copy of the weights, runs the forward and backward passes in the 16-bit format, and computes the loss in float32. To keep float16 gradients above the underflow floor, multiply the loss by a large constant such as 1024 before backward, so every gradient is 1024 times larger, then divide the gradients by the same constant before the update. The update is unchanged. Dynamic loss scaling starts high, at 65536 in the lesson, halves the scale on the first inf gradient, and doubles it again after a run of clean steps.

### Why bfloat16 skips most of this

bfloat16 is the top 16 bits of a float32: drop the low mantissa bits and the exponent is unchanged. Its range covers the gradient spectrum, so loss scaling is usually unnecessary, and conversion is a truncation. The cost is precision: about 2 to 3 decimal digits, against 3 to 4 for float16.

### Symptoms that point here

The lesson's bug list has three entries with this cause: validation accuracy 1 to 3 percent below the paper after a switch to float16, gradient norms of 0.0 in some layers, and a run that diverges after moving from float32 to float16. The fixes are loss scaling or bfloat16.

## Follow-ups

- **Level 3:** Why do small gradients vanish in float16 and not in bfloat16? Expected: float16's smallest normal values sit near 6e-8 and smaller gradients round to 0; bfloat16's exponent reaches float32's range.
- **Level 3:** What does dynamic loss scaling do when a gradient turns inf? Expected: skip the step, halve the scale, and double it again after a run of clean steps.
- **Level 4:** You moved from float32 to float16 and validation accuracy fell by a few percent with no error. What happened? Expected: gradient underflow zeroed small updates; enable loss scaling or move to bfloat16.
- **Level 4:** Why is bfloat16 cheap to convert from float32? Expected: it is the top 16 bits of a float32, so conversion drops the low mantissa bits and the exponent is unchanged.

## Wrong answers

- "More mantissa bits means better training, so float16 wins." Training is limited by range; a logit spike past 65,504 becomes inf in float16 and is fine in bfloat16.
- "Loss scaling changes the training result." Dividing the gradients by the same factor before the update gives the same update; the scale only lifts small values above the underflow floor.
- "Use bfloat16 everywhere, inference included." Inference values are bounded and the extra float16 precision helps there; the lesson makes float16 the inference default.

## Taught in

The [numerical stability lesson](../../../phases/01-math-foundations/13-numerical-stability/) compares the formats, explains loss scaling, and lists the mixed precision bugs.
