---
id: fp8-kv-scale-silently-one
title: FP8 KV scales silently at 1.0
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [fp8, kv-cache, quantization, attention-backend, accuracy, scales]
minutes: 20
lessons: []
manuals: [vllm-101#s-fit-more-users-with-an-fp8-kv-cache, vllm-101#s-change-the-attention-backend-only-for-a-reason, vllm-101#s-ref-incident-index, sglang-101#s-quantization]
practice: []
cheatsheet: [quantization]
related: []
updated: 2026-11-03
system:
  version: vLLM 0.31.0
  model: Qwen/Qwen3-8B
  hardware: one L4 with 24 GB of memory
source:
  - manuals/vllm-101/capture/gpu/incidents/l4-vllm-kv-fp8-flashinfer-attention-jit.txt
  - manuals/vllm-101/capture/gpu/out-l4/gsm8k-fp8-accuracy.txt
  - manuals/vllm-101/sections/2-4-fit-more-users-with-an-fp8-kv-cache.md
  - manuals/vllm-101/sections/r-3-incident-index.md
---

## Situation

A team serves `Qwen/Qwen3-8B` on one L4. Requests queue because the KV pool is full, so they add `--kv-cache-dtype fp8` to store each cached value in one byte instead of two. The first start fails with a compiler error from a kernel library. A colleague adds a backend flag, the server starts, and a quick benchmark shows the time per token a little lower than before.

Before the rollout, the team runs GSM8K on its first 500 questions in BF16 and in FP8 and sees the same accuracy within the error bars. They ship. In the review, a staff engineer asks one question: "Which scale did the cache use?" Nobody knows. The production model is not this one, it is a newer family whose checkpoint ships calibrated scales.

## Evidence

- [the first start with an FP8 KV cache on the L4](evidence/first-start-fails.txt)
- [the FP8 KV cache with the Triton backend against the BF16 default, pool held fixed](evidence/speed-at-a-fixed-pool.txt)
- [GSM8K accuracy of the four configs on both engines](evidence/accuracy-check.txt)
- [three rows of the incident index at 0.31.0](evidence/known-loader-bugs.txt)
- [the manual's check for scales in the checkpoint and in the startup log](evidence/the-check.txt)

## Questions

1. The server picked a different attention backend when the KV data type changed. Why does the data type decide the backend, and why did that backend fail on this host?
2. Two things changed between the BF16 and FP8 runs in the speed table. What can you claim from it, at which user count, and what can you not claim?
3. What is a KV scale, what does a scale of 1.0 do to an FP8 value, and for which checkpoints is 1.0 the only option?
4. Every interval in the accuracy table overlaps. What does that prove, and what can 500 questions not rule out?
5. The production checkpoint carries calibrated scales. Give the three checks, in order, that prove the running server uses them.

## Walkthrough

Start with the failed start. The second line shows the backend choice: `FLASHINFER` out of the two candidates `FLASHINFER` and `TRITON_ATTN`. FlashAttention is missing from that list. On an L4, vLLM tries FlashAttention first, but at 0.31.0 FlashAttention reads an FP8 KV cache only on Hopper and Blackwell data center GPUs, and the L4 is an Ada GPU with SM 8.9. So vLLM moved to the next backend in its list. FlashInfer builds its kernels on the first start, and the fourth line shows that build failing because the CUDA compiler and the CUDA headers came from different releases. The fix is `--attention-backend TRITON_ATTN`, which reads an FP8 KV cache without that build, plus `VLLM_USE_FLASHINFER_SAMPLER=0` because the sampler fails to build in the same way.

The speed table holds the pool at 24,096 tokens in both runs, so it does not show the larger pool at all. It shows the change in speed. At one user, FP8 was 2.3 percent faster per token, 101.8 against 104.1 ms, at the same clock of 210 MHz, and the seed ranges did not overlap. At 32 users the seed ranges overlapped and the FP8 run had the higher clock, 480 against 450 MHz, so no claim holds there. Two things changed together, the KV data type and the backend, so even the gain at one user cannot be attributed to the data type alone.

The accuracy table starts with the sentence that answers the staff engineer. Neither checkpoint carries KV scales, so the FP8 KV runs used a scale of 1.0. An FP8 value has few bits, and a scale maps the range of the real keys and values onto that range. With no calibrated scale the server stores the values as they are. For this model the result was 454 of 500 correct against 459 in BF16, 90.8 percent against 91.8, with intervals of 87.9 to 93.0 and 89.1 to 93.9. Every interval overlaps every other one. That means the run did not show a difference. It does not mean there is none. With 500 questions the test cannot rule out a loss of a few points, and it covers one model and one benchmark.

The incident index adds the part that makes the question dangerous. Issue 54623 reports that the Qwen3.5 model family never loads its checkpoint KV scales, so an FP8 KV cache runs at scale 1.0 even when the checkpoint has calibrated scales. Issue 60333 reports the same for one MTP draft loader. Both are open at 0.31.0. So a checkpoint with scales does not prove that the server uses them.

The last listing gives the check. Search the weight index for tensor names that end in `k_scale` or `v_scale`. No output means the checkpoint has no scales. Then read the startup log for the warning `Using KV cache scaling factor 1.0`. If the checkpoint has scales and the warning is still there, the loader dropped them. Last, run your own prompts with and without FP8 and compare the answers.

## Resolution

The incident is a missing question, not a crash. For `Qwen/Qwen3-8B` a scale of 1.0 was the only option, and the accuracy check on 500 questions could not tell the two configs apart. For the production model the team had to prove three things before the rollout: that the checkpoint holds `k_scale` and `v_scale` tensors, that the startup log does not print the scale 1.0 warning, and that a sample of their own prompts gives the same answers with and without FP8.

They also had to read the backend line after every change to the KV data type. On this L4 the change moved the server from FlashAttention to Triton, and the speed table measured that move as much as the data type. Write the backend, the scale and the accuracy interval next to the result, and keep the accuracy test on your own task, because a model with a different attention layout can lose more.

## Wrong turns

- "The accuracy matched, so FP8 is safe for every model." The check covered one model with no scales, one benchmark and 500 questions. It could not rule out a loss of a few points, and a different model can lose more.
- "The checkpoint has scales, so the server uses them." At 0.31.0 two open issues report loaders that drop the scales and run at 1.0. Only the startup log proves what the server used.
- "FP8 made each token 2.3 percent faster, so the data type paid off." The backend changed in the same run, and the gain held only at one user. The table cannot say which change gave it.
- "Fix the compiler error so FlashInfer builds." That is a host repair, not a serving decision. The Triton backend reads the FP8 cache without the build, and the backend line in the log says which one runs.

## Generalize

A quantized store needs a scale, and a default scale of 1.0 is a silent choice that the server makes for you. Whenever you change a data type, read the three lines that follow from it: which kernel now runs, which scale it uses and what the quality check can and cannot detect at its sample size. A test that shows no difference bounds the loss, it does not remove it.

## Taught in

The vLLM manual turns on the FP8 KV cache and checks the scales in [the FP8 KV cache page](../../../manuals/vllm-101/sections/2-4-fit-more-users-with-an-fp8-kv-cache.md), explains the backend choice in [the attention backend page](../../../manuals/vllm-101/sections/4-5-change-the-attention-backend-only-for-a-reason.md) and lists the open loader issues in [the incident index](../../../manuals/vllm-101/sections/r-3-incident-index.md), and the SGLang manual runs the same accuracy check in [its quantization page](../../../manuals/sglang-101/sections/4-3-quantization.md).
