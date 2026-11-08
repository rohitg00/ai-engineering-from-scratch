# --quantization and --kv-cache-dtype

> Quantization buys memory first and speed second, and SGLang keeps weights, GEMM kernels, and the KV cache as three separate choices so that you can buy only what you need.

Cloudflare served Kimi K2.6 with a BF16 KV cache and raised concurrency step by step. At 32 concurrent requests the server produced 1,558 tok/s. At 64 it ran out of memory. With an FP8 KV cache the same service reached 2,192 tok/s at 64 requests, about 41% above the best BF16 result {{field Cloudflare 2026-08}}. The FP8 cache was slower per token at every concurrency both versions could run. It won because twice as many requests fit.

When you finish this section, you can tell weight quantization from KV cache quantization, and load a quantized checkpoint without breaking detection. You can also size the memory gain before you measure speed, and decide where a lower precision belongs.

## Three choices, three flags

**Weight quantization:** storing the model weights in fewer bits, such as FP8, FP4, or INT4. It shrinks the weights and the memory traffic of each GEMM. `--quantization` selects the method.

**GEMM backend:** the kernel library that multiplies quantized weights. `--fp8-gemm-backend` and `--fp4-gemm-backend` select it, and both default to `auto`, which picks by GPU generation.

**KV cache dtype:** the format of the cached keys and values. `--kv-cache-dtype` selects it, separately from the weights. Its default `auto` uses the model dtype.

A model can run FP8 weights with a BF16 KV cache, or BF16 weights with an FP8 KV cache. Each choice moves a different budget, so treat them as three decisions.

## Weights: offline first

At v0.5.22, `--quantization` accepts 31 method names. Most of them describe a checkpoint that someone already quantized: AWQ, GPTQ, ModelOpt FP8 and FP4, compressed-tensors, GGUF, Quark, and others. A few quantize BF16 weights while the model loads: `fp8`, `mxfp8`, `nvfp4_online`, and `mlx_q4` or `mlx_q8` on Apple silicon.

**Offline quantization:** the checkpoint already stores low-bit weights and their scales. **Online quantization:** SGLang converts full-precision weights at load time.

When you load a quantized checkpoint, do not pass `--quantization`. The model config check reads `quantization_config.quant_method` from the checkpoint and uses it. If you pass a method that differs, the check accepts only known compatible pairs, such as `modelopt_fp4` on a `modelopt` checkpoint. For a requantization it logs that you should validate accuracy again. Every other mismatch raises at startup.

```figure
id: fig-4-4
kind: flow
title: how SGLang decides the weight format
claim: The checkpoint names its own quantization method, and a --quantization flag only helps when it matches that method or a known upgrade.
caption: Read each row left to right. The rose arrow ends in a startup error. The last row is the CUDA path at v0.5.22. From _verify_quantization and the GPTQ Marlin override at v0.5.22.
```

The flag can also block an upgrade. A GPTQ checkpoint loaded with no flag is detected, converted at runtime, and served by the Marlin kernel. The upgrade code accepts that conversion only when you passed no method or `gptq_marlin`.

PR #32114 deleted the plain GPTQ CUDA kernel on 2026-09-10, and on a CUDA build the method registry has no `gptq` entry. The flag parser still accepts `--quantization gptq`. The model config check then skips the Marlin upgrade and raises `Unknown quantization method: gptq`. We read this path in the code and did not run it on a GPU.

## The KV cache: capacity, with a scale

`--kv-cache-dtype` accepts `auto`, `bf16`, `fp8_e4m3`, `fp8_e5m2`, `mxfp8` (FA4 only), `nvfp4`, and `fp4_mx_block16`. FP8 halves the bytes per token and FP4 quarters them, so the same pool holds two or four times as many tokens. [Section 3.1](#s-kv-bytes-per-token-and-the-kv-pool) shows how to compute bytes per token for your model.

FP8 needs a scale for each tensor. The help text of `--quantization-param-path` says to supply the scales file when the KV cache dtype is FP8. Without it, every scale is 1.0, and accuracy can drop {{code}}. Run an accuracy check whenever you change the KV cache dtype.

The vLLM team treats a scale of 1.0 as the worst case for accuracy. They tested uncalibrated FP8 KV caches in 2026, and most models stayed close to BF16 in their tests. They named Kimi-K2.5 on the FlashMLA backend as a model that needs calibrated scales. We did not measure these results ourselves.

Cloudflare published its check. On Kimi K2.6, BF16 against FP8 KV scored 94.24 and 94.09 on GSM8K, 89.11 and 89.04 on MMLU, and 80.29 and 79.29 on MMLU-Pro {{field Cloudflare 2026-08}}. Those are their numbers on their model, and your model can differ.

We ran our own check on 2026-10-23, on our L4: the first 500 GSM8K questions, 8-shot and greedy, with `Qwen/Qwen3-8B` and `Qwen/Qwen3-8B-FP8`. Neither checkpoint has KV scales, so the FP8 KV runs used a scale of 1.0.

```listing
title: GSM8K accuracy, 500 questions, 8-shot, Qwen3-8B on SGLang 0.5.22
source: capture/gpu/out-l4/gsm8k-fp8-accuracy.txt
lang: text
note: The SGLang rows. The vLLM rows of the same file are cut.
---
engine   config                     correct   accuracy   Wilson 95% interval
SGLang   BF16                       458/500   91.6%      88.8 to 93.7
SGLang   FP8 weights                456/500   91.2%      88.4 to 93.4
SGLang   FP8 KV cache               458/500   91.6%      88.8 to 93.7
SGLang   FP8 weights + FP8 KV       460/500   92.0%      89.3 to 94.1
…
```

All four intervals overlap, so this run did not show a difference. With 500 questions, it cannot rule out a loss of a few points. That is one model and one benchmark, so it does not remove the check on your model.

### Check that your scales load

The warning `Using FP8 KV cache but no scaling factors provided` prints whenever you pass no `--quantization-param-path` {{code}}. A checkpoint can also carry its scales in its weight files. So the warning alone does not tell you which scales the server uses.

First, look for scales in the checkpoint. Search the weight index for tensor names that end in `k_scale` or `v_scale`:

```bash
grep -oE '"[^"]*(k|v)_scale"' model.safetensors.index.json | sort -u
```

We ran this search on the index of `Qwen/Qwen3-30B-A3B-Instruct-2507-FP8` on 2026-10-22. It lists weight scales and no KV scales, so our FP8 server below used a KV scale of 1.0.

Then read the load log. Before PR #35455, SGLang dropped the KV scales of compressed-tensors checkpoints, and the log reported each `k_scale` parameter as not found {{issue #35455}}. The fix is in the v0.5.22 source {{code}}. A warning about a missing `k_scale` or `v_scale` still means that the loader skipped those scales. On a checkpoint with scales close to 1.0, the PR measured GSM8K at 0.960 with dropped scales and 0.965 with loaded scales.

Last, run your own prompts with and without FP8, and compare the answers before you go to production.

## Quantization is a capacity decision

```figure
id: fig-4-5
kind: comparison
title: BF16 against FP8 KV cache on Kimi K2.6
claim: The FP8 KV cache is a few percent slower at every load both caches can run, and keeps scaling after the BF16 cache runs out of memory.
caption: Output tokens per second by concurrency, as Cloudflare reported them on 2026-08-03. Dashed bars are BF16 and solid bars are FP8. Rose marks the out-of-memory run. No SGLang version was published.
```

Cloudflare also tested INT4 weights on GLM 5.2 {{field Cloudflare 2026-08}}. Decode got faster, 60 to 92 tok/s at concurrency 1 and 1,672 to 1,933 tok/s at 64. Prefill got slower, from about 10,160 tok/s with FP8 to about 8,660 with INT4.

Decode is limited by memory traffic, so smaller weights help. Prefill is limited by compute, and dequantizing INT4 costs compute. Cloudflare split the two phases across servers and runs INT4 for decode and FP8 for prefill. [Section 6.3](#s-prefill-decode-disaggregation) explains the split.

## What we measured on a GB10

We served `Qwen/Qwen3-30B-A3B-Instruct-2507` twice on one NVIDIA GB10. The first server loaded the BF16 checkpoint. The second loaded the FP8 checkpoint `Qwen/Qwen3-30B-A3B-Instruct-2507-FP8` with `--kv-cache-dtype fp8_e4m3`. Both used `--mem-fraction-static 0.7`, and we passed no `--quantization` flag.

```listing
title: the FP8 server detects its checkpoint and sizes its pool
source: capture/gpu/out-gb10/server-fp8.log
lang: text
note: Four lines from the startup log. Timestamps are cut.
---
… Detected fp8 checkpoint.
… Using FP8 KV cache but no scaling factors provided. Defaulting to scaling factors of 1.0.
… Load weight end. elapsed=152.29 s, type=Qwen3MoeForCausalLM, quant=fp8, fmt=e4m3, avail mem=83.63 GB, mem usage=29.75 GB.
… KV Cache is allocated. dtype: torch.float8_e4m3fn, #tokens: 1083008, K size: 24.79 GB, V size: 24.79 GB
```

**We measured** what the two choices bought. The weights went from 57.75 GB to 29.75 GB, and the load time went from 323.61 s to 152.29 s. The pool went from 227,243 tokens to 1,083,008 tokens, 4.77 times as many.

Two effects multiply in that number. The smaller weights freed 28.00 GB, and the pool grew by 28.78 GB, from 20.80 GB to 49.58 GB in the units of the log. Each token then took half the bytes, 49,152 against 98,304 for 48 layers with 4 KV heads of size 128.

The second line of the listing is the warning from the previous subsection. We gave no scale file, so every scale is 1.0. Both servers wrote the same 12 tokens for our first request at temperature 0. That is one prompt, and it is not an accuracy check.

Speed changed at every load. The table comes from the sweep servers, which had pools of 234,600 and 1,084,458 tokens. The sweep ran three seeds at each concurrency:

| Concurrency | BF16 output tok/s | FP8 output tok/s | BF16 median TPOT | FP8 median TPOT |
|---|---|---|---|---|
| 1 | 29.14 | 51.50 | 32.52 ms | 18.41 ms |
| 8 | 74.11 | 137.00 | 102.21 ms | 54.96 ms |
| 32 | 150.66 | 283.19 | 201.91 ms | 104.12 ms |
| 64 | 235.38 | 440.86 | 254.06 ms | 131.78 ms |

```figure
id: fig-4-3b
kind: chart
title: FP8 moves the whole latency and throughput curve
claim: On the GB10, FP8 weights and FP8 KV gave more tokens per second and less time per token at every concurrency from 1 to 64.
caption: Each dot is one concurrency, from c1 to c64. The x axis is output tokens per second and the y axis is median TPOT. Plum is BF16 and green is FP8. From capture/gpu/summary/gb10.json.
```

This result differs from the Cloudflare result above. There, the FP8 cache was a little slower per token and won on capacity. Here, the weights were FP8 too. Decode on this machine reads weights from a memory with modest bandwidth, so half the bytes gave almost twice the speed.

## The same test on a 24 GB L4

The GB10 has 121.7 GiB of memory, so its BF16 pool never ran short. We wanted to see the other case, so we ran the same pair on one NVIDIA L4 with `Qwen/Qwen3-8B` and `Qwen/Qwen3-8B-FP8`. Both servers used `--mem-fraction-static 0.85`. The sweep waited for the card to cool to 72°C before each run.

```listing
title: the BF16 server on the L4
source: capture/gpu/out-l4/server-load-default.log
lang: text
note: Two lines from the startup log. Timestamps are cut.
---
… Load weight end. elapsed=3.92 s, type=Qwen3ForCausalLM, avail mem=6.59 GB, mem usage=15.28 GB.
… KV Cache is allocated. dtype: torch.bfloat16, #tokens: 24094, K size: 1.65 GB, V size: 1.65 GB
```

```listing
title: the FP8 server on the L4
source: capture/gpu/out-l4/server-load-fp8.log
lang: text
note: Two lines from the startup log. Timestamps are cut.
---
… Load weight end. elapsed=2.54 s, type=Qwen3ForCausalLM, quant=fp8, fmt=e4m3, avail mem=13.06 GB, mem usage=8.81 GB.
… KV Cache is allocated. dtype: torch.float8_e4m3fn, #tokens: 142369, K size: 4.89 GB, V size: 4.89 GB
```

**We measured** a pool of 24,094 tokens for BF16 and 142,369 tokens for FP8, 5.91 times as many. Each request in the sweep had 512 input tokens and 128 output tokens. The BF16 pool held about 37 such requests.

| Concurrency | BF16 output tok/s | FP8 output tok/s | BF16 median TTFT | FP8 median TTFT |
|---|---|---|---|---|
| 1 | 13.42 | 24.53 | 189.16 ms | 140.72 ms |
| 16 | 201.09 | 313.92 | 211.78 ms | 147.52 ms |
| 32 | 270.11 | 507.20 | 2,969.61 ms | 199.09 ms |
| 64 | 250.85 | 735.91 | 18,348.57 ms | 296.42 ms |

```figure
id: fig-4-3c
kind: chart
title: On a 24 GB card the BF16 pool fills
claim: On one L4, BF16 throughput stopped at 270 tokens per second at concurrency 32, and FP8 kept climbing to 736 at 64.
caption: Output throughput against max concurrency, three seeds per point. Plum is BF16 and green is FP8 weights with an FP8 KV cache. From capture/gpu/summary/l4.json.
```

The scheduler log of the sweep shows the cause at concurrency 64. The BF16 server ran at most 38 requests, with token usage at 0.99 and 26 requests in the queue. The FP8 server ran all 64 requests at token usage 0.29 with an empty queue. The BF16 throughput fell from 32 to 64 because more requests waited, and each waiting request added its wait to TTFT.

At concurrency 1 the pool size does not matter, and FP8 was still faster: 39.66 ms per token against 60.16 ms. That is the GB10 effect again. Decode on an L4 reads every weight for every token, and FP8 weights are half the bytes.

On this card the goodput result is clear. Our target was TTFT under 1 s and TPOT under 100 ms. BF16 served 0 requests per second within target at concurrency 32 and 64. FP8 served 2.87 requests per second within target at 64.

### When the pool is too small for the prefixes

The L4 test above gave BF16 a full pool. We then gave both builds the same smaller budget, `--mem-fraction-static 0.74`, and ran the shared-prefix sweep of [section 3.3](#s-radixcache). Each run sent 64 prompts in 4 groups of 16 at 8 users, with a shared system prompt of 0 to 4,096 tokens. Four groups at 4,096 tokens need about 16,000 tokens of prefix in the cache.

```listing
title: two pools from one memory budget
source: capture/gpu/out-l4/server-small-pool-bf16-fp8.log
lang: text
note: The BF16 pool and the FP8 pool at the same memory fraction of 0.74.
---
[2026-10-18 19:35:26] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 6559, K size: 0.45 GB, V size: 0.45 GB
[2026-10-18 22:02:58] KV Cache is allocated. dtype: torch.float8_e4m3fn, #tokens: 107299, K size: 3.68 GB, V size: 3.68 GB
```

| Shared prompt tokens | Output tok/s, BF16 / FP8 | Median TTFT, BF16 / FP8 |
|---|---|---|
| 0 | 113.5 / 180.1 | 354 / 255 ms |
| 1,024 | 95.0 / 164.1 | 470 / 349 ms |
| 2,048 | 25.9 / 155.1 | 12,576 / 380 ms |
| 4,096 | 10.9 / 134.8 | 40,126 / 372 ms |

**We measured** a cliff for BF16 and none for FP8. The BF16 pool held 6,559 tokens, so at 2,048 shared tokens the four prefixes no longer fitted. Its median first token went from 470 ms to 12.6 s. The FP8 pool held 107,299 tokens and kept every prefix, with a first token under 400 ms at every length. At 2,048 shared tokens, FP8 gave 6.0 times the output of BF16.

One caveat belongs with the last row. The BF16 runs at 4,096 shared tokens stayed under our 1,000 MHz clock floor after three tries, at a median of 390 MHz. Read the 2,048 row as the result. Its BF16 runs had a median clock of 1,275 MHz, above the floor, but half of their samples had the thermal flag set. The FP8 runs had a median clock of 1,200 to 1,260 MHz.

The [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?workload=shared&shared=2048&frac=0.74) machine runs the small-pool test on an L4. This link opens BF16 at a fraction of 0.74 with 2,048 shared tokens. The four prefixes do not fit in 6,559 tokens together, so the tree evicts prefixes and requests compute them again. Switch the weights to FP8 to keep every prefix in 107,299 tokens.

## Our position

Use an offline-quantized checkpoint and pass no `--quantization` flag. The SGLang docs give the same advice {{docs}}. Online quantization adds load time and gives you a checkpoint that nobody evaluated.

Choose a KV cache dtype from memory, not from speed. If your server queues requests because the pool is full, FP8 is the cheapest capacity we measured. Our runs changed the weights and the KV cache together. For an FP8 KV cache alone, the evidence is the field report in [section 3.1](#s-kv-bytes-per-token-and-the-kv-pool), and you need a scale file. If the pool has room, keep the model dtype.

On our GB10 with Qwen3-30B-A3B, FP8 weights with an FP8 KV cache gave 1.73 to 1.88 times the throughput at every concurrency. Decode on that card waits for memory, so smaller weights are faster. Check accuracy on your own tasks before you serve it.

Quantize per phase when you run prefill and decode on separate servers. Smaller weights help decode, and they can slow prefill.

## Incidents

**The BF16 cache ran out at 64 requests.** Cloudflare {{field Cloudflare 2026-08}} reported that Kimi K2.6 with a BF16 KV cache ran out of memory at concurrency 64. The FP8 cache held about 1.37 million tokens against about 686,000 and served the same load.

**A container could not run NVFP4.** A field report from joshua8.ai {{field joshua8 2026-01}} used an RTX PRO 6000 Blackwell. NVFP4 did not run in its SGLang container, so it compared SGLang on GPTQ-INT4 against vLLM on NVFP4. Compare engines on the same weight format, or the result measures the format.

**FP4 needs one GPU generation.** A user summary on Pivot News {{field Pivot News 2026-05}} reported that SGLang crashed when RTX 4090 cards joined a Blackwell pipeline. Its FP4 path required compute capability 10.0 and had no software path for older cards. This report reached us through a secondary summary of a Reddit post.

```takeaways
- Load quantized checkpoints without --quantization and let SGLang read the method.
- Replace --quantization gptq with no flag or gptq_marlin on CUDA builds.
- Supply a KV scale file and run an accuracy check before serving an FP8 KV cache.
- Search the checkpoint index for k_scale and v_scale, and read the load log for scales that were not found.
- Choose KV cache dtype by queue length and pool usage, then measure speed.
- Read the KV Cache is allocated line to see the pool size each choice buys.
```

Sources: capture/gpu/out-gb10/server-default.log, server-fp8.log, server-fp8.command.txt, generate.txt, fp8-generate.txt, capture/gpu/summary/gb10.json, capture/gpu/summary/l4.json, capture/gpu/out-l4/server-load-default.log, server-load-fp8.log, python/sglang/srt/arg_groups/choices.py (QUANTIZATION_CHOICES), arg_groups/fields/model.py (kv_cache_dtype, quantization_param_path), configs/model_config.py (_verify_quantization), layers/quantization/__init__.py (get_quantization_config), layers/quantization/gptq/gptq.py (override_quantization_method), layers/quantization/fp8.py, and docs/docs/advanced_features/quantization.mdx at v0.5.22; model_executor/model_runner_components/load_model_utils.py (load_kv_cache_scales) and layers/quantization/compressed_tensors/compressed_tensors.py (kv_cache_scheme) at v0.5.22; PR #32114; PR #35455 (compressed-tensors KV scales, merged 2026-08-20); the model.safetensors.index.json of Qwen/Qwen3-30B-A3B-Instruct-2507-FP8 (read 2026-10-22); the vLLM team, The State of FP8 KV-Cache and Attention Quantization in vLLM (2026-04-22); field reports by Cloudflare (2026-08-03), joshua8.ai (2026-01-10), and Pivot News (2026-05-19); capture/gpu/out-l4/server-small-pool-bf16-fp8.log, capture/gpu/summary/l4.json (prefix.small-pool, prefix.fp8-small-pool), capture/gpu/out-l4/server-load-c64-scheduler.log, capture/gpu/out-l4/gsm8k-fp8-accuracy.txt
