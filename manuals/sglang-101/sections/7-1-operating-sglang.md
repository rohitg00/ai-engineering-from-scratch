# Operating SGLang

> Run SGLang so that a restart costs seconds and drops no request: pin the image, keep the compiled kernels, signal only the main process, and tune in a measured order.

The first production incident with a new serving engine is rarely about tokens per second. A rolling update kills ten requests in the middle of their answers. A new pod takes four minutes to become ready, so the autoscaler starts three more. A liveness probe times out under load and restarts the busiest pod. None of these appear in a benchmark, and all of them cost more than a slow kernel.

When you finish this section, you can choose an image tag and keep startup short. You can connect the health probes to the right endpoints and stop a server without losing work. You can also change settings in the order that this manual measured, and read three production reports for what each one teaches.

## Pin the image you run

The SGLang team publishes images on Docker Hub as `lmsysorg/sglang`. At v0.5.22 the `latest` tag holds the newest stable release, and `latest-runtime` holds a smaller image of the same release {{docs}}. Nightly tags follow `main`. The images contain CUDA 13 only. The docs name `lmsysorg/sglang:v0.5.19-cu129` as the last CUDA 12 tag, so a host with an older driver needs that tag or a driver upgrade.

The documented start command gives the container a large shared memory segment and the host IPC namespace:

```bash
docker run -it --gpus all \
  --shm-size 32g \
  -p 30000:30000 \
  -v "$HF_CACHE_DIR:/root/.cache/huggingface" \
  --ipc=host \
  lmsysorg/sglang:latest bash
```

**Our position:** never deploy `latest`. SGLang tagged v0.5.20, v0.5.21, and v0.5.22 within four weeks, from 2026-09-18 to 2026-10-13, and each release changed defaults that this manual measures. A pinned tag such as `v0.5.22` makes a regression a choice that you made. The tag `latest` makes it something that happened to you on a restart.

## What pip install leaves out

The image exists for a reason that a pip install hides. **We measured** this on a host with two NVIDIA L4 GPUs, Ubuntu 24.04, a driver, and no CUDA toolkit. `pip install sglang==0.5.22` finished with no error. The first `sglang serve` then failed, and so did the next three, each for a new reason:

```listing
title: four starts, four missing pieces
source: capture/gpu/incidents/l4-toolchain-failures.txt
lang: text
note: The first error line of each attempt. Repeated lines and progress bars are cut.
---
=== attempt: out-l4-nopyheaders/server-default.log
<site-packages>/triton/backends/nvidia/driver.c:9:10: fatal error: Python.h: No such file or directory
…
=== attempt: out-l4-nonvcc/server-default.log
[2026-10-16 14:21:19] RuntimeError: Could not find nvcc and default cuda_home='/usr/local/cuda' doesn't exist
…
=== attempt: out-l4-jitmismatch/server-default.log
…
<site-packages>/flashinfer/data/cccl/libcudacxx/include/cuda/std/__cccl/cuda_toolkit.h:41:8: error: #error "CUDA compiler and CUDA toolkit headers are incompatible, please check your include paths"
…
=== attempt: out-l4-nolibcudart/server-default.log
/usr/bin/ld: cannot find -lcudart: No such file or directory
```

All four failures come from one fact. SGLang, Triton, and FlashInfer compile kernels on the target machine at startup, and a compiler needs a complete toolchain.

1. Triton compiles a small C helper against the Python headers. The system Python of Ubuntu has no `Python.h`. We changed to a Python build that includes its headers, from `uv`.
2. SGLang looks for `nvcc` under `/usr/local/cuda`. The pip wheels include `nvcc` 13.4 under `nvidia/cu13` in site-packages, but nothing points to it. We set `CUDA_HOME` to that directory.
3. FlashInfer then compiled its attention kernels with that `nvcc` against its own bundled headers, and the versions did not match. We installed `flashinfer-jit-cache`, which holds kernels compiled in advance for SM 8.9.
4. The JIT kernels of SGLang link with `-lcudart` from `$CUDA_HOME/lib64`. The wheel has only `lib/libcudart.so.13`. We made a `CUDA_HOME` with a `lib64` directory that holds `libcudart.so`.

The fifth start served requests. Our GB10 never had this problem, because its DGX operating system has a full toolkit in `/usr/local/cuda`.

The benchmark client has one more dependency that a firewall exposes. Its `random` dataset takes its text from ShareGPT and downloads that file from the Hugging Face Hub {{code}}. With `HF_HUB_OFFLINE=1`, our first GPU benchmark failed although every model was on disk. We did not keep that log. Use `--dataset-name random-ids` on a machine without network access, or pass a local ShareGPT file with `--dataset-path`.

**Our position:** run SGLang from the pinned image or on a host with a full CUDA toolkit. A pip install on a host with only a driver works after our four repairs. Each SGLang upgrade can need them again.

## Cold start is weights plus compilers

A new SGLang process loads the weights, compiles or loads kernels, sizes the KV pool, and captures graphs. Our capture logs each phase on one line. This run used a model that was already on disk:

```listing
title: startup phases of the default server
source: capture/out/server-default.log
lang: text
note: One line from the startup log. The CUDA graph fields are all 0.00 because the MLX path captures no CUDA graphs.
---
[2026-10-16 13:58:06] Engine startup timings (s): load_weight=0.00, kv_cache_allocation=0.00, scheduler_e2e=7.01, cuda_graph={prefill=0.00, decode=0.00, target_verify=0.00, draft_prefill=0.00, draft_decode=0.00, draft_extend=0.00}, tokenizer_e2e=11.92
```

**We measured** 18 s from the first log line to "The server is fired up and ready to roll!" for a 0.6B model on the Mac. A large model on GPUs is a different problem. **A field report** from Doubleword, an engineer blog dated 2026-04, timed SGLang v0.5.10 with Qwen3.5-122B-A10B-FP8 on 8 B200 GPUs {{field Doubleword 2026-04}}. A cold start took 695 s, and 531 s of that was weight loading. With kernel caches kept between runs, a warm start took 88 s. With a process checkpoint and weights staged in host memory, it took 9.6 s.

The code helps with the cheap part of that work. When Python imports `sglang`, it points the Triton, TorchInductor, CUDA, TileLang, and FlashInfer caches into one directory, `SGLANG_CACHE_DIR`, which defaults to `~/.cache/sglang` {{code}}. Mount that directory and the Hugging Face cache on volumes that survive the pod. Then a restart reuses compiled kernels and downloaded weights.

The same field report defends the slow start. To them, 10 percent more tokens per second is worth more than a start that is 10 seconds faster {{field Doubleword 2026-04}}. We agree for a fleet that runs for days. For a fleet that scales to zero every night, startup time is a real cost, and the persistent caches are the first fix.

## Health checks: /ready, /health, and /health_generate

SGLang has two kinds of health endpoint {{code}}:

- `/ready` returns 200 when the tokenizer manager is ready and 503 before that.
- `/health` and `/health_generate` share one handler. They return 503 while the server starts and while it shuts down.
- Otherwise the handler sends a one-token request with `max_new_tokens` 1 and waits for any output from the detokenizer.
- `SGLANG_ENABLE_HEALTH_ENDPOINT_GENERATION` defaults to true, so a plain `/health` also generates that token.
- The wait is `SGLANG_HEALTH_CHECK_TIMEOUT`, 20 s by default. With no output in that time, the handler marks the server `UnHealthy` and returns 503.

The docstring says that the probe request costs nothing when the server is busy, because any output from the scheduler counts as proof of life. That is true for the work, and false for the timing. **A real incident:** issue #22511 reports "health check failed. server could not get a response from detokenizer for last 20 seconds" on GLM-5 with 2 H800 GPUs under high load, on v0.5.10 {{issue #22511}}. A related issue, #35884, found that a timed-out probe left its request in the scheduler, so failed probes accumulated {{issue #35884}}.

**Our position:** use `/ready` for the readiness probe. Keep the liveness probe from generating. Set `SGLANG_ENABLE_HEALTH_ENDPOINT_GENERATION=false`, and `/health` then returns 200 without a request to the scheduler {{code}}. Use `/health_generate` for a slower deep check that alerts a person and restarts nothing. A busy server then does not lose its busiest pod to a probe that waited in the queue.

## Graceful shutdown: signal the main process only

On SIGTERM, the HTTP server sets `gracefully_exit`, and `/health` starts to return 503. A watchdog in the tokenizer manager checks the flag every 5 s {{code}}. It then logs the remaining requests every 5 s until none remain. Then it sends `ShutdownReq` to the schedulers and gives them 15 s to exit before it kills them. [Figure 7.1](#fig-7-1) shows this path and the two paths that skip the drain.

```figure
id: fig-7-1
kind: state
title: three ways an SGLang server stops
claim: Only a SIGTERM to the main process drains running requests, and a forced exit or a signal to the process group stops work in progress.
caption: Read left to right along the top for the graceful path, then down for the two other paths. The numbers match the key. From capture/out/shutdown-exploratory.log, capture/out/server-default.log, and the shutdown code at v0.5.22.
```

**We measured** both cases on the Mac. Our capture kit stopped each server by sending SIGTERM to its whole process group. The scheduler child received the signal too and died first:

```listing
title: SIGTERM to the process group
source: capture/out/server-default.log
lang: text
note: Four consecutive lines from the end of the default run.
---
[2026-10-16 14:01:45] SIGTERM received. signum=None frame=None. Draining requests and shutting down...
[2026-10-16 14:01:45] Subprocess scheduler_0 (pid=5909) crashed with exit code -15. Triggering SIGQUIT for cleanup...
[2026-10-16 14:01:45] SIGQUIT received. signum=None, frame=None. It usually means one child failed.
[2026-10-16 14:01:46] Sleeping 5 seconds before crash diagnostics to let GPU activity settle.
```

The parent saw a crashed child, took the crash path, and killed the process tree. No request was running at that moment, so nothing was lost. Under load, every running request would have failed. We then started a server, sent it a request for 3,000 output tokens, and sent SIGTERM to the main process only:

```listing
title: SIGTERM to the main process, with one request running
source: capture/out/shutdown-exploratory.log
lang: text
note: Lines cut from the log of a separate run. Decode batch lines between them are cut.
---
[2026-10-16 14:13:54] SIGTERM received. signum=None frame=None. Draining requests and shutting down...
…
[2026-10-16 14:13:55] INFO:     127.0.0.1:53237 - "GET /health HTTP/1.1" 503 Service Unavailable
…
[2026-10-16 14:13:57] Gracefully exiting... Remaining number of requests 1. Remaining requests remaining_rids=['ef12359aaaaf40d78fedb4e7f7aaed25'].
…
[2026-10-16 14:14:04] INFO:     127.0.0.1:53209 - "POST /generate HTTP/1.1" 200 OK
[2026-10-16 14:14:07] Gracefully exiting... Remaining number of requests 0. Remaining requests remaining_rids=[].
…
[2026-10-16 14:14:07] INFO:     Finished server process [53853]
```

```listing
title: what the client saw
source: capture/out/shutdown-exploratory.txt
lang: text
note: The whole output of the probe script.
---
health before SIGTERM: 200
sent SIGTERM to the server process only
health during drain: 503
in-flight request: {"status": 200, "completion_tokens": 3000, "finish_reason": {"type": "length", "length": 3000}, "seconds": 14.2}
server exit code: 0
```

The request finished with all 3,000 tokens, and `/health` returned 503 during the drain. The server exited with code 0, thirteen seconds after the signal. `docker stop` and Kubernetes send SIGTERM to the main process of the container. That is the correct target when `sglang serve` is the main process, so start it with `exec` or as the entrypoint. The interactive command above makes `bash` the main process, and `bash` does not pass the signal on. A wrapper script that forwards the signal to a process group, or a supervisor that kills the group, gives you the first log instead.

The code has two exits that skip the drain. If the server is already `UnHealthy`, the watchdog exits at once. It also exits at once if the environment variable `SGL_FORCE_SHUTDOWN` is true. At v0.5.22 the watchdog reads that old name directly {{code}}.

The environment module declares the new name `SGLANG_FORCE_SHUTDOWN`. Its compatibility code copies `SGL_` variables to `SGLANG_` names, never the other way. **The code shows** that setting only `SGLANG_FORCE_SHUTDOWN` does not reach the watchdog. We read this in the code and did not run it, so we call it a likely bug. If you need a forced stop, set `SGL_FORCE_SHUTDOWN=1`.

**Our position:** set the termination grace period longer than your longest request at your output cap. A 32K-token answer at 30 tokens per second needs more than 18 minutes. Cap `max_tokens` before you set the grace period, or a drain can never finish in time.

## Before you trust a measurement

Three checks prevent most of the false results that we found on our own machines:

1. Flush the prefix cache before each run that you compare, and record the cached tokens, as in [section 5.1](#s-sglang-benchmark-serving). In our kit, a warm cache made a run at a higher load look faster. In a later test with `Qwen/Qwen3-0.6B` at a cap of 16, a repeat with no flush read a median TTFT about 4.8 times lower.
2. Record the SM clock and the temperature with every run, as in [section 5.1](#s-sglang-benchmark-serving). A hot L4 reported up to 28 percent less throughput.
3. On a shared GB10, run SGLang in a container with a memory limit, and log free memory during startup, as in [section 3.2](#s-mem-fraction-static-and-startup-sizing).

When a greedy output changes between two runs, check the cache first. A request that finds its prompt in the cache runs a different prefill path, as [section 4.6](#s-deterministic-inference-and-logprobs) shows. One request at a time, a warm cache changed 21 of 32 of our greedy outputs, and a flush brought exact repeats back. These two tests ran on a shared L4 GPU with no clock lock, so trust the ratio and the counts, not the times.

## The server aborts or hangs under heavy eviction

**Symptom:** in the middle of a multi-turn load, the server stops with `CUDA error: an illegal memory access was encountered`. Or the log stops with no error while the GPU stays at 100 percent.

We saw this on SGLang 0.5.22 with `Qwen/Qwen3-0.6B`, a pool of 8,192 tokens, and the trace of [section 3.5](#s-eviction-policies-and-hicache). From the fourth turn, the pool evicted prefixes on almost every step. CUDA graphs and the overlap scheduler were on, which is the default. The runs were on the second GPU of our L4 node on 2026-10-23, which its owner shares and which had no clock lock.

```listing
title: aborts and hangs by variant, same server and trace
source: capture/gpu/out-l4/small-pool-crash.txt
lang: text
note: The tally from the summary. A hang is a log with no new line for 5 minutes, or a run longer than 15 minutes.
---
variant                                          runs   aborts   hangs   clean
lru, CUDA graph and overlap on (default)         6      1        3       2
lru, CUDA_LAUNCH_BLOCKING=1                      3      0        0       3
lru, --disable-cuda-graph                        4      0        0       4
lru, --enable-hierarchical-cache                 3      1        0       2
lru, HiCache, CUDA_LAUNCH_BLOCKING=1             2      0        0       2
```

With the defaults, 4 of 6 runs failed. HiCache did not prevent it, and 1 of its 3 runs aborted. The abort and every hang stopped in the same place: the scheduler waited for the copy of a decode result to finish. With CUDA graphs off, 0 of 4 runs failed. With `CUDA_LAUNCH_BLOCKING=1`, 0 of 3 failed.

We did not find the kernel that faults, because the fault did not occur with blocking launches. Nothing was filed upstream.

**Workaround:** add `--disable-cuda-graph`. On our L4 with an 8B model, graphs saved about 1 percent of each decode step, as [section 4.1](#s-forwardmode-and-cuda-graphs) shows. A small model spends a larger share of each step on launches, so measure the cost on your model. `CUDA_LAUNCH_BLOCKING=1` also hid the fault, but it makes every kernel launch wait for the one before it. Use it to debug, never to serve.

**Also test:** a larger pool. With a pool of 16,384 tokens or more, the same trace stopped thrashing, as section 3.5 shows. We did not count crashes at the larger pools, so this is not a proven fix.

## The order to change settings

Most tuning advice lists flags. The order matters more than the list, because each step changes what the next step measures. [Figure 7.1b](#fig-7-1b) shows the order this manual uses, and each row links to the section that measures it.

```figure
id: fig-7-1b
kind: flow
title: the order to change SGLang settings
claim: Measure first, then fix memory, prompts, and concurrency, and only then touch kernels, parallelism, and disaggregation.
caption: Read top to bottom. Each row is one setting or action, with the measurement that justifies it and the section that shows that measurement.
```

1. Measure with `sglang.benchmark.serving` at three concurrency levels, as in [section 5.1](#s-sglang-benchmark-serving). Without a baseline, no later change has a number.
2. Set `--mem-fraction-static` for the machine you share, as in [section 3.2](#s-mem-fraction-static-and-startup-sizing). On our Mac the automatic value crashed the server at concurrency 32.
3. Put shared text first in every prompt, as in [section 3.4](#s-prefix-friendly-prompts). One request id at the start of a system prompt cost us about 14 times the time to first token.
4. Cap `--max-running-requests` at the knee you measured. Past the knee on our L4, throughput fell while time to first token grew. Our GB10 kept rising to 64 users, and we did not measure a cap itself.
5. Only now change CUDA graph settings and `--attention-backend`, one change per run, as in [section 4.1](#s-forwardmode-and-cuda-graphs) and [section 4.2](#s-attention-backend). At v0.5.22 `--disable-cuda-graph` is deprecated in favour of `--cuda-graph-backend-decode` and `--cuda-graph-backend-prefill`.
6. Add tensor, data, or attention-data parallelism when one replica is saturated, as in [section 6.1](#s-tp-size-dp-size-and-attn-dp-size).
7. Split prefill from decode last, and only after you measured that prefill delays decode, as in [section 6.3](#s-prefill-decode-disaggregation).

## What production teams report

Three reports by teams outside SGLang show where operating effort goes.

**LinkedIn**, an independent engineering blog dated 2026-02-20, serves ranking models of 375M to 0.6B parameters on H100 GPUs {{field LinkedIn 2026-02}}. The workload needs only prefill and the logits of the last token. Their bottlenecks were the tokenizer, ZMQ messages, Python garbage collection, the GIL, and the scheduler, and none of them were GPU kernels.

Batch tokenization took P99 latency from 4,583 ms to 464 ms. A scoring path that skips decode took P99 from 6,220 ms to 454 ms. Garbage collection pauses of 100 to 300 ms went away with a warm-up and `gc.freeze()`. The 375M ranker went from 750 to 2,200 items per second per GPU. LinkedIn wrote most of the pull requests involved, so their "before" is an older SGLang.

**CERIT-SC**, a Czech academic service, moved from vLLM to SGLang in 2025 and reported 100 billion tokens served by 2026-04 {{field CERIT-SC 2026-04}}. Their traffic shape is the lesson. For Kimi K2.6 the median prompt was 2,179 tokens and the 95th percentile was 99,746 tokens, which they attribute to agentic coding tools. Their SGLang problems were tool calls that leaked into reasoning output, rare hangs, and model loops that held KV cache. Their fix was operational: an output cap of 32K tokens and a presence penalty for workloads that loop. They still run both engines, chosen per model.

**Ant Group** published a DeepSeek-R1 deployment on H20 GPUs with SGLang v0.5.2 on the LMSYS blog, dated 2025-09-26 {{field Ant Group 2025-09}}. They chose expert parallelism of 16 over 32 because at batch 32 EP16 gave 675 tokens per second against 585 for EP32. More speculative draft tokens gained 21% at batch 1 and lost about 18% at batch 32. They sell three latency tiers, and the strictest tier, below 30 ms TPOT, runs at batch 12. The measured tier table is a product decision, which is the point.

**Our position:** read a production report for its traffic shape and its order of fixes, never for its throughput number. LinkedIn fixed CPU work before GPU work. CERIT-SC capped output before it tuned anything. Ant Group chose the smaller expert group because the fault radius and the batch size it sells mattered more than peak throughput.

```takeaways
- Pin an image tag such as `lmsysorg/sglang:v0.5.22` and upgrade on purpose.
- Run outside the image only on a host with a full CUDA toolkit.
- Mount `~/.cache/sglang` and the Hugging Face cache on persistent volumes.
- Probe readiness with `/ready`, and liveness with `/health` with generation turned off.
- Send SIGTERM to the main process only, and check the log for the drain lines.
- Set `SGL_FORCE_SHUTDOWN` for a forced stop at v0.5.22, never only `SGLANG_FORCE_SHUTDOWN`.
- Cap output length before you choose the termination grace period.
- Change settings in the order of figure 7.1b, one change per measured run.
- Flush the prefix cache and record the clock before every run that you compare.
- On an illegal memory access under heavy eviction, grow the pool or add --disable-cuda-graph.
```

Sources: python/sglang/srt/entrypoints/http_server.py (ready, health_generate, HEALTH_CHECK_TIMEOUT), python/sglang/srt/managers/tokenizer_manager.py (sigterm_watchdog, _SCHEDULER_EXIT_TIMEOUT_SECS), python/sglang/srt/environ.py (SGLANG_FORCE_SHUTDOWN, SGLANG_ENABLE_HEALTH_ENDPOINT_GENERATION, SGLANG_CACHE_DIR, redirect_third_party_caches, _handle_deprecated_envs) and python/sglang/__init__.py at v0.5.22; docs/docs/get-started/install.mdx at v0.5.22; capture/out/server-default.log, capture/out/server-default.command.txt, capture/out/shutdown-exploratory.log, capture/out/shutdown-exploratory.txt, capture/shutdown_probe.py, capture/gpu/incidents/l4-toolchain-failures.txt; python/sglang/benchmark/datasets/random.py at v0.5.22; issues #22511 and #35884; field reports: Doubleword, fergusfinn.com/blog/fast-sglang-starts (2026-04-06), LinkedIn Engineering, linkedin.com/blog/engineering/ai/scaling-llm-based-ranking-systems-with-sglang-at-linkedin (2026-02-20), CERIT-SC, blog.cerit.io/blog/run-llm2 (2025-10-19) and blog-dev.cerit.io/blog/llm3 (2026-04-27), Ant Group on the LMSYS blog, lmsys.org/blog/2025-09-26-sglang-ant-group (2025-09-26), capture/gpu/out-l4/os-release.txt, sections 3.2, 4.6, and 5.1 of this manual (the cache, clock, and memory checks), capture/gpu/out-l4/prefix-cache-flush.txt, capture/gpu/out-l4/greedy-output-cache-batch-dtype.txt, capture/gpu/out-l4/small-pool-crash.txt, capture/gpu/out-l4/eviction-multiturn.txt, section 4.1 of this manual (the cost of CUDA graphs on the L4).
