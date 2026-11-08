---
id: speculation-depth-vs-batch
title: Speculation depth against batch size
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth, system-design]
tags: [speculative-decoding, eagle3, draft-depth, acceptance-length, batch-size, kv-pool]
minutes: 25
lessons: []
manuals: [vllm-101#s-speed-up-decode-with-eagle3, vllm-101#s-how-speculative-decoding-checks-drafts, sglang-101#s-speculative-decoding]
practice: []
cheatsheet: [speculative-decoding]
related: [scenarios/thermal-throttle-voided-ab-test]
updated: 2026-11-03
system:
  version: vLLM 0.31.0 and SGLang 0.5.22
  model: Qwen/Qwen3-8B with the Tengyunw/qwen3_8b_eagle3 draft
  hardware: one L4 with 24 GB of memory, SM clock locked at 900 MHz, and a GB10 as the second machine
source:
  - manuals/vllm-101/sections/4-1-speed-up-decode-with-eagle3.md
  - manuals/sglang-101/sections/4-4-speculative-decoding.md
  - manuals/sglang-101/capture/gpu/out-l4/server-load-eagle3.log
  - manuals/sglang-101/capture/gpu/out-gb10/server-eagle3.log
  - manuals/vllm-101/capture/gpu/out-l4/eagle3-long-outputs.txt
---

## Situation

A team serves `Qwen/Qwen3-8B` on one L4 and wants shorter answers for its users. They turn on EAGLE3 with a trained draft and set the draft depth to 5, because a deeper draft guesses more tokens in each step. At one user the time per token almost halves, and the demo is a success.

The load test at 32 users tells another story. Each token still arrives faster, but the server writes no more total tokens each second than it did without speculation, while the first token now takes several seconds. The team concludes that speculation does not scale and schedules its removal. A second team, which serves a model of a second family on a GB10 with the same method, reports that their gain holds at 64 users and asks what the first team did wrong.

## Evidence

- [EAGLE3 at three draft depths against no speculation, with the clock locked](evidence/depth-sweep-locked.txt)
- [the same draft on the other engine, time per token against output on the L4](evidence/dense-model-on-l4.txt)
- [the startup lines of the server with the draft loaded on the L4](evidence/draft-pool-cost.txt)
- [the one warning that sets the request limit](evidence/the-silent-cap.txt)
- [EAGLE3 with its own draft on a mixture-of-experts model on the GB10](evidence/moe-model-on-gb10.txt)
- [the acceptance length on answers of about 2,000 tokens, both engines](evidence/acceptance-long-answers.txt)

## Questions

1. Why does a deeper draft pay at one user and cost at 32? Name what a wrong guess spends in each case.
2. From the depth sweep, which depth wins at 32 users and which at one user, and how do you know that the gain is real and not noise?
3. On the L4 each token got faster at every load, and the output stopped growing from 32 users. Which two startup lines explain that, and what does each one cost?
4. On the GB10, an MoE model with its own EAGLE3 draft kept its gain at 64 users. The model, the draft and the card all changed. Which change do you think explains most of the result, and how would you test it?
5. Acceptance stayed between 2.32 and 2.69 tokens per step on long answers. Why would you still measure it on the longest answers that your users get?
6. Design the rollout: which depth, which limits you set by hand, which metrics you read, and which runs come before production.

## Walkthrough

A draft model guesses the next tokens, and the target model checks all the guesses in one pass. At one user the GPU has spare compute in each step, so the extra guesses are almost free and each accepted guess is a token that the target did not have to compute alone. At 32 users each step is already full, and every wrong guess takes compute from a real token of another user.

The depth sweep shows that trade with the clock locked at 900 MHz. At 32 users the run without speculation gave 208.8 tokens per second. Depth 1 gave 271.1, depth 3 gave 333.6 and depth 5 gave 289.5. Depth 3 is 1.6 times the baseline, and its seed range did not overlap with any other config. Depth 5 lost output against depth 3, so its extra guesses cost more than they gave. At one user depth 3 cut the time per token from 39.4 to 27.8 ms against depth 1, and depth 5 at 26.2 ms tied with it inside the seed spread. The one-user run without speculation fell to 210 MHz, below the lock, so it is left out of the comparison. One more cost hides in the median: the ITL at 32 users rose from 84 ms to 133 ms at depth 3, because each step now delivers several tokens at once and the stream arrives in larger, less frequent groups.

The second listing is the other engine with the same draft on the same card. Each token came out 1.6 to 2.3 times faster at every load. At 32 users the output was 269.42 against 270.11 tokens per second without the draft, a ratio of 1.00, and at 64 users 245.34 against 250.85. The startup lines explain it. With the draft loaded, the KV pool held 9,951 tokens against 24,094 without it, about 15 of our 640-token requests, because the draft took its share of the card. And the server set `max_running_requests=48` by itself. The fourth listing is the warning that does it: when nobody sets the limit, the engine resets it to 48 for speculative decoding, prints that once, and the line scrolls away. At 32 users the first token took 8,040 ms with the draft against 2,970 ms without, because the pool held about 15 requests and the rest waited.

The GB10 run is the counterexample, with a caveat: that run used another model, another draft and another card, so it does not isolate the architecture. On a mixture-of-experts model the time per token fell by 1.56 times or more at every load, with a peak of 1.89 times at 32 and 1.84 at 64, and the acceptance length stayed between 2.71 and 2.74 tokens per step. A dense model reads all its weights in each step, so a larger batch already uses the spare compute that speculation needs. A mixture-of-experts model reads only the experts that the tokens of the step chose, and the verify pass scores four positions per request with the expert weights that it already read. Even there the cap bit: at 64 users the output was 276.32 against 235.38, but the median first token was 7,772 ms against 557 ms, because 48 requests ran and 16 waited.

The last listing is the acceptance on long answers at 8 users: 2.68 and 2.32 tokens per step on two datasets for one engine, 2.69 and 2.35 for the other, with the first draft position accepted 0.77 and 0.67 of the time and each later position less. It did not fall from 128-token answers to answers of about 2,000 tokens. That is our measurement, on two datasets. A 2026 study of reasoning answers that ran toward 20,000 tokens found the acceptance length fall from about 3.7 to about 1.5, and another found that synthetic prompts overstate the gain of real prompts. So the number to trust is the one from your own longest answers.

## Resolution

For this model and draft on the L4, the right depth is 3. With the clock locked it gave 1.6 times the output at 32 users and tied depth 5 at one user, while depth 5 lost output under load. The first team measured depth 5 at one user and read that result as a property of speculation.

Two settings decided the load test, and neither was the draft depth. The draft shrank the pool to 9,951 tokens, which holds about 15 of the 32 requests, and the engine capped the running requests at 48 without being asked, which binds at 64 users. Read the pool line and the cap warning after you load a draft, set `--max-running-requests` yourself, and count how many of your requests fit in the smaller pool. Then measure on your own traffic without `--ignore-eos`: the acceptance from the draft and accepted token counters, the median time per token and the output, and the P99 ITL and P99 TTFT, because a better median can hide a worse tail. Lock or record the clock for every pair. The second team was right for their machine and wrong to generalize: on a mixture-of-experts model the gain held as the batch grew, and on a dense 8B model it did not.

## Wrong turns

- "A deeper draft always gives more tokens per step." At 32 users depth 5 gave 289.5 tokens per second and depth 3 gave 333.6. Past the depth that the acceptance supports, each extra guess is compute taken from another user.
- "Speculation does not scale, remove it." The output tie on the dense model came from a pool of 9,951 tokens, not from the draft. At 32 users the cap of 48 did not bind; at 64 users it did. The mixture-of-experts model kept 1.84 times at 64 users.
- "Compare against the run without speculation at one user too." That run fell to 210 MHz while the others held 900. A clock gap that large hides the effect, so the row is left out.
- "The acceptance from the 128-token benchmark is the acceptance we will see." Our long answers held it, but a study of answers toward 20,000 tokens saw it fall from about 3.7 to about 1.5. Measure your own tail.
- "Raise the running request limit and the queue disappears." The pool holds about 15 requests of 640 tokens. A higher limit does not add memory, it adds waiting on a different line of the log.

## Generalize

A feature that spends idle capacity pays when the capacity is idle and costs when it is not, so its value is a function of the load, the model architecture and the memory it takes, not a property of the feature. Measure it across the load range you serve, read every startup line that a new component changes, and treat a default that a component sets for you as a setting you now own.

## Taught in

The vLLM manual sweeps the depth in [the EAGLE3 page](../../../manuals/vllm-101/sections/4-1-speed-up-decode-with-eagle3.md) and explains the check in [the speculative decoding page](../../../manuals/vllm-101/sections/8-7-how-speculative-decoding-checks-drafts.md), and the SGLang manual measures the dense and the mixture-of-experts case and names the request limit in [its speculative decoding page](../../../manuals/sglang-101/sections/4-4-speculative-decoding.md).
