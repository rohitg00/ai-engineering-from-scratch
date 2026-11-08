# sglang serve and the three processes

> SGLang splits one server into a tokenizer process, a scheduler process, and a detokenizer process, because Python text work must never delay the loop that feeds the GPU.

You start a server, send one request, and it works. Then you put real traffic on it, and the GPU sits at 40 percent while users wait. Most people blame the kernels first. LinkedIn did the work to find out, and the slow parts were the tokenizer, the messages between processes, Python garbage collection, and the GIL {{field LinkedIn 2026-02}}.

When you finish this section, you can start SGLang with `sglang serve` and name the three processes it starts. You can also read the startup log for the numbers that decide everything later.

## The cost: one Python thread cannot do everything

A language model server does two kinds of work. GPU work is the forward pass: one prefill or decode step every few milliseconds. CPU work is everything around it: parsing HTTP, applying the chat template, tokenizing, turning token ids back into text, and checking stop strings.

The obvious design puts all of it in one Python process. That design fails under load. Python runs one thread at a time under the GIL. A 3,000-token prompt that is being tokenized holds the interpreter that must launch the next GPU step. Every millisecond of text work becomes a millisecond of idle GPU.

LinkedIn measured this on H100 GPUs with small ranking models. Batch tokenization alone moved P99 latency from 4,583 ms to 464 ms at 500 queries per second {{field LinkedIn 2026-02}}. The model did not change. Only the CPU path around it changed.

## What SGLang starts

**TokenizerManager:** the object in the main process that receives each request, applies the chat template, tokenizes the text, and waits for the answer. The HTTP server and the TokenizerManager share one process and one asyncio loop.

**Scheduler:** a separate process that owns the GPU. It decides which tokens run next, builds the batch, runs the forward pass, and samples. With tensor parallelism there is one scheduler process per GPU.

**DetokenizerManager:** a third process that turns output token ids into text, one small piece at a time, and sends the text back to the TokenizerManager.

The processes talk over ZMQ sockets. The TokenizerManager sends a `TokenizedGenerateReqInput` to the scheduler. The scheduler sends a `BatchTokenIDOutput` to the detokenizer. The detokenizer sends a `BatchStrOutput` back. At v0.5.22 the messages are pickled by default, because `SGLANG_USE_PICKLE_IPC` is true {{code}}.

```figure
id: fig-2-1
kind: flow
title: the three processes of one SGLang server
claim: One request crosses three processes over ZMQ, and only the scheduler touches the model, so text work never runs on the thread that launches GPU steps.
caption: Read the numbered arrows in order. Blue boxes are SGLang processes, the olive box is the client. Process ids 5782 and 5909 are from the default server log of our Mac run.
```

With tensor parallelism, only rank 0 of the scheduler opens the ZMQ sockets. It broadcasts each request to the other ranks, so every GPU builds the same batch {{code}}. No rank decides on its own.

## The command we ran

We started the server on an Apple silicon Mac with the MLX backend and a 4-bit Qwen3 0.6B model. `sglang serve` is the recommended command at v0.5.22. The older `python -m sglang.launch_server` still works and prints a warning that names `sglang serve` as the recommended entrypoint {{code}}.

```listing
title: the server command for every default capture
source: capture/out/server-default.command.txt
lang: text
---
SGLANG_USE_MLX=1 sglang serve --model-path mlx-community/Qwen3-0.6B-4bit --disable-cuda-graph --host 127.0.0.1 --port 30000 --enable-cache-report --enable-metrics --mem-fraction-static 0.4
```

Three flags are not defaults, and all three are deliberate. `--enable-cache-report` puts the cached token count into every OpenAI-style response, so [section 2.5](#s-streaming-stop-strings-and-the-openai-api) can show it. `--enable-metrics` turns on the `/metrics` endpoint that [section 5.2](#s-the-metrics-endpoint) reads. `--mem-fraction-static 0.4` limits the KV pool, and [section 3.2](#s-mem-fraction-static-and-startup-sizing) explains the crash we had without it.

The log objects to one flag. The Apple silicon page of the SGLang docs tells you to pass `--disable-cuda-graph`. The second line of our log says the flag "is deprecated and will be removed in a future release", and names `--cuda-graph-backend-{decode,prefill}=disabled` as the replacement.

The docs and the code disagree here, and the code wins. The flag still works at v0.5.22. Plan to replace it before the next release removes it.

## Read the startup log before anything else

The startup log tells you what SGLang decided on your behalf. Most of those numbers are not flags you set. They are values that SGLang computed from your memory, your model, and your hardware.

```listing
title: the limits SGLang computed at startup
source: capture/out/server-default.log
lang: text
note: Lines cut from the startup section. The same lines appear in every capture with different memory numbers.
---
[2026-10-16 13:58:05] max_total_num_tokens=181574, chunked_prefill_size=4096, max_prefill_tokens=16384, max_running_requests=4096, context_len=40960, available_gpu_mem=47.96 GB
…
[2026-10-16 13:58:06] Using the Python TreeCore: the Rust TreeCore supports Linux only
[2026-10-16 13:58:06] Tree cache initialized: source=default impl=UnifiedRadixCache hybrid_swa=False hybrid_ssm=False hicache_attached=False
[2026-10-16 13:58:06] Engine startup timings (s): load_weight=0.00, kv_cache_allocation=0.00, scheduler_e2e=7.01, cuda_graph={prefill=0.00, decode=0.00, target_verify=0.00, draft_prefill=0.00, draft_decode=0.00, draft_extend=0.00}, tokenizer_e2e=11.92
```

Read the first line field by field:

- `max_total_num_tokens=181574` is the size of the KV pool in tokens. [Part 3](#s-kv-bytes-per-token-and-the-kv-pool) shows where it comes from.
- `chunked_prefill_size=4096` is the largest piece of one prompt that runs in one step. A longer prompt runs in pieces.
- `max_running_requests=4096` is how many requests can decode at the same time. It is a computed value, not a promise of good latency.
- `context_len=40960` is the longest sequence the model accepts.

The tree cache lines matter too. On Linux the radix tree runs in Rust by default since v0.5.21. On our Mac it runs in Python, and the log says so.

## The warm-up and the garbage collector

Before the server says it is ready, it sends itself one request. Then it calls its own `/freeze_gc` endpoint.

```listing
title: the warm-up request and the frozen garbage collector
source: capture/out/server-default.log
lang: text
---
[2026-10-16 13:58:08] Prefill batch, #new-seq: 1, #new-token: 6, #cached-token: 0, token usage: 0.00, #running-req: 0, #queue-req: 0, #pending-token: 0, cuda graph: False, input throughput (token/s): 3.85
[2026-10-16 13:58:08] INFO:     127.0.0.1:63781 - "POST /generate HTTP/1.1" 200 OK
[2026-10-16 13:58:08] INFO:     127.0.0.1:63785 - "POST /freeze_gc HTTP/1.1" 200 OK
[2026-10-16 13:58:08] The server is fired up and ready to roll!
```

That `/freeze_gc` call has a history. LinkedIn saw garbage collection pauses of 100 to 300 ms every few seconds and fixed them with a warm-up and `gc.freeze()` {{field LinkedIn 2026-02}}. At v0.5.22 the server does the same thing for you after its warm-up, for the scheduler and the detokenizer too {{code}}.

## The processes in the shutdown log

The clearest proof of the process split comes when the server stops. Our capture kit stops each server with SIGTERM.

```listing
title: shutdown, seen from the main process
source: capture/out/server-default.log
lang: text
---
[2026-10-16 14:01:45] SIGTERM received. signum=None frame=None. Draining requests and shutting down...
[2026-10-16 14:01:45] Subprocess scheduler_0 (pid=5909) crashed with exit code -15. Triggering SIGQUIT for cleanup...
```

The main process is pid 5782 and the scheduler is pid 5909. Exit code -15 is our own SIGTERM, so the word "crashed" is misleading. A real scheduler crash looks different. It prints a traceback and then "SIGQUIT received ... It usually means one child failed", as [section 2.4](#s-the-overlap-scheduler) shows.

## Our position

Treat the CPU path as part of the model server. When time to first token is high and the GPU is not busy, look at the tokenizer process before you look at kernels. SGLang gives you more workers for both ends: `--tokenizer-worker-num` and `--detokenizer-worker-num`, both 1 by default {{code}}.

Do not run every experiment on the defaults that the startup log reports. Write the computed limits down, then decide which ones to set yourself. [Section 7.1](#s-operating-sglang) gives the order.

```takeaways
- Start the server with sglang serve and keep its startup log.
- Copy the computed limits from the startup log into your notes.
- Look at the tokenizer process first when the GPU is idle and latency is high.
- Read exit codes in shutdown lines before you call a stop a crash.
```

Sources: python/sglang/srt/entrypoints/engine.py (Engine docstring and process launch), python/sglang/srt/managers/io_struct.py, python/sglang/srt/environ.py (SGLANG_USE_PICKLE_IPC), python/sglang/srt/managers/scheduler_components/request_receiver.py, python/sglang/launch_server.py, python/sglang/srt/entrypoints/http_server.py (warm-up and /freeze_gc), python/sglang/srt/arg_groups/fields/serving.py at v0.5.22; docs/docs/hardware-platforms/apple_metal.mdx at v0.5.22; capture/out/server-default.command.txt and capture/out/server-default.log; LinkedIn Engineering, "Scaling LLM-based ranking systems with SGLang at LinkedIn", 2026-02-20, https://www.linkedin.com/blog/engineering/ai/scaling-llm-based-ranking-systems-with-sglang-at-linkedin.
