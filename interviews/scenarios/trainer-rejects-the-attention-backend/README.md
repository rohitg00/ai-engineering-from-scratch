---
id: trainer-rejects-the-attention-backend
title: The trainer rejects the attention name
card: scenarios
kind: incident
level: 1
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [screen, debugging]
tags: [rl, attention-backend, trainer, true-on-policy, miles]
minutes: 15
lessons: []
manuals: [miles-101#s-troubleshoot-by-symptom, miles-101#s-know-the-true-on-policy-limits, sglang-101#s-sglang-as-an-rl-rollout-engine]
practice: []
cheatsheet: []
related: [scenarios/dead-engine-and-watchdog]
updated: 2026-11-03
system:
  version: Miles main 08752a12 with its own SGLang 0.5.22 build
  model: Qwen/Qwen3-0.6B
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/sglang-101/capture/gpu/out-miles/true-on-policy-error.log
  - manuals/miles-101/sections/7-1-troubleshoot-by-symptom.md
  - manuals/miles-101/sections/4-6-know-the-true-on-policy-limits.md
  - manuals/sglang-101/sections/7-2-sglang-as-an-rl-rollout-engine.md
---

## Situation

An engineer wants to shrink the log probability gap between the rollout engine and the trainer. The engine runs its Triton attention backend, so she sets the trainer's attention implementation to `triton` as well, with a name she copied from an example. The idea is that two sides with one kernel name agree on more numbers.

The run ends about a minute after the launcher's first line. The trainer prints a `ValueError`, and a line from the fault-tolerance layer says that the trainer's init failed. She asks whether the image is broken and whether to pull another tag.

## Evidence

- [the launcher line, the trainer error and the failed init](evidence/the-error.txt)
- [the troubleshooting entry for this error](evidence/manual-entry.txt)
- [where the flag value came from, and the one pair that both sides accept](evidence/why-the-value-was-wrong.txt)
- [the true on-policy contract: the models, the kernel and the two checks](evidence/the-contract.txt)

## Questions

1. Which process raised the error, and which list does the error print?
2. How does this failure differ from a rollout engine that dies at start?
3. Why does a name that the engine accepts not reach the trainer as a valid name?
4. Is there a pair of settings that gives both sides one kernel on this machine?
5. What do you change, and which line in the next log shows that the run is healthy?

## Walkthrough

1. **Read the error.** The trainer raised `ValueError: Specified attn_implementation="triton" is not supported`, and it printed the names it accepts: `eager`, `flash_attention_2`, `flash_attention_3`, `flash_attention_4`, `sdpa`, `flex_attention`, and their paged forms. The next line, from the trainer controller, reads `phase=fail` for `fn=init` after 0.7 s. The trainer never came up, and the job said so and stopped. The launcher line and the fail line are one minute apart. A dead rollout engine, by contrast, leaves the job running for an hour with HTTP 503 errors.
2. **Match the manual entry.** The troubleshooting page has this symptom: a trainer attention name that the installed transformers library does not accept, such as `triton`. The check is a `ValueError` that lists the accepted implementations, and the fix is to pick one from that list. The manual's runs left the trainer setting at its default.
3. **See where the name came from.** The engine and the trainer keep two different lists. In the FSDP actor, a bridge to the engine's Triton attention turns on only when the build reports an AMD GPU. On an NVIDIA GPU the value goes straight to the transformers library, which has no attention named `triton`. The example that the engineer copied was for the other kind of GPU.
4. **Read the contract.** Miles has one pairing where both sides run one kernel: the engine on its `fa3` backend and the trainer on `flash_attention_3`, for the dense Qwen3 models in the contract, and that kernel accepts GPUs with compute capability 8.0 to 9.0. The GB10 is outside that range, so on this machine no setting puts one kernel on the two sides. The manual's advice outside the contract is to watch the gap and lower its sampler part.

## Resolution

Remove the attention flag on the trainer side, or set it to a name from the error's own list. Leave the engine on its backend. The two lists are different, and the only pairing that makes both sides bit-exact needs a Hopper GPU, which this machine is not. The healthy run then shows a `rollout 0` line within minutes, and a step-0 gap inside the range of the healthy runs on this machine, 0.0136 to 0.0164 for this model without top-p or top-k.

## Wrong turns

- "The image is broken, pull another tag." The error is a value check in the trainer library against its own list of names. The manual's runs used this image with the default name and completed.
- "Give the engine the same name as the trainer, so the names match." The engine accepts `triton` and the trainer does not. Matching names does not give matching kernels, and the trainer still refuses to start.
- "Use the contract pair, FlashAttention 3 on both sides." The engine's FA3 backend refuses the GB10 at start, because of its compute capability range, and the job then runs for an hour against a dead engine.

## Generalize

Two components that read the same word do not read the same thing. Each one checks a setting against its own list, and an error that prints the list is the fastest fix you will get. Read the list, pick from it, and do not expect a shared name to buy shared numerics. Bit-exact agreement between a server and a trainer is a contract with a model list and a hardware range, not a flag.

## Taught in

The Miles manual lists this error in [its symptom table](../../../manuals/miles-101/sections/7-1-troubleshoot-by-symptom.md) and the contract that both sides must meet in [the true on-policy limits page](../../../manuals/miles-101/sections/4-6-know-the-true-on-policy-limits.md), and the SGLang manual shows the same run and where the flag value came from in [its RL rollout engine page](../../../manuals/sglang-101/sections/7-2-sglang-as-an-rl-rollout-engine.md).
