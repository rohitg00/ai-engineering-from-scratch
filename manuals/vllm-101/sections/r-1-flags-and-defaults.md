# Flags and defaults

> This page lists the flags the manual uses, grouped by user job, with the default at 0.31.0.

Use this page to look up a flag that a section names.

Defaults are for `vllm serve` at 0.31.0 on a CUDA GPU, read from the configuration classes in the source.

## Server

| Flag | Default | What it sets | Page |
|---|---|---|---|
| `--host` | not set, so every network interface | the address the server listens on | [server options](#s-set-the-server-options-every-deployment-needs) |
| `--port` | 8000 | the HTTP port | [server options](#s-set-the-server-options-every-deployment-needs) |
| `--served-model-name` | the model name | the name that clients send in `model` | [server options](#s-set-the-server-options-every-deployment-needs) |
| `--api-key` | not set | the key that the `/v1` routes require | [server options](#s-set-the-server-options-every-deployment-needs) |
| `--chat-template` | the template of the model | the chat template, as a file or as text | [server options](#s-set-the-server-options-every-deployment-needs) |
| `--default-chat-template-kwargs` | not set | template values for every request | [reasoning models](#s-serve-reasoning-models) |
| `--reasoning-parser` | not set | the parser that moves thinking out of the answer | [reasoning models](#s-serve-reasoning-models) |
| `--enable-log-requests` | off | one log line for each request | [server options](#s-set-the-server-options-every-deployment-needs) |

## Memory and length

| Flag | Default | What it sets | Page |
|---|---|---|---|
| `--gpu-memory-utilization` | 0.92 | the share of total GPU memory for one instance | [startup](#s-fix-out-of-memory-at-startup) |
| `--kv-cache-memory-bytes` | not set | the KV cache size in bytes, which overrides the share for the cache | [startup](#s-fix-out-of-memory-at-startup) |
| `--max-model-len` | the model config | the longest prompt plus answer for one request | [long contexts](#s-serve-long-contexts-and-hybrid-models) |
| `--block-size` | 16 | tokens in one KV block, or the attention backend's preference | [block pool](#s-how-the-block-pool-manages-kv-memory) |
| `--kv-cache-dtype` | `auto` | the data type of the KV cache, such as `fp8` | [attention backend](#s-how-vllm-picks-an-attention-backend) |
| `--num-gpu-blocks-override` | not set | a fixed number of KV blocks, for tests | [startup](#s-fix-out-of-memory-at-startup) |

## Scheduling

| Flag | Default | What it sets | Page |
|---|---|---|---|
| `--max-num-batched-tokens` | 2048 for `vllm serve` on a GPU under 70 GiB or an A100, 8192 from 70 GiB, 16384 from 160 GiB | the token budget for one step | [token budget](#s-why-one-token-budget-replaces-a-prefill-phase) |
| `--max-num-seqs` | 256 on a GPU under 70 GiB or an A100, 1024 from 70 GiB | the most requests that run at once | [token budget](#s-why-one-token-budget-replaces-a-prefill-phase) |
| `--enable-chunked-prefill` | on | splitting a long prompt across steps | [token budget](#s-why-one-token-budget-replaces-a-prefill-phase) |
| `--async-scheduling` | on for most generate models | planning the next step while the GPU runs | [Model Runner V2](#s-what-model-runner-v2-changed) |
| `--scheduling-policy` | `fcfs` | first come first served, or `priority` | [token budget](#s-why-one-token-budget-replaces-a-prefill-phase) |
| `--long-prefill-token-threshold` | not set | a cap on the tokens of one prefill in one step | [token budget](#s-why-one-token-budget-replaces-a-prefill-phase) |

## Cache

| Flag | Default | What it sets | Page |
|---|---|---|---|
| `--enable-prefix-caching` | on | reuse of cached prefix blocks | [block pool](#s-how-the-block-pool-manages-kv-memory) |
| `--prefix-caching-hash-algo` | `sha256` | the hash of each block | [block pool](#s-how-the-block-pool-manages-kv-memory) |
| `--disable-hybrid-kv-cache-manager` | off | one group for every layer kind | [long contexts](#s-serve-long-contexts-and-hybrid-models) |
| `--kv-transfer-config` | not set | a KV connector and its role | [KV connectors](#s-how-kv-connectors-move-the-cache) |

## Execution

| Flag | Default | What it sets | Page |
|---|---|---|---|
| `-O0` to `-O3` | `-O2` | the compile and CUDA graph level | [compile and graphs](#s-how-compile-and-cuda-graphs-are-captured) |
| `--enforce-eager` | off | no compile, no CUDA graphs, and no kernel warmup | [compile and graphs](#s-how-compile-and-cuda-graphs-are-captured) |
| `--max-cudagraph-capture-size` | set by the level | the largest batch with a captured graph | [compile and graphs](#s-how-compile-and-cuda-graphs-are-captured) |
| `--attention-backend` | chosen from a list | the attention kernel, by enum name | [attention backend](#s-how-vllm-picks-an-attention-backend) |
| `--speculative-config` | not set | the speculation method and its options, as JSON | [speculative decoding](#s-how-speculative-decoding-checks-drafts) |

## Parallelism

| Flag | Default | What it sets |
|---|---|---|
| `--tensor-parallel-size`, `-tp` | 1 | GPUs that split each layer |
| `--pipeline-parallel-size`, `-pp` | 1 | GPUs that split the layers into stages |
| `--data-parallel-size`, `-dp` | 1 | full copies of the model |
| `--enable-expert-parallel` | off | experts spread across GPUs for mixture-of-experts models |

## Environment variables

| Variable | Default | What it sets |
|---|---|---|
| `VLLM_ENABLE_V1_MULTIPROCESSING` | `1` | the engine core in its own process |
| `VLLM_USE_V2_MODEL_RUNNER` | not set | a pinned choice of model runner |
| `VLLM_BATCH_INVARIANT` | `0` | the batch-invariant mode, when set to `1` |
| `VLLM_API_KEY` | not set | the API key, as `--api-key` sets it |
| `VLLM_LOGGING_LEVEL` | `INFO` | the vLLM log level |
| `VLLM_NO_USAGE_STATS` | `0` | no usage statistics, when set to `1` |

Sources: the vLLM source at v0.31.0 (vllm/config/cache.py, vllm/config/scheduler.py, vllm/config/compilation.py, vllm/config/model.py, vllm/config/parallel.py, vllm/engine/arg_utils.py, vllm/envs.py, vllm/entrypoints/launchers/cli_args.py, vllm/config/structured_outputs.py).
