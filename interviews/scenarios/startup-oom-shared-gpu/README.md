---
id: startup-oom-shared-gpu
title: Startup out of memory on a shared GPU
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, screen]
tags: [oom, startup, gpu-memory-utilization, max-model-len, shared-gpu, kv-pool]
minutes: 15
lessons: []
manuals: [vllm-101#s-fix-out-of-memory-at-startup, vllm-101#s-count-the-memory-before-you-pick-a-gpu, vllm-101#s-check-that-the-server-is-healthy, sglang-101#s-mem-fraction-static-and-startup-sizing]
practice: []
cheatsheet: [serving-engines-compared]
related: [inference-serving/kv-pool-users-fit]
updated: 2026-11-03
system:
  version: vLLM 0.31.0
  model: Qwen/Qwen3-8B
  hardware: the shared second L4 of a two-GPU node, with another team's processes on it
source:
  - manuals/vllm-101/capture/gpu/out-l4/livecheck-2026-10-22.txt
  - manuals/vllm-101/capture/gpu/incidents/l4-gpu1-vllm-maxlen-oom.txt
  - manuals/vllm-101/sections/2-2-fix-out-of-memory-at-startup.md
---

## Situation

An on-call engineer deploys `Qwen/Qwen3-8B` with vLLM on the second L4 of a node. Another team runs its pods on that GPU and holds part of its memory. The server stops before it prints the KV cache size line, and the log ends with a `ValueError` that names a maximum of 40,960 tokens.

A colleague has seen the error before and sets two flags: `--gpu-memory-utilization 0.83`, to stay under the memory that the other team uses, and `--max-model-len 2928`, which matches the pool of 2,928 tokens that they want for a test. The server fails again, with almost the same message. The engineer now wants to raise the memory fraction to 0.95 and try once more.

## Evidence

- [the first start, with the default maximum model length](evidence/default-length-fails.txt)
- [the second start, with the maximum length set to the pool size](evidence/tight-length-fails.txt)
- [a start on the same shared GPU that reached the pool line](evidence/a-start-that-works.txt)
- [the three startup failures and the flag for each](evidence/three-cases.txt)

## Questions

1. The error names 40,960 tokens. Where does that number come from, and why does one request at that length decide whether the server starts?
2. The second attempt set the maximum length to the pool size and missed by 16 tokens. Explain the arithmetic that the error line shows.
3. On a shared GPU, what does the memory fraction describe, and why is raising it the wrong first move?
4. Which startup line proves that a fix worked, and what do you compare it with?
5. Put the three flags in the order you would change them, and name the log text that points to each.

## Walkthrough

Read the first error from the end. vLLM must be able to serve at least one request at the model's maximum sequence length. For this model that length is 40,960 tokens, taken from the model config when nobody sets `--max-model-len`. One request of that length needs 5.62 GiB of KV cache, and after the weights and the startup profile only 1.01 GiB was free on this shared card. The message even computes the answer: the estimated maximum model length is 7,360 tokens. The server did not fail because the GPU is too small for the model. It failed because the default length is far longer than any request the service will send.

The second error is the same check with a different margin. The settings line shows `max_model_len` at 2,928, the fraction at 0.83 and a block override of 183 blocks of 16 tokens, which is 2,928 tokens. The check compares one request of the maximum length with the KV cache memory that the profile left, and that memory holds only 2,912 tokens. Both sides print as 0.4 GiB, so the check failed by a hair. A length equal to the pool that you want does not help when the profile leaves less memory than that pool.

The third listing is what success looks like on the same card. A smaller model started with a fraction of 0.5, loaded 1.12 GiB of weights, and printed the two lines that matter: `Available KV cache memory: 9.02 GiB` and `GPU KV cache size: 84,480 tokens`, with the maximum concurrency for the default length at 2.06 times. Those two lines are the proof that a start reached the pool. The last listing maps the three errors to three flags. An error about the maximum sequence length points at `--max-model-len`. An error that the free memory is below the desired utilization points at `--gpu-memory-utilization`, or at the other process. A CUDA out of memory during the profile or the graph capture points at the batch limits or the graph capture size.

## Resolution

The fix was one flag, read from the error. We set `--max-model-len 2048`, which covers our 640-token requests, and the server started. Later we raised it to 2,304 tokens so that tests with 2,048-token prefixes fit. On a shared GPU the fraction and the maximum length work together, and the maximum length is the one to lower first, down to the longest request that the service really sends.

Raising the fraction to 0.95 would have been wrong twice over. The fraction is a limit for one vLLM instance on the whole GPU memory, not a share of what is free when the server starts, so a higher fraction on a shared card claims memory that another tenant already holds. And the first error asked for 5.62 GiB for a length that no request needs. When two instances must share one GPU with a known pool each, set the cache in bytes with `--kv-cache-memory-bytes` instead. After every change, start the server with `tee` on the log and grep for `GPU KV cache size`, then compare the pool with the count from the memory page.

## Wrong turns

- "Raise the memory fraction until it starts." The fraction is a share of the whole GPU, not of the free memory. On a shared card a higher fraction claims memory that another process holds, and the start can fail later in the profile or the other team's job can fail instead.
- "The GPU is too small for an 8B model." The weights loaded. The check that failed was for one request of 40,960 tokens, and the message said that 7,360 tokens would fit.
- "Set the maximum length equal to the pool." The second start did that and missed by 16 tokens. The pool is counted in blocks of 16, and the length check needs a little margin.
- "Use the blocks override in production to force the pool." The override does not check that the memory exists. It is a test flag, and on a shared card it fails at the first request that needs the memory.

## Generalize

A startup check that fails on a limit is a question about your traffic, not about your hardware. Read the number in the error, ask which setting put it there and what the real requests need, and change that setting first. On any shared machine, a fraction of total memory is a promise that the other tenants did not make, so prefer limits that name the exact bytes you want.

## Taught in

The vLLM manual matches each startup error to one flag in [the startup out of memory page](../../../manuals/vllm-101/sections/2-2-fix-out-of-memory-at-startup.md), counts the pool in [the memory page](../../../manuals/vllm-101/sections/2-1-count-the-memory-before-you-pick-a-gpu.md) and reads the startup lines in [the health page](../../../manuals/vllm-101/sections/1-2-check-that-the-server-is-healthy.md), and the SGLang manual shows the same startup sizing in [its memory fraction page](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md).
