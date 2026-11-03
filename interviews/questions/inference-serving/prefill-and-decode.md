---
id: prefill-and-decode
title: The two phases of one request
card: inference-serving
kind: concept
level: 1
roles: [inference-engineer, applied-ai-engineer]
rounds: [screen, ml-breadth]
tags: [prefill, decode, ttft, tpot, itl]
minutes: 6
lessons: [phases/17-infrastructure-and-production/04-vllm-serving-internals]
manuals: [vllm-101#s-understand-what-happens-to-your-request]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

A user sends a chat request to a serving engine and the answer streams back, slowly at first and then word by word. Describe what the GPU does from the moment the request arrives until the last token. Name the phases, and name the numbers you would put on a dashboard for each of them.

## Short answer

A request has two phases. Prefill reads the whole prompt in one pass and writes its keys and values into the KV cache, so the GPU is busy with math. Decode then writes one token per request per step, and each step reads all the weights to do it, so the GPU waits for memory. Four numbers measure them: TTFT for the wait before the first token, TPOT and ITL for the stream, and output tokens per second for the whole server.

## Full answer

### Prefill

Prefill handles many prompt tokens in one step. The keys and values of every prompt token go into the KV cache. The step does a lot of math for each byte it reads, so it is compute bound. A long prompt makes the first token late.

### Decode

Decode makes one new token for each running request in each step. The step reads all the model weights once to do that, whatever the batch size. The step moves many bytes for little math, so it is memory bound. This is why a bigger batch is almost free per step on a dense model: the weights are read once for all the requests in the step.

### The four numbers

| Number | What it measures | Who feels it |
|---|---|---|
| TTFT | the wait from the request to the first token, mostly queue time and prefill | the person who waits for the answer to start |
| TPOT | the mean time between tokens after the first one | the person who reads a long answer |
| ITL | each gap between two tokens; its P99 shows the worst stalls | the person who sees the stream stop and start |
| Throughput | output tokens per second for all users together | the person who pays for the GPU |

Report the four together. A throughput number alone hides the latency that the users feel.

### What load does to them

The manual measured Qwen/Qwen3-30B-A3B with vLLM 0.31.0 from one user to 64 users at once:

| Users at once | Median TTFT | Median TPOT | Output tokens per second |
|---|---|---|---|
| 1 | 257 ms | 32.3 ms | 29.5 |
| 64 | 965 ms | 243.8 ms | 239.3 |

With 64 users the server wrote about eight times as many tokens per second. Each user waited almost four times as long for the first token, and each token took about 7.5 times longer. A busy server is cheaper per token and slower for each user. Every tuning choice moves one of these four numbers and costs another.

### One scheduler, not two stages

The engine does not run the two phases as separate stages. In vLLM, each scheduler step has one token budget. Running requests get their next decode token first. The rest of the budget goes to prompt tokens, in chunks. A prefill is only a request with many tokens left to compute.

## Follow-ups

- **Level 1:** Which of the four numbers matters most to someone who reads a long answer? Expected: TPOT, the mean gap between tokens, together with the P99 ITL for the worst stalls.
- **Level 2:** Why is decode bound by memory and prefill by math? Expected: a decode step reads every weight to make one token per request, so the bytes moved dominate; a prefill step handles hundreds of prompt tokens per pass, so the math per byte is high.
- **Level 3:** In the manual's run, 64 users got about eight times the output of one user. Why do the cost per token and the wait per user move in opposite directions? Expected: each decode step reads the weights once for all running requests, so more requests share one read; each request then waits for a longer step.
- **Level 4:** The lesson describes a prefill phase and a decode phase. What does the vLLM scheduler have instead? Expected: one token budget per step; running requests take their next token first and prompt chunks fill the rest, so a prefill is a request with many tokens left to compute.

## Wrong answers

- "Throughput is the number to optimize, and the rest follows." Throughput is what the GPU owner pays for; the users feel TTFT and the gaps between tokens, and at 64 users the manual's server wrote eight times the tokens while each user waited about 7.5 times longer per token.
- "Prefill and decode run as two separate stages inside the engine." The vLLM scheduler has one token budget per step; running requests get a decode token first and prompt chunks fill the rest, so the two phases mix in one step.
- "TPOT and ITL are the same number." TPOT is the mean time per output token for one request; ITL is each gap between two tokens, and its P99 shows the stalls that the mean hides.

## Taught in

The request flow is in [the vLLM 101 section on what happens to your request](../../../manuals/vllm-101/sections/1-3-understand-what-happens-to-your-request.md) and in [the serving engine internals lesson](../../../phases/17-infrastructure-and-production/04-vllm-serving-internals/docs/en.md).
