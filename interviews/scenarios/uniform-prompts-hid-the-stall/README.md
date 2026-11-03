---
id: uniform-prompts-hid-the-stall
title: Uniform prompt lengths that hid the stall
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth, system-design]
tags: [load-testing, prompt-lengths, p99-itl, waves, chunked-prefill, engine-choice]
minutes: 25
lessons: [phases/17-infrastructure-and-production/22-load-testing-llm-apis]
manuals: [vllm-101#s-ref-lab-notes, vllm-101#s-keep-long-prompts-from-stalling-short-ones, sglang-101#s-reading-other-peoples-benchmarks, sglang-101#s-sglang-benchmark-serving]
practice: []
cheatsheet: [inference-load-testing, serving-engines-compared]
related: [scenarios/load-knee-and-admission-cap, scenarios/prefix-cache-inflated-benchmark]
updated: 2026-11-03
system:
  version: vLLM 0.31.0 against SGLang 0.5.22
  model: Qwen/Qwen3-8B
  hardware: one L4 with 24 GB of memory
source:
  - manuals/vllm-101/sections/r-7-lab-notes.md
  - manuals/vllm-101/sections/3-3-keep-long-prompts-from-stalling-short-ones.md
  - manuals/sglang-101/sections/5-3-reading-other-peoples-benchmarks.md
  - manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md
  - manuals/sglang-101/capture/gpu/out-l4/waves-default-input-tokens.txt
  - manuals/sglang-101/capture/gpu/out-l4/server-waves-default.log
  - manuals/sglang-101/capture/gpu/out-l4/server-waves-mixed-chunk.log
---

## Situation

A team that serves `Qwen/Qwen3-8B` on L4 cards runs an engine evaluation before a contract renewal. The load test is the benchmark client's default shape: 64 prompts with 16 users at once, every prompt 512 tokens and every answer 128 tokens. Engine A reads a P99 inter-token gap of 502 ms and a median first-token wait of 1,499 ms. Engine B reads 81 ms and 1,775 ms. The output is the same, 181.7 against 182.3 tokens per second. The evaluation calls engine A's stream "unusable" and schedules a migration to engine B.

A support engineer points out that production prompts run from a few tokens to several thousand, and that nobody has seen a 500 ms gap in production on engine A. The team repeats the test with the client's length ratio at 0.5 and at 0, where lengths vary, and the two engines change places on the stream metric. You are asked which result is the one to act on.

## Evidence

- [the waves workload on the L4 by length ratio, both engines](evidence/the-waves-table.txt)
- [how the length ratio sets the prompt and output lengths](evidence/what-the-ratio-means.txt)
- [total input tokens sent at each ratio, seed 1](evidence/input-tokens-by-ratio.txt)
- [five consecutive scheduler lines from a run at ratio 1.0](evidence/one-wave-in-the-log.txt)
- [how the SGLang manual reads the two traffic shapes](evidence/a-different-winner-per-shape.txt)
- [SGLang with the mixed chunk against vLLM, by ratio](evidence/the-mixed-chunk-test.txt)
- [the caveats of the ratio test and the rule for using it](evidence/two-settings-two-servers.txt)

## Questions

1. Explain, from the length ratio definition, what identical lengths at 16 users do to the arrival pattern.
2. Read the five log lines. What happened in the second before the first line, and what did the scheduler do in the next two?
3. Why does the engine that keeps the stream smooth in waves lose that advantage when lengths vary?
4. The mixed-length runs sent fewer input tokens. What else differs between the two shapes, and what can you still compare?
5. One SGLang flag cut its mixed-length tail almost in half. What did it cost, and when would you turn it on?
6. Decide the renewal: which result, which flag, and which test you put into the contract.

## Walkthrough

1. **Read what the ratio does.** At a ratio of 1.0 every request has 512 prompt tokens and 128 output tokens. At 0, each length is drawn at random from 1 token up to that size. With identical lengths at a fixed user count, all 16 requests start together, finish together, and their replacements arrive together. The traffic comes in waves. With mixed lengths, requests end at different times and new prompts arrive one by one.
2. **See the wave in the log.** In the first line only one request is running, so fifteen had just finished at once. The scheduler prefilled their replacements in two batches, 4096 and then 3583 new tokens, with no decode in between. Then all 16 decoded together: the generation throughput reads 2.62 tokens per second on the step that carried the prefill, then 231.07 and 229.85 on the steps after it. Prefill happened only between waves, so the decode steps had clean gaps and the first token of a whole wave waited for two full prefill batches.
3. **Read the table at ratio 1.** The engines tie on output, 181.7 against 182.3. vLLM gives the first token sooner, 1,499 against 1,775 ms, and SGLang keeps the stream smooth, with a P99 ITL of 81 against 502 ms. That is the same choice the two engines make at a full pool: one admits the new prompts into the running steps, the other finishes the wave's prefill first.
4. **Read the table at ratios 0.5 and 0.** With mixed lengths vLLM led. At 0.5 it gave 169.6 against 159.6 tokens per second, a median TPOT of 81.4 against 87.8 ms and a P99 ITL of 191 against 363 ms. At 0 the P99 ITL was 202 against 302 ms and the first token 284 against 283 ms. The SGLang manual's reading: when new prompts arrive one by one, each prefill shares a step with the running decodes, and vLLM split that work so the stream stalled less. The vLLM manual describes the mechanism as the batch token budget: in each step the running streams get their next token first, and a waiting prompt fills the rest.
5. **Account for the confounds.** Mixed lengths sent fewer tokens: 32768 input tokens at 1.0 in seed 1, 24504 at 0.5 and 17870 at 0. The runs at 0.5 and 0 also came after the run at 1.0 on the same server, so part of their first-token gain can be the cache. The SGLang manual says that less work and the cache do not explain the stream: with mixed lengths its P99 ITL rose from 82 to 300 ms because each prefill stopped the running decodes. So compare the shape of each row and the ranking inside a row, not the absolute throughput across rows.
6. **Read the mixed-chunk test.** With `--enable-mixed-chunk`, SGLang puts the running decodes into the prefill batch. On mixed lengths it then tied vLLM: the P99 ITL fell from 363 to 193 ms at 0.5 and from 302 to 196 ms at 0, with every seed range overlapping, and the output rose by about 8 percent. On fixed lengths the flag cost: the P99 ITL rose from 81 to 203 ms, with seeds from 83 to 349 ms, while vLLM stayed at 502. The log shows one prefill of 514 tokens with 15 requests decoding in the same batch.
7. **Decide what each setting measures.** The SGLang manual states it: fixed lengths measure bursts, a slow first token and smooth tokens after it; mixed lengths measure steady traffic, a fast first token and stalls in the stream. Keep the ratio at 1.0 to compare two builds, because it repeats exactly. Run your real length distribution before you set a latency target.

## Resolution

The migration decision rested on a traffic shape that production never produces. Identical lengths at a fixed user count synchronize the requests into waves, and in waves engine A's choice to admit new prompts into running steps costs a 502 ms tail that engine B avoids by prefilling between waves. With the lengths production has, engine A had the lower tail, 191 against 363 ms at 0.5 and 202 against 302 at 0, the same or better first token, and more output. On the support engineer's evidence, the 500 ms gap belongs to the test.

The renewal keeps engine A. If the team prefers engine B for other reasons, `--enable-mixed-chunk` removes its mixed-length disadvantage at a cost in bursts, 81 to 203 ms, so the choice depends on whether production arrives in bursts or steadily. The contract test changes: sample the real length distribution from production logs, run it as the acceptance test, and keep the fixed-length run only as the repeatable build-to-build check. Record the clock on both; every median clock in the mixed-length pairs was 1,410 MHz or higher, which is why those rows are comparable.

## Wrong turns

- "A 502 ms tail is a scheduler bug in engine A." The same engine read 202 ms at a ratio of 0 and 191 at 0.5. The tail came from 16 prefills landing in the same steps, which the test created and production does not.
- "Identical lengths are the fairest test, because nothing varies." They are the most repeatable, not the most realistic. They measure bursts, and the SGLang manual says to use them for build comparisons, not for latency targets.
- "Raise the token budget so prefills finish sooner." On the DGX Spark, a budget of 16,384 tokens raised the P99 ITL from 574 to 798 ms at a low rate, and the gain in the first token did not clear the seed spread. The budget trades the two latencies; it does not remove the stall.
- "Compare throughput, the engines tie, so it does not matter." The tie on output hid a 502 against 81 ms tail in one shape and a 363 against 191 ms tail in the other. Users feel the tail.
- "Turn on the mixed chunk everywhere on engine B." On fixed-length bursts it raised the P99 ITL from 81 to 203 ms with seeds up to 349. It fixes steady traffic and hurts bursts, so measure your traffic shape first.

## Generalize

A load test with one prompt length tests one point of the length distribution, and at a fixed user count it also synchronizes the requests, so it measures a burst that steady traffic never produces. The ranking of two schedulers can flip between those shapes. Sample the real distribution of lengths for every latency target, keep the fixed-length run for repeatability, and read the tail next to the median in both.

## Taught in

The vLLM manual holds the waves tables in [the lab notes](../../../manuals/vllm-101/sections/r-7-lab-notes.md) and the budget mechanism in [the token budget page](../../../manuals/vllm-101/sections/3-3-keep-long-prompts-from-stalling-short-ones.md), the SGLang manual reads the pair [on waves](../../../manuals/sglang-101/sections/5-3-reading-other-peoples-benchmarks.md#the-same-pair-on-waves) and tests the ratio in [its benchmark page](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md#we-tested-the-waves-on-an-l4), and [the load testing lesson](../../../phases/17-infrastructure-and-production/22-load-testing-llm-apis/docs/en.md) names the prompt-uniformity trap.
