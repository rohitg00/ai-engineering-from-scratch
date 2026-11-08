# Fix out of memory at startup

> One setting, the GPU memory fraction, decides most startup failures, and a shorter maximum length or a lower concurrency cap fixes most of the rest.

The server stopped before it printed the KV cache size line. When you finish this section, you can read the reason from the last lines of the log and pick the one flag that fixes it.

## Know what vLLM claims at startup

vLLM does four things before it serves a request:

1. It loads the weights.
2. It runs one profile pass with a full batch to measure the activation memory.
3. It captures CUDA graphs.
4. It gives the KV cache the rest of its share of the GPU.

The share is `--gpu-memory-utilization`. The default is 0.92, so vLLM claims 92 percent of the total GPU memory for itself. The number is a limit for one vLLM instance. It is not a fraction of the memory that is free when the server starts. On unified memory, such as a DGX Spark, it is not always a hard limit, as [the DGX Spark page](#s-size-memory-on-a-dgx-spark) explains.

## Find your failure in the log

Read the last 30 lines of the server log. Most startup failures match one of three cases.

| What the log says | Cause | Fix |
|---|---|---|
| The KV cache needed for one request at the maximum length is larger than the available KV cache memory | The weights and the profile leave too little for one full-length request | Lower `--max-model-len`. The error gives the largest length that fits. |
| The free memory on the device is less than the desired GPU memory utilization | Another process holds GPU memory | Lower `--gpu-memory-utilization` below the free share, or stop the other process |
| CUDA out of memory during the profile run or the graph capture | The batch in the profile pass or the graphs need more memory than is left | Lower `--max-num-seqs` or `--max-num-batched-tokens`, or lower `--max-cudagraph-capture-size` |

```figure
id: fig-2-2
kind: decision
title: where a start fails
claim: The last line before the start fails tells you which of three settings to change.
caption: Read down each column: where the log stops, the cause, and the flag to change. From the vLLM source at v0.31.0 and our runs on the L4.
```

## Fix a shared GPU

On a shared GPU, set the fraction yourself. We ran vLLM 0.31.0 on an L4 that another team also used. Their processes held part of the memory, so we set `--gpu-memory-utilization 0.83` and a pool of 2,928 tokens.

The first start still failed, because we also set the maximum length to 2,928 tokens. One request at that length needed slightly more KV cache than was free, and the error said that 2,912 tokens would fit:

```listing
title: the maximum length error on the shared L4 GPU
source: capture/gpu/incidents/l4-gpu1-vllm-maxlen-oom.txt
lang: text
note: The first line gives the settings. The second line gives the error and the length that fits. Our capture cut the second line at 420 characters. In vLLM 0.31.0, the rest of the message tells you to raise the memory fraction or to lower the maximum length.
---
(APIServer pid=3681321) INFO 10-22 00:35:04 [api_utils.py:286] non-default args: {'model_tag': 'Qwen/Qwen3-8B', 'host': '127.0.0.1', 'port': 30100, 'model': 'Qwen/Qwen3-8B', 'max_model_len': 2928, 'gpu_memory_utilization': 0.83, 'num_gpu_blocks_override': 183}
(EngineCore pid=3682071) ERROR 10-22 00:36:18 [core.py:1433] ValueError: To serve at least one request with the model's max seq len (2928), (0.4 GiB KV cache is needed, which is larger than the available KV cache memory (0.4 GiB). Based on the available memory, the estimated maximum model length is 2912. Try increasing `gpu_memory_utilization` (which also controls CPU memory on the CPU backend) or decreasing `max_mod
```

We set `--max-model-len 2048`, which is enough for our 640-token requests, and the server started. Later we raised it to 2,304 tokens, so that our tests with 2,048-token prefixes fit.

So on a shared GPU, the fraction and the maximum length work together. Lower the maximum length to the longest request you send before you lower the fraction.

## Set the KV cache size directly

If you know the KV cache size you want, set it in bytes with `--kv-cache-memory-bytes`. vLLM then ignores `--gpu-memory-utilization` for the cache. Use this when two vLLM instances share one GPU and each one needs a known pool.

`--num-gpu-blocks-override` sets the number of 16-token blocks for a test, as in [our fixed pool](#s-count-the-memory-before-you-pick-a-gpu). Do not use it in production, because it does not check that the memory exists.

## Check the fix

Start the server again with `tee server.log`, as in [the first start](#s-install-vllm-and-serve-your-first-model), and wait for the pool line:

```bash
grep "GPU KV cache size" server.log
```

If the line is there, the server has a pool. Compare its size with [your count](#s-count-the-memory-before-you-pick-a-gpu).

```takeaways
- Read the last 30 lines of the log, and match the failure to one of three cases.
- On a shared GPU, lower the maximum model length before you lower the memory fraction.
- Use the exact KV memory flag when two instances share one GPU.
```

Sources: capture/gpu/incidents/l4-gpu1-vllm-maxlen-oom.txt, vLLM documentation at v0.31.0 (docs/configuration/optimization.md), the vLLM source at v0.31.0 (vllm/config/cache.py, vllm/config/scheduler.py), our L4 run on the shared GPU on 2026-10-22.
