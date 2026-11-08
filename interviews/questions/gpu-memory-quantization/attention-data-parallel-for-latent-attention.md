---
id: attention-data-parallel-for-latent-attention
title: Eight copies of the same KV cache
card: gpu-memory-quantization
kind: concept
level: 4
roles: [inference-engineer]
rounds: [ml-depth, system-design]
tags: [attention-data-parallel, mla, tensor-parallel, kv-cache, moe]
minutes: 10
lessons: []
manuals: [sglang-101#s-tp-size-dp-size-and-attn-dp-size, sglang-101#s-kv-bytes-per-token-and-the-kv-pool]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

A teammate serves a model that uses latent attention (MLA) on eight GPUs with `--tp-size 8` and asks why the server holds so few KV tokens on 640 GB of memory. Explain how a tensor-parallel split treats that cache, what the attention-group mode changes, and what it changes without a flag of its own.

## Short answer

Latent attention stores one compressed latent per token and layer, about 68.6 KiB for the 61-layer model, and tensor parallelism cannot split one head across GPUs, so every one of the 8 ranks stores the full cache for every token: eight copies and no more tokens. Attention data parallelism runs the attention layers data parallel inside the tensor group, each group with its own scheduler, requests and KV cache, while the expert layers stay split across all GPUs, so the KV capacity grows with the number of groups; `--attn-dp-size 8` with `--tp-size 8` is the layout for these models. It also divides the chunked prefill size by the group count and multiplies the schedule conservativeness by 0.3, so a chunk tuned on one GPU becomes smaller and admission grows bolder.

## Full answer

### One world, many ways to split it

The model world is the set of GPUs that hold one copy of the model, and SGLang builds it from two numbers only: the world size must equal `--tp-size` times `--pp-size`. Attention data parallelism, expert parallelism and context parallelism do not add GPUs. They regroup the GPUs of the tensor group differently for different layers. Every one of these flags defaults to 1.

### Two meanings of data parallel

Data parallelism with `--dp-size` means several complete copies of the model, each with its own requests and KV cache, behind a controller that sends each request to one copy, round robin by default. Attention data parallelism with `--attn-dp-size` means that inside one tensor group the attention layers run data parallel while the feed-forward or expert layers stay split across all GPUs; `--attn-dp-size 4` with `--tp-size 8` gives four attention groups of two GPUs each.

Before v0.5.22 one flag carried both meanings: `--dp-size` counted copies unless `--enable-dp-attention` was set, when it counted attention groups. The change merged on 2026-09-30 gave the reason in one sentence: the flag meant two different things and every reader had to look at both flags to know which. At the pinned version `--dp-size 8 --enable-dp-attention` is rewritten to `--attn-dp-size 8 --dp-size 1` with a deprecation warning, `--dp-size 2 --attn-dp-size 4` raises an error because copies combined with attention groups are not supported, and a code comment says to remove the old flag after 2026-12-31. Many recipes on the web still use the old spelling.

### Why attention gets its own mode

Latent attention stores one compressed latent per token and layer, one KV head in effect. Tensor parallelism cannot split one head across GPUs, so with `--tp-size 8` every GPU stores the full latent cache for every token, and eight GPUs hold eight copies. With attention data parallelism each group keeps only its own requests, so the KV capacity grows with the groups. The team that added the mode reported up to 1.9 times more decode throughput for these models, which is their claim. For a dense model with grouped-query attention the reason does not hold: it has several KV heads, and tensor parallelism splits its cache without copies while the tensor size is at most the number of KV heads. Above that count, each KV head is copied to more than one rank.

### Two side effects

Turning on attention data parallelism changes two other settings. The chunked prefill size is divided by the group count, so a chunk of 8192 tuned on one GPU becomes 1024 with eight groups, and the log prints the old and the new value; long prompts then take more scheduler steps. The schedule conservativeness is multiplied by 0.3, so the scheduler admits new requests with a smaller reservation for their future tokens.

### Field data points

A student team tuning a latent-attention model for a competition got about 5.9k tokens per second offline with plain 16-way tensor parallelism, and 17,417 tokens per second with a layout of tensor 4, data 4, pipeline 2 and attention data parallelism on one node; read it as one data point, because their write-up explains the memory fraction incorrectly. A production deployment of the same model family runs decode on two nodes with 16 attention groups and 16-way expert parallelism. Watch `sglang:dp_attention_token_imbalance_ratio`, the busiest group's tokens over the average, where 1.0 means balanced.

### The position

Use tensor parallelism to make the model fit and nothing more. Add capacity with copies, inside one server or behind a gateway, with equal pools. Set the attention group count equal to the tensor size for latent-attention expert models, and leave it at 1 for dense grouped-query models.

## Follow-ups

- **Level 3:** Why does the same server with a grouped-query dense model not need the attention groups? Expected: that model has several KV heads, so tensor parallelism splits the cache across ranks without copies, as long as there are at least as many KV heads as ranks; the copy problem exists only when the attention keeps one latent that cannot be split.
- **Level 4:** A recipe from last year passes the old copy flag together with the attention flag. What happens at the pinned version, and what do you write instead? Expected: the server rewrites it to --attn-dp-size with --dp-size 1 and prints a deprecation warning, with the old flag due for removal after the end of 2026; write --attn-dp-size, and know that copies combined with attention groups raise an error.
- **Level 4:** A team tuned the first token with a chunk of 8192 and then turned on eight attention groups. Why did long prompts get slower? Expected: the chunk size is divided by the group count, so each group now prefills in chunks of 1024 and a long prompt takes more scheduler steps; the log prints the old and new values, and the admission ratio was also multiplied by 0.3.

## Wrong answers

- "Eight GPUs give eight times the KV capacity." Under tensor parallelism with latent attention every rank stores the full cache, so eight GPUs hold eight copies and the capacity of one; attention data parallelism is what grows it with the groups.
- "--dp-size 8 means eight attention groups." At the pinned version --dp-size counts model copies; attention groups are --attn-dp-size, and the old spelling with the extra flag is rewritten with a warning until it is removed.
- "Attention data parallelism only changes the attention layers." It also divides the chunked prefill size by the group count and multiplies the schedule conservativeness by 0.3, so the first token and admission both change.
- "Use it on every model for more capacity." For a dense grouped-query model tensor parallelism already splits the cache without copies; the manual's position is attention groups equal to the tensor size for latent-attention expert models only.

## Taught in

[The SGLang parallelism section](../../../manuals/sglang-101/sections/6-1-tp-size-dp-size-and-attn-dp-size.md) explains both kinds of data parallelism, and [The KV pool and bytes per token](../../../manuals/sglang-101/sections/3-1-kv-bytes-per-token-and-the-kv-pool.md) works through the latent size.
