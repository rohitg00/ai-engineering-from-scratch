---
id: one-token-budget-per-step
title: One token budget instead of two phases
card: inference-serving
kind: concept
level: 2
roles: [inference-engineer]
rounds: [ml-depth, system-design]
tags: [continuous-batching, chunked-prefill, token-budget, scheduler]
minutes: 8
lessons: [phases/17-infrastructure-and-production/04-vllm-serving-internals]
manuals: [vllm-101#s-why-one-token-budget-replaces-a-prefill-phase, vllm-101#s-keep-long-prompts-from-stalling-short-ones]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Most explanations of continuous batching describe a prefill phase and a decode phase that take turns on the GPU. Describe what the vLLM scheduler does in one step instead. Where does chunked prefill come from in that design, and where do you read the value that controls it?

## Short answer

The scheduler asks the same question of every request: how many tokens does it still need to compute? Each step has a budget of tokens, set by `--max-num-batched-tokens`, and the running requests take their next token first. Waiting prompts fill the rest of the budget, so a long prompt is split over several steps, and chunked prefill needs no extra mechanism.

## Full answer

### One question for every request

A new request needs all of its prompt tokens. A running request needs one token, or more with speculative decoding. No prefill phase and no decode phase exist in the code, only a count of tokens still to compute.

### The order inside a step

1. Each running request gets the tokens it needs, up to the budget.
2. Waiting requests are admitted while budget and room remain. `--max-num-seqs` caps the running requests.

A prompt that does not fit the rest of the budget gets a part now and the rest in later steps. That is chunked prefill, and it is on by default because the budget design needs nothing else to support it.

### The default depends on the memory that vLLM reads

| GPU memory that vLLM reads | Budget, `vllm serve` | Budget, `LLM` class | `--max-num-seqs`, both |
|---|---|---|---|
| 160 GiB or more | 16,384 | 16,384 | 1,024 |
| 70 GiB or more, but not an A100 | 8,192 | 16,384 | 1,024 |
| less, or unknown | 2,048 | 8,192 | 256 |

The unified-memory machine in the manual has 121.69 GiB that the CPU and the GPU share, and its log still shows 2,048, the value for a small or unknown GPU. Read the value that your server uses before you change it. At 0.31.0 the log does not print the budget under its own name; find `compile_ranges_endpoints` in the engine config line, and the largest number in that list is the budget.

### Why decode goes first

Running requests come first so that a user who already sees a stream keeps seeing it. A new prompt waits for what is left. A smaller budget gives a smoother stream; a larger one gives a faster first token for long prompts. The small default of 2,048 is a choice for the stream.

### Why one budget

One budget for every kind of work keeps the scheduler simple. Prefix caching only lowers the count of tokens to compute. Speculative decoding only raises the count for a running request. The same loop serves all of them. The cost is that one number decides the balance between the first token and the stream, and no single value suits every workload.

The lesson's toy scheduler uses a fixed 512-token chunk. The real engine has no separate chunk size at 0.31.0: the chunk is what is left of the budget in that step.

## Follow-ups

- **Level 2:** Prefix caching is on, and a request with a 2,048-token prompt finds 1,024 tokens in the cache. What does the scheduler count for it? Expected: 1,024 tokens still to compute; the cache only lowers the count, and the same loop serves the request.
- **Level 3:** A server with 121.69 GiB of unified memory logs a budget of 2,048. Why not 8,192? Expected: the default comes from the memory that vLLM reads, and the unified machine reads as small or unknown, so it gets the small value; read compile_ranges_endpoints before you change it.
- **Level 4:** Speculative decoding is on with three draft tokens. How does the budget rule change? Expected: it does not; a running request now needs more than one token per step, so its count rises, and the budget is spent in the same order.

## Wrong answers

- "Chunked prefill is a flag you turn on." It follows from the budget: a prompt that does not fit the rest of the budget gets part now and the rest later, so it is on by default and has no separate mechanism.
- "New prompts go first so that the first token comes fast." Running requests take their tokens first so that a user who sees a stream keeps seeing it; a new prompt waits for the budget that is left.
- "The budget is 2,048 on every GPU." It depends on the memory that vLLM reads: 2,048 below 70 GiB, 8,192 at 70 GiB or more, and 16,384 at 160 GiB or more, and the offline LLM class uses larger values.

## Taught in

[Why one token budget replaces a prefill phase](../../../manuals/vllm-101/sections/8-2-why-one-token-budget-replaces-a-prefill-phase.md) and [the long prompts section](../../../manuals/vllm-101/sections/3-3-keep-long-prompts-from-stalling-short-ones.md) give the rule and the defaults, and [the serving engine internals lesson](../../../phases/17-infrastructure-and-production/04-vllm-serving-internals/docs/en.md) has the toy scheduler.
