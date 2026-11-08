# Flags and defaults

> These are the flags this manual changes or explains, with the default the code sets, the value our Mac resolved, and when to change it.

`sglang serve --help` lists 535 options at 0.5.22 ([the captured help output](manuals/sglang-101/capture/out/serve-help.txt)). Most of them never matter to you. The table below holds the main ones this manual uses. The sections name a few more flags where they apply.

Many defaults are `None` in the code. A startup hook replaces them with a value that depends on the GPU, the model, and the free memory. The "On our Mac" column shows that resolved value, from the `server_args` line of [the default server log](manuals/sglang-101/capture/out/server-default.log).

## Memory and admission

| Flag | Default in the code | On our Mac | Change it when | Section |
|---|---|---|---|---|
| `--mem-fraction-static` | `None`, derived from GPU size at startup | `0.4`, set by the kit | the machine runs other programs, or the server crashes on large batches | [3.2](#s-mem-fraction-static-and-startup-sizing) |
| `--max-total-tokens` | `None`, derived from the memory budget | 181,574 tokens in the pool | you want a fixed pool size for a test | [2.3](#s-admission-and-retraction) |
| `--max-running-requests` | `None`, derived from the pool and the context length | 4,096 | you know your concurrency limit, or you turn on speculative decoding | [2.3](#s-admission-and-retraction) |
| `--chunked-prefill-size` | `None`, derived from GPU memory | 4,096 | long prompts stall decode, or prefill is too slow | [2.2](#s-the-scheduler-loop-and-schedule-policy) |
| `--max-prefill-tokens` | 16,384 | 16,384 | rarely | [2.2](#s-the-scheduler-loop-and-schedule-policy) |
| `--schedule-conservativeness` | 1.0 | 1.0 | you see retractions in the log, raise it | [2.3](#s-admission-and-retraction) |
| `--page-size` | `None`, derived per attention backend | 1 | the attention backend needs pages | [3.1](#s-kv-bytes-per-token-and-the-kv-pool) |

## Scheduling

| Flag | Default in the code | On our Mac | Change it when | Section |
|---|---|---|---|---|
| `--schedule-policy` | `fcfs` | `fcfs` | many queued requests share long prefixes, try `lpm` | [2.2](#s-the-scheduler-loop-and-schedule-policy) |
| `--disable-overlap-schedule` | `False` | `False` | only to debug, and never on MLX at 0.5.22, where it crashed | [2.4](#s-the-overlap-scheduler) |
| `--stream-interval` | 1 | 1 | you stream to many clients and want fewer messages | [2.5](#s-streaming-stop-strings-and-the-openai-api) |

## Cache

| Flag | Default in the code | On our Mac | Change it when | Section |
|---|---|---|---|---|
| `--disable-radix-cache` | `False` | `False` | only to measure the cache, as our kit does | [3.3](#s-radixcache) |
| `--radix-eviction-policy` | `lru` | `lru` | a few prefixes are hot and many are cold | [3.5](#s-eviction-policies-and-hicache) |
| `--enable-hierarchical-cache` | off | off | the working set of prefixes is larger than GPU memory | [3.5](#s-eviction-policies-and-hicache) |
| `--kv-cache-dtype` | `auto` | `auto` | you need more context per GPU and can test the quality | [4.3](#s-quantization) |
| `--enable-cache-report` | `False` | `True`, set by the kit | always, so clients see `cached_tokens` | [3.4](#s-prefix-friendly-prompts) |

## Execution

| Flag | Default in the code | On our Mac | Change it when | Section |
|---|---|---|---|---|
| `--attention-backend` | `None`, chosen per GPU and model | `torch_native`, which MLX does not use | you measured a better backend for your model | [4.2](#s-attention-backend) |
| `--grammar-backend` | `None`, which resolves to `xgrammar` | `xgrammar` | a grammar fails to compile | [4.5](#s-structured-outputs-with-xgrammar) |
| `--disable-cuda-graph`, deprecated | `False` | `True`, as the Apple instructions say | on Apple silicon, where CUDA graphs do not exist. Prefer `--cuda-graph-backend-decode disabled` and `--cuda-graph-backend-prefill disabled` | [4.1](#s-forwardmode-and-cuda-graphs) |
| `--speculative-algorithm` | `None` | `None` | decode latency at low concurrency matters most | [4.4](#s-speculative-decoding) |
| `--enable-deterministic-inference` | `False` | `False` | you need the same output for the same input in any batch | [4.6](#s-deterministic-inference-and-logprobs) |

`--disable-cuda-graph` still works at 0.5.22, and the per-phase flags `--cuda-graph-backend-decode` and `--cuda-graph-backend-prefill` replace it.

## Parallelism and operations

| Flag | Default in the code | On our Mac | Change it when | Section |
|---|---|---|---|---|
| `--tp-size` | 1 | 1 | one GPU cannot hold the weights | [6.1](#s-tp-size-dp-size-and-attn-dp-size) |
| `--dp-size` | 1 | 1 | one copy of the model is saturated and you have GPUs for another | [6.1](#s-tp-size-dp-size-and-attn-dp-size) |
| `--attn-dp-size` | 1 | 1 | you serve an MLA model such as DeepSeek on many GPUs | [6.1](#s-tp-size-dp-size-and-attn-dp-size) |
| `--ep-size` | 1 | 1 | you serve a large MoE model | [6.2](#s-moe-serving-deepep-and-eplb) |
| `--enable-metrics` | `False` | `True`, set by the kit | always in production | [5.2](#s-the-metrics-endpoint) |
| `--watchdog-timeout` | 300 s | 300 s | a single forward pass can take longer than five minutes | [7.1](#s-operating-sglang) |

Sources: python/sglang/srt/arg_groups/fields/schedule.py, memory.py, exec_.py, model.py, parallel.py, spec.py, serving.py, observability.py, device.py at v0.5.22; capture/out/serve-help.txt, server-default.log, server-small-pool.log.
