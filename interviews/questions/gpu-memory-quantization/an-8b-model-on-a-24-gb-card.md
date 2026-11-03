---
id: an-8b-model-on-a-24-gb-card
title: Why an 8B model fails to start on a 24 GB card
card: gpu-memory-quantization
kind: estimate
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [screen, debugging]
tags: [max-model-len, kv-pool, startup, l4, fp8]
minutes: 8
lessons: []
manuals: [vllm-101#s-serve-long-contexts-and-hybrid-models, vllm-101#s-count-the-memory-before-you-pick-a-gpu, sglang-101#s-quantization]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Your teammate starts Qwen/Qwen3-8B in BF16 on an L4 with no flags, and the start fails with an error about the KV cache and --max-model-len. The same command works on a larger card. Explain the failure with numbers, and say what you set.

## Short answer

The model config gives a context of 40,960 tokens, and vLLM takes that as the maximum length when you set none. At 144 KiB per token one request at that length needs 5.6 GiB of KV cache, and on a 24 GB card the 16.4 GB of weights can leave less than that, so the start check fails before the pool line prints. Set `--max-model-len` to the longest prompt plus answer that your users send; the pool stays the same size, and the limit only stops one request from claiming all of it.

## Full answer

### The arithmetic

The weights of Qwen3-8B in BF16 take 16.4 GB. SGLang measured the load on the same card at 15.28 GB and had 6.59 GB left, from which it sized a pool of 24,094 tokens, 1.65 GB for the keys and 1.65 GB for the values, at a memory fraction of 0.85. A pool of that size holds about 3.31 GiB. One request at the default length of 40,960 tokens needs 40,960 times 144 KiB, which is 5.6 GiB, more than the whole pool. vLLM checks that at least one request at the maximum length fits, so the start stops.

### Set the length on purpose

Set `--max-model-len` to the longest prompt plus answer that your users send. The pool size stays the same. A shorter limit only stops one request from claiming the whole pool, and it lets the start check pass. The pool line then prints the maximum concurrency at that length: on the L4 it read `GPU KV cache size: 24,096 tokens, Maximum concurrency for 8,192 tokens per request: 2.94x`. Real requests hold less than the limit, so more of them fit: about 37 users with 512 prompt tokens and 128 output tokens each.

### Check the length after an upgrade

Some models extend their context with a scaling method. In release 0.30.0 vLLM changed how it reads that method, and for some models the length that vLLM derived from the config became shorter; the release notes give one model that went from 131,072 to 32,768 tokens. After an upgrade, read the derived length in the startup log, and set the length yourself if it changed.

### Other ways to make room

The FP8 checkpoint of the same model loaded 8.81 GB of weights on the L4 and left 13.06 GB. With an FP8 cache too, the pool was 142,369 tokens against 24,094. A memory fraction set too low has the opposite effect: at 0.74 the BF16 pool was 6,559 tokens, and four shared prompts of 2,048 tokens no longer fit together.

### Check the setup

The pool line prints only when the start succeeds. If the start stops with the error about the cache and the maximum length, lower `--max-model-len` until the pool line prints, read its concurrency, and compare it with the users you plan to serve at full length.

## Follow-ups

- **Level 2:** Does lowering the maximum model length give you more users? Expected: no; the pool stays the same size, and the limit only stops one request from taking all of it and lets the start check pass; more users need a bigger pool, from an FP8 cache, FP8 weights or a bigger card.
- **Level 3:** The same model started last month and fails after an upgrade with the same flags. What do you check? Expected: the derived context length in the startup log; a release changed how the scaling method is read and shortened one model's length from 131,072 to 32,768, and a change the other way can make the check fail, so set the length yourself.
- **Level 4:** Estimate the pool when the FP8 checkpoint replaces BF16 on the same card and the cache is FP8 too. Expected: the weights fall to 8.81 GB and leave 13.06 GB, and each token takes half the bytes, so the pool rose from 24,094 to 142,369 tokens in the manual's run.

## Wrong answers

- "The card is too small for an 8B model." The weights fit with about 6.59 GB to spare; the check fails because one request at the default length of 40,960 tokens needs 5.6 GiB of cache, so set the length to what your users send.
- "Raise the memory fraction to make it start." The gap between 5.6 GiB and the room left is larger than a fraction step can close on this card; the length is the lever, and a fraction set too high leaves nothing for the activations.
- "Lower the maximum length to fit more users." It fits the start, not more users; the pool size does not change with the limit.
- "The KV pool is sized from the weights." It is sized from what is left after the weights and the startup profile, so read the available KV memory line, not the parameter count.

## Taught in

[Serve long contexts and hybrid models](../../../manuals/vllm-101/sections/2-6-serve-long-contexts-and-hybrid-models.md) explains the length check, [Count the memory before you pick a GPU](../../../manuals/vllm-101/sections/2-1-count-the-memory-before-you-pick-a-gpu.md) sizes the pool, and [the SGLang quantization section](../../../manuals/sglang-101/sections/4-3-quantization.md) shows the startup lines of the same card.
