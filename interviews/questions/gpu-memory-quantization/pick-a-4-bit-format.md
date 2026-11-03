---
id: pick-a-4-bit-format
title: Pick a 4-bit format for a 14B model on 24 GB
card: gpu-memory-quantization
kind: tradeoff
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [screen, design-review]
tags: [quantization, awq, gptq, bitsandbytes, gguf]
minutes: 10
lessons: [phases/17-infrastructure-and-production/09-production-quantization, phases/10-llms-from-scratch/11-quantization]
manuals: [vllm-101#s-fit-a-bigger-model-with-fp8-weights]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

A 14B model must run on a 24 GB card and does not fit in FP8 with a usable pool. You can choose AWQ, GPTQ, a checkpoint in the compressed-tensors format, bitsandbytes at load time, or a GGUF file. How do you pick, and what did the manual measure for each?

## Short answer

Pick a published 4-bit checkpoint over quantization at load time, and pick the format from the engine and the workload. For a GPU server AWQ with the Marlin kernels is the default, GPTQ when you also serve LoRA adapters on the base, and GGUF only for CPU or edge serving, because its kernels are not built for GPUs. The manual started an AWQ Qwen3-14B on an L4 with 9.44 GiB of weights and a pool of 36,272 tokens, loaded Qwen3-1.7B with bitsandbytes in 1.33 GiB against 3.22 GiB in BF16, which is 41 percent, and loaded a GGUF file of 0.55 GiB through a plugin that the documentation calls experimental.

## Full answer

### The formats vLLM reads

| Format | What it stores | Notes at 0.31.0 |
|---|---|---|
| AWQ and GPTQ | 4-bit weights, 16-bit math | runs from the Turing GPUs on, with the fast Marlin kernels on Ampere, Ada and Hopper |
| compressed-tensors W4A16 or W8A8 | 4-bit or 8-bit weights, made with the LLM Compressor library | the vLLM project suggests this library to make your own checkpoint |
| bitsandbytes | 4-bit weights, made when the server loads the model | needs the separate `vllm-bnb-plugin` package, then `--quantization bitsandbytes` for a model that is not quantized |
| GGUF | the llama.cpp file format | needs the separate `vllm-gguf-plugin` package, and the documentation calls it experimental |

For a published checkpoint you set no flag; vLLM reads the method from the checkpoint config.

### What the manual started

- **AWQ.** `vllm serve Qwen/Qwen3-14B-AWQ --max-model-len 8192` on an L4 with no quantization flag. The log showed `quantization=auto_awq` and the Marlin kernel. The weights took 9.44 GiB and the pool held 36,272 tokens. Speed and accuracy were not measured.
- **bitsandbytes.** Without the plugin, the server stopped with `Unknown quantization method: bitsandbytes`. With it, Qwen3-1.7B loaded in 1.33 GiB against 3.22 GiB in BF16, which is 41 percent, and the pool grew from 92,960 to 108,512 tokens. The 41 percent includes the embeddings and the output layer, which stay in 16-bit, so the share differs on a larger model.
- **GGUF.** With the plugin, a 4-bit file of Qwen3-0.6B loaded 0.55 GiB of weights and a chat request returned HTTP 200.

The second GPU of the node was throttled during these starts, so the manual gives no speeds, and it measured no accuracy for either small format.

### The lesson's picking guide

- CPU or edge serving: GGUF, with the medium 4-bit variant as the production default. GGUF is a file format that bundles several quantization variants, keeps the first and last layers at higher precision, and runs best in llama.cpp, the fastest CPU engine. In vLLM it is slow, about 93 tokens per second on a 7B model in the lesson's numbers, because the format is not built for GPU kernels.
- GPU serving with routine chat and no adapters: AWQ. It protects the most salient weights during quantization; with the Marlin kernels it gave about 741 tokens per second on a 7B model, the best code accuracy among the 4-bit formats, and a 10.9 times speedup over a naive kernel.
- GPU serving with many LoRA adapters on one base: GPTQ with Marlin, about 712 tokens per second on a 7B model and 2.6 times faster than without Marlin, because it supports LoRA in vLLM and the microscaling 4-bit formats did not at the start of 2026.
- Reasoning-heavy work: FP8, and accept the memory cost; the lesson puts the AWQ loss on math at several points.

### Two traps

The calibration set must match the domain: AWQ and GPTQ pick the weights to protect from a calibration pass, and generic web text makes them protect the wrong weights for code, medical or legal traffic. Calibrate on hundreds of in-domain samples and test on the eval set. And the KV cache is separate from the weights: a 70B model at 4-bit is about 35 GB of weights, and at 128 concurrent requests with a 2k context its cache is near 20 GB on top.

### The accuracy caveat

A 4-bit model can lose more accuracy than an FP8 model, and the loss depends on the model and the method. The manual ran its GSM8K check on FP8 and not on the 4-bit formats. Test the candidate formats on your own prompts, and when it is ambiguous run a 1,000-sample eval on each.

## Follow-ups

- **Level 2:** Why pick a published checkpoint over bitsandbytes at load time? Expected: load-time quantization adds load time and gives a checkpoint that nobody evaluated; a published checkpoint has a known method and often a published accuracy, and vLLM reads the method from its config with no flag.
- **Level 3:** The bitsandbytes load saved 41 percent on a 1.7B model. Will a 14B model save the same share? Expected: not the same; the 41 percent includes the embeddings and the output layer, which stay in 16-bit, and they are a smaller share of a larger model, so the saving changes.
- **Level 3:** You need LoRA adapters on the 4-bit base. Which format? Expected: GPTQ with the Marlin kernels, because it supports LoRA adapters in vLLM; the microscaling 4-bit formats did not support LoRA at the start of 2026.
- **Level 4:** A domain model quantized with AWQ on generic web text loses several points on its own eval. Why, and what do you do? Expected: AWQ picks the weights to protect from a calibration set, and generic text makes it protect the wrong ones for the domain; calibrate on hundreds of in-domain samples and test on the eval set before you ship.

## Wrong answers

- "GGUF is the most popular format, so use it on the GPU server." It is the CPU and edge default; in vLLM it needs an experimental plugin, and its kernels are not built for GPUs, about 93 tokens per second on a 7B model in the lesson's numbers.
- "Quantize at load time with bitsandbytes, it is one flag." Without the plugin the server stops with an unknown method error, and the result is a checkpoint that nobody evaluated; use a published AWQ or GPTQ checkpoint and test it.
- "4-bit loses as little as FP8." A 4-bit model can lose more, and the loss depends on the model and the method; AWQ loses several points on math in the lesson, so run your own check.
- "The memory saving is 41 percent for any model." The measured 41 percent is one small model with its embeddings and output layer in 16-bit; the share differs on a larger model, and the KV cache is separate from the weights.

## Taught in

[Fit a bigger model with FP8 weights](../../../manuals/vllm-101/sections/2-5-fit-a-bigger-model-with-fp8-weights.md) lists the formats and the three starts, and [the production quantization lesson](../../../phases/17-infrastructure-and-production/09-production-quantization/docs/en.md) and [the quantization lesson](../../../phases/10-llms-from-scratch/11-quantization/docs/en.md) give the picking guide.
