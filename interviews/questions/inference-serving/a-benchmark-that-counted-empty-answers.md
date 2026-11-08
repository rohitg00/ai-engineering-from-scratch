---
id: a-benchmark-that-counted-empty-answers
title: A split-server benchmark that counted empty answers
card: inference-serving
kind: code-reading
level: 4
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [disaggregation, benchmark, kv-transfer, retokenized-tokens, false-success]
minutes: 10
lessons: []
manuals: [sglang-101#s-prefill-decode-disaggregation]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

A team split Qwen/Qwen3-8B into a prefill server and a decode server on two L4s over TCP, ran the open-loop benchmark through the router at 8 requests per second, and posted the result as a win: 751.85 tokens of output per second, against 728.61 for the single FP8 server at the same rate. Here are lines from the prefill log, the decode log and the benchmark summary. Read them and tell me what you see.

```text
… Decode batch, #running-req: 2, #token: 1206, token usage: 0.41, pre-allocated usage: 0.00, #prealloc-req: 19, #transfer-req: 0, #retracted-req: 0
… TCP lane queue-full rejection count: 4096
… Session 151.242.195.41:15367 failed.
Prefill transfer failed lines: 2902
Successful requests:                     240
Total generated tokens (retokenized):    0
Mean TTFT (ms):                          0.00
```

## Short answer

The run produced no text. Every request counted as a success through the router, but zero tokens came back when the client retokenized the output, and a mean first-token time of 0.00 ms is not a measurement. The decode log shows why: the decode copy could run only 2 requests while 19 waited for memory, prefill kept producing KV for them, the TCP transfer queue to decode filled and rejected 4096 times, the session failed, and 2902 later transfers failed with it, so the 751.85 figure is the speed at which the router returned empty answers.

## Full answer

### Read the lines in order

1. `#running-req: 2` with `#prealloc-req: 19` at a token usage of 0.41. The decode side runs two requests and 19 more wait for decode memory. That pool is small: the decode server sat on the shared card with 2,925 tokens, against 24,094 on the prefill card.
2. `TCP lane queue-full rejection count: 4096`. Prefill kept producing KV caches for requests that decode could not take, and the transfer queue to decode filled.
3. `Session ... failed.` Three minutes into the sweep the transfer session died, and it did not come back.
4. `Prefill transfer failed lines: 2902`. Every later request failed its transfer.
5. `Successful requests: 240` with `Total generated tokens (retokenized): 0` and `Mean TTFT (ms): 0.00`. Each failed request still returned HTTP 200 through the router, with no text.

### Why the summary lied

The client counts a success on the status code. The throughput line counts the tokens the client asked for, 128 per request with the end token ignored, not the tokens it received. Only two numbers gave the run away: the retokenized output tokens, which count what came back, and a first-token time of zero, which no real request can have. The manual did not publish the throughput figure, and its kit now refuses a run in which every request has a TTFT of 0.

### The swapped split

The team then put decode on the card with the full pool of 24,094 tokens and prefill on the shared card with 2,925. From 1 to 8 users every request came back with text. At 16 users only 2,048 of 8,192 generated tokens came back as text. At 32 users every request came back empty, and the kit stopped the sweep. The original direction failed earlier: at 2 users only 512 of 2,048 generated tokens came back, and at 4 users none did. The manual's conclusion is that it has no measured result for the split under load on this pair of cards, and it does not claim one.

### The rule

Check `Total generated tokens (retokenized)` against `Total generated tokens` in every disaggregated benchmark before you read its throughput, and look at the TTFT distribution for values that cannot be real. In production, watch the bootstrap-failed and transfer-failed counters, the transfer latency and speed, and the decode pre-allocation and transfer queue gauges.

## Follow-ups

- **Level 3:** Which two numbers in such a summary must you read before the throughput? Expected: the retokenized output tokens against the generated tokens, and the TTFT distribution; a gap between the two token counts or a first token of zero means requests returned without text.
- **Level 4:** Why did the decode pool fill while prefill kept working? Expected: the decode copy sat on the shared card with a pool of 2,925 tokens, so it ran 2 requests and 19 waited for memory; prefill had 24,094 tokens and kept producing KV for them, so the transfer queue to decode filled and the session died.
- **Level 4:** The swapped split served text up to 8 users and lost it at 16 and 32. What does that say about the pair? Expected: the small side limits the pair whichever role it has; with prefill on the small card, 2,048 of 8,192 generated tokens came back at 16 users and none at 32, so there is no measured result for this pair under load, and the honest report says so.

## Wrong answers

- "240 of 240 requests succeeded, so the system is healthy." The router returned HTTP 200 with no text for every failed request; zero retokenized tokens and a first token of 0.00 ms show that nothing was generated.
- "751.85 beats 728.61, so disaggregation won." The figure counts tokens the client asked for, not tokens it received; the manual did not publish it, and its kit now refuses a run in which every request has a TTFT of 0.
- "The TCP backend is the problem, so use RDMA." The queue filled because decode could not take the KV: it ran 2 requests with 19 waiting for memory on a pool of 2,925 tokens; a faster link does not add memory to the decode side.
- "Retries would have fixed the failed transfers." The session failed three minutes in and did not come back, so every later transfer failed; the fix is a decode pool that can hold the requests and a check that the output exists.

## Taught in

[The SGLang disaggregation section](../../../manuals/sglang-101/sections/6-3-prefill-decode-disaggregation.md) has the queue-full listing, the swapped split and the rule to check retokenized tokens.
