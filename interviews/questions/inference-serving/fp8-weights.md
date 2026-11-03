---
id: fp8-weights
title: When an FP8 checkpoint pays
card: inference-serving
kind: tradeoff
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [design-review, ml-depth]
tags: [fp8, quantization, throughput, gsm8k, kv-pool]
minutes: 10
lessons: []
manuals: [vllm-101#s-fit-a-bigger-model-with-fp8-weights, sglang-101#s-quantization]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Your Qwen/Qwen3-8B server in BF16 fits on one L4, but only with a small KV pool. The model's publisher also offers an FP8 checkpoint. When does the FP8 checkpoint pay, what does it do to speed, and what does our GSM8K check say about the cost?

## Short answer

FP8 weights store most parameters in 1 byte instead of 2, so they free memory that the engine gives to the KV pool, and on a GPU with FP8 math they also speed up the matrix work. On our clock-locked L4 with the pool held fixed, the FP8 checkpoint gave 284.7 against 208.8 output tokens per second at 32 users, 36 percent more, and cut the time per token by 30 percent. On 500 GSM8K questions it scored 90.6 percent against 91.8 in BF16, 1.2 points lower with overlapping intervals, so the run did not show a loss and cannot rule out a few points.

## Full answer

### Serve it

Serve the published checkpoint like any model, `Qwen/Qwen3-8B-FP8`, and set no flag. vLLM reads the quantization method from the checkpoint config. SGLang does the same, and a `--quantization` flag that does not match the checkpoint raises at startup, except for a few known compatible pairs. If no FP8 checkpoint exists, vLLM can quantize a BF16 model when it loads; the manual did not test that path.

### Know what your GPU runs

The L4 is an Ada GPU, SM 8.9, and it has FP8 math, so the matrix math runs in FP8 and the speed can rise with the free memory. GPUs before Ada, such as the A100, have no FP8 math. There vLLM keeps the weights in FP8 and runs a weight-only kernel: you keep the memory saving and expect less speed gain. The manual did not test such a GPU.

### The L4 result

The session locked at 900 MHz, two seeds each, the pool held at 24,096 tokens in both runs:

| Users | Median TPOT, BF16 / FP8 | Output tok/s, BF16 / FP8 | Median SM clock, BF16 / FP8 |
|---|---|---|---|
| 32 | 119.9 / 83.8 ms | 208.8 / 284.7 | 881 / 900 MHz |
| 1 | not compared / 35.3 ms | not compared / 25.4 | 210 / 900 MHz |

At 32 users the seed ranges did not overlap for either number, and the BF16 clock was about 2 percent lower, much less than the gap. At one user the BF16 run fell to 210 MHz because the GPU throttled, so the two are not compared.

### What it frees

The speed test held the pool fixed, so it did not measure the larger pool. The gain in room comes from the bytes. The SGLang runs on the same L4 let the pool grow and changed the weights and the cache together: the pool went from 24,094 tokens in BF16 to 142,369 with FP8 weights and an FP8 cache, 5.91 times as many, and output at 64 users went from 250.85 to 735.91 tokens per second, because the BF16 pool was full and the FP8 pool was not. At one user FP8 was still faster, 39.66 against 60.16 ms per token, because decode reads every weight for every token and FP8 weights are half the bytes.

On the GB10 with Qwen3-30B-A3B the FP8 pair did the same: the weights went from 57.75 to 29.75 GB, the load time from 323.61 to 152.29 s, and the pool from 227,243 to 1,083,008 tokens, 4.77 times as many, because the smaller weights freed memory and each token took half the bytes. Throughput was 1.73 to 1.88 times higher at every concurrency, because decode on that machine reads weights from a memory with modest bandwidth.

### The accuracy check

The first 500 GSM8K questions, 8-shot and greedy, on the L4 on 2026-10-23:

| Engine | Config | Correct | Accuracy | Wilson 95 percent interval |
|---|---|---|---|---|
| vLLM | BF16 | 459/500 | 91.8% | 89.1 to 93.9 |
| vLLM | FP8 weights | 453/500 | 90.6% | 87.7 to 92.9 |
| vLLM | FP8 weights + FP8 KV | 453/500 | 90.6% | 87.7 to 92.9 |
| SGLang | BF16 | 458/500 | 91.6% | 88.8 to 93.7 |
| SGLang | FP8 weights | 456/500 | 91.2% | 88.4 to 93.4 |
| SGLang | FP8 weights + FP8 KV | 460/500 | 92.0% | 89.3 to 94.1 |

All intervals overlap. The run did not show a difference, and with 500 questions it cannot rule out a loss of a few points. It is one model and one benchmark. Run your own prompts on both checkpoints before production.

### When it does not pay

- The pool has room and the GPU has no FP8 math: little gain for the risk.
- A task that depends on long chains of reasoning: run your own check first.
- The model still does not fit in FP8: a 4-bit checkpoint stores most weights in about half a byte, and on a 24 GB card that is the common way to serve a 14B model. A 4-bit model can lose more accuracy than FP8, and the loss depends on the model and the method.

## Follow-ups

- **Level 3:** The pool was held fixed in the speed test. What did that hide, and what did it show? Expected: it hid the larger pool that FP8 frees, so the test shows only the change in speed; the gain in room comes from the bytes, and the SGLang run that let the pool grow went from 24,094 to 142,369 tokens with an FP8 cache too.
- **Level 3:** Why was the one-user row not compared? Expected: the BF16 run fell to 210 MHz, below the 900 MHz lock, because the GPU throttled; a lock caps the clock and cannot stop a throttle, so the two runs were at different clocks.
- **Level 4:** On the GB10 the FP8 pair nearly doubled the speed at every load, while a field report of an FP8 cache alone was a little slower per token. Reconcile the two. Expected: the GB10 decodes from a memory with modest bandwidth, so half the weight bytes gave almost twice the speed; an FP8 cache alone changes no weight bytes and adds the scale work, so it wins on capacity and not on speed per token.

## Wrong answers

- "FP8 always speeds up decode." Only on a GPU with FP8 math, such as Ada, Hopper and Blackwell; on an A100 vLLM keeps the weights in FP8 and runs a weight-only kernel, so you keep the memory saving and expect less speed gain.
- "Pass --quantization fp8 to be safe." vLLM reads the method from the checkpoint config, and in SGLang a flag that does not match the checkpoint raises at startup, so pass no flag for a published checkpoint.
- "A 1.2 point drop on GSM8K means FP8 loses accuracy." The two intervals overlap, so this run did not show a difference; it also cannot rule out a loss of a few points, which is why you run your own prompts on both checkpoints.
- "If FP8 is good, 4-bit is twice as good." A 4-bit model can lose more accuracy than an FP8 model, and the loss depends on the model and the method; use it when the model does not fit in FP8, such as a 14B model on a 24 GB card, and test it.

## Taught in

[Fit a bigger model with FP8 weights](../../../manuals/vllm-101/sections/2-5-fit-a-bigger-model-with-fp8-weights.md) and [the SGLang quantization section](../../../manuals/sglang-101/sections/4-3-quantization.md) give the L4 and GB10 runs and the GSM8K table.
