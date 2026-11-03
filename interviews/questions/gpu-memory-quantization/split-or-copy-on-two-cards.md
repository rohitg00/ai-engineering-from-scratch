---
id: split-or-copy-on-two-cards
title: Split the model or copy it across two cards
card: gpu-memory-quantization
kind: design
level: 3
roles: [inference-engineer]
rounds: [system-design, design-review]
tags: [tensor-parallel, pipeline-parallel, data-parallel, pcie, kv-pool]
minutes: 10
lessons: []
manuals: [vllm-101#s-choose-tensor-pipeline-or-data-parallelism, sglang-101#s-tp-size-dp-size-and-attn-dp-size]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

You have two L4 cards in one host, joined by PCIe only, and an 8B model that fits on one card with a KV pool that is too small for your users. Do you split the model across both cards or run two copies? Think about memory first, then about communication.

## Short answer

Tensor parallelism splits the weights and the KV cache across the two cards, so each card holds half the weights and gains several times the room for cache, and that is the layout that grows the pool per request; data parallelism holds a full copy of the weights on each card and doubles the users only if each copy's pool already fits them. Over PCIe, tensor parallelism pays a collective after every layer and can cost more than the split saves, so the documentation suggests pipeline parallelism on such a machine, which sends data only at the stage boundaries. Neither manual measured either layout on its two L4s, so I would measure tensor against pipeline against two copies on the real workload, and give any split whole GPUs, because a tensor group sizes every rank from the smallest card.

## Full answer

### What each layout does to memory

| Layout | Weights per GPU | KV cache per GPU | What grows |
|---|---|---|---|
| Tensor | a slice of every layer | a slice of every layer's cache | the pool per request, several times when the weights fill most of one GPU |
| Pipeline | the layers of its stage | the cache of those layers | the pool per request, and it accepts an uneven GPU count |
| Data | a full copy | its own full pool | the number of users, only if one copy's pool already fits them |

One exception: a model with multi-head latent attention stores the full latent on every tensor-parallel rank, so the tensor split does not grow its cache. For a grouped-query model such as Qwen3-8B it does.

### The decision tree

| Question | If yes | If no |
|---|---|---|
| Does the model fit on one GPU, with room for the KV cache you need? | Data parallelism, one copy per GPU. | Split the model. |
| Does the split model fit inside one machine? | Keep the split inside the machine. | Pipeline parallelism across machines. |
| Do the GPUs have NVLink, and does the GPU count divide the model evenly? | Tensor parallelism. | Pipeline parallelism inside the machine. |

Your case answers the first question with no, because the room for the cache is the problem. The third question answers with no too, because PCIe is not a fast link. The tree lands on pipeline parallelism inside the machine, and the manual asks you to measure it against tensor parallelism before you pick, because it ran neither on its pair.

### What the link costs

Tensor parallelism sends data after every layer, so it needs a fast link. On GPUs joined only by PCIe, such as two L4s in one host, that traffic can cost more than the split saves. Pipeline parallelism sends data once per stage boundary. Data parallelism sends nothing between copies.

### The balance check

Before SGLang loads weights for a tensor group, each rank measures its free memory and the group keeps the smallest value. If that value is under 90 percent of the local free memory, the server stops, and no flag turns the check off. On the manual's pair the second card ran two pods of another team and had 18.28 GB free against the 19.53 GB that the check required, so the tensor split refused to start. Each rank holds the same share of weights and the same pool, so the smallest card sets the size for all. The data-parallel pair had no such check, started with pools of 24,094 and 2,925 tokens, and served less than one card at every load. Give any split whole GPUs.

### The processes

With data parallelism vLLM starts one engine core per copy and a coordinator; with tensor parallelism one worker per GPU under one engine core. In SGLang the world size is the tensor size times the pipeline size, and data-parallel copies get a controller that sends requests round robin by default.

## Follow-ups

- **Level 3:** The model fits on one card. Why might the decision tree still say split? Expected: the first question asks whether it fits with room for the KV cache you need; with a pool that cannot hold your users the answer is no, so the tree moves to a split, and tensor or pipeline parallelism is what grows the pool per request.
- **Level 3:** Why does the tensor split need whole GPUs on a shared machine? Expected: every rank holds the same share of weights and the same pool, so the smallest card sets the size for all; SGLang measures free memory on each rank and stops when one has less than 90 percent of the local free memory, 18.28 against 19.53 GB in the manual's case.
- **Level 4:** Over PCIe, how would you decide between tensor and pipeline parallelism without a measurement from the manuals? Expected: run both on the real workload and read throughput with the P99 ITL and the first token at matched clocks; tensor pays a collective after every layer on the slow link and pipeline pays once per stage boundary, so the pipeline layout can win on a PCIe pair, and the documentation suggests it there.

## Wrong answers

- "Two copies double everything." Each copy holds the full weights, so the pool per copy is the same small pool; two copies double the users only if that pool already fits them, and a pair with unequal pools served less than one card.
- "Tensor parallelism is the way to pool memory across cards." It pools the weights and the cache, but it sends data after every layer; over PCIe that traffic can cost more than the split saves, so the documentation suggests pipeline parallelism on such a machine.
- "The split starts as long as the model fits across the two cards." The tensor group refuses when one rank has less than 90 percent of the local free memory, because the smallest card sets the pool for all ranks; give the split whole GPUs.
- "Pipeline parallelism wastes a card because the stages wait for each other." It sends data only at stage boundaries and accepts an uneven GPU count, which is why the documentation suggests it for GPUs without a fast link; measure it before you rule it out.

## Taught in

[Choose tensor, pipeline, or data parallelism](../../../manuals/vllm-101/sections/6-1-choose-tensor-pipeline-or-data-parallelism.md) and [the SGLang parallelism section](../../../manuals/sglang-101/sections/6-1-tp-size-dp-size-and-attn-dp-size.md) give the layouts, the link rule and the balance check.
