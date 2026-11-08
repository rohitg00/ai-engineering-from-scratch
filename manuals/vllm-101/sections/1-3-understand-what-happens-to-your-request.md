# Understand what happens to your request

> A request spends one short phase reading the prompt and a longer phase writing the answer, and four numbers measure those two phases.

You sent a request and the answer came back, slowly at first and then token by token. When you finish this section, you can name the two phases of a request and the four numbers that every benchmark in this manual reports.

**Our result:** on our DGX Spark, 64 users got eight times the output of one user. Each user waited about 7.5 times longer for every token.

## Two phases

**Prefill:** the step that reads the whole prompt at once and writes its keys and values into the KV cache. One prefill step handles many prompt tokens, so the GPU is busy with math.

**Decode:** the steps that write the answer, one token per request per step. Each step reads all the model weights to make one token for each running request. The GPU waits for memory more than for math.

vLLM does not run the two phases as separate stages. Each scheduler step has one token budget. Running requests get their next decode token first. Then the scheduler spends the rest of the budget on prompt tokens, in chunks. A long prompt can take several steps. [Part 8](#s-why-one-token-budget-replaces-a-prefill-phase) explains why vLLM works this way.

```figure
id: fig-1-3
kind: flow
title: one request through three processes
claim: A request crosses three processes: the API server tokenizes it, the engine core schedules it, and a GPU worker runs the model.
caption: Solid arrows carry the request forward, dashed arrows carry token ids back, and the dotted arrow is the text stream. From the vLLM source at v0.31.0.
```

## Four numbers

| Number | What it measures | Who feels it |
|---|---|---|
| TTFT, time to first token | the wait from the request to the first token, mostly queue time and prefill | a user who waits for the answer to start |
| TPOT, time per output token | the mean time between tokens after the first one | a user who reads a long answer |
| ITL, inter-token latency | each gap between two tokens, so its 99th percentile shows the worst stalls | a user who sees the stream stop and start |
| Throughput | output tokens per second for all users together | the person who pays for the GPU |

## One server, two loads

The numbers trade against each other as users grow. Here is our DGX Spark serving Qwen3-30B-A3B with vLLM 0.31.0, from one user to 64 users at the same time.

| Users at the same time | Median TTFT | Median TPOT | Output tokens per second |
|---|---|---|---|
| 1 | 257 ms | 32.3 ms | 29.5 |
| 64 | 965 ms | 243.8 ms | 239.3 |

With 64 users, the server wrote about eight times as many tokens per second. Each user waited almost four times as long for the first token, and each token took more than seven times as long. A busy server is cheaper per token and slower for each user.

Every tuning page in this manual moves one of these four numbers. Each page says which number it moves and which number it costs.

```figure
id: fig-1-3b
kind: chart
title: one server, two loads
claim: On our DGX Spark, 64 users got eight times the total output of one user, and each user waited about 7.5 times longer for every token.
caption: Read the left chart for the server and the right chart for one user. Bands span the lowest and highest of three runs. From capture/gpu/summary/gb10.json.
```

```takeaways
- Report TTFT, TPOT, P99 ITL, and throughput together.
- Pick the number your users feel before you tune.
```

Sources: vLLM documentation at v0.31.0 (docs/design/metrics.md, docs/configuration/optimization.md), capture/gpu/summary/gb10.json (load.vllm), capture/gpu/out-gb10/server-load-vllm.log.
