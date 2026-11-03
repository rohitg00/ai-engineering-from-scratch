---
id: eagle3-draft-refused-context-length
title: The draft that declared 2,048 positions
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth]
tags: [speculative-decoding, eagle3, draft-model, context-length, startup]
minutes: 20
lessons: []
manuals: [sglang-101#s-speculative-decoding]
practice: []
cheatsheet: []
related: [scenarios/speculation-depth-vs-batch]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-30B-A3B-Instruct-2507 with the lmsys/SGLang-EAGLE3-Qwen3-30B-A3B-Instruct-2507-SpecForge-Nex draft, and Qwen/Qwen3-8B with the Tengyunw/qwen3_8b_eagle3 draft
  hardware: one GB10 with unified memory, and one L4 as the second machine
source:
  - manuals/sglang-101/capture/gpu/out-gb10/server-eagle3-no-env.log
  - manuals/sglang-101/capture/gpu/out-gb10/server-eagle3.command.txt
  - manuals/sglang-101/capture/gpu/out-gb10/server-eagle3.log
  - manuals/sglang-101/capture/gpu/out-l4/server-eagle3-no-env.log
  - manuals/sglang-101/sections/4-4-speculative-decoding.md
---

## Situation

A team adds EAGLE-3 speculation to its mixture-of-experts server on a GB10. They take the draft model and the shape from the cookbook: three steps, a top-k of one, four draft tokens. The start fails inside the draft worker with a `ValueError` about two context lengths, and the scheduler child exits.

Earlier the same day a colleague turned on the same feature for the dense 8B model on an L4, with its own trained draft, and the server came up without any change. The team concludes that the draft published for the 30B model is defective and prepares an issue for its authors, with a request for a new draft. You are asked to look at the two logs before the issue goes out.

## Evidence

- [the end of the traceback of the refused start](evidence/the-refusal.txt)
- [the 8B target and its draft on an L4, with no override](evidence/l4-draft-loaded.txt)
- [the settings line of the L4 start](evidence/l4-pool-and-context.txt)
- [the command of the start that worked](evidence/the-command-that-started.txt)
- [the same check with the override set](evidence/override-accepted.txt)
- [the two pools of the target and the draft](evidence/pool-with-draft.txt)
- [what the override does and does not do](evidence/what-the-variable-does.txt)

## Questions

1. Which component raised the error, the target or the draft, and which two numbers does the check compare?
2. The L4 pair started with no change. What differs between the two draft configs?
3. The error message names an environment variable. What does setting it change, and what does it leave as it was?
4. Read the pool lines of the start that worked. What did the draft cost in memory, and which request limit did speculation set?
5. The benchmark prompts had 512 tokens. Which incident in the manual shows what a draft with 2,048 positions does on long inputs, and how would you test that before production?

## Walkthrough

1. **Read the traceback from the bottom up to the first frame you recognise.** The frames run from the scheduler into `maybe_init_draft_worker`, then into the EAGLE draft worker, then into a model config, and the error is raised in `_derive_context_length`. So the check belongs to the draft's model config. It compares the target's context length, 262144, with the length it derived for the draft, 2048, and refuses because the target is larger. The last sentence of the message names the way out: set `SGLANG_ALLOW_OVERWRITE_LONGER_CONTEXT_LEN=1`.
2. **Compare with the L4 pair.** On the L4 the target loaded with 6.41 GB free, the draft of type `LlamaForCausalLMEagle3` loaded 1.90 GB more, the pool came out at 8,827 tokens, and the settings line reads `context_len=40960`. That draft declares 40,960 positions, the same as its target, so the check had nothing to refuse. The variable belongs to one draft config, not to EAGLE-3. The manual's rule is to compare `max_position_embeddings` in both configs before you set it.
3. **Read the start that worked.** The cookbook command for this pair begins with the variable. With it set, the same warning about 262144 against 2048 still prints, and the next line says what changed: the draft's `max_position_embeddings` is overridden to 262144. The manual is exact about the meaning. The variable only removes the check. It does not teach the draft to read long prompts.
4. **Read what the draft cost.** The target pool holds 216,775 tokens at 9.92 GB each for K and V. The draft has a pool with the same token count at 0.21 GB each, after loading 1.58 GB of weights in 1.30 s. The start also reset `max_running_requests` to 48, the cap that every speculation handler sets when you do not set it yourself. On the L4 the same draft design cut the pool from 24,094 tokens to 8,827, so on a small card the draft takes the memory that the batch needs.
5. **Find the incident that the override hides.** Issue #6783 in the manual's incident list ran a 70B model with EAGLE-3 and a draft config of 2,048 positions and no rope scaling. Acceptance was 3.2 tokens at 1k input, 1.6 at 3k and 1.2 at 10k, and at 10k the server produced 63.9 tokens per second against 102.7 without speculation. Adding rope scaling and 131,072 positions to the draft config fixed it. The manual's GB10 run used 512-token prompts and says that it tells you nothing about long contexts. The test is to read `accept len` on the decode log lines, or `sglang:spec_accept_length` from the metrics, on your own longest prompts, and to compare the time per token with speculation off at the same prompts.

## Resolution

The draft is not defective. Its config declares 2,048 positions, and the context length check refuses that against a 262,144-token target. The cookbook's command sets the variable for this pair, and with it the server started with a target pool of 216,775 tokens, a draft of 1.58 GB, and a cap of 48 running requests. The issue to the draft's authors was not sent.

The team then treated the variable as a removed check rather than a fix. They measured the acceptance length on their longest prompts with the decode log and the endpoint for metrics, and set `--max-running-requests` themselves from the concurrency where speculation still won in their sweep. If acceptance falls on long prompts the way it did in issue #6783, the next step is a draft config with rope scaling and enough positions, or no speculation for that traffic, not a larger override.

## Wrong turns

- "The draft model is broken, ask for a new one." The draft loaded and served once the check was removed. A config that declares 2,048 positions is a limit of that draft, not a defect in its weights.
- "Set the variable everywhere EAGLE-3 runs." The L4 draft needed no variable, because its positions matched its target. Set it only for the draft config that needs it, after you compared the two configs.
- "The override fixed it, so long prompts are fine." The override removes a check. In issue #6783 a draft with 2,048 positions fell to 1.2 accepted tokens at 10k input and made the server slower than no speculation.
- "Lower the target's context length to 2048 so the check passes." That caps every request at the draft's limit and gives up the long contexts the 30B model was chosen for. Fix the draft config or test the limit instead.

## Generalize

A refusal at startup is a contract check between two components, and the fastest way out is to turn the check off. Before you do, read what each side declared and what the check protects. An override that removes a check leaves the mismatch in place, so the measurement that the check stood in for, here the acceptance length on long prompts, becomes your job. Compare the two configs, remove the check only for the pair that needs it, and measure what it guarded.

## Taught in

The speculative decoding page of SGLang 101 records both starts in [what we measured on a GB10](../../../manuals/sglang-101/sections/4-4-speculative-decoding.md#what-we-measured-on-a-gb10), gives the cap in [the limit nobody asked for](../../../manuals/sglang-101/sections/4-4-speculative-decoding.md#the-limit-nobody-asked-for), and lists the long-prompt failure under [incidents](../../../manuals/sglang-101/sections/4-4-speculative-decoding.md#incidents).
