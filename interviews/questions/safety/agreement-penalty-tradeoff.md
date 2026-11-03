---
id: agreement-penalty-tradeoff
title: How hard to penalize agreement
card: safety
kind: tradeoff
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [ml-depth, design-review]
tags: [sycophancy, reward-shaping, pareto, calibration]
minutes: 8
lessons: [phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification]
manuals: []
practice: []
cheatsheet: [alignment-training]
related: [safety/sycophancy-is-the-loss]
updated: 2026-11-03
---

You can subtract an agreement score from the reward during training to reduce sycophancy. The alignment lead wants the penalty weight as high as it will go. What does a high weight cost, how do you pick the weight, and how do you show that you got it right?

## Short answer

The correction subtracts a classifier's agreement score, scaled by a weight, from the reward. In the lesson's sweeps sycophancy falls to near the base model level at a weight around 0.3 to 0.5, and beyond that the model turns contrarian on claims that are true. Pick the weight from a frontier of correct answer rate against sycophancy rate on matched test pairs, and watch calibration while you sweep.

## Full answer

### The correction

```text
r'(x, y) = r(x, y) - alpha * agree(x, y)
```

The agreement term comes from an auxiliary classifier that reads whether the completion agrees with the premises stated in the prompt, without regard to truth. The weight alpha sets how much agreement costs.

### Why there is a trade

Agreeing with a user who is right and agreeing with a user who is wrong look the same on the surface. A penalty on agreement hits both. Every sycophancy mitigation pays in helpful agreement, because the two share surface features. This is a trade, not a fix.

### Picking the weight

Sweep alpha. For each value, measure the correct answer rate and the sycophancy rate on matched pairs: the same claim framed as the user's belief and as a third party's, in a version where the claim is true and a version where it is false. Plot the frontier and pick the point the product can live with. The lesson's toy world exposes both knobs, the KL weight and alpha, so the shape can be seen before a real run.

### Showing it worked

Report the agreement differential between the two framings with a confidence interval, estimated from enough pairs for the significance level you chose. Report the correct answer rate on the true variants, which is where the cost shows. Report calibration, because sycophancy training collapses it and the fix should move it back toward the neutral baseline.

## Follow-ups

- **Level 2:** What does the agreement classifier measure? Expected: whether the completion agrees with the premises stated in the prompt, independent of truth.
- **Level 2:** Why does the trade exist at all? Expected: agreeing with a correct user and agreeing with a wrong user look the same on the surface, so a penalty on agreement hits both.
- **Level 3:** Design the test set for the sweep. Expected: matched pairs with the same claim framed as the user's belief and a third party's, in true and false variants, with enough pairs for a confidence interval on the differential.
- **Level 3:** What else do you watch during the sweep? Expected: calibration; the training that caused the sycophancy collapsed it, and the fix should move it back toward the neutral baseline.

## Wrong answers

- "Set the weight as high as it goes." The model becomes contrarian on true claims; helpful agreement is lost with the sycophancy.
- "The penalty removes sycophancy." It lowers the rate to near the base level at the right weight; the base model was not at zero either.
- "Agreement is always bad." Agreeing with a correct user is the helpful kind; the goal is disagreement when the user is wrong.

## Taught in

The [sycophancy lesson](../../../phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification/) proposes the agreement penalty and names its trade off.
