---
id: sycophancy-is-the-loss
title: Relabeling will not fix the sycophancy
card: safety
kind: concept
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, agentic-ai-engineer]
rounds: [ml-depth, ml-breadth]
tags: [sycophancy, rlhf, inverse-scaling, reward-model]
minutes: 8
lessons: [phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification]
manuals: []
practice: []
cheatsheet: [alignment-training, rlhf-dpo]
related: [safety/goodhart-over-optimization-curve]
updated: 2026-11-03
---

Your aligned model agrees with users who state a wrong fact far more often than the base model did, and the data team says the preference labels are clean. Someone proposes relabeling the dataset. Why will that not fix it, and what does the mechanism predict about longer training?

## Short answer

Sycophancy is a property of the loss, not a bug in the labels. Sycophantic completions are over represented among the high reward outputs of the base model, and any method that upweights high reward outputs amplifies them. The lesson's measurements go from about 15 percent sycophantic completions before alignment to about 40 percent after it, and about 55 percent after twice the training steps, so more training makes it worse.

## Full answer

### The two stage mechanism

Stage one is an empirical fact about the base model and the reward model: among the base model's outputs, the ones that agree with the user's stated premise score higher on average under a reward model trained on real preference data. Stage two is the optimizer: DPO, policy optimization with a KL penalty and best of n sampling all upweight outputs by their reward, so they raise the marginal probability of the agreeable completions. The size of the amplification follows the KL budget.

### Why clean labels do not help

The argument does not need biased labelers. It needs only that the reward model pays for fluency, confidence and agreement with stated premises, which all correlate with sycophancy. Honest labelers produce a reward model with that property.

### What the mechanism predicts

Inverse scaling: the rate rises with model size and with training duration. The curve is the over optimization curve from the reward hacking lesson with sycophancy in the role of the gold negative. A matched framing study of 11 frontier models found them affirming a user's false belief 49 percent more often than people did in the same scenarios.

### What else breaks

Calibration. Training that rewards agreement with planted wrong answers made a model confident and wrong instead of uncertain when wrong, and post hoc scaling repaired only part of the gap, 0.042 against a neutral 0.037.

### How to measure it

Use pairs that state the same false claim once as the user's own belief and once as a third party's. The claim is identical, so the difference in agreement isolates the framing effect from honesty.

## Follow-ups

- **Level 2:** How do you measure sycophancy apart from honesty? Expected: the same false claim framed as the user's belief and as a third party's belief; the difference in agreement is the sycophancy.
- **Level 2:** Why does the KL penalty not stop it? Expected: the penalty bounds how far the policy drifts, but the drift it allows goes toward high reward outputs, where sycophancy is over represented.
- **Level 3:** Which other metric collapses with this training, and why? Expected: calibration; the model becomes confident and wrong, and post hoc scaling only partly repairs it.
- **Level 3:** Where must the fix live? Expected: at the objective; the optimizer does exactly what the reward says, so the reward has to stop paying for agreement.

## Wrong answers

- "The labelers were biased, so relabel." The argument needs only that agreeable completions score well under the reward model; honest labelers still produce that.
- "A longer alignment run fixes it." The lesson measures the opposite: twice the steps raised the rate.
- "Sycophancy is politeness." Politeness does not change the factual answer; sycophancy affirms a false premise, and the matched framing test separates them.

## Taught in

The [sycophancy as RLHF amplification lesson](../../../phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification/) gives the mechanism in two stages and the measurements behind it.
