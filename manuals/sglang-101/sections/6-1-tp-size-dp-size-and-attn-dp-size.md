# --tp-size, --dp-size, and --attn-dp-size

> Tensor parallelism makes a model fit, data parallelism adds capacity, and attention data parallelism removes the KV copies that tensor parallelism makes for MLA models.

You have eight GPUs and one large model. The first command most people type is `--tp-size 8`, and the model loads. Then a teammate asks why the server holds so few tokens of KV cache for a DeepSeek model on 640 GB of memory. The answer is in how SGLang splits one model across GPUs, and in a flag whose meaning changed in v0.5.22.

When you finish this section, you can choose `--tp-size`, `--dp-size`, and `--attn-dp-size` for a model and a GPU count. You can also say which GPUs share which work, and read an old recipe that uses `--enable-dp-attention`.

## One world, many ways to split it

**Model world:** the set of GPUs that together hold one copy of the model. SGLang builds it from two numbers only. The code raises an error when the world size is not `tp_size` times `pp_size` {{code}}.

**Tensor parallelism (TP):** each layer's weight matrices are cut into `--tp-size` slices, one per GPU. Every layer then ends with a collective operation that joins the slices. **Pipeline parallelism (PP):** whole layers go to different GPUs in order, and `--pp-size` sets the number of stages.

Everything else splits that same world. Attention data parallelism, expert parallelism, and context parallelism do not add GPUs. They regroup the GPUs of the TP group differently for different layers.

Keep one mental model, and every later flag reads clearly. TP size is the number of GPUs in one model copy. The other widths are ways to cut that set.

```figure
id: fig-6-1
kind: layers
title: one TP group of eight GPUs, split three ways
claim: With --tp-size 8, --attn-dp-size 4, and --ep-size 8, the same eight GPUs form one TP group, four attention groups, and one expert group.
caption: Read each row as one layer type. Each square is one GPU. Attention groups are contiguous rank ranges, and an expert group equal to the TP group reuses it. From the group construction code at v0.5.22.
```

The default of every one of these flags is 1 {{code}}. So a plain `sglang serve` uses one GPU, one scheduler, and one copy of the model.

## Two meanings of "data parallel"

**Data parallelism (DP):** several complete copies of the model, each with its own requests and its own KV cache. `--dp-size 2` with `--tp-size 4` uses eight GPUs as two worlds of four. A data parallel controller process gives each new request to one of the copies {{code}}. Its default method, `auto`, resolves to `round_robin` outside prefill-decode disaggregation.

```figure
id: fig-6-1b
kind: tree
title: two data parallel copies behind one controller
claim: Round robin sends alternate requests to two worlds that share no KV cache, so a repeated prefix can miss in the other world.
caption: Read top to bottom. The controller is the default round_robin method. Each world is a TP group of four GPUs with its own cache. From the data parallel controller and serving hook code at v0.5.22.
```

**Attention data parallelism:** inside one TP group, the attention layers run data parallel while the feed-forward or expert layers stay split across all GPUs. Each attention group has its own scheduler, its own requests, and its own KV cache. `--attn-dp-size 4` with `--tp-size 8` gives four attention groups of two GPUs each.

Before v0.5.22, one flag carried both meanings. `--dp-size` counted model copies, unless `--enable-dp-attention` was also set, when it counted attention groups. Pull request [#41818](https://github.com/sgl-project/sglang/pull/41818) gave the reason for the change in one sentence: "`--dp-size` means two different things... Every reader has to look at both flags to know which meaning it has." It was merged on 2026-09-30.

The code at v0.5.22 does three things with the old spelling {{code}}:

| You pass | SGLang does |
|---|---|
| `--dp-size 8 --enable-dp-attention` | rewrites it to `--attn-dp-size 8 --dp-size 1` and prints a deprecation warning |
| `--attn-dp-size 8` | the new spelling, the same layout |
| `--dp-size 2 --attn-dp-size 4` | raises an error: replicas combined with attention data parallelism are not supported |

The warning names the new flag, and a comment in the code says to remove the old flag after 2026-12-31 {{code}}. Many DeepSeek recipes on the web still use the old spelling. They work today and stop working in a later release.

## Why attention gets its own data parallel mode

DeepSeek models use multi-head latent attention (MLA). MLA stores one compressed latent vector per token and layer, which is one KV "head". [Section 3.1](#s-kv-bytes-per-token-and-the-kv-pool) works through its size. Tensor parallelism cannot split one head across GPUs, so with `--tp-size 8` every GPU stores the full latent cache for every token. Eight GPUs then hold eight copies of the same KV cache.

The SGLang team gave this reason when they added the mode in v0.4 {{team 2024-12}}. With attention data parallelism, each attention group keeps only its own requests. The KV capacity of the server grows with the number of groups. The team reported up to 1.9 times more decode throughput for DeepSeek models, which is their claim.

For a dense model with grouped-query attention (GQA), the reason does not hold. GQA has several KV heads, so tensor parallelism already splits the cache without copies.

## What attention data parallelism changes for you

Turning on attention data parallelism changes two other settings without a flag of their own {{code}}:

- `chunked_prefill_size` is divided by `--attn-dp-size`. A chunk size that you tuned on one GPU becomes smaller per attention group. The server log prints the old and the new value.
- `schedule_conservativeness` is multiplied by 0.3. The scheduler then admits new requests with a smaller reservation for future tokens. [Section 2.3](#s-admission-and-retraction) explains that reservation.

The first change is the one that surprises people. A team that measured TTFT with `--chunked-prefill-size 8192` and then added `--attn-dp-size 8` now runs chunks of 1024 tokens. Long prompts take more scheduler steps to prefill.

## Our position

Use tensor parallelism to make the model fit, and nothing more. Add capacity with data parallel copies, inside one server with `--dp-size` or as separate servers behind the gateway in [section 6.4](#s-sgl-model-gateway). Give every copy about the same pool. Our only pair had unequal pools, and it lost at every load. Use `--attn-dp-size` equal to `--tp-size` for MLA mixture-of-experts models such as DeepSeek and Kimi, and leave it at 1 for dense GQA models.

A field report supports the order. A student team tuned DeepSeek-R1 for a competition on H100 and H200 nodes {{field Lowndes 2025-11}}. Plain `--tp 16` gave about 5.9k tokens per second offline. Their best layout, TP4 with DP4, PP2, and attention data parallelism on one H200 node, gave 17,417 tokens per second. Use their numbers as one data point, because the [write-up](https://luca.lowndes.net/blog/sglang-optimisations) explains `--mem-fraction-static` incorrectly.

Ant Group made the same kind of choice in production. Their DeepSeek-R1 decode runs on two nodes with 16 attention groups and 16-way expert parallelism {{field Ant-Group 2025-09}}.

## Several nodes

One model world can span machines. Three flags describe it {{code}}:

| Flag | Default | Meaning |
|---|---|---|
| `--nnodes` | 1 | the number of machines in one world |
| `--node-rank` | 0 | this machine's position, from 0 |
| `--dist-init-addr` | none | the `host:port` where all ranks meet to build their groups |

Only node 0 runs the tokenizer and the HTTP API. Other nodes run their scheduler processes, a small health server, and nothing else {{code}}. Point your load balancer at node 0. Also keep adjacent ranks on the same machine, because TP groups are contiguous rank ranges and their collectives need the fast links inside one box.

A real incident shows how a network detail can stop all of this. A user ran attention data parallelism across nodes with an IPv6 address in `--dist-init-addr` ([issue #19953](https://github.com/sgl-project/sglang/issues/19953)). The server hung on its first message to the schedulers, and no request was ever served. The cause was a ZeroMQ socket that the controller bound without IPv6 turned on. A fix was proposed in the thread. We could not confirm that it was merged.

## What to measure

Before you add GPUs, measure one copy with the benchmark in [section 5.1](#s-sglang-benchmark-serving). Watch `sglang:num_queue_reqs` and `sglang:token_usage` from [section 5.2](#s-the-metrics-endpoint). A queue that grows while token usage stays low points to compute limits, and more copies help. Token usage near 1.0 points to KV memory limits, and a smaller KV cache per token helps first.

For attention data parallelism, watch `sglang:dp_attention_token_imbalance_ratio`. It reports the busiest group's tokens over the average, and 1.0 means balanced. Our `/metrics` capture lists it even on a single Mac, so your dashboards can include it before you need it.

## What happened on two L4s

We had two NVIDIA L4 cards in one machine, and the second card also ran two small pods for another team. Each pod held 1,746 MiB. We started `Qwen/Qwen3-8B` with `--tp-size 2`, and the server stopped two seconds after NCCL started.

```listing
title: tensor parallelism refuses an unevenly loaded pair
source: capture/gpu/incidents/l4-tp-unbalanced-memory.txt
lang: text
note: The scheduler exception from the server log, with the other lines cut.
---
RuntimeError: The memory capacity is unbalanced. Some GPUs may be occupied by other processes. pre_model_load_memory=18.28375244140625, local_gpu_memory=21.70391845703125, local_gpu_memory * 0.9=19.533526611328124
```

Before it loads weights, each rank measures its free memory, and the group keeps the smallest value. If that value is less than 90 percent of the local free memory, the server stops {{code}}. The second card had 18.28 GB free against the 19.53 GB that the check required. No flag turns the check off at v0.5.22.

The check is right to stop. Each rank of a TP group holds the same share of weights and the same pool. The smallest card sets the size for all of them. On a shared machine, give a TP group whole GPUs. `--dp-size 2` does not have this check, because each copy sizes its own pool, so it started on the same pair.

## Data parallelism on the same pair lost

We expected two copies to serve about twice as much as one. They served less than one. We ran the closed-loop sweep of [section 4.3](#s-quantization) with three seeds per point. Each request had 512 input tokens and 128 output tokens. The first run used one L4, and the second used `--dp-size 2` on both.

```listing
title: two copies, two very different pools
source: capture/gpu/out-l4/server-dp2.log
lang: text
note: Startup lines, and four decode lines logged at 64 running requests on 2026-10-17 at 07:26. Timestamps are cut.
---
… DP0] Load weight end. elapsed=3.61 s, type=Qwen3ForCausalLM, avail mem=6.59 GB, mem usage=15.28 GB.
… DP1] Load weight end. elapsed=3.73 s, type=Qwen3ForCausalLM, avail mem=3.17 GB, mem usage=15.28 GB.
… DP0] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 24094, K size: 1.65 GB, V size: 1.65 GB
… DP1] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 2925, K size: 0.20 GB, V size: 0.20 GB
… DP1] Decode batch, #running-req: 4, #token: 2385, token usage: 0.82, cuda graph: True, gen throughput (token/s): 25.48, #queue-req: 59
… DP0] Decode batch, #running-req: 1, #token: 590, token usage: 0.02, cuda graph: True, gen throughput (token/s): 9.67, #queue-req: 0
… DP1] Decode batch, #running-req: 4, #token: 2545, token usage: 0.87, cuda graph: True, gen throughput (token/s): 25.79, #queue-req: 59
… DP0] Decode batch, #running-req: 3, #token: 1665, token usage: 0.07, cuda graph: True, gen throughput (token/s): 9.49, #queue-req: 0
```

The second card had 3.17 GB free after the weights, against 6.59 GB on the first, because the two pods held the rest. **We measured** a pool of 2,925 tokens on that copy, an eighth of the first. Four requests of 640 tokens fill it.

The controller still sent every second request to that copy, because `round_robin` does not look at pools or queues. The benchmark keeps 64 requests open at a time. At concurrency 64, 63 of them sat on the small copy, 4 running and 59 waiting. The large copy had one to three requests and used 2 to 7 percent of its pool. The client could not send it more work until the small copy gave a slot back.

```figure
id: fig-6-1c
kind: chart
title: Two copies of the model served less than one
claim: One L4 reached 270 tokens per second, and the shared pair with --dp-size 2 peaked at 64 and fell to 42 as its clock fell.
caption: Output throughput against max concurrency, three seeds per point. Plum is one L4 and rose is --dp-size 2 on two L4s with the shared second card. From capture/gpu/summary/l4.json.
```

**We measured** the cost at the tail too. At concurrency 64, the median p99 TTFT of three seeds was 33.4 seconds on one L4 and 391 seconds with two copies. The one-card run was on 2026-10-16 and the pair on 2026-10-17. At 32 and 64 users the pair ran at 765 and 675 MHz, under our clock floor. One card ran at 1,320 and 1,080 MHz, so part of that loss is the clock.

Up to concurrency 4, the two copies were already 16 to 41 percent slower, for a reason we did not isolate. At 1 user the pair took 79.6 ms per token against 60.2 ms, at a higher clock.

The open-loop sweep of [section 5.1](#s-sglang-benchmark-serving) agreed. With requests arriving at a fixed rate, two copies completed at most 0.21 requests per second inside our latency target. One L4 alone completed 0.96.

We then measured one of the two settings that could help. `--load-balance-method total_tokens` sends each request to the copy that holds the fewest tokens.

```listing
title: the same uneven pair, routed by tokens
source: capture/gpu/out-l4/server-dp2-tokens.log
lang: text
note: The two pools at startup. The second card was still shared, so its copy had an eighth of the pool.
---
[2026-10-19 00:24:05 DP0] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 24094, K size: 1.65 GB, V size: 1.65 GB
[2026-10-19 00:24:06 DP1] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 2925, K size: 0.20 GB, V size: 0.20 GB
```

**We measured** a large gain over round robin, and still a loss against one card. The three runs were on 2026-10-19, 2026-10-17, and 2026-10-16.

At 64 users the pair gave 114.7 tok/s routed by tokens, against 41.7 with round robin and 250.9 on one L4. At 8 users it gave 92.1 against 64.2 and 112.6. The median TTFT at 64 users fell from 4,763 to 3,977 ms. The median clock at 64 users was 1,020 MHz, against 675 MHz in the round-robin run. So part of the gain can be the card.

The other setting is two separate servers behind the gateway in [section 6.4](#s-sgl-model-gateway), each with a weight. We did not measure it. We did not measure a pair with equal pools either. On our unequal pair, `--dp-size 2` lost at every load. We expect data parallelism to add capacity only when every copy has about the same pool. Check the `#tokens` line of each `DP` rank before you trust the sum.

```takeaways
- Set --tp-size to the smallest number of GPUs that fits the model and its KV cache.
- Add capacity with --dp-size copies or separate servers only when every copy has about the same pool.
- Use --attn-dp-size equal to --tp-size for MLA mixture-of-experts models only.
- Check the #tokens line of every DP rank before you count on --dp-size.
- Rewrite old recipes from --dp-size N --enable-dp-attention to --attn-dp-size N.
- Recheck your chunked prefill size after you enable attention data parallelism.
- Send requests to node 0 and keep each TP group inside one machine.
```

Sources: python/sglang/srt/distributed/parallel_state.py (initialize_model_parallel), python/sglang/srt/distributed/bootstrap.py (_check_tp_memory_balance), capture/gpu/incidents/l4-tp-unbalanced-memory.txt, capture/gpu/out-l4/server-dp2.log, capture/gpu/summary/l4.json, python/sglang/srt/arg_groups/fields/parallel.py, python/sglang/srt/arg_groups/parallel_hook.py (handle_deprecated_dp_attention, handle_data_parallelism), python/sglang/srt/server_args.py, python/sglang/srt/entrypoints/engine.py, and python/sglang/srt/managers/data_parallel_controller.py, all at v0.5.22. capture/out/metrics.txt. Pull request #41818, issue #19953. LMSYS, "SGLang v0.4", 2024-12-04. Luca Lowndes, "SGLang optimisations", 2025-11-07. Ant Group on the LMSYS blog, 2025-09-26; capture/gpu/out-l4/server-dp2-tokens.log, capture/gpu/summary/l4.json (load.dp2-tokens).
