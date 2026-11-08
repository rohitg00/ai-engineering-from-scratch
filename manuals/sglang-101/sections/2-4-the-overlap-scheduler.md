# The overlap scheduler

> The overlap scheduler prepares batch N+1 on the CPU while the GPU runs batch N, and at v0.5.22 it is the default path.

Profile a simple serving loop and you find gaps on the GPU timeline between decode steps. In each gap the GPU waits while Python reads the sampled tokens, checks stop strings, frees memory, and builds the next batch. A decode step on a small model takes a few milliseconds, so a gap of one millisecond is a large share of the step.

When you finish this section, you can explain how SGLang hides the CPU work between steps and say when the overlap is off. You can decide whether `--disable-overlap-schedule` belongs in your command.

## The cost: CPU time between GPU steps

**Overlap scheduling:** running the CPU work for one batch at the same time as the GPU work of another batch.

The SGLang team described the problem in the v0.4 release post. Batch scheduling, memory allocation, and prefix matching leave the GPU idle between steps {{team 2024-12}}. Their answer is a scheduler that runs one batch ahead and prepares all the metadata for the next batch. They report a 1.1x throughput gain from it {{team 2024-12}}. That number is their claim, measured on their GPUs.

The obvious fix is a second thread that builds batches while the first one runs the GPU. Python threads share one interpreter, so a scheduler thread and a forward thread take turns. SGLang tried a thread first. Since pull request #11210 in October 2025 it uses two CUDA streams in one thread instead {{code}}.

## How it works on CUDA

The loop launches batch N+1 on the GPU first, and then processes the results of batch N on the CPU {{code}}. The GPU never waits for the bookkeeping of the step before.

There is a problem. Batch N+1 needs the tokens that batch N sampled, and those tokens are still on the GPU when N+1 is built. SGLang builds N+1 with placeholder token ids. A `FutureMap` fills in the placeholders on the GPU from the output of N. The CPU never needs to read the tokens before the launch {{code}}.

```figure
id: fig-2-4
kind: timeline
title: the same three decode steps without and with overlap
claim: Without overlap the GPU waits for CPU bookkeeping after every step, and with overlap the CPU processes step N while the GPU already runs step N+1.
caption: Read left to right in time. Plum bars are GPU forward passes, blue bars are CPU work, grey hatched bars are idle GPU. The shape is schematic, the loop order is from event_loop_overlap at v0.5.22.
```

## How it works on a Mac

The MLX backend has its own overlap loop, `event_loop_overlap_mlx` {{code}}. MLX evaluates lazily, so the loop keeps two decode graphs queued with `mx.async_eval`. The docstring says that the GPU runs the next step right after the current one, with no scheduling gap on the device. The chain breaks when a prefill arrives, a request finishes, or the waiting queue has new work. Then the loop builds a fresh step.

The scheduler is the same Python scheduler on CUDA and on MLX. The batching, the radix tree bookkeeping, and the log lines in [section 2.2](#s-the-scheduler-loop-and-schedule-policy) are the same. Only the forward pass and the overlap mechanism differ.

## What happened when we turned it off

The Apple silicon page of the SGLang docs lists `--disable-overlap-schedule` as one of the key parameters for the MLX backend. We added it to our server command and ran the concurrency 8 benchmark. The server answered its own warm-up and the benchmark warm-up. Then the scheduler died on the first batch of the real run.

```listing
title: the scheduler crash with --disable-overlap-schedule on MLX
source: capture/out/server-no-overlap.log
lang: text
note: The traceback is cut between the event loop and run_batch. File paths are from our checkout of v0.5.22.
---
[2026-10-16 14:07:15] Prefill batch, #new-seq: 1, #new-token: 1, #cached-token: 511, token usage: 0.00, #running-req: 0, #queue-req: 0, #pending-token: 0, cuda graph: False, input throughput (token/s): 0.39
[2026-10-16 14:07:16] Scheduler hit an exception: Traceback (most recent call last):
…
    scheduler.event_loop_normal()
…
  File "/private/tmp/sglang-research/sglang-v0.5.22/python/sglang/srt/managers/scheduler.py", line 4746, in run_batch
    self._relay_forward_payload(
  File "/private/tmp/sglang-research/sglang-v0.5.22/python/sglang/srt/managers/scheduler.py", line 4852, in _relay_forward_payload
    self.future_map.stash(future_indices, payload)
  File "/private/tmp/sglang-research/sglang-v0.5.22/python/sglang/srt/managers/overlap_utils.py", line 639, in stash
    self.output_tokens_buf[indices] = payload.bonus_tokens.to(
…
RuntimeError: Expected all tensors to be on the same device, but found at least two devices, mps:0 and cpu!
```

Read the stack from the bottom. With the overlap off, the dispatcher picks `event_loop_normal`, the generic loop. That loop calls `run_batch`, which still relays the sampled tokens through the `FutureMap` of the overlap machinery. On MLX the buffer lives on the Metal device and the sampled tokens arrive on the CPU, and PyTorch refuses to mix them. The overlap loop for MLX does not take this path, so the default server never reaches it.

The main process then shut everything down. Every one of the 32 benchmark requests failed: 8 were cut off during their response, and 24 could not connect after the server was gone.

```listing
title: the client side of the crash
source: capture/out/no-overlap-bench-random-c8.txt
lang: text
note: The first characters of two of the 32 error lines, and the final line. Each error line holds a full traceback.
---
Warmup completed with 1 sequences. Starting main benchmark run...
…
requests.exceptions.ConnectionError: HTTPConnectionPool(host='0.0.0.0', port=30000): Max retries exceeded with url: /server_info (Caused by NewConnectionError("HTTPConnection(host='0.0.0.0', port=30000): Failed to establish a new connection: [Errno 61] Connection refused"))
```

It failed this way in our one MLX recording. We report it as we found it: a flag that the platform docs recommend crashed the platform at the pinned release.

The same kit configuration ran on CUDA without errors, on the L4 and on the GB10, with 64 of 64 requests served. Each card ran it once with the overlap on and once with it off, at 8 users. The two results disagree:

| Card, model | Output tok/s, overlap on / off | Median TPOT, overlap on / off |
|---|---|---|
| L4, Qwen3-8B | 73.71 / 84.17 | 91.24 / 69.38 ms |
| GB10, Qwen3-30B-A3B | 78.92 / 73.59 | 97.30 / 103.21 ms |

On the L4 the server without the overlap was 14 percent faster, and on the GB10 it was 7 percent slower. These are single runs without clock records, so a hot card can explain either one. They do not show the 1.1x gain that the SGLang team reports, and they do not disprove it.

## A GPU incident with the same root

On CUDA, a user ran with overlap on and hit an allocation failure right after `KV cache pool is full` at 94 percent token usage {{issue #14972}}. Under overlap, the next batch is planned while the tokens of the previous one are still being computed. Retraction had to reason about requests that would finish one step later. A fix proposed in pull request #15626 closed without merge. At v0.5.22 the scheduler removes requests that will finish by length from the next decode batch. It also skips retraction in a step where finishing requests will free KV {{code}}.

Both stories have one lesson. Overlap is a second copy of the timeline in the scheduler's head, and every feature has to agree with it.

## Our position

Leave the overlap on unless a measurement on your own card says otherwise. It is the default, and it is designed to hide CPU time that you would otherwise pay on every step. Our two single runs on CUDA disagreed, so measure both settings with a clock record before you change it.

Turn it off for one reason: to rule it out while you debug a wrong output or a hang. Expect the off path to be less tested, and test it on your hardware before you depend on it. SGLang itself turns the overlap off where it cannot work, for example on Apple MPS without MLX and for speculative decoding on CPU {{code}}.

```takeaways
- Keep the overlap scheduler on unless your own measurement says otherwise.
- Use --disable-overlap-schedule only to isolate a bug, and test it first.
- Do not add --disable-overlap-schedule on MLX at v0.5.22.
- Read a scheduler traceback from the bottom to find the failing component.
```

Sources: python/sglang/srt/managers/scheduler.py (event_loop_overlap, event_loop_normal, _dispatch_event_loop_once, run_batch, _relay_forward_payload, update_running_batch), python/sglang/srt/managers/overlap_utils.py (FutureMap.stash), python/sglang/srt/hardware_backend/mlx/scheduler_mixin.py (event_loop_overlap_mlx) at v0.5.22; docs/docs/hardware-platforms/apple_metal.mdx at v0.5.22; LMSYS, "SGLang v0.4: Zero-Overhead Batch Scheduler", 2024-12-04, https://lmsys.org/blog/2024-12-04-sglang-v0-4/; pull request https://github.com/sgl-project/sglang/pull/11210; issue https://github.com/sgl-project/sglang/issues/14972 and pull request https://github.com/sgl-project/sglang/pull/15626; capture/out/server-no-overlap.command.txt, server-no-overlap.log, no-overlap-bench-random-c8.txt, capture/gpu/out-l4/bench-random-c8.txt, capture/gpu/out-l4/no-overlap-bench-random-c8.txt, capture/gpu/out-gb10/bench-random-c8.txt, capture/gpu/out-gb10/no-overlap-bench-random-c8.txt
