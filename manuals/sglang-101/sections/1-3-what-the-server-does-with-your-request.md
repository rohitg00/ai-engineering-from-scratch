# What the server does with your request

> Every request has two phases with different costs, and four numbers tell you how a server handles them for all its users.

You sent two requests in [section 1.1](#s-install-sglang-and-serve-your-first-model), and both came back in under a second. With ten users, the same server can make some of them wait seconds for the first word. The reason is in the two phases of every request.

When you finish this section, you can name the two phases of a request and the four numbers a server is judged by. You can also say what SGLang controls and what stays with the model and with you.

## Two phases with two different costs

**Prefill:** the forward pass over the whole prompt. It computes the keys and values of every prompt token in one batch and produces the first output token. **Decode:** the loop that produces each next token, one forward pass per token per request.

The two phases use the GPU in different ways. Prefill has many tokens in each pass, so it keeps the arithmetic units busy. Decode has one new token per request in each pass.

Each decode step reads the weights that the step needs, and the cached keys and values, to do little arithmetic. For a dense model, that is every weight. For a mixture-of-experts model, it is the shared weights and the experts that the router chose. Memory bandwidth sets the speed of decode, and compute sets the speed of prefill.

We measured the difference on a Mac with a 0.6B model. A 512-token prompt reached its first token in a median of 163 ms. After that, each new token took 4.38 ms on average.

```listing
title: one request at a time, 512 tokens in and 128 tokens out
source: capture/out/bench-random-c1.txt
lang: text
note: Cut from the benchmark summary. The latency percentiles other than the median and the inter-token block are cut.
---
Max request concurrency:                 1         
Successful requests:                     16        
…
Median TTFT (ms):                        162.98    
…
Mean TPOT (ms):                          4.38      
```

That is at most about 0.32 ms per prompt token against 4.38 ms per output token, a factor of about 14 on this Mac. The 0.32 ms is an upper bound, because the TTFT also holds the queue and the first decode step. On our L4 with Qwen3-8B the factor was about 160: 189 ms for a 512-token prompt, against 60 ms per output token. A serving engine can share and skip prefill work. It mostly batches decode work, so that one read of the weights serves many requests. [Section 4.4](#s-speculative-decoding) shows the other way to cut decode steps.

```figure
id: fig-1-1
kind: comparison
title: prefill against decode on the capture Mac
claim: The median TTFT divided by the prompt length is about 0.32 ms per prompt token, and one output token costs 4.38 ms in decode.
caption: Read left to right. Both columns come from one benchmark run with one request at a time. From capture/out/bench-random-c1.txt.
```

## The four numbers

Judge a server by four numbers together. A report that gives one of them tells you little.

- **Time to first token (TTFT):** how long a user waits before the first word. Prefill and the queue set it.
- **Time per output token (TPOT):** the average gap between tokens after the first. **Inter-token latency (ITL)** is the same gap, measured one token at a time, so its tail shows stalls. Decode sets both.
- **Throughput:** output tokens per second across all users. Batching sets it.
- **Goodput:** requests per second that meet a TTFT target and a TPOT target at the same time. Your users feel this number.

The first three trade against each other. A larger batch raises throughput and makes the tokens of each user slower. A large prefill chunk finishes a long prompt sooner and stalls every decode in the batch while it runs. [Section 5.1](#s-sglang-benchmark-serving) shows the trade on a real sweep.

The SGLang benchmark tool prints TTFT, TPOT, ITL, and throughput. It does not print goodput at version 0.5.22, so compute it from the records of each request. The [inference metrics lesson](phases/17-infrastructure-and-production/08-inference-metrics-goodput) builds that calculation.

## What SGLang owns, and what it does not

SGLang owns the time between a request and its tokens. It decides which prompt tokens to compute, which to reuse, and when each request runs.

```figure
id: fig-1-2
kind: layers
title: what SGLang owns
claim: SGLang owns tokenizing, scheduling, the KV cache, and the forward pass, while the model and the operator own quality, memory, and routing.
caption: Read top to bottom, from the client to the weights. Grey layers are outside SGLang. From the v0.5.22 source and capture/out/server-default.log.
```

Three things stay outside. The model decides what the answer says. On our Mac, a 0.6B model asked to name a planet answered "Ardens", which is no planet. SGLang served that answer correctly and fast, and no serving engine can make a model right.

You, the operator, decide how much memory SGLang gets and which machine a request goes to. SGLang has a separate router for that second job, and [section 6.4](#s-sgl-model-gateway) covers it.

## The path of one request

Inside SGLang, your `/generate` request crossed three processes. The tokenizer manager turned the text into token ids. The scheduler found two of the five prompt tokens in the cache and computed the other three. The detokenizer turned the new token ids into text.

The scheduler logged its side of the request in one line:

```listing
title: the scheduler's view of the request on our L4
source: capture/gpu/out-l4/server-default.log
lang: text
note: The prefill line and the response line of the /generate request from section 1.1.
---
[2026-10-17 14:43:41] Prefill batch, #new-seq: 1, #new-token: 3, #cached-token: 2, token usage: 0.00, #running-req: 0, #queue-req: 0, #pending-token: 0, cuda graph: True, input throughput (token/s): 2.82
[2026-10-17 14:43:41] INFO:     127.0.0.1:58314 - "POST /generate HTTP/1.1" 200 OK
```

`#new-token: 3` and `#cached-token: 2` add up to the five prompt tokens. This pair is the most useful line that SGLang prints. [Section 3.4](#s-prefix-friendly-prompts) uses it alone to find a prompt that misses the cache.

```figure
id: fig-1-3
kind: sequence
title: one /generate request through the three processes
claim: The tokenizer manager, the scheduler, and the detokenizer each touched the request once, and the prefill computed 3 of 5 tokens.
caption: Read top to bottom. Numbers are from our L4 request in section 1.1. From capture/gpu/out-l4/generate.txt and capture/gpu/out-l4/server-default.log.
```

## Our position

Choose SGLang for the shape of your traffic, never for a headline number. Agents, chat with a fixed system prompt, and retrieval with a fixed preamble all share long prefixes. For that traffic, the prefix cache saves prefill work on every request. If every prompt is unique and long, measure two engines on your own prompts before you decide.

Distrust any SGLang benchmark that does not name its version. The most repeated number on the web, "SGLang 29% faster than vLLM", comes from one offline test that lists SGLang v0.2.3 {{field AIMultiple 2026-01}}. [Section 5.3](#s-reading-other-peoples-benchmarks) shows where independent tests agree, and our own head-to-head runs.

To see how the scheduler, the cache, and each forward pass do this work, read Parts 2 to 4. Start with [section 2.1](#s-sglang-serve-and-the-three-processes), which follows the request through the three processes.

```takeaways
- Report TTFT, TPOT, throughput, and goodput together, at a stated concurrency.
- Expect decode to cost tens to hundreds of times more per token than prefill.
- Check #new-token and #cached-token in the scheduler log for each request you debug.
- Choose SGLang when your prompts share prefixes, and measure it when they do not.
```

Sources: capture/out/bench-random-c1.txt, capture/out/generate.txt, capture/out/server-default.log, capture/gpu/out-l4/server-default.log; python/sglang/benchmark/serving.py and python/sglang/srt/entrypoints/http_server.py at v0.5.22; AIMultiple, "LLM Inference Engines" (https://aimultiple.com/inference-engines, 2026-01-25), capture/gpu/summary/l4.json (load.default)
