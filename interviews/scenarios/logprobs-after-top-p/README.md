---
id: logprobs-after-top-p
title: The logprob gap that jumped when the engine changed
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [rl, logprobs, top-p, importance-ratio, sampling-replay, miles]
minutes: 25
lessons: []
manuals: [miles-101#s-lower-the-logprob-gap, miles-101#s-check-the-first-step, vllm-101#s-use-vllm-as-an-rl-rollout-engine, sglang-101#s-deterministic-inference-and-logprobs]
practice: []
cheatsheet: []
related: [scenarios/rl-experiment-hygiene, scenarios/temperature-zero-two-answers]
updated: 2026-11-03
system:
  version: SGLang 0.5.22 and vLLM 0.31.0 as rollout engines, with Miles main 08752a12
  model: Qwen/Qwen3-0.6B in BF16
  hardware: the shared second L4 of a two-GPU node, with no clock lock
source:
  - manuals/miles-101/capture/gpu/out-l4/logprobs-top-p.txt
  - manuals/miles-101/capture/gpu/out-gb10/engine-settings.txt
  - manuals/miles-101/sections/4-4-lower-the-logprob-gap.md
---

## Situation

An RL team samples its rollouts at temperature 1 with top-p 0.9. The trainer scores each sampled token against the whole vocabulary and compares that score with the log probability that the engine returned. The gap between the two, `train/train_rollout_logprob_abs_diff`, has sat between 0.0148 and 0.0157 at step 0 in all healthy runs.

The team moves the rollouts to a second engine. That engine has a flag for which log probability it returns, and the engineer picks the processed value, "because that is the distribution we sampled from". The step-0 gap of the new run lands about 0.053 above the old range. One teammate says the new engine's kernels are worse and wants to switch back. Another wants to switch the engine to its deterministic mode. A third says the gap is a constant and the trainer can subtract it. You have a probe that a colleague ran on the lab L4.

## Evidence

- [the probe: two engines, one model, one float32 reference](evidence/probe-setup.txt)
- [returned logprob minus the reference, by engine and mode](evidence/four-rows.txt)
- [what the shifted value is](evidence/formula-check.txt)
- [how much mass top-p dropped on these tokens](evidence/how-often-the-cut-bites.txt)
- [the engine settings of five Miles runs](evidence/engine-settings.txt)
- [the gap with and without sampling replay, 12 steps, one seed](evidence/replay-result.txt)

## Questions

1. Three of the four rows agree with the reference and one does not. Which number is the kernel gap, and which is something else?
2. Derive the shifted value. In which direction does it move from the full-vocabulary value, and by how much for a token whose kept mass is 0.9?
3. The teammate calls the gap a constant to subtract. Is it constant across tokens, and which direction does it push the importance ratio?
4. Which value must the engine return for a trainer that scores the full vocabulary, and which setting pairs with a trainer that scores the kept set?
5. Why did the Miles run with top-p 0.95 and top-k 64 end with a lower gap than the run without them?
6. What does the deterministic mode change about this gap, and what does the temperature change about the value the first engine returns?

## Walkthrough

1. **Read the probe.** Both engines ran the same model in BF16 on the same GPU. The client sent 16 prompts and sampled 48 tokens for each, at temperature 1 and top-p 0.9. The reference is a float32 forward pass over the same tokens with a full-vocabulary `log_softmax`. The GPU was shared and had no clock lock, which changes the speed and not these values.
2. **Read the four rows.** The second engine in raw mode returned the reference value, with a median difference of 0.0000 and a median absolute difference of 0.005. The first engine returned the reference value too, with a median absolute difference of 0.0066, with its environment variable at 0 and at 1. The second engine in processed mode returned a value higher than the reference by a median of 0.0527. The 0.005 and the 0.0066 are the kernel gap. The 0.0527 is a definition.
3. **Check the formula.** Top-p keeps the smallest set of tokens whose probabilities add up to at least 0.9, then scales the kept probabilities so that they add up to 1 again. The log probability of a kept token after that scaling is the score over the whole vocabulary minus the log of the kept mass. The probe subtracted that formula from the processed value and got a median residual of 8e-9. So the processed value is the log probability inside the renormalized nucleus, and the raw value is the full-vocabulary one.
4. **Read how often the cut bites.** The kept mass was below 0.99 for 74 to 79 percent of the sampled tokens, and the median of minus the log of the kept mass was 0.055 to 0.067. That is the size of the shift, and it differs from token to token. Because the kept mass is never above 1, the shift is never negative. It pushes the trainer-to-engine ratio the same way on every token, so it is a bias and not noise.
5. **Read the Miles runs.** The engine settings table shows a run that passed `--rollout-top-p 0.95` and `--rollout-top-k 64`, and a base run that passed neither. Miles turns on sampling replay when top-p is below 1 or top-k is above 0: the engine returns the set of tokens that each step could sample from, and the trainer then scores every token over that set only. The replay run had a median gap of 0.0135 against 0.0153 for the base run over 12 steps, with no overlap between their step ranges. Both sides meant the same log probability, so the sampler part of the gap went away and the kernel part stayed.
6. **Place the other two proposals.** Deterministic inference makes the engine repeat itself and changes nothing about which value the sampler reports. The first engine computes its returned value as `log_softmax(logits / temperature)` unless its original-logprob variable is set, so at a temperature other than 1 that engine returns a scaled value, while at temperature 1 the variable makes no difference, as the two rows show.

## Resolution

The gap jumped because the engine and the trainer no longer meant the same log probability. The trainer scored every token over the whole vocabulary, and the engine returned the value after top-p renormalized the kept set, which is higher by minus the log of the kept mass, 0.0527 at the median on these tokens. Nothing changed in the kernels: the raw mode of the second engine matched the reference with a median absolute difference of 0.005.

Choose one of two consistent pairs. Either set the engine to its raw mode, so that both sides use the full vocabulary, or turn on replay in Miles with both `--rollout-top-p` and `--rollout-top-k`, so that both sides use the kept set. The proof is the step-0 gap: back inside 0.0148 to 0.0157 with the raw mode, or near 0.0136 with replay, which is the step-0 value the manual recorded for the top-p run. Then keep reading the gap at every step, because a gap that grows later means the weights did not reach the engine, which is a different fault.

## Wrong turns

- "The new engine's kernels are worse, switch back." In raw mode the new engine matched the float32 reference with a median absolute difference of 0.005, about the same as the old engine's 0.0066. The jump came from the value the flag selected.
- "Turn on deterministic inference." It makes the engine repeat its own output and costs rollout time. It does not change the definition of the returned value, so the shift stays.
- "The gap is a constant, subtract it in the trainer." The shift is minus the log of the kept mass of each token, which spread over the tokens and sat below 0.99 for 74 to 79 percent of them. A constant correction leaves a bias on every token, in the same direction.
- "Lower top-p so that sampling gets sharper and the gap settles." A smaller kept mass makes minus its log larger. The shift grows.
- "Set the original-logprob variable on the first engine and the problem is solved everywhere." At temperature 1 that variable changed nothing in the probe. It matters when you sample at another temperature and the trainer scores at 1, which is a different mismatch.

## Generalize

Two systems that compare a number must agree on its definition before they compare its value. A sampler that truncates and renormalizes changes the definition of a log probability, and the change is a one-sided bias per token, not noise. Before you read a gap between two sides, probe each side against one reference you compute yourself, and keep the two sides on the same side of the sampler, both before the cut or both after it.

## Taught in

The Miles manual derives the shift and measures replay in [the logprob gap page](../../../manuals/miles-101/sections/4-4-lower-the-logprob-gap.md) and gives the step-0 ranges in [the first step page](../../../manuals/miles-101/sections/5-2-check-the-first-step.md), the vLLM manual explains the two modes in [its RL rollout page](../../../manuals/vllm-101/sections/3-9-use-vllm-as-an-rl-rollout-engine.md), and the SGLang manual explains the temperature-scaled value in [its logprobs page](../../../manuals/sglang-101/sections/4-6-deterministic-inference-and-logprobs.md).
