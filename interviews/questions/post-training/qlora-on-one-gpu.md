---
id: qlora-on-one-gpu
title: Fit a 7B fine-tune on a 24 GB GPU
card: post-training
kind: estimate
level: 2
roles: [applied-ai-engineer, inference-engineer]
rounds: [screen, system-design]
tags: [qlora, lora, gpu-memory, nf4, fine-tuning]
minutes: 10
lessons: [phases/11-llm-engineering/08-fine-tuning-lora]
manuals: []
practice: [lora-forward]
cheatsheet: [lora-fine-tuning, quantization]
related: [post-training/lora-parameter-count]
updated: 2026-11-03
---

You have one GPU with 24 GB of memory and want to fine-tune a 7B model on your own instruction data. Walk me through the memory for a full update, for LoRA and for QLoRA, and say what makes the last one fit.

## Short answer

A full update of a 7B model needs about 56 GB: the weights in half precision, the gradients, and two optimizer states per parameter, all in half precision. LoRA keeps the half-precision weights but trains only small adapters, so the gradients and optimizer states shrink and the run takes about 18 GB. QLoRA stores the frozen base in 4-bit, about 3.5 GB of weights, and trains the adapters in half precision, so the run takes about 6 GB and leaves room for activations on a 24 GB card.

## Full answer

### The memory table

| Method | Weights | Training total | Fits on |
|---|---|---|---|
| Full update, FP16 | 14 GB | about 56 GB before activations, which depend on the workload | one 80 GB datacenter GPU |
| LoRA on an FP16 base | 14 GB | about 18 GB | one 40 GB GPU |
| QLoRA, 4-bit base | 3.5 GB | about 6 GB | one 24 GB consumer GPU |

The 56 GB comes from two bytes per weight, two bytes per gradient, and two optimizer states per parameter; activations come on top of that. This estimate keeps the optimizer states in half precision too. Standard Adam keeps its states in FP32, so a typical full update needs more memory than this, not less. The adapters remove the gradients and the states for every frozen weight, which is the large part.

### What QLoRA adds

1. NF4. A 4-bit type whose 16 levels sit at the quantiles of a normal distribution, which matches how weights are distributed and loses less than uniform 4-bit integers.
2. Double quantization. Each block of 64 weights needs a scale in FP32, about 0.4 GB for a 7B model; quantizing the scales to 8 bits brings that down to about 0.1 GB.
3. Paged optimizers. Optimizer states page to CPU memory when the GPU runs out, which trades some throughput for no out-of-memory crash from optimizer states. Activations stay on the GPU, so a long sequence can still run out of memory.

### What it costs in quality

The lesson's table puts LoRA at rank 16 within about one point of a full update, QLoRA at rank 16 a fraction behind that, and QLoRA at rank 64 level with the full update on the listed benchmarks.

### What it costs in time and money

On the lesson's cost table, QLoRA at rank 16 on a 24 GB consumer card took about 6 hours and about 5 dollars for 50,000 examples over three epochs. The full update took about 8 hours on two 80 GB datacenter GPUs and about 32 dollars. Fused kernels cut the QLoRA run to about 2.5 hours.

## Follow-ups

- **Level 2:** Why does LoRA cut training memory so much more than it cuts weight memory? Expected: the gradients and the two optimizer states exist only for the adapter parameters, which are a fraction of a percent of the model.
- **Level 2:** The adapters train in half precision while the base is 4-bit. Where does the forward pass compute? Expected: the base weights are dequantized block by block to the compute dtype for each matrix product, and the adapter path runs in half precision.
- **Level 3:** When would you still pay for the full update? Expected: when the task needs changes that a low-rank update cannot express, when you have the data and the GPUs, or when the eval shows a gap that a higher rank does not close.
- **Level 3:** How do you serve several QLoRA fine-tunes from one base? Expected: keep the adapters separate and load them on top of one base copy; merge only when you ship a single specialized model.

## Wrong answers

- "Quantize the whole model to 4-bit and fine-tune it directly." Gradients and optimizer states still need higher precision; the base stays frozen in 4-bit, and only the adapters train.
- "QLoRA halves the quality." The lesson's table shows a loss of a fraction of a point at rank 16 and parity at rank 64.
- "Load the base in 8-bit with LoRA; it is the same thing." Eight-bit weights take twice the memory of NF4, and the double quantization and paged optimizers are what make the 6 GB figure.

## Taught in

The [LoRA lesson](../../../phases/11-llm-engineering/08-fine-tuning-lora/) gives the memory and cost tables and explains NF4, double quantization and paged optimizers.
