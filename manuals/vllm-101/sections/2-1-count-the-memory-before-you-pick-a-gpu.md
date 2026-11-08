# Count the memory before you pick a GPU

> The KV cache, not the weights, decides how many users fit, and you can count it from four numbers in the model config.

You chose a GPU and the server holds fewer users than you planned. When you finish this section, you can predict the KV pool and the number of users for a model and a context length.

**Our result:** on our L4 with Qwen3-8B, the 24,096-token pool fit 37 users with 640 tokens each, although the startup line printed 2.94.

## Count the bytes for one token

Every token in a running request keeps its keys and values in GPU memory until the request ends. Four numbers in the model config give the size:

```text
KV bytes per token = layers x KV heads x head size x 2 x bytes per value
```

The factor 2 counts the key and the value. Read the first three numbers from `config.json` as `num_hidden_layers`, `num_key_value_heads`, and `head_dim`. In BF16, a value takes 2 bytes. With an FP8 KV cache, it takes 1 byte.

| Model | Layers | KV heads | Head size | KV per token in BF16 |
|---|---|---|---|---|
| `Qwen/Qwen3-8B` | 36 | 8 | 128 | 144 KiB |
| `Qwen/Qwen3-30B-A3B-Instruct-2507` | 48 | 4 | 128 | 96 KiB |

The mixture-of-experts model has almost four times the weights of the dense model, but it keeps fewer bytes for each token. The KV heads decide this number, not the parameter count.

```figure
id: fig-2-1
kind: structure
title: the bytes for one token
claim: Qwen3-8B holds 144 KiB of KV cache for every token, and Qwen3-30B-A3B holds 96 KiB, because it has fewer KV heads.
caption: Multiply the five numbers in each row. The last factor is two bytes for BF16. From the model configs on the Hugging Face Hub.
```

## Turn bytes into users

vLLM gives the KV cache what is left after the weights and the startup profile. Divide that memory by the bytes per token to get the pool in tokens. Then divide the pool by the context that one user holds:

```text
users that fit = KV pool in tokens / (prompt tokens + output tokens per user)
```

A request that needs more blocks than are free waits in the queue. If a running request needs a new block and none is free, vLLM stops it and computes it again later.

## Check the count against the startup log

Read two lines after every start. On our DGX Spark, with `Qwen/Qwen3-30B-A3B-Instruct-2507` and `--gpu-memory-utilization 0.75`, the log said:

```listing
title: the memory lines from a GB10 start
source: capture/gpu/out-gb10/server-load-vllm.log
lang: text
note: The weights took 56.93 GiB, and 31.32 GiB was left for the KV cache.
---
(EngineCore pid=143) INFO 10-21 10:58:45 [model_runner.py:407] Model loading took 56.93 GiB memory and 330.542793 seconds
(EngineCore pid=143) INFO 10-21 10:59:46 [gpu_worker.py:692] Available KV cache memory: 31.32 GiB
```

At 96 KiB per token, 31.32 GiB holds about 342,000 tokens.

**Fixed pool:** in our sweeps, we set the pool size by hand with `--num-gpu-blocks-override`, which sets the number of 16-token blocks. We gave vLLM the same pool as the SGLang server on the same machine, so that the two engines had the same room. On the DGX Spark the pool was 234,960 tokens, and on the L4 it was 24,096 tokens. Your server sizes the pool from free memory, so it uses the full number.

The next line gives the pool in tokens and the users that fit at the full context length:

```listing
title: the pool line from the L4 comparison run
source: capture/gpu/out-l4/server-h2h-vllm.log
lang: text
note: 24,096 tokens at 144 KiB each is 3.31 GiB of KV cache.
---
INFO 10-17 20:13:17 [kv_cache_utils.py:2464] GPU KV cache size: 24,096 tokens, Maximum concurrency for 8,192 tokens per request: 2.94x
```

The `Maximum concurrency` number assumes that every user fills the full `--max-model-len`. Real users hold less, so more of them fit. With 512 prompt tokens and 128 output tokens, the 24,096-token pool holds 37 users at their full length. During our load sweep, the log showed 40 running requests with the cache 99.5 percent full, because users early in their answer hold fewer tokens.

```figure
id: fig-2-1b
kind: comparison
title: the pool decides the users
claim: The same 24,096-token pool fits 2.94 users at the full context length, but 37 users who each hold 640 tokens.
caption: Each blue block is one user. The dashed part is pool that no full-length user fills. From capture/gpu/out-l4/server-h2h-vllm.log.
```

## Decide what to change

If the count is too small for your traffic, you have four choices. They are in order of cost:

1. Lower `--max-model-len` to the longest context that your users send. The pool stays the same size, and one long request can no longer take all of it.
2. Use an FP8 KV cache. It halves the bytes per token. [The FP8 KV page](#s-fit-more-users-with-an-fp8-kv-cache) shows the cost.
3. Use FP8 weights. They free memory for the cache. [The FP8 weights page](#s-fit-a-bigger-model-with-fp8-weights) shows when this pays.
4. Use a GPU with more memory, or split the model across GPUs. [The parallelism page](#s-choose-tensor-pipeline-or-data-parallelism) covers this.

```takeaways
- Count KV bytes per token from four config numbers before you buy or rent a GPU.
- Divide the KV pool by the context per user, not by the maximum model length.
- Compare your count with the memory and pool lines after every start.
```

Sources: vLLM documentation at v0.31.0 (docs/configuration/optimization.md, docs/design/prefix_caching.md), the model configs of Qwen/Qwen3-8B and Qwen/Qwen3-30B-A3B-Instruct-2507, capture/gpu/out-gb10/server-load-vllm.log, capture/gpu/out-l4/server-h2h-vllm.log, capture/gpu/summary/l4.json, capture/gpu/summary/gb10.json.
