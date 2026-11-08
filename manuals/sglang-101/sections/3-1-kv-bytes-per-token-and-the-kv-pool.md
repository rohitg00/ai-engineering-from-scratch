# The KV pool and bytes per token

> SGLang stores every token of every running request in one pool of fixed-size slots, so a model's bytes per token decide how many users one GPU can serve.

You rent a GPU with 80 GB of memory for an 8-billion-parameter model. The weights take about 16 GB, so most people expect room for a large number of users. Then the server queues requests at a few dozen concurrent conversations, and the GPU still shows free compute. The weights did not fill the memory. The keys and values of every token did.

When you finish this section, you can compute the KV cost of a model from its config. You can find the same number in the startup log and explain why SGLang counts capacity in tokens.

## Why the cache exists

**KV cache:** the stored keys and values of every earlier token, for every layer, kept so that decode does not compute them again. A decode step makes one new token. That token attends to the keys and values of all the tokens before it. Without the cache, each new token would repeat the whole prefill of the conversation.

So the cache grows with two things: the length of each conversation and the number of conversations that run at the same time. After the weights, it is the largest user of memory in a serving engine. Every scheduling decision in [Part 2](#p-2) is a decision about this memory.

## The formula, and our first measured number

For a model with ordinary multi-head or grouped-query attention, one token costs this many bytes:

`2 × layers × KV heads × head dim × bytes per value`

The 2 counts the key and the value. **Grouped-query attention:** several query heads share one key and value head, which is why modern models have far fewer KV heads than attention heads. SGLang computes this number when it starts {{code}}. On our Mac, the MLX backend printed it in the first lines of the log.

```listing
title: the KV pool, sized at startup
source: capture/out/server-default.log
lang: text
note: Two lines from the startup log of the default kit configuration.
---
[2026-10-16 13:58:03] Auto-sized attention KV pool: sys_available=48.49 GB, mlx_limit=51.8 GB, mlx_used=0.31 GB, kv_budget=19.39 GB, bytes_per_slot=114688, pool_size=181574
…
[2026-10-16 13:58:08] MlxAttentionKVPool: 181575 slots x 28 layers x 8 heads x 128 dim, dtype=mlx.core.bfloat16, ~19859.8 MB
```

We measured `bytes_per_slot=114688` for Qwen3-0.6B. The second line gives every term: 28 layers, 8 KV heads, a head dimension of 128, and bfloat16, which is 2 bytes. So the cost is 2 × 28 × 8 × 128 × 2, which is 114,688 bytes, or 112 KiB per token. The formula and the log agree to the byte.

The same arithmetic on public model configs gives these costs:

| Model | Attention | Bytes per token, bf16 | Per GPU |
|---|---|---|---|
| Qwen3-0.6B (our capture) | GQA, 28 layers, 8 KV heads | 112 KiB | 112 KiB on one GPU |
| Llama-3.1-8B | GQA, 32 layers, 8 KV heads | 128 KiB | 128 KiB on one GPU |
| Llama-3.1-70B | GQA, 80 layers, 8 KV heads | 320 KiB | 40 KiB with 8-way tensor parallelism |
| DeepSeek-V3 | MLA, 61 layers, latent 512 plus 64 | 68.6 KiB | 68.6 KiB on every GPU |

Two results surprise most people. A 0.6B model costs almost as much per token as an 8B model. The layer count and the KV heads decide the cost, and the parameter count does not. A 100,000-token conversation on Llama-3.1-8B holds 12.2 GiB of KV, which is close to the size of the weights.

**Multi-head latent attention (MLA):** DeepSeek's attention, which stores one compressed latent per token instead of separate keys and values per head. MLA is small per token, but every tensor-parallel rank stores the full latent {{code}}. Add GPUs with tensor parallelism and you do not add tokens. [Section 6.1](#s-tp-size-dp-size-and-attn-dp-size) shows how data-parallel attention answers that problem.

```figure
id: fig-3-1
kind: structure
title: what one token costs in Qwen3-0.6B
claim: One token of Qwen3-0.6B costs 114,688 bytes, the product of five numbers from the model config.
caption: Read left to right. Each box is one factor of the bytes_per_slot value in the startup log. From capture/out/server-default.log.
```

## Two tables, one pool

SGLang keeps the KV cache in a pool of fixed-size slots, one slot per token. Two tables sit in front of it, and they answer different questions {{code}}.

**ReqToTokenPool:** a table with one row per running request and one column per token position. Each cell holds the index of a slot in the KV pool. Row 0 is padding, so that padded batch entries write to a harmless place.

**TokenToKVPoolAllocator:** the free list of KV slots. It gives out slot indices when a request needs room and takes them back when the request ends. Slot 0 is reserved for the same padding reason. That is why our log shows a buffer of 181,575 slots for a pool of 181,574.

The physical pool holds the tensors. Attention kernels read the keys and values through the request's row in `ReqToTokenPool`. This design has one large effect. Two requests that share a prefix can point their rows at the same slots, so the shared tokens exist once in memory. [Section 3.3](#s-radixcache) shows the radix tree that finds those shared slots.

```figure
id: fig-3-1b
kind: structure
title: request rows point into one slot pool
claim: Two requests that share a system prompt point their first rows at the same KV slots, so the prefix exists once in memory.
caption: Read top to bottom. Each row is a ReqToTokenPool entry, and the strip below is the KV pool. Mechanism from the v0.5.22 code, sizes illustrative.
```

## The cache is the pool

SGLang has no separate setting for cache size. The SGLang paper makes this a design choice: cached tokens and running requests use one memory pool {{paper}}. A cached prefix is KV that no running request locks right now. When a new request needs room, SGLang evicts prefixes that no request locks, from the same pool.

This is why the startup log reports one number, `max_total_num_tokens`, and not two. On our Mac with `--mem-fraction-static 0.4`, that number was 181,574 tokens. The model allows a context of 40,960 tokens. So the pool holds four full-length conversations, or about 180 conversations of 1,000 tokens each. Running requests and cached prefixes compete for those same slots.

## Our position: count tokens, not gigabytes

Size a deployment from `max_total_num_tokens`, not from free memory. Multiply your typical context length by the concurrency you need, and compare the product with that number. If the product is larger, the scheduler retracts or queues requests, and [section 2.3](#s-admission-and-retraction) shows what that costs.

The two levers that change the number are the memory fraction in [section 3.2](#s-mem-fraction-static-and-startup-sizing) and the KV data type. `--kv-cache-dtype` defaults to `auto`, which keeps the model data type unless the checkpoint asks for FP8 {{code}}. FP8 halves the bytes per token.

A field report shows the size of that lever. Cloudflare reported that FP8 KV raised the context held in memory for Kimi K2.6 from about 686,000 to about 1.37 million tokens {{field Cloudflare 2026-08}}. The same report measured a few percent less throughput per request at low concurrency. At concurrency 64, the BF16 configuration ran out of memory, and the FP8 configuration reached 2,192 tokens per second. In that report, FP8 KV traded a little speed per token for twice the users.

Our own FP8 runs changed the weights and the KV cache together, and they were faster per user. On the L4 they gave 24.5 against 13.4 tokens per second at 1 user, as [section 4.3](#s-quantization) shows. Read the [Cloudflare post](https://blog.cloudflare.com/smaller-faster-safer-models/) for their accuracy checks before you copy the change.

The [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?users=64) machine draws the KV pool as cells on the six GDDR6 packages of an L4. This link opens the BF16 run at 64 users: the 24,094-token pool holds 37 requests of 640 tokens, and the other 27 wait. Switch the weights and the KV cache to FP8 to see the pool grow to 142,369 tokens.

## What to measure

- Read `bytes_per_slot` or compute it, and check that the two agree.
- Read `max_total_num_tokens` in the startup log, and divide it by your typical context length.
- Watch `token usage` in the scheduler log. It is the fraction of the pool that running requests and cached prefixes hold.

The lesson on [inference optimization](phases/10-llms-from-scratch/12-inference-optimization) builds a KV cache from scratch, if you want the mechanism below SGLang.

```takeaways
- Compute bytes per token from layers, KV heads, head dimension, and data type.
- Check the computed number against bytes_per_slot in the startup log.
- Plan capacity in tokens with max_total_num_tokens, not in gigabytes.
- Expect MLA KV on every tensor-parallel rank, so more ranks add no tokens.
- Try FP8 KV before you buy more GPUs, and check accuracy on your data.
```

Sources: python/sglang/srt/model_executor/pool_configurator.py (_compute_cell_size, calculate_pool_sizes), python/sglang/srt/mem_cache/memory_pool.py (ReqToTokenPool), python/sglang/srt/mem_cache/allocator/token.py (TokenToKVPoolAllocator), python/sglang/srt/hardware_backend/mlx/model_runner.py (_compute_pool_size), python/sglang/srt/arg_groups/fields/model.py (kv_cache_dtype) at v0.5.22, capture/out/server-default.log, the SGLang paper (arXiv 2312.07104), the Cloudflare report of 2026-08-03, capture/gpu/out-l4/server-load-default.log and capture/gpu/out-l4/server-load-fp8.log for the L4 pools.
