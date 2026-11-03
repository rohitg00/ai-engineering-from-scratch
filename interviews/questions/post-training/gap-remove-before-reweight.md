---
id: gap-remove-before-reweight
title: Remove a cause of the gap before you reweight it
card: post-training
kind: tradeoff
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [ml-depth, system-design]
tags: [logprob-gap, importance-sampling, sampling-replay, fp16, miles]
minutes: 15
lessons: []
manuals: [miles-101#s-the-correction-methods, miles-101#s-lower-the-logprob-gap, miles-101#s-why-true-on-policy-is-a-contract, miles-101#s-roll-out-in-fp8, miles-101#s-why-rl-owns-an-engine]
practice: []
cheatsheet: [miles-rl]
related: [post-training/logprob-gap-at-step-zero]
updated: 2026-11-03
---

Your RL run shows a steady disagreement between trainer and rollout engine on the probability of each sampled token. One engineer wants to turn on a capped importance weighting right away. Another says it is a kernel artifact and should be ignored. Lay out how you decide, and what you would try first.

## Short answer

Match the method to the source of the gap. Five sources exist: tokens re-encoded between turns, expert routing on a mixture model, a sampler that cuts the vocabulary, numeric differences between kernels or precisions, and stale samples. The first three have corrections that remove the cause; try those first, because a reweighting such as truncated importance sampling leaves the gap in place and adds variance to the gradient. A flat gap on a dense model with plain sampling is the kernel floor of that setup; measure it, keep it inside your range, and reweight only what remains after the causes are gone.

## Full answer

### Two kinds of method

A method that removes a cause makes both sides compute the same thing, and that part of the gap is gone. A method that reweights leaves the gap and changes how much each token counts in the loss. Remove causes first.

| Method | Kind | Cause |
|---|---|---|
| Sampling replay | removes | top-p and top-k cut the vocabulary on the engine side only |
| Routing replay | removes | a mixture-of-experts router picks different experts on each side |
| Token-in, token-out sessions | removes | text round trips between agent turns change the tokens |
| True on-policy mode | removes | all kernel differences, for the models and GPUs it covers |
| Truncated importance sampling | reweights | any remaining gap |
| A sample age limit | drops | samples from older weights |

### What the manual measured

Sampling replay on one seed lowered the median gap from 0.0153 to 0.0135, 11.5 percent. No step of the replay run reached the lowest step of the plain run, and the reward stayed in the same range. The sampler part is not noise: a top-p cut raises the engine's log-probability of a kept token by minus the log of the kept mass, which at a top-p of 0.9 was a median shift of about 0.053 in a check outside the training framework. Deterministic inference removed nothing, because it is not a correction.

### The kernel floor

On a dense model in BF16 on both sides, the manual's gap stayed at about 0.015 per token in every healthy run. That is the floor of one setup, not a law. A check with FP16 on both sides cut the median gap about 7.8 times, from 0.0073 to 0.00094 on a serving engine against a reference forward pass, and the worst token fell from 0.355 to 0.033. FP16 on one side only did not help. Precision is a lever that removes a cause, and it costs numeric range.

### When to reweight

Truncated importance sampling weights each token by the ratio of the trainer probability to the engine probability and caps the ratio, with `--use-tis --tis-clip 2.0` as the manual's example. Use it for a gap you cannot remove: a low-precision rollout, where FP8 rounding has no kernel fix, or a mixture model after routing replay. Pair it with the step-0 check, so that the reweighting never hides a setup error.

### How to run the comparison

Same seed, same steps, one change per run, and the gap read at every step. A method that helps shows a lower gap on the same steps. A gap that grows after a change names the cause you added.

## Follow-ups

- **Level 3:** Why does a reweighting add variance? Expected: tokens with a large ratio get a large weight, so a few tokens dominate the update; the cap limits that, but does not remove it.
- **Level 3:** Replay needs both a top-k and a top-p set. Why is the top-k needed? Expected: the framework requires a positive top-k for replay, so a run with top-p alone changes the sampler without replaying the kept set.
- **Level 4:** FP16 on the engine and BF16 on the trainer did not close the gap. Why? Expected: each side's own rounding sets a floor; the gap closes only when both sides round the same way, so the precision must match on both sides.
- **Level 4:** When is the bit-exact mode the right answer, and when is it not available? Expected: when you need a gap of zero and your model and GPU are in its contract; it pins one attention kernel and batch-invariant operations for specific dense models on one GPU generation, and refuses the rest.

## Wrong answers

- "Turn on importance sampling first; it is cheap." It leaves every cause in place, adds variance, and hides a setup error that the step-0 check would show.
- "The gap is a kernel artifact, so it never matters." The sampler part was measurable and removable, and a gap that grows after a change is a cause you added.
- "Deterministic inference is a correction method." It makes the engine repeat itself and leaves the gap where it was; the manual's four runs show the same gap with it on and off.

## Taught in

[Section 8.2 of Miles 101](../../../manuals/miles-101/sections/8-2-the-correction-methods.md) matches each correction to its cause, [section 4.4](../../../manuals/miles-101/sections/4-4-lower-the-logprob-gap.md) measures sampling replay, and [section 8.3](../../../manuals/miles-101/sections/8-3-why-true-on-policy-is-a-contract.md) measures the precision lever.
