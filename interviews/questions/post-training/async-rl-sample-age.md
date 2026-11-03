---
id: async-rl-sample-age
title: Design async RL rollout and control the sample age
card: post-training
kind: design
level: 4
roles: [inference-engineer]
rounds: [system-design]
tags: [async-rl, staleness, grpo, weight-update, miles]
minutes: 15
lessons: []
manuals: [miles-101#s-run-rollout-and-training-at-once, miles-101#s-read-the-run, miles-101#s-split-rollout-and-training, miles-101#s-the-correction-methods, miles-101#s-handle-long-responses, miles-101#s-run-a-separate-eval-fleet]
practice: []
cheatsheet: [miles-rl, async-disaggregated-inference]
related: [post-training/gap-remove-before-reweight]
updated: 2026-11-03
---

You move an RL job from one GPU to a cluster where the rollout engines and the trainers run on separate devices. The team wants generation and training to run at the same time, so that neither side waits for the other. Design the async setup: which knobs matter, what new failure appears, and what you watch in the logs.

## Short answer

Async training lets the engines generate the next batch while the trainer updates, at the price of samples that come from older weights. Two modes exist: one step ahead, where every sample is at most one weight version old with the default update interval, and fully async, where a worker keeps generating and the trainer drains a buffer, so the age depends on how fast the trainer drains it. Set a limit on sample age, decide what happens to running requests at each weight update, and lower the learning rate as you allow older samples. Watch the weight version of each sample, the share of dropped samples, the clip fraction, and the gap between the two sides.

## Full answer

### Why async pays off only on a split layout

With both sides on one GPU they take turns, and generation stops for the whole training window; the colocated fully async mode exists only to learn the settings. On separate devices the trainer idles during rollout and the engines idle during training unless the two overlap. Async removes part of that wait.

### The knobs

| Setting | What it decides |
|---|---|
| `--update-weights-interval` | how many steps run between weight updates to the engines |
| `--max-weight-staleness` | the oldest weight version a sample may come from; unset means no limit |
| `--async-unused-samples-handler` | drop or retry a sample that is too old |
| `--async-max-concurrent-samples` | how many samples the engines generate at one time |
| `--pause-generation-mode` | what happens to running requests at a weight update: abort, retract, or in place; retract is the default |

The over-sampling batch size has no effect in the fully async mode.

### The new failure: stale samples

A sample generated under weights two versions old is off-policy for the trainer. The ratio of trainer probability to engine probability now carries a gap that the kernels did not cause. Two signals show it. The clip fraction, `train/pg_clipfrac`, is 0 in a run with one optimizer update per rollout, because the policy that trains is the one that sampled; a clip fraction above 0 in such a run means the samples did not come from the current weights. The log-probability gap grows with the age for the same reason.

### Learning rate follows age

A study of asynchronous GRPO on small models changed the steps between weight updates and the learning rate together, and the largest stable learning rate fell in proportion to the steps between updates: twice the steps, about half the rate. The manual has not tested it and offers it as the starting rule. When you raise the update interval or the age limit, lower the learning rate by the same factor, then watch the gap and the reward.

### What to watch

- The weight version statistics in the rollout metrics: how old the samples are.
- The share of dropped or retried samples. A high share means the engines work for nothing.
- `train/pg_clipfrac` and the gap, read against the ranges of your synchronous runs.
- `perf/update_weights_time` against the step time. On a split layout the update is a transfer over the network, not a copy inside one GPU, and the transfer method is a choice of its own.

### Corrections for what remains

A sample age limit drops the worst samples. For the rest, the truncated importance-sampling correction reweights each token by the ratio of the two probabilities with a cap. Remove staleness before you reweight it.

## Follow-ups

- **Level 3:** Why is the clip fraction exactly 0 in a synchronous run with one update per rollout? Expected: the policy in the trainer is still the policy that produced the samples, so every ratio is 1 and nothing hits the clip range.
- **Level 4:** Which pause mode do you choose, and what does the wrong one cost? Expected: retract keeps the work of running requests and continues them under new weights, which mixes weight versions inside one answer; abort throws the work away; in place changes the weights under a running request; the fully async mode refuses some of these, so read the flag help of your version.
- **Level 4:** A partial answer started under version 5 and finished under version 7. Where does that show up? Expected: in the gap, because part of its tokens come from older weights than the trainer holds; watch the gap after you turn on partial rollout or raise the staleness limit.
- **Level 4:** How does a dedicated evaluation fleet fit this design? Expected: it loads checkpoint snapshots and never takes part in the training weight updates, so its lag is reported in steps; in the version the manual read it does not combine with rollout fault tolerance.

## Wrong answers

- "Run fully async on the single GPU too; it is the same code." With one GPU the two sides still take turns and generation stops during training, so you pay the staleness cost and get no overlap.
- "Leave the staleness limit unset, so that no sample is wasted." Unset means no limit; very old samples pull the update in the wrong direction, and the gap grows without a cause in the kernels.
- "Keep the learning rate from the synchronous run." The stable rate falls with the age of the samples; raise the update interval and you lower the rate by about the same factor.

## Taught in

[Section 4.1 of Miles 101](../../../manuals/miles-101/sections/4-1-run-rollout-and-training-at-once.md) lists the async modes and settings, [section 5.1](../../../manuals/miles-101/sections/5-1-read-the-run.md) reads the clip fraction as a staleness signal, and [section 6.1](../../../manuals/miles-101/sections/6-1-split-rollout-and-training.md) covers the split layout and the weight transfer.
