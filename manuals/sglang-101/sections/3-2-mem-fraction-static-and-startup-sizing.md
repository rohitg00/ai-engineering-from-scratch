# --mem-fraction-static and startup sizing

> SGLang sizes the KV pool once at startup from a snapshot of free memory, so a machine that changes after startup can kill the whole server.

Our first SGLang server on the capture Mac ran for four minutes. Then a benchmark at 32 concurrent requests crashed it with a Metal out-of-memory error, and every process of the server exited. The KV pool at that moment was 95 percent empty. The memory had gone to the pool, and the next prefill had nowhere to run.

When you finish this section, you can read how SGLang divides memory at startup and predict when that division fails. You can also set `--mem-fraction-static` on purpose.

## The crash we recorded

We started the server twice before the capture kit existed, with the same command and no `--mem-fraction-static`. The two startups sized the pool very differently.

```listing
title: two startups, two pool sizes
source: capture/out/oom-exploratory.log
lang: text
note: Lines from two exploratory runs on the same Mac, before the capture kit. The comment lines are ours.
---
# run 1 startup
[2026-10-16 13:30:31] Auto-sized attention KV pool: sys_available=27.81 GB, mlx_limit=51.8 GB, mlx_used=0.31 GB, kv_budget=24.25 GB, bytes_per_slot=114688, pool_size=227022
# run 2 startup
'mem_fraction_static': 0.872
[2026-10-16 13:38:58] Auto-sized attention KV pool: sys_available=38.29 GB, mlx_limit=51.8 GB, mlx_used=0.31 GB, kv_budget=33.39 GB, bytes_per_slot=114688, pool_size=312581
```

Nothing changed in SGLang between the runs. Other programs on the Mac used less memory at the second start, so `sys_available` grew from 27.81 GB to 38.29 GB. The pool grew with it, from 24.25 GB to 33.39 GB. Both budgets are 87.2 percent of the free memory, because the automatic `mem_fraction_static` resolved to 0.872.

```listing
title: the crash at concurrency 32
source: capture/out/oom-exploratory.log
lang: text
note: Lines from run 2. The traceback above the RuntimeError line is cut.
---
[2026-10-16 13:42:53] Decode batch, #running-req: 32, #token: 16095, token usage: 0.05, cuda graph: False, gen throughput (token/s): 564.55, #queue-req: 0
[2026-10-16 13:42:55] Prefill batch, #new-seq: 1, #new-token: 511, #cached-token: 0, token usage: 0.00, #running-req: 0, #queue-req: 9, #pending-token: 0, cuda graph: False, input throughput (token/s): 66.85
RuntimeError: [METAL] Command buffer execution failed: Insufficient Memory (00000008:kIOGPUCommandBufferCallbackErrorOutOfMemory).

[2026-10-16 13:42:57] SIGQUIT received. signum=None, frame=None. It usually means one child failed.
…
[2026-10-16 13:43:02] kill_process_tree called: parent_pid=81559, include_parent=True, pid=81559
```

Read `token usage: 0.05` first. Thirty-two requests held 16,095 tokens, which is 5 percent of a 312,581-token pool. The pool reserved 34 GB and used under 2 GB of it. The activations of the next forward pass needed memory outside the pool, and the operating system had none left. One failed command buffer took down the scheduler, and the server killed its whole process tree.

```figure
id: fig-3-2
kind: comparison
title: the same Mac, two memory splits
claim: A pool sized at 87 percent of free memory left too little for activations, and a fraction of 0.4 kept the server alive.
caption: Read each bar left to right. The green part is the KV pool, and the grey part is everything else. From capture/out/oom-exploratory.log and capture/out/server-default.log.
```

## How SGLang decides the split

**--mem-fraction-static:** the share of memory that SGLang gives to the model weights plus the KV pool. Everything outside that share is for activations, CUDA graphs, and other programs. The flag defaults to `None`, and SGLang computes a value at startup {{code}}.

On a GPU, the automatic value comes from a reserve. SGLang starts with 512 MB and adds 1.5 MB for each token of the prefill chunk {{code}}. Then it adds more for tensor and pipeline parallelism and for CUDA graphs. On a GPU with more than 60 GB, the reserve is at least 10 GiB. The fraction is then the GPU memory minus the reserve, divided by the GPU memory. When SGLang cannot read the device capacity, it uses 0.95.

After the weights load, SGLang measures free memory again. The KV budget is the free memory minus the `1 - fraction` share of the memory that was free before loading {{code}}. The pool holds that budget divided by the bytes per token from [section 3.1](#s-kv-bytes-per-token-and-the-kv-pool). If the budget is not positive, startup stops and prints the smallest fraction that would work.

The MLX backend on Apple silicon uses a simpler rule {{code}}. It takes the smaller of two numbers. The first is the fraction of the Metal working set, minus memory already in use. The second is the fraction of system memory available right now. The second term is the snapshot that changed between our two runs.

One public tuning write-up describes the fraction the other way round, as weights plus buffers, with the KV cache in the remainder. The code says the opposite: the static share holds the weights and the KV pool.

## The default assumes the machine belongs to SGLang

The automatic rule is reasonable on a dedicated GPU. Nothing else allocates memory there, and the reserve covers the activations of one prefill chunk and the CUDA graphs. The rule fails in three common cases.

- **A shared machine.** A laptop, a workstation, or a node with other jobs. The snapshot at startup does not hold for the life of the server.
- **Unknown capacity.** On a device where SGLang cannot read the memory size, the fraction becomes 0.95 and leaves 5 percent for activations. Issue #39675 reports exactly that failure on Apple MPS, an out-of-memory error on the first prefill {{issue #39675}}.
- **Extra memory the estimate does not know about.** Issue #42510 shows draft-model copies that stay in memory while the target pool is sized, so the draft pool allocation fails {{issue #42510}}. Issue #6027 shows a 64K-token DeepSeek-V3 prompt that ran out of memory in attention, although the log reported room for 274,934 KV tokens {{issue #6027}}.

## Unified memory on a GB10

**We measured** the same rule on an NVIDIA GB10, the chip of a DGX Spark. Its CPU and GPU share 121.7 GiB of memory. There is no separate GPU memory, and that changes what each number in the startup log means.

```listing
title: one GB10 startup, from capacity to pool
source: capture/gpu/out-gb10/server-default.log
lang: text
note: Lines cut from the startup of the default GPU configuration, Qwen3-30B-A3B in BF16 with a fraction of 0.7.
---
[2026-10-17 14:12:57] Failed to get GPU memory capacity from nvidia-smi. Falling back to torch.cuda.mem_get_info(). Reported total GPU memory per device (MiB): [124610], using min: 124610 MiB.
…
[2026-10-17 14:13:05] Load weight begin. avail mem=112.59 GB
…
[2026-10-17 14:18:29] Load weight end. elapsed=323.61 s, type=Qwen3MoeForCausalLM, avail mem=54.84 GB, mem usage=57.75 GB.
[2026-10-17 14:18:32] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 227243, K size: 10.40 GB, V size: 10.40 GB
[2026-10-17 14:18:32] Memory pool end. avail mem=31.22 GB
```

The first line is the capacity. `nvidia-smi` reports no memory size for the GB10, so SGLang takes the total from PyTorch.

The second line is free memory, and here the code is careful. On a device that shares system memory, `torch.cuda.mem_get_info()` counts the file cache of the kernel as used. In our first recording, on a day with a large file cache, our kit read 67.7 GiB free that way. SGLang checks whether the device is integrated, and then it reads the available memory of the operating system instead {{code}}. That number counts cache that the kernel can free, and it read 113.55 GB at the same start. After a reboot, the two numbers agreed: 112.1 GiB from PyTorch and 112.59 GB from SGLang.

The cost of that choice is that the pool size moves with the rest of the machine. Six BF16 starts used the same command and the same weights:

| Configuration | Available before weights | Weights, as SGLang measured them | KV pool, tokens |
|---|---|---|---|
| default | 112.59 GB | 57.75 GB | 227,243 |
| no CUDA graph | 113.21 GB | 54.78 GB | 258,017 |
| deterministic | 113.44 GB | 57.90 GB | 234,517 |
| no radix cache | 113.17 GB | 57.34 GB | 236,315 |
| no overlap | 113.37 GB | 57.92 GB | 233,822 |
| EAGLE-3, with a draft model | 113.45 GB | 57.49 GB | 216,775 |

The weights did not change, yet their measured size went from 54.78 GB to 57.92 GB. SGLang measures them as the drop in available memory, and the kernel cache changed during each load. Among the five starts without a draft model, the pool differs by 14 percent. A day earlier, the same six starts put the outlier on the no-overlap server, with 261,113 tokens. The outlier moved, so the cause is the machine, not the flag. On unified memory, a pool size from one start is an estimate for the next start, not a constant.

## A pool that other programs see

On a GB10, the KV pool is tens of GB, and SGLang allocates it in a few seconds. Every other program on the machine sees that memory go. Our GB10 also ran a memory guard daemon for its other users. It stops the process that grows fastest when free memory gets low. It stopped our scheduler three times, each time just after the weights loaded:

```listing
title: the memory guard stops the scheduler
source: capture/gpu/incidents/gb10-memory-guard-pauses.txt
lang: text
note: The first two lines of the guard log for our runs on the GB10.
---
2026-10-16T12:53:16+00:00 2026/10/16 12:53:16 guardian level: Critical: 34.2 GiB left before the freeze zone.
2026-10-16T12:53:16+00:00 2026/10/16 12:53:16 guardian pause: Paused sglang::schedul (pid 2983880, rohit): it grew 36.7 GiB in 5s with 34.2 GiB left. Resume or stop it from the app.
```

SGLang logged no error. From the server side, startup stopped after `Load weight end` and never reached the health check. The guard was correct by its own rule: the scheduler was the fastest-growing process. Seconds later the guard logged "Back to normal", because the pool was complete. We agreed with the owner of the machine to stop the guard for the time of our runs.

The NVIDIA driver also reports memory errors at startup. The kernel log of the GB10 holds bursts of this line:

```listing
title: the driver line at server startup
source: capture/gpu/incidents/gb10-driver-no-memory.txt
lang: text
note: The last line of the file. The lines above it count the bursts per minute.
---
NVRM: nvCheckOkFailedNoLog: Check failed: Out of memory [NV_ERR_NO_MEMORY] (0x00000051) returned from _memdescAllocInternal(pMemDesc) @ mem_desc.c:1359
```

Six bursts match a `KV Cache is allocated` line of the kit to the minute. They are at 14:36, 14:55, 15:04, 15:30, 15:47, and 15:58. Every one of those servers became healthy and finished its benchmarks. The start with a 4,096-token pool logged no burst. The other bursts came from our test and sweep servers.

**Our position:** on unified memory, the KV pool is memory that the whole machine gives up. Pass `--mem-fraction-static` on purpose, and tell the other users of the machine before you start. Do not alert on the driver line alone. Alert when a server does not become healthy.

## Our position: set the fraction yourself on any shared machine

On a machine that runs anything besides SGLang, pass `--mem-fraction-static` yourself. The capture kit uses 0.4 on the Mac. With that value, the same benchmark that crashed run 2 finished all 128 requests at concurrency 32.

```listing
title: the kit's server, with an explicit fraction
source: capture/out/server-default.log
lang: text
note: One startup line from the default kit configuration.
---
[2026-10-16 13:58:03] Auto-sized attention KV pool: sys_available=48.49 GB, mlx_limit=51.8 GB, mlx_used=0.31 GB, kv_budget=19.39 GB, bytes_per_slot=114688, pool_size=181574
```

The budget is now 19.39 GB, which is 0.4 of the 48.49 GB snapshot. The pool still holds 181,574 tokens, far more than 32 requests of 640 tokens need. A smaller pool cost nothing in this workload, because the workload never filled the pool.

We tested the other direction on the GB10. The load sweep of [section 5.1](#s-sglang-benchmark-serving) ran twice, at the kit's fraction of 0.7 and at 0.82, three seeds per point.

```listing
title: a larger pool on the GB10, at its fullest
source: capture/gpu/out-gb10/server-load-default-kv-max.log
lang: text
note: The pool at a fraction of 0.82, and the decode line with the highest token usage in the whole sweep.
---
[2026-10-17 16:35:26] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 383065, K size: 17.54 GB, V size: 17.54 GB
[2026-10-17 16:47:45] Decode batch, #running-req: 64, #token: 40751, token usage: 0.11, cuda graph: True, gen throughput (token/s): 263.88, #queue-req: 0
```

**We measured** a BF16 pool of 383,065 tokens against 234,600, 63 percent more. The FP8 pool grew from 1,084,458 to 1,378,545 tokens. The throughput did not move. At 64 users, BF16 gave 238.72 against 235.38 tok/s, and FP8 gave 442.71 against 440.86. At every concurrency, the two medians were within 2 percent of each other.

```figure
id: fig-3-2c
kind: chart
title: A larger pool bought nothing when the pool was never full
claim: Raising the fraction from 0.7 to 0.82 on the GB10 grew the BF16 pool by 63 percent and changed closed-loop throughput by less than 2 percent.
caption: Output throughput against max concurrency, three seeds per point. Solid lines are 0.7 and dashed lines are 0.82. Plum is BF16 and green is FP8 with an FP8 KV cache. From capture/gpu/summary/gb10.json.
```

The log line explains it. Sixty-four requests held 40,751 tokens, 11 percent of the pool. At 0.7 the highest token usage was 17 percent. The pool was never the limit, so a larger pool had nothing to do. Compare the L4 in [section 4.3](#s-quantization), where the BF16 pool was full at 64 users and FP8 nearly tripled the throughput.

The open-loop sweep of [section 5.1](#s-sglang-benchmark-serving) gave the other half of the answer. At 16 requests per second, more than the GB10 serves, requests kept arriving while earlier ones still ran. There the larger pool did matter.

```listing
title: the pool at 0.7 under an open-loop overload
source: capture/gpu/out-gb10/server-rate-default-full.log
lang: text
note: One decode line at 16 offered requests per second, at a fraction of 0.7.
---
[2026-10-16 19:08:23] Decode batch, #running-req: 374, #token: 227530, token usage: 0.96, cuda graph: False, gen throughput (token/s): 866.37, #queue-req: 101
```

```listing
title: the pool at 0.82 under the same overload
source: capture/gpu/out-gb10/server-rate-default-kv-max.log
lang: text
note: The decode line with the highest token usage at 16 offered requests per second, at a fraction of 0.82.
---
[2026-10-17 18:00:45] Decode batch, #running-req: 480, #token: 289721, token usage: 0.75, cuda graph: False, gen throughput (token/s): 994.20, #queue-req: 0
```

At 0.7 the pool was 96 percent full, and 101 requests waited outside it. At 0.82 all 480 requests of the run fit at once. **We measured** 5.19 completed requests per second against 3.88, 34 percent more, and 664 against 497 output tok/s, three seeds each. The two runs were a day apart, so part of the gap can be the machine. The log lines show the mechanism, and the size of the gain belongs to this run. FP8 had a pool of over a million tokens at both fractions, and its rate did not change: 8.29 against 8.26.

So the extra 13.6 GB bought nothing at 64 users and a third more throughput in an overload. Size the pool from your token usage at peak load, including the burst that arrives faster than you serve. On a machine that the GB10 shares with other programs, memory you do not need is memory another program cannot use.

On a dedicated GPU, trust the automatic value first. Raise the fraction in steps of 0.02 only when the scheduler log shows a full pool and retractions. Find the upper limit in staging with your longest prompts, then run production one or two steps below it. Lower it when long prompts fail in attention, as in issue #6027.

The fraction also changes comparisons. One independent benchmark ran SGLang with its automatic fraction and vLLM with its default of 0.9 of GPU memory {{field Rawlinson 2025-12}}. The two engines had KV pools of very different sizes. Read [section 5.3](#s-reading-other-peoples-benchmarks) before you trust a comparison that does not state both values.

## What to measure

- The `max_total_num_tokens` line at startup. It is the result of the whole calculation.
- `token usage` in decode lines. A value near 1.0 means the pool is full.
- The free memory of the machine during the heaviest prefill, from the operating system.

One more caution for Apple silicon. The `kv_cache_memory_usage_gb` metric read 0.0 in our capture, because the MLX backend allocates its own pool outside the accounting that the metric reads. Use the `MlxAttentionKVPool` log line, which reported about 19,860 MB.

```takeaways
- Size the KV pool from token usage at peak load, bursts included, not from free memory.
- Pass --mem-fraction-static yourself on any machine that runs other programs.
- Read kv_budget and max_total_num_tokens in the startup log after every change.
- Raise the fraction in small steps only when the pool is full and requests retract.
- Lower the fraction when long prompts fail with out-of-memory errors in attention.
- Compare engines only when both report their KV pool sizes.
- On a GB10, read the pool size in each startup log, because it changes between starts.
```

Sources: python/sglang/srt/arg_groups/memory_hook.py (handle_gpu_memory_settings), python/sglang/srt/mem_cache/kv_cache_configurator.py (_profile_available_bytes), python/sglang/srt/hardware_backend/mlx/model_runner.py (_compute_pool_size), python/sglang/srt/arg_groups/fields/schedule.py (mem_fraction_static) at v0.5.22, capture/out/oom-exploratory.log, capture/out/server-default.log, capture/out/metrics.txt, python/sglang/srt/utils/common.py (get_available_gpu_memory) at v0.5.22, capture/gpu/out-gb10/server-*.log, capture/gpu/out-gb10/environment.json, capture/gpu/incidents/gb10-memory-guard-pauses.txt, capture/gpu/incidents/gb10-driver-no-memory.txt, issues #39675, #42510, and #6027, the Rawlinson benchmark of 2025-12-05. capture/gpu/out-gb10/server-load-default-kv-max.log, capture/gpu/summary/gb10.json. capture/gpu/out-gb10/server-rate-default-full.log, capture/gpu/out-gb10/server-rate-default-kv-max.log.
