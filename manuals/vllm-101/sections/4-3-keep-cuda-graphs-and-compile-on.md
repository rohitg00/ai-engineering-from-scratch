# Keep CUDA graphs and compile on

> The default compile level is the right one for most servers, and eager mode costs a few percent of decode speed.

Startup takes minutes and you want it faster. When you finish this section, you can decide what each compile level and eager mode cost.

**Our result:** on our L4, eager mode cost about 2 percent of the time per token in a cooled run. In a throttled run, `-O0` cost about 2 percent for one user, and `-O3` matched the default.

## Know the switches

vLLM sets compile and CUDA graphs with one level, from `-O0` to `-O3`. The default is `-O2`. [The compile page](#s-how-compile-and-cuda-graphs-are-captured) explains what each part does.

| Setting | Compile | CUDA graphs | Use it for |
|---|---|---|---|
| `-O2`, the default | on | full and piecewise | production |
| `-O3` | the same as `-O2` in 0.31.0 | | nothing extra yet |
| `-O1` | on, with fewer fusions | piecewise only | a faster start that keeps compile and graphs on, not measured by us |
| `-O0` | off | off | a fast start when you test a change |
| `--enforce-eager` | off | off | debugging a kernel, because it also skips the kernel warmup |

## Read what the start costs

The startup log gives the time of each part. On our DGX Spark, with `Qwen3-30B-A3B`, the two graph captures and the compile took about 96 seconds of a start of about eight minutes:

```listing
title: graph capture and compile time at startup
source: capture/gpu/out-gb10/server-load-vllm.log
lang: text
note: The first two lines are the two capture passes. The last line gives the whole engine start and the compile share.
---
(EngineCore pid=143) INFO 10-21 10:59:45 [model_runner.py:1087] Graph capturing finished in 39 secs, took 1.17 GiB
(EngineCore pid=143) INFO 10-21 11:00:51 [model_runner.py:1087] Graph capturing finished in 38 secs, took 0.31 GiB
(EngineCore pid=143) INFO 10-21 11:00:53 [core.py:373] init engine (profile, create kv cache, warmup model) took 127.54 s (compilation: 18.67 s)
```

On that start, loading the weights took about 330 seconds, much more than the compile. A later start can read the compile cache, so the compile share gets smaller.

## See what our runs show

**We measured** eager mode against the default on the L4 with `Qwen/Qwen3-8B` on 2026-10-21, in [the full-clock session](#l4-sessions). Both runs used the same pool, seven concurrencies, and three seeds, with the GPU cooled before each run.

```figure
id: fig-4-3
kind: chart
title: eager mode against the default
claim: On our L4, eager mode was 1.2 to 2.3 percent slower per token at every concurrency.
caption: Bands span the lowest and highest of three runs. The two lines sit close because an 8B decode step waits on memory, not on kernel launches. From capture/gpu/summary/l4.json.
```

| Users, L4 full-clock session | Median TPOT, default / eager | Median SM clock, default / eager |
|---|---|---|
| 1 | 60.36 / 61.07 ms | 1,275 / 1,290 MHz |
| 8 | 65.75 / 66.98 ms | 1,485 / 1,515 MHz |
| 32 | 101.79 / 103.11 ms | 1,275 / 1,313 MHz |
| 64 | 129.15 / 131.42 ms | 1,005 / 1,020 MHz |

The seed ranges did not overlap from 1 to 32 users, so the gap is real, and it is small. On our DGX Spark, eager mode cost 2 to 6 percent of the time per token.

We then ran the compile levels on 2026-10-22, in [the throttled session](#l4-sessions), at 1 and 32 users. The default had three seeds and the other two levels had two. The GPU was throttled for all three: the median clock was 210 MHz at one user and 450 to 548 MHz at 32 users.

| Users, L4 throttled session | Median TPOT, default / `-O0` / `-O3` |
|---|---|
| 1 | 104.14 / 106.48 / 104.15 ms |
| 32 | 142.67 / 142.04 / 143.85 ms |

At one user, `-O0` was 2.2 percent slower, and the seed ranges did not overlap. At 32 users, the three levels overlapped. `-O3` matched the default, as the code says it should at this version. Because of the low clock, read these as a comparison inside one session, not as speeds you will see.

## Decide

Keep the default for production. The graphs and the compile cost about one and a half minutes on our DGX Spark start, and the cache makes later starts faster.

When you test a change and restart often, use `-O0`. It skips the compile and the graph capture, and it cost us about 2 percent of decode speed. Use `--enforce-eager` only to debug a kernel, because it also skips the warmup, so the first requests after a start are slow.

```takeaways
- Leave the default compile level on for production.
- Use -O0, not eager mode, when you only want a faster start.
- Expect -O3 to equal the default in vLLM 0.31.0.
```

Sources: capture/gpu/summary/l4.json (load.vllm-b, load.vllm-eager, load.vllm-fast-b, load.vllm-O0, load.vllm-O3), capture/gpu/summary/gb10.json (load.vllm, load.vllm-eager), capture/gpu/out-gb10/server-load-vllm.log, vLLM documentation at v0.31.0 (docs/design/optimization_levels.md), the vLLM source at v0.31.0 (vllm/config/model.py).
