---
id: fp8-kv-cache
title: What an FP8 KV cache buys and costs
card: inference-serving
kind: tradeoff
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [ml-depth, design-review]
tags: [fp8, kv-cache, capacity, accuracy, attention-backend]
minutes: 10
lessons: []
manuals: [vllm-101#s-fit-more-users-with-an-fp8-kv-cache, sglang-101#s-quantization]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Your server queues requests because the KV cache is full. Someone suggests `--kv-cache-dtype fp8`. What does it buy, what can it cost, and how do you check both before production?

## Short answer

An FP8 KV cache stores each key and value in 1 byte instead of 2, so the same memory holds twice the tokens: for Qwen/Qwen3-8B a token falls from 144 KiB to 72 KiB, and one GiB holds about 14,600 tokens instead of about 7,300. It can cost accuracy, because FP8 needs a scale per tensor and a checkpoint without scales runs with a scale of 1.0, and it can change the attention backend, which on our L4 broke the first start. Check it with an accuracy run on your own task and with the startup log: on 500 GSM8K questions our FP8 KV run scored 90.8 percent against 91.8 in BF16, with overlapping intervals.

## Full answer

### What it buys

Only the cache changes; the weights stay in BF16. Use the KV formula with 1 byte per value. Twice the tokens fit, so twice the users fit at the same length, or each user can have a context twice as long.

The speed change is small. With the pool held fixed at 24,096 tokens on our L4, one user got a median TPOT of 101.8 ms against 104.1 ms in BF16, 2.3 percent faster at the same 210 MHz clock, and the seed ranges did not overlap. At 32 users the seed ranges overlapped and the FP8 run had a higher clock, so the manual claims no gain there. Two things changed together in that run, the cache dtype and the attention backend.

A field report shows the capacity effect at scale. With a BF16 cache a service produced 1,558 tokens per second at 32 concurrent requests and ran out of memory at 64. With an FP8 cache it reached 2,192 tokens per second at 64, about 41 percent above the best BF16 result, while it was a few percent slower per token at every concurrency both could run. It won because twice as many requests fit: the context held in memory went from about 686,000 to about 1.37 million tokens.

### What it costs

FP8 needs a scale for each tensor. Without a scale file, every scale is 1.0. vLLM logs `Using KV cache scaling factor 1.0` and SGLang logs `Using FP8 KV cache but no scaling factors provided`. The vLLM team treats a scale of 1.0 as the worst case for accuracy; in their tests most models stayed close to BF16, and one model family on a latent-attention backend did not.

Our own check, on 2026-10-23, ran the first 500 GSM8K questions, 8-shot and greedy, on the L4. Qwen3-8B has no KV scales, so the FP8 KV runs used a scale of 1.0:

| Engine | Config | Correct | Accuracy | Wilson 95 percent interval |
|---|---|---|---|---|
| vLLM | BF16 | 459/500 | 91.8% | 89.1 to 93.9 |
| vLLM | FP8 KV cache | 454/500 | 90.8% | 87.9 to 93.0 |
| SGLang | BF16 | 458/500 | 91.6% | 88.8 to 93.7 |
| SGLang | FP8 KV cache | 458/500 | 91.6% | 88.8 to 93.7 |

Every interval overlaps the BF16 interval, so this run did not show a difference. With 500 questions it cannot rule out a loss of a few points. It is one model and one benchmark. A model with a different attention layout can lose more.

### The backend trap on an L4

The first FP8 start on our L4 failed. FlashAttention in vLLM 0.31.0 reads an FP8 cache only on Hopper and Blackwell data center GPUs, and the L4 is an Ada GPU, SM 8.9. So vLLM moved to FlashInfer, which builds its kernels on the first start, and that build failed on our node. The fix was `--attention-backend TRITON_ATTN`, which reads FP8 and needs no build, with `VLLM_USE_FLASHINFER_SAMPLER=0` for the same reason. Read the attention backend line after every change to the cache dtype.

### Check that your scales load

1. Search the weight index of the checkpoint for tensor names that end in `k_scale` or `v_scale`. For a checkpoint with an index, no output means no scales. A checkpoint with one weight file has no index; for it, list the tensor names with the `safetensors` Python package.
2. Read the startup log for the scale warning. If the checkpoint has scales and the warning still prints, the loader dropped them. At 0.31.0 one model family never loads its KV scales, and the issue is open.
3. Run your own prompts with and without FP8 and compare the answers before you go to production.

The FP8 checkpoint of Qwen3-30B-A3B lists weight scales and no KV scales, so weight scales do not imply KV scales.

### The order of checks

1. Is the pool the limit? Read the cache usage and the queue. If the pool has room, keep the model dtype.
2. Search the checkpoint for KV scales.
3. Start the server and read the backend line and the scale warning.
4. Run an accuracy check on your own task.
5. Measure speed at the same clock, and expect little change per token.

## Follow-ups

- **Level 2:** The pool has room and requests do not queue. Do you still switch? Expected: no; the cache dtype is a capacity decision, and with room in the pool it buys nothing and still carries the accuracy and backend risks.
- **Level 3:** The scale warning prints although the checkpoint has k_scale tensors. What does it mean? Expected: the loader dropped the scales; at 0.31.0 one model family never loads its KV scales and the issue is open, so the server runs with a scale of 1.0 until you change the checkpoint or the version.
- **Level 3:** Why did the first FP8 start fail on the L4 and not on a data center GPU? Expected: the default attention backend reads an FP8 cache only on Hopper and Blackwell data center GPUs, so vLLM fell back to a backend that compiles its kernels on the first start, and that build failed; the Triton backend reads FP8 and skips the build.
- **Level 4:** The GSM8K check gave 91.8 against 90.8 percent, and the two intervals overlap. What can you conclude? Expected: this run did not show a difference and cannot rule out a loss of a few points; it is one model and one benchmark, so run the same check on your model and task, and expect a model with another attention layout to lose more.

## Wrong answers

- "FP8 KV halves memory, so it doubles throughput." It doubles the tokens that fit; in the field report it was a few percent slower per token at every load both caches could run, and won only because the BF16 cache ran out at 64 requests.
- "The checkpoint is FP8, so the KV scales are there." Weight scales and KV scales are different tensors; the FP8 checkpoint of Qwen3-30B-A3B lists weight scales and no k_scale or v_scale, so its cache ran with a scale of 1.0.
- "Accuracy is a property of the model, so test it once." The loss depends on the model, the attention layout and the task; one family that needs calibrated scales lost accuracy with a scale of 1.0 while most models stayed close to BF16 in the same tests.
- "The attention backend does not matter for a cache dtype." On the L4 the dtype change moved vLLM to another backend and the start failed; read the backend line after every change to the cache dtype.

## Taught in

[Fit more users with an FP8 KV cache](../../../manuals/vllm-101/sections/2-4-fit-more-users-with-an-fp8-kv-cache.md) and [the SGLang quantization section](../../../manuals/sglang-101/sections/4-3-quantization.md) measure the pool, the speed and the GSM8K accuracy on both engines.
