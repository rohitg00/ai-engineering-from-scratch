# Size memory on a DGX Spark

> On unified memory the GPU and the operating system share one pool, so read free memory from the system, not only from the GPU.

You run vLLM on a DGX Spark or another machine where the CPU and the GPU share memory. When you finish this section, you can pick a memory fraction that leaves room for the operating system. You also know why the first start takes minutes.

**Our result:** with a fraction of 0.75, the weights took 56.93 GiB and the KV cache 31.32 GiB of the 121.69 GiB of memory.

## Know what "GPU memory" means here

The GB10 in a DGX Spark has no separate GPU memory. The CPU and the GPU use the same LPDDR5x memory, which NVIDIA sells as 128 GB. On our machine, the startup log reported 121.69 GiB in total. The operating system, the page cache, and every other program use the same memory.

vLLM 0.31.0 knows this. On an integrated GPU it reads free memory from the operating system. The GPU driver reports too little free memory on these machines. It also releases its cached GPU memory when the whole system is more than 80 percent full. So `--gpu-memory-utilization` is a share of the whole machine, not of a separate card.

## Do not trust the fraction as a hard limit

The fraction sets the share that vLLM plans for. On unified memory it does not always limit what vLLM takes. Reports from other users show two cases. We did not see them in our run:

- Issue 46307 reports a GB10 at a fraction of 0.70. It used about 112 GiB during the startup profile, against a share of about 83 GiB. The machine stopped responding. The issue was closed as stale with no fix.
- Issue 44740 reports a negative estimate of the CUDA graph memory with MTP speculation on the GB10. The KV cache grew too large, and the start ran out of memory. The issue is open.

In our run, the numbers matched the share of 0.75. That is one run, with no speculation.

To give the cache a fixed size, set it in bytes with `--kv-cache-memory-bytes`, as [the out-of-memory page](#s-fix-out-of-memory-at-startup) explains. Check that the weights, the cache, and a few GiB for the profile leave room for the operating system.

## Pick the fraction

Add the weights, the KV cache you want, and a few GiB for the startup profile and the CUDA graphs. Divide the sum by the total memory. Leave room for the operating system and the page cache, which use the same memory.

Our run with `Qwen/Qwen3-30B-A3B-Instruct-2507` in BF16 used a fraction of 0.75:

| Part | Size |
|---|---|
| The share for vLLM, 0.75 of 121.69 GiB | 91.3 GiB |
| The weights | 56.93 GiB |
| Free for the KV cache | 31.32 GiB |
| The rest, for the profile and the graphs | about 3 GiB |

At 96 KiB per token, the 31.32 GiB holds about 342,000 tokens. That is enough for more than 500 users with 640 tokens each. Our sweeps used a smaller [fixed pool](#s-count-the-memory-before-you-pick-a-gpu). The fraction left about 30 GiB for the operating system and every other program.

We ran one fraction only. A sweep of the fraction against the KV pool and the swap activity is planned and not run yet.

```figure
id: fig-2-3
kind: layers
title: one pool on a DGX Spark
claim: With a fraction of 0.75, vLLM takes 91.3 of the 121.7 GiB that the CPU and the GPU share on a DGX Spark.
caption: The bar is the whole memory, drawn to scale. The blue rule marks the share of vLLM. From capture/gpu/out-gb10/server-load-vllm.log.
```

## Expect a slow first start

The first start took more than five minutes. The log shows where the time went:

```listing
title: the weight load on a GB10
source: capture/gpu/out-gb10/server-load-vllm.log
lang: text
note: 330 seconds to load 56.93 GiB of weights.
---
(EngineCore pid=143) INFO 10-21 10:58:45 [model_runner.py:407] Model loading took 56.93 GiB memory and 330.542793 seconds
```

The load copies each tensor from the memory-mapped safetensors file into the GPU allocation, one tensor at a time. On the GB10, a copy from a file-backed page is slow. An open vLLM issue measured about 1.7 ms for each tensor copied from the file view. A copy in host memory first took about 0.2 ms.

Release 0.31.0 made a different part of the load faster. An indexed lookup of expert names saves about 25 s on a DGX Spark. The cost of each tensor copy stays.

Two things help:

- Keep the weights on the local NVMe drive, not on a network mount.
- Start the server once and keep it running. A restart pays the full load again.

## Check the fraction

After the start, read the two memory lines and the system memory:

```bash
grep -E "Model loading took|Available KV cache memory|GPU KV cache size" server.log
free -g
```

If `free -g` shows almost no available memory while the server is idle, lower the fraction by 0.05 and start again. If the KV cache line is larger than your share allows, set the cache size in bytes instead.

```takeaways
- On unified memory, the memory fraction is a share of the whole machine.
- Leave room for the operating system and the page cache, and check it with `free -g`.
- Expect minutes for the first weight load, and keep the server running.
```

Sources: the vLLM source at v0.31.0 (vllm/utils/mem_utils.py, vllm/platforms/cuda.py), the v0.31.0 release notes (weight loading on DGX Spark), vLLM issue 58726 (slow weight loading on GB10), vLLM pull request 58720 (indexed expert lookups in the weight load), capture/gpu/out-gb10/server-load-vllm.log, capture/gpu/summary/gb10.json, vLLM issue 44740 (negative CUDA graph memory estimate with MTP speculation on the GB10), vLLM issue 46307 (memory use above the share during the startup profile on the GB10), vLLM documentation at v0.31.0 (--kv-cache-memory-bytes).
