---
id: eagle3-draft-depth
title: Pick the EAGLE3 draft depth for your concurrency
card: inference-serving
kind: tradeoff
level: 3
roles: [inference-engineer]
rounds: [design-review, ml-depth]
tags: [speculative-decoding, eagle3, draft-depth, concurrency, clock]
minutes: 10
lessons: []
manuals: [vllm-101#s-speed-up-decode-with-eagle3]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

You turn on an EAGLE3 draft for Qwen/Qwen3-8B on one L4 and must set `num_speculative_tokens`. The draft config suggests a value, but you want to set it yourself. How do you choose, and how does the right value move with the number of users?

## Short answer

Set the depth yourself and sweep it at your real concurrency, because the depth that pays falls as more users share each step. On our clock-locked L4 at 32 users, depth 3 gave 333.6 output tokens per second against 208.8 with no speculation, and depth 5 fell back to 289.5, so the extra guesses cost more than they returned. At one user depths 3 and 5 tied, so start at 3 and move only on a measurement.

## Full answer

### Why the depth matters

A deeper draft can give more tokens for each pass of the target, but each guess also costs work in the check. With one user the GPU has spare compute in each step, so extra guesses are almost free. With many users each step is already full, and wrong guesses take compute from real tokens.

### The sweep

Depths 1, 3 and 5 against no speculation, with the clock locked at 900 MHz, 512 tokens in and 128 out, two seeds each:

| Users | Config | Median TPOT | Output tok/s | Median SM clock |
|---|---|---|---|---|
| 32 | no speculation | 119.9 ms | 208.8 | 881 MHz |
| 32 | depth 1 | 100.4 ms | 271.1 | 900 MHz |
| 32 | depth 3 | 77.8 ms | 333.6 | 900 MHz |
| 32 | depth 5 | 83.7 ms | 289.5 | 885 MHz |
| 1 | depth 1 | 39.4 ms | 22.4 | 900 MHz |
| 1 | depth 3 | 27.8 ms | 31.3 | 900 MHz |
| 1 | depth 5 | 26.2 ms | 31.7 | 900 MHz |

At 32 users depth 3 gave 1.6 times the output of no speculation, and its seed range did not overlap with any other config. At one user depth 3 cut the time per token from 39.4 to 27.8 ms against depth 1, and depth 5 was the same within the seeds. The run with no speculation at one user fell to 210 MHz, below the lock, so the manual does not compare it.

### The stream gets lumpier

The median TPOT fell, but the gaps between token groups grew. At 32 users the median ITL rose from 84 ms with no speculation to 133 ms at depth 3. Each step now sends several tokens at once, so the stream arrives in larger and less frequent groups.

### The limits of the result

The gain holds for random prompts and outputs of 128 tokens. Other teams found that synthetic prompts overstate the gain on real prompts and that the best depth changes with the batch size. One study saw the acceptance length fall from about 3.7 to about 1.5 on answers that ran toward 20,000 tokens. The manual's own test up to 4,096 tokens did not see a steady fall; the acceptance stayed near 2.1 to 2.8 tokens per step. So test on your own long answers before you trust the gain.

### Lock the clock before you compare

The first EAGLE3 runs had no lock. At one user the run with no speculation ran at 210 MHz and the EAGLE3 run at about 1,400 MHz. A gap that large hides the effect of speculation, so those runs were set aside. Lock the SM clock with the driver tool before a comparison and release it after, and compare two runs only at the same clock.

### Choose

- Start at 3 for Qwen3-8B with this draft. It gave the best output at 32 users and tied at one.
- For a busy server, sweep the depth on your own model; depth 5 lost output at 32 users here.
- If the load changes a lot through the day, vLLM can set the depth by batch size with `num_speculative_tokens_per_batch_size`. The manual did not test it.
- Read the two counters, `spec_decode_num_draft_tokens` and `spec_decode_num_accepted_tokens`, and divide; read the P99 ITL and the P99 TTFT, not only the median.

## Follow-ups

- **Level 3:** Why did depth 5 lose to depth 3 at 32 users but tie at one user? Expected: at one user the step has spare compute, so two more guesses are nearly free; at 32 users the step is full, and each rejected guess takes compute from real tokens.
- **Level 3:** The median time per token fell and users still said the stream felt uneven. Why? Expected: each step now sends several tokens at once, so tokens arrive in larger and less frequent groups; the median ITL rose from 84 to 133 ms at depth 3 with 32 users.
- **Level 4:** Your load swings from 2 users at night to 32 by day. What do you set? Expected: sweep the depth at both loads, because the depth that pays falls with the batch; vLLM can set the depth per batch size, which the manual did not test, so measure before you trust it.

## Wrong answers

- "Deeper is better, because more guesses mean more tokens per step." At 32 users depth 5 gave 289.5 tokens per second against 333.6 at depth 3; the extra guesses cost more compute than they returned.
- "Leave the depth out and let the draft config decide." Then you do not know what runs; set it yourself so that the number in the command is the number you measured.
- "Compare speculation with the baseline at one user and ship the ratio." The one-user baseline ran at 210 MHz while the EAGLE3 run ran near 1,400 MHz, so the ratio measured the clock; compare at the same clock and at the concurrency you serve.
- "The gain on the random dataset transfers to chat." Synthetic prompts overstate the gain and the acceptance can fall on long answers; measure the acceptance on your own traffic with real output lengths and without ignore-eos.

## Taught in

[Speed up decode with EAGLE3](../../../manuals/vllm-101/sections/4-1-speed-up-decode-with-eagle3.md) has the depth sweep, the acceptance tables and the clock rule.
