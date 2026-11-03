---
id: is-it-learning-read-ten-steps
title: Six steps in, is the run learning
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth]
tags: [rl, grpo, reward, logprob-gap, first-steps, miles]
minutes: 20
lessons: []
manuals: [miles-101#s-read-your-first-ten-steps, miles-101#s-check-the-first-step, miles-101#s-read-the-run, miles-101#s-repeat-a-run]
practice: []
cheatsheet: []
related: [scenarios/rl-experiment-hygiene]
updated: 2026-11-03
system:
  version: Miles main 08752a12 with its own SGLang 0.5.22 build
  model: Qwen/Qwen3-0.6B
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/miles-101/capture/gpu/out-gb10/read-steps.txt
  - manuals/miles-101/capture/gpu/out-gb10/plain-first-step.log
  - manuals/miles-101/sections/1-3-read-your-first-ten-steps.md
  - manuals/miles-101/sections/5-2-check-the-first-step.md
---

## Situation

A GRPO run on GSM8K is six steps old. A teammate posts the reward of each step as the log printed it: 0.62890625, 0.59375, 0.7578125, 0.69140625, 0.58984375, 0.5859375. The last three fell. He says the model is getting worse, wants to stop the run, and wants to halve the learning rate before the next start.

A second teammate opens the step 0 line and finds that the loss and the advantages are so close to zero that the log prints them in scientific notation. She concludes that no training happens at all and that the run is a waste of a GPU. You pull the log again a little later, when ten steps have finished, together with the three lines that the first step wrote.

## Evidence

- [the reward of the first ten steps](evidence/ten-rewards.txt)
- [the log probability gap of the first ten steps](evidence/ten-gaps.txt)
- [the perf line of the first rollout](evidence/first-perf-line.txt)
- [the rollout 0 line of the trainer](evidence/first-rollout-line.txt)
- [the step 0 line of the trainer](evidence/first-step-line.txt)
- [the healthy ranges of five numbers over the first ten steps of three seeds](evidence/healthy-ranges.txt)
- [the signs of a broken run](evidence/signs-of-a-broken-run.txt)

## Questions

1. Three falling steps in a row. How large is a normal move between two steps on this setup, and over how many steps do you read the reward?
2. The gap between the engine and the trainer: what is its range over the ten steps, and what would a different shape of that series mean?
3. Why are the centered rewards and the advantages of the first rollout near zero, and what number on the same line is the real signal?
4. The step 0 loss is near zero, the clip fraction is 0 and the ppo_kl is 0. Which of those three are expected at step 0, and which number proves that a gradient exists?
5. How many of the 32 groups gave no learning signal in the first rollout, and how do you read that count?
6. Write the rule that decides, at any step, whether this run stops.

## Walkthrough

1. **Read all ten rewards, not six.** The ten values run from 0.5859375 to 0.7578125, and the four steps after the posted six are 0.6875, 0.67578125, 0.74609375 and 0.6484375. The manual measured steps 0 to 9 of three seeds of this recipe: rewards from 0.53 to 0.74, with a per-seed mean of 0.62 to 0.65, and moves of up to 0.14 from one step to the next. The fall after step 2 is a move of that size, and the three steps that fell are followed by four that did not. The manual's rule is to read the mean over five or more steps, never one step.
2. **Read the gap.** The ten values of `train/train_rollout_logprob_abs_diff` run from 0.014312651939690113 to 0.01628461480140686, inside the manual's range of 0.0141 to 0.0164 for steps 0 to 9. The series is flat. A gap that grows step after step would mean that the two sides hold different weights, which is the one shape that stops a run at once.
3. **Read the first perf line.** The answers had a mean length of 739.92578125 tokens and a median of 759.5, with the longest at the limit of 1024 and the shortest at 259. The field `rollout/truncated_ratio` is 0.3203125, so about a third of the answers hit the cap, inside the range of 0.19 to 0.43. The fields `rollout/zero_std/count_1` and `rollout/zero_std/count_0` are 7 and 3: ten of the 32 groups had every answer right or every answer wrong. Those groups teach nothing. The rest do.
4. **Read the rollout 0 line.** `rollout/rewards` is about minus one point six times ten to the minus nine and `rollout/advantages` is about four point seven times ten to the minus ten. GRPO subtracts the mean reward of each group from each answer, so the mean of the centered rewards is zero by construction, and the advantages are centered the same way. The signal on that line is `rollout/raw_reward`, 0.62890625, the share of correct answers before centering.
5. **Read the step 0 line.** `train/loss` is near zero for the same reason, because the advantages sum to zero across the batch. `train/pg_clipfrac` is 0.0 and `train/ppo_kl` is 0.0, and both must be 0 at step 0, because nothing can be clipped and the old and new probabilities are the same before the first update. `train/grad_norm` is 0.5216571092605591, inside the range of 0.35 to 4.95 over the whole run. That is the gradient. The gap on this line, 0.015336457639932632, sits inside the step-0 range of 0.0148 to 0.0157 that the manual recorded over 17 runs of this model.
6. **Check the four signs of a broken run.** Step lines appear, so both processes started. No run of `503 Service Unavailable` lines goes on for minutes. The gap does not grow. The reward is not flat, and most of the 32 groups score with a spread. None of the four signs is present.

## Resolution

The run is healthy on every number that the manual asks you to read, and it stays on. The reward over ten steps sits in the range of the three healthy seeds, the gap is flat and in range, the cut share is in range, the gradient norm is in range, and the two step-0 values that must be zero are zero. The near-zero loss and advantages are what centering does, not a sign of a dead run.

The rule for stopping is the table of signs, not the last three rewards: stop when no step line appears within ten minutes, when the error lines do not stop for minutes, when the gap grows step after step, or when the reward stays flat while most groups score the same. For the trend, read means over five or more steps, and expect what the three seeds of the longer run showed: the reward rose, the answers got shorter, from about 720 to about 460 tokens, and the gap stayed flat.

## Wrong turns

- "Three falling steps, halve the learning rate." A move of up to 0.14 between two steps is normal on this setup, and the gradient norm sits in its range. A learning rate change now answers noise with a new variable, and the next run cannot be compared with this one.
- "The loss is zero, so nothing trains." The advantages are centered in each group and sum to zero, which puts the loss near zero by construction. The gradient norm of 0.5216571092605591 is the proof that an update happened.
- "A third of the answers are cut, raise the length limit." The cut share of 0.3203125 is inside 0.19 to 0.43, and it falls on its own as the model learns shorter answers. A higher limit makes every rollout slower.
- "Ten groups out of 32 give no signal, so the data is wrong for this model." Those groups cost rollout time and teach nothing, and the rest still teach. The sign to act on is a flat reward with most groups the same, and the reward here is not flat.

## Generalize

One number read at one step tells you almost nothing, and the number that everyone reads first, the reward, is the slowest to show a fault. Build a short list of signals with a healthy range for each, from your own seeds, and read them together before you touch a run. Know which values are zero by construction, so that a zero does not look like a dead run, and decide a stop from a sign of breakage, never from a dip.

## Taught in

The Miles manual gives the five numbers and their ranges in [the first ten steps page](../../../manuals/miles-101/sections/1-3-read-your-first-ten-steps.md), the step-0 zeros of the clip fraction and the KL in [the first step page](../../../manuals/miles-101/sections/5-2-check-the-first-step.md), the eight signals of a run in [the read the run page](../../../manuals/miles-101/sections/5-1-read-the-run.md), and the noise between seeds in [the repeat page](../../../manuals/miles-101/sections/5-3-repeat-a-run.md).
