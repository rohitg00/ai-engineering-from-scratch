# ForwardMode and CUDA graphs

> A decode step is too small to keep a GPU busy, so SGLang records its kernel launches once as a CUDA graph and replays the record on every step.

You serve a small model to one user on an H100 and watch tokens arrive. The GPU is fast, yet a profiler shows gaps between kernels. A field report from Hazy Research {{field Hazy Research 2025-09}} measured that SGLang and vLLM used about half of the H100 memory bandwidth for Llama-1B at batch 1. The GPU waits for the CPU to tell it what to do next.

When you finish this section, you can name the mode of any forward pass and explain what a CUDA graph saves. You can also read the batch sizes SGLang captures and keep busy decode inside a graph.

## Every forward pass has a mode

**ForwardMode:** the label on a batch that tells the model runner what kind of pass to run. The scheduler sets it, and the model runner, the attention backend, and the graph runners all read it.

| Mode | What the pass does |
|---|---|
| `EXTEND` | Prefill. It writes KV entries for many new tokens. Part of the prompt can already be in the cache. |
| `DECODE` | One new token for each running request. |
| `MIXED` | A chunk of prefill and the decode tokens in one batch. Off unless you pass `--enable-mixed-chunk`. |
| `IDLE` | No tokens. A data-parallel attention rank with no work runs it so that collective calls still match. |
| `TARGET_VERIFY` | Speculative decoding: the target model scores the draft tokens. |
| `DRAFT_EXTEND_V2` | Speculative decoding: the draft model reads the accepted tokens. |
| `PREBUILT` | A decode worker in prefill-decode disaggregation. The KV cache arrived from another server. |
| `SPLIT_PREFILL` | A prefill that runs a few layers at a time, for prefill-decode multiplexing. |

SGLang calls any pass that writes many KV entries per request "extend". That is why `TARGET_VERIFY` counts as extend in the code. The target model runs over several draft positions per request, like a small prefill with a tree mask.

## The cost: one decode step is a long list of small launches

A transformer layer is a sequence of kernels: a norm, the QKV projection, attention, the output projection, a second norm, and the MLP. A 28-layer model launches hundreds of kernels to produce one token. During prefill each kernel works on thousands of tokens, so launch time is small next to compute time. During decode each kernel works on one token per request.

At batch 1 the GPU often finishes a kernel before the Python process has sent the next one. The obvious fix is a faster launch path, such as fewer Python calls. That helps a little, but each kernel still needs its own CPU launch, and the count does not change.

**CUDA graph:** a record of kernel launches with fixed tensor shapes and addresses, which the GPU can replay with one CPU call.

```figure
id: fig-4-1
kind: comparison
title: one decode step, launched and replayed
claim: In eager mode the CPU launches each kernel of every layer, and in graph mode one replay call runs the whole recorded decode step.
caption: Read each column top to bottom. Kernel names are the ops of one Llama-style layer. The right column runs only when the batch fits a captured size. From the v0.5.22 decode CUDA graph runner.
```

The record has a price. Every captured shape uses GPU memory, and a batch must match a captured shape exactly. SGLang pays that price for decode and pads each batch up to the next captured size.

## What SGLang captures, and when it gives up

**Capture bucket:** one batch size that SGLang records a decode graph for at startup. Without speculative decoding, v0.5.22 captures sizes 1, 2, 4, 8, and 12, then every eighth size from 16 to 256. Above 256 it captures every sixteenth size to 511, then every thirty-second size up to the largest. A batch of 13 requests replays the graph for 16 and wastes three slots.

The largest bucket, `max_bs`, depends on GPU memory and tensor parallel size. The startup code picks it when you do not set `--cuda-graph-max-bs-decode`.

| GPU memory | Example GPUs | Decode `max_bs` at TP below 4 | At TP 4 or more | `chunked_prefill_size` |
|---|---|---|---|---|
| under 20 GB | T4, RTX 4080 | 8 | 8 | 2048 |
| 20 to 35 GB | A10, RTX 4090, RTX 5090 | 48 | 160 | 4096 |
| 35 to 60 GB | A100 40 GB, L40 | 32 | 160 | 4096 |
| 60 to 90 GB | H100, A100 80 GB | 256 | 512 | 8192 |
| 90 to 160 GB | H200 | 256 | 512 | 8192 |
| 160 GB and more | B200, MI300X | 512 | 512 | 16384 |

When a decode batch is larger than `max_bs`, the graph runner cannot replay. The step runs eager, with one launch per kernel. Nothing fails and no warning appears. The scheduler log line for that batch says `cuda graph: False`, and latency per token rises.

```figure
id: fig-4-2
kind: decision
title: which decode batches replay a graph
claim: A decode batch replays the next captured graph when it fits under max_bs, and runs eager with one launch per kernel when it does not.
caption: Read left to right. The bucket list is the v0.5.22 default without speculative decoding on an 80 GB GPU at TP 1. A batch of 300 runs eager.
```

The code does not change your shapes for prefill the same way. Since PR #29458 (2026-07-01), CUDA builds use a breakable graph for prefill. **Breakable graph:** a capture that ends a segment at each op marked to run eager, runs that op eagerly, and starts the next segment. A model with one op that a graph cannot hold still gets graphs for every other op. On other platforms prefill graphs are off, and our Mac capture logs both facts.

```listing
title: graph status in the startup log and the first batches
source: capture/out/server-default.log
lang: text
note: Two lines from the default server log. Timestamps and the end of the batch line are cut.
---
… Disable prefill CUDA graph because cuda_graph_config resolved prefill.backend='disabled' (e.g. via --cuda-graph-backend-prefill=disabled or auto-disable rules).
… Prefill batch, #new-seq: 1, #new-token: 6, #cached-token: 0, token usage: 0.00, #running-req: 0, #queue-req: 0, #pending-token: 0, cuda graph: False, …
```

Every scheduler batch line ends with `cuda graph:`. On a CUDA server, watch that field on your decode batches.

The older torch.compile path for prefill graphs is being removed in PRs #42285 to #42287. A blog post that says "piecewise CUDA graphs use torch.compile" describes that older path.

## The cliff in field reports

A field report from Jarvislabs {{field Jarvislabs 2026-05}} ran Qwen2.5-7B on one H100 with default SGLang flags. At concurrency 300, mean inter-token latency was 17.72 ms against 12.28 ms for vLLM. With no concurrency cap it was 100.92 ms against 28.84 ms. The post does not record the SGLang version or the server logs.

Our reading is a hypothesis, labeled as one. The default decode `max_bs` on that GPU is 256, and the latency break sits just above it. The maintainers saw the same shape on smaller cards. The code comment on the 20 to 35 GB tier explains why. The old cap made every decode batch of 32 or more run eager, and throughput at high concurrency fell far behind vLLM {{code}}. PR #37898 raised that cap from 24 to 48 on 2026-09-04.

## What we measured on a GB10

The cost above assumes a fast GPU and a small model. We tested a different case: `Qwen/Qwen3-30B-A3B-Instruct-2507`, a mixture-of-experts model, on one NVIDIA GB10. The GB10 has one memory for the CPU and the GPU, with less bandwidth than the HBM of a data-center GPU.

**We measured** two servers with three seeds at each concurrency from 1 to 64. The default server replayed a decode graph on every decode batch, and its log says `cuda graph: True`. The server with both graph backends set to `disabled` logged `cuda graph: False`. The results were almost the same:

| Concurrency | Median TPOT with graphs | Median TPOT without | Output tok/s with graphs | Output tok/s without |
|---|---|---|---|---|
| 1 | 32.52 ms | 33.09 ms | 29.14 | 28.72 |
| 8 | 102.21 ms | 104.77 ms | 74.11 | 73.46 |
| 64 | 254.06 ms | 253.77 ms | 235.38 | 235.79 |

The two lines lie on top of each other in [figure 5.1c](#fig-5-1c). The graphs still cost startup time and memory. The decode capture took 4.61 s and 1.73 GB, and the prefill capture took 35.06 s and 2.14 GB.

Our reading of this result: one decode step of this model takes about 32 ms at batch 1. The launch time that a graph removes is small next to that step. Each step reads the weights of the experts that its tokens chose, and memory bandwidth sets the time.

## What we measured on an L4

Our first sweep on an L4, with the dense `Qwen/Qwen3-8B`, was wrong. The card ran at 87 C with a thermal slowdown, at an SM clock of 360 MHz out of 2,040. A throttled GPU is slow on every step, so the launch saving disappears in the noise. We removed those numbers. Record GPU clocks and temperature with every benchmark, as [section 5.1](#s-sglang-benchmark-serving) shows.

We then ran the same pair on a cooled L4. Every run of the same-day pair started at 72 C or below. A run with a median SM clock under 1,000 MHz was repeated, up to three times. The first pair ran on two days, 2026-10-16 and 2026-10-18. We ran both servers again on 2026-10-21, one after the other, with the same pool of 24,094 tokens. The table shows the same-day pair.

```listing
title: the same batch, with and without a graph
source: capture/gpu/out-l4/server-load-graphs-on-off.log
lang: text
note: One decode line from each server of the first pair, on two days, at 33 running requests. The first replayed a graph, the second ran eager.
---
[2026-10-16 20:32:22] Decode batch, #running-req: 33, #token: 19597, token usage: 0.81, cuda graph: True, gen throughput (token/s): 319.70, #queue-req: 0
[2026-10-18 18:01:00] Decode batch, #running-req: 33, #token: 20422, token usage: 0.85, cuda graph: False, gen throughput (token/s): 350.78, #queue-req: 0
```

| Concurrency | Median TPOT with graphs / without | Output tok/s with / without | P99 ITL with / without |
|---|---|---|---|
| 1 | 60.15 / 60.64 ms | 13.93 / 14.67 | 104 / 104 ms |
| 8 | 66.01 / 66.60 ms | 112.60 / 111.67 | 70 / 68 ms |
| 16 | 70.08 / 70.59 ms | 201.21 / 200.16 | 80 / 73 ms |
| 32 | 95.65 / 94.12 ms | 270.61 / 270.81 | 103 / 87 ms |
| 64, see the note below | 103.39 / 103.12 ms | 264.10 / 265.30 | 109 / 90 ms |

The L4 servers captured decode graphs only up to 48 running requests. At 64 users, batches above 48 ran eager on both servers, so the last row does not measure graphs.

**We measured** a small difference on the L4 as well. Up to 16 users, the graphs saved 0.5 to 0.7 ms of a 60 to 70 ms step, about 1 percent. Throughput was within 1.2 percent from 2 users up, and 5 percent apart at 1 user.

At 16 and 32 users, the server without graphs had the lower P99 ITL, with no seed overlap. It was 73 against 80 ms, and 87 against 103 ms. Both servers replayed graphs at those batch sizes. We do not have a mechanism for the gap yet, so we report it and do not explain it.

The GB10 gave no such gap on the same day. Its P99 ITL with and without graphs stayed within 7 percent at every concurrency, and the median TPOT within 2 percent.

Our reading: a step of an 8B model at batch 1 reads about 16 GB of weights from memory. The launch time that a graph removes is small next to that read.

The [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?graphs=off&users=1) machine shows one decode step on the L4 as a weight read and the work after it. This link opens the run without graphs at one user. Launch commands cross PCIe for every kernel, and in our first pair the step grew by 0.47 ms to 60.63 ms.

## Our position

Keep CUDA graphs on, and size them to your traffic. The default `max_bs` suits moderate concurrency. If your benchmark or your production peak runs more requests than that, set `--cuda-graph-max-bs-decode` and `--max-running-requests` to your target before you measure. SemiAnalysis InferenceX recipes {{field InferenceX 2026-05}} derive both values from the concurrency they test.

Do not expect graphs to make a slow decode fast on every machine. On the GB10, one decode step of a mixture-of-experts model takes tens of milliseconds, and graphs changed it by 3 percent or less. On the L4, with a dense 8B model, they saved about 1 percent. The worst token gap was shorter without them at 16 and 32 users. Measure the median and the tail, with and without graphs, before you blame the launch path.

Do not turn graphs off to fix memory. If capture runs out of memory, lower `--cuda-graph-max-bs-decode` or `--mem-fraction-static`. A server without decode graphs pays launch time on every token for every user.

Two flag names changed in v0.5.22, and old recipes break on them. `--disable-cuda-graph` still works, and the help text marks it as deprecated.

```listing
title: the deprecated graph flag in sglang serve --help
source: capture/out/serve-help.txt
lang: text
note: Two lines from the deprecated flags at the end of the help text.
---
  --disable-cuda-graph  Deprecated. Use --cuda-graph-
                        backend-{decode,prefill}=disabled instead.
```
 The flag `--cuda-graph-max-bs` no longer exists. We passed it to the v0.5.22 argument parser and it exited with `ambiguous option: --cuda-graph-max-bs could match --cuda-graph-max-bs-decode, --cuda-graph-max-bs-prefill`.

## Incidents

**Capture runs out of memory with data-parallel attention.** Issue #23769 (2026-04-26): DeepSeek-V4-Pro-FP8 on two nodes of eight H200 exited during graph capture. With data-parallel attention, the graph batch size counts per rank, so the captured graphs were larger than the traffic needed. The fix was a smaller graph batch size or a lower `--mem-fraction-static`.

**A renamed field broke the Python API.** Issue #36478 (2026-08-26): `sgl.Engine(..., disable_piecewise_cuda_graph=True)` raised `TypeError`, while the command-line flag still worked. PR #23906 folded the field into the per-phase graph config and kept only the command-line alias. The fix is `cuda_graph_backend_prefill="disabled"`.

**A new GPU needed eager mode.** A field report from joshua8.ai {{field joshua8 2026-01}} ran SGLang on an RTX PRO 6000 Blackwell (SM120). It needed `--disable-cuda-graph` to run at all. On new architectures, check that capture works before you compare engines.

```takeaways
- Read the scheduler log field cuda graph for every decode batch you care about.
- Set --cuda-graph-max-bs-decode and --max-running-requests to your peak concurrency before benchmarking.
- Fix capture memory with a smaller graph batch size, and keep graphs on.
- Measure decode with and without graphs on your GPU and model before you tune them.
- Replace --cuda-graph-max-bs and --disable-cuda-graph in old recipes with the v0.5.22 per-phase flags.
```

Sources: capture/out/server-default.log, capture/out/serve-help.txt, capture/gpu/out-gb10/server-default.log, capture/gpu/out-gb10/server-no-cuda-graph.log, capture/gpu/summary/gb10.json, capture/gpu/incidents/l4-thermal-throttle.txt, capture/gpu/out-l4/server-load-graphs-on-off.log, capture/gpu/summary/l4.json (load.default, load.no-cuda-graph, load.graphs-on-b, load.graphs-off-b), python/sglang/srt/model_executor/forward_batch_info.py (ForwardMode), model_executor/model_runner.py (_forward_raw), model_executor/cuda_graph_config.py (default_prefill_backend), model_executor/runner/decode_cuda_graph_runner.py (can_run_graph), arg_groups/memory_hook.py (_handle_gpu_memory_settings), arg_groups/cuda_graph_hook.py (generate_decode_cuda_graph_batch_sizes), and server_args.py (deprecated flags) at v0.5.22; the argument parser of the installed v0.5.22 package; PRs #23906, #29458, #37898, #42285; issues #23769 and #36478; field reports by Hazy Research (2025-09-28), Jarvislabs (2026-05-18), joshua8.ai (2026-01-10), and SemiAnalysis InferenceX (2026-05-26), capture/gpu/out-l4/graphs-sameday-starts.log, capture/gpu/out-gb10/cuda-graph-max-bs-ambiguous.txt
