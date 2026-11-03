---
id: acceptance-length-on-long-answers
title: Acceptance by draft position, tokens per pass
card: inference-serving
kind: estimate
level: 3
roles: [inference-engineer]
rounds: [ml-depth, debugging]
tags: [speculative-decoding, eagle3, acceptance-length, long-outputs]
minutes: 8
lessons: []
manuals: [vllm-101#s-speed-up-decode-with-eagle3, sglang-101#s-speculative-decoding]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

A vLLM server runs Qwen/Qwen3-8B with an EAGLE3 draft of depth 3. Over a run of answers near 2,000 tokens at 8 users, the counters show that the draft at position one was accepted with probability 0.77, position two with 0.54, and position three with 0.38. Estimate the mean number of tokens that one verify pass commits, and say what you would check before you rely on that gain for long answers.

## Short answer

Each verify pass commits the accepted drafts plus one bonus token from the target, so the mean acceptance length is one plus the sum of the per-position acceptance rates. With 0.77, 0.54 and 0.38 that is about 2.69 tokens per pass, which is the value vLLM reported on GSM8K in that run. Before I trust it on long answers I would read the acceptance of the longest answers alone, with real output lengths and without ignore-eos, because another study saw the acceptance fall from about 3.7 to about 1.5 on answers that ran toward 20,000 tokens.

## Full answer

### The arithmetic

The per-position rates already include the order of the chain: position two can only be accepted when position one was, and 0.54 is the share of all passes in which position two was accepted. The expected number of accepted drafts is the sum of the rates, and the target always adds one token of its own, so:

```text
mean acceptance length = 1 + 0.77 + 0.54 + 0.38 = 2.69
```

On ShareGPT the same run gave 0.67, 0.42 and 0.26, which is 2.35. Both match the mean acceptance length that vLLM reported from its counters.

### What the manual measured on long answers

Qwen/Qwen3-8B in BF16 at 8 users, answers up to 2,048 tokens, no ignore-eos, median answer 1,800 to 2,000 tokens:

| Engine | Dataset | Mean acceptance length | Accepted per draft position 1 / 2 / 3 |
|---|---|---|---|
| SGLang EAGLE3 | GSM8K | 2.68 | |
| SGLang EAGLE3 | ShareGPT | 2.32 | |
| vLLM EAGLE3 | GSM8K | 2.69 | 0.77 / 0.54 / 0.38 |
| vLLM EAGLE3 | ShareGPT | 2.35 | 0.67 / 0.42 / 0.26 |

On short 128-token answers in the same session, SGLang gave 2.69 to 2.78 on GSM8K and 2.33 to 2.43 on ShareGPT. Its long answers stayed within 0.01 of those ranges.

### By position inside the answer

A second test ran 8 prompts with thinking on, greedy, at one user, up to 4,096 tokens, and read the acceptance in segments:

| Segment of the output | SGLang | vLLM |
|---|---|---|
| 0 to 256 | 2.05 to 2.64 (8) | 2.14 to 2.51 (8) |
| 256 to 512 | 1.95 to 2.64 (8) | 2.09 to 2.55 (8) |
| 512 to 1,024 | 2.11 to 2.77 (8) | 2.12 to 2.79 (8) |
| 1,024 to 2,048 | 2.09 to 2.47 (5) | 1.72 to 2.66 (5) |
| 2,048 to 4,096 | 2.33 and 2.48 (2) | 2.35 and 2.60 (2) |

Up to 4,096 tokens the acceptance did not fall steadily. Only 2 of the 8 prompts ran past 2,048 tokens, so the last segment rests on two answers, and the limit of 4,096 came from the memory on that GPU. So the test did not reach the range of the study that saw the fall.

### When acceptance does fall

One incident shows a different cause. A draft config with 2,048 positions and no rope scaling accepted 3.2 tokens at 1k input tokens, 1.6 at 3k and 1.2 at 10k. At 10k the server produced 63.9 tokens per second against 102.7 without speculation. The draft could not read past its position limit. Adding the rope scaling and 131,072 positions to the draft config fixed it. The override variable that skips the context check removes the check and does not teach the draft to read long prompts.

### What to read

- vLLM: `spec_decode_num_draft_tokens` and `spec_decode_num_accepted_tokens` from `/metrics`, and the `SpecDecoding metrics` line in the log.
- SGLang: `accept len` and `accept rate` on each decode log line, `sglang:spec_accept_length` from `/metrics`, and `spec_accept_length` in the `meta_info` of each `/generate` response, which gives you the value per answer.
- Compare the P99 ITL and the P99 TTFT with and without the draft, and compare `max_position_embeddings` of the draft with your longest prompts.

## Follow-ups

- **Level 3:** Why is the bonus token always there? Expected: the target computes a distribution one position past the last accepted draft, so even when every draft is rejected the pass still writes one token of its own, as plain decoding would.
- **Level 3:** The ShareGPT rates were 0.67, 0.42 and 0.26. What length do you get, and why is it below GSM8K? Expected: 2.35; open chat is harder for the draft to predict than math steps and code, so fewer drafts match the target.
- **Level 4:** Acceptance was 3.2 at 1k input tokens and 1.2 at 10k on a draft with 2,048 positions. Cause and fix? Expected: the draft could not read past its position limit, so its guesses degrade with the prompt length; the rope scaling and the longer position count in the draft config fixed it, and the override variable only removes the check.

## Wrong answers

- "The mean acceptance length is the mean of the three rates." It is the expected count of accepted drafts, the sum of the rates, plus the bonus token; 0.77 plus 0.54 plus 0.38 plus one is 2.69, not a value below one.
- "An acceptance length of 2.69 means 2.69 times the speed." Each pass also pays the draft steps and the check; on the L4 the dense model gave each token 1.6 to 2.3 times faster and no more output from 32 users, because the draft took pool space.
- "A long answer keeps the acceptance of a short one." In the manual's own test to 4,096 tokens it did, but another study saw it fall from about 3.7 to about 1.5 toward 20,000 tokens, and a draft with too few positions fell from 3.2 to 1.2 with the prompt length; read your own long answers.

## Taught in

[Speed up decode with EAGLE3](../../../manuals/vllm-101/sections/4-1-speed-up-decode-with-eagle3.md) and [the SGLang speculative decoding section](../../../manuals/sglang-101/sections/4-4-speculative-decoding.md) hold the acceptance tables by position and by answer length.
