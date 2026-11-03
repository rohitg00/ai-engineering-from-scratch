---
id: logprob-gap-at-step-zero
title: A step-0 gap several times the healthy range
card: post-training
kind: debug
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [grpo, logprob-gap, deterministic-inference, trainer-engine, miles]
minutes: 12
lessons: []
manuals: [miles-101#s-check-the-first-step, miles-101#s-use-deterministic-inference, miles-101#s-troubleshoot-by-symptom, miles-101#s-read-the-run, miles-101#s-why-true-on-policy-is-a-contract]
practice: []
cheatsheet: [miles-rl]
related: [post-training/grpo-groups-teach-nothing]
updated: 2026-11-03
---

You start a GRPO run with a new model checkpoint. At step 0, the metric that compares the trainer's log-probabilities with the rollout engine's reads several times higher than on your earlier runs with the same model family. A colleague suggests turning on the engine's deterministic mode to close it. What do you do?

## Short answer

Stop the run before it trains on wrong numbers. At step 0 both sides hold the same weights, so a value far above your healthy range means the two sides do not compute the same model: a wrong checkpoint path on one side, or a format that one side reads differently. Deterministic inference does not help; in the manual's runs it left the gap unchanged at about 0.015 and made the engine repeat itself, which is a different property. Fix the setup, then compare the step-0 value with the range of your healthy runs.

## Full answer

### What step 0 proves

No training has happened yet. The trainer scores the sampled tokens with the weights the engine used, so every difference comes from the setup. Two values must be exactly 0 at step 0: `train/ppo_kl`, the KL between the trainer's old and new probabilities, and `train/pg_clipfrac`, the share of clipped tokens. The gap itself, `train/train_rollout_logprob_abs_diff`, is never 0 outside the bit-exact mode, because the two sides run different kernels. It must still sit inside your range.

### The ranges in the manual

| Setup | Gap at step 0 |
|---|---|
| Qwen3-0.6B, plain sampling, 17 runs | 0.0148 to 0.0157 |
| Qwen3-0.6B, top-p 0.95 and top-k 64 | 0.0136 |
| Qwen3-1.7B | 0.0109 |

The gap depends on the model and the sampler, so build the range from your own seeds. A value several times the range points at the model, not at the kernels.

### Why deterministic mode is the wrong tool

Deterministic inference makes the engine give the same result for a request, whatever the batch around it. In four 12-step runs with one seed, the median gap was 0.01526 with the default engine and 0.01518, 0.01520 and 0.01515 with deterministic kernels on two attention backends. Two deterministic runs repeated the step-0 gap to six decimal places, 0.015404. So the mode buys repeatability, not agreement, and it cost 40 to 45 percent more rollout time on clean steps.

### The checks, in order

1. The checkpoint paths of both sides. With the trainer the manual uses, both sides load from one argument; a split layout or a low-precision engine loads two files, and they must hold the same model.
2. The model format: a conversion step that one side applies and the other does not.
3. The weight equality check on a two-step run after the first update, with the quantization tolerance on when the engine runs in low precision.
4. The sampler. A top-p or top-k setting on one run and not on the other moves the gap, as the table shows.

### What a healthy gap does over a run

It stays flat. In the manual's three baseline seeds, every step over 48 steps stayed between 0.0136 and 0.0164, and the KL between the two sides stayed between 0.00063 and 0.00076. A gap that jumps and stays high after a weight update means the two sides no longer hold the same weights.

## Follow-ups

- **Level 3:** Why is the gap never zero in a normal run? Expected: the two sides add the same numbers in a different order, with different kernels; across many layers and a large vocabulary the rounding adds up.
- **Level 3:** What does the deterministic mode buy, then? Expected: the same rollout for the same seed, which is what you need to test a reward function on identical samples.
- **Level 4:** Which levers move the floor of the gap itself? Expected: the precision on both sides, the tensor-parallel size of the engine, and kernels that add in one fixed order; each costs speed or work.
- **Level 4:** The gap is fine at step 0 and grows step after step. What is different from the step-0 failure? Expected: the weights diverge after updates, so the weight update path is the suspect, not the checkpoint; read the update logs and run the weight equality check.

## Wrong answers

- "Turn on deterministic inference to close the gap." The manual's four runs show the same gap with and without it; it makes the engine repeat itself and costs rollout time.
- "A gap is normal; keep training and watch the reward." A step-0 value several times the healthy range means the trainer scores a different model than the one that sampled, so the run trains on wrong numbers from the first update.
- "Add an importance-sampling correction." A reweighting hides a gap that comes from a setup error; remove the cause first.

## Taught in

[Section 5.2 of Miles 101](../../../manuals/miles-101/sections/5-2-check-the-first-step.md) gives the step-0 checks and ranges, [section 4.5](../../../manuals/miles-101/sections/4-5-use-deterministic-inference.md) measures what the deterministic mode does and does not fix, and [section 7.1](../../../manuals/miles-101/sections/7-1-troubleshoot-by-symptom.md) lists the symptom.
