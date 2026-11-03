---
id: emergence-or-scorer-artifact
title: A benchmark jumps between two model sizes
card: transformers
kind: concept
level: 4
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, inference-engineer]
rounds: [ml-depth, design-review]
tags: [scaling-laws, emergence, metrics, cross-entropy, evaluation]
minutes: 12
lessons: [phases/07-transformers-deep-dive/13-scaling-laws, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling]
manuals: []
practice: []
cheatsheet: [scaling-laws-pretraining]
related: [transformers/compute-split-params-tokens]
updated: 2026-11-03
---

Between two model sizes a benchmark accuracy goes from near zero to high. The team calls it an emergent ability and asks for a larger budget to find the next jump. How do you evaluate the claim before you sign?

## Short answer

Ask what the scorer is. Exact match and thresholded accuracy are discontinuous: a model that gets most digits right scores zero until it gets all of them right, so a smooth gain in the underlying probabilities shows up as a cliff. Re-score the same checkpoints with a continuous metric such as the cross-entropy of the target answers; if that curve is smooth, the jump belongs to the scorer and not to the model. Plan the budget against the continuous curve, which the scaling law predicts reliably.

## Full answer

### The argument

The 2023 analysis of emergence showed that the abilities usually cited, arithmetic and multi-step reasoning among them, were measured with discontinuous scoring. Under a continuous metric the same models improve smoothly with scale. By 2026 the working consensus is: predictions from continuous loss are reliable, and benchmark jumps are often artifacts of the scorer.

### What to do with the checkpoints you have

1. Keep the prompts and the targets fixed.
2. For each checkpoint, log the per-token probability of the correct answer and the cross-entropy over the answer tokens.
3. Plot both against the parameter count and against the training compute.
4. Add a partial-credit scorer, such as the share of correct digits, to see where the cliff disappears.

If the probability curve is smooth, the model was getting closer all along and the benchmark hid it.

### What it means for the budget

Fit the loss on the checkpoints and read where the next size lands on the continuous curve. Then calibrate the discontinuous benchmark against that curve: at which loss does accuracy cross the product threshold? Sample more sizes near that point instead of betting on a surprise. A product threshold can be real for the user and still be predictable for the planner.

### Where real changes of regime do show up

In-context learning, following a few examples with no fine-tuning, is usually described as appearing around the 6B to 13B range. The lesson's position is still to measure it with a continuous metric before you call it a discontinuity, because the same scorer problem applies.

## Follow-ups

- **Level 3:** Give an example of a discontinuous scorer and its continuous counterpart. Expected: exact match on a multi-digit answer against the log-probability or the digit-level accuracy of the same answer.
- **Level 4:** How does this change the way you plan a training budget? Expected: predict the loss from the law, calibrate the benchmark against the loss, and place runs near the threshold instead of hoping for a jump.
- **Level 4:** The product threshold really is binary for the user. Does the artifact argument still matter? Expected: yes; the threshold is real for the product, but its position is predictable from the smooth curve, which is what you need to budget.
- **Level 4:** What would convince you that a jump is not a scorer artifact? Expected: the continuous metric also shows a kink at the same scale, replicated across seeds and data orderings.

## Wrong answers

- "Accuracy is the ground truth and loss is a proxy." Accuracy with a hard threshold throws away the information that shows the trend; the loss is what the model optimizes and what the law predicts.
- "Emergence means the scaling law broke." The law describes the continuous loss, which keeps its shape while the thresholded score jumps.
- "Train the bigger model and see." That is the expensive experiment the analysis lets you avoid; re-score what you already have first.

## Taught in

The [scaling laws lesson](../../../phases/07-transformers-deep-dive/13-scaling-laws/) covers emergence against smooth loss, and the [causal language modeling lesson](../../../phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/) places in-context learning on the scale axis.
