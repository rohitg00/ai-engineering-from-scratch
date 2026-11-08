# Why one token budget replaces a prefill phase

> This page explains the scheduler loop, decode first, and preemption by recompute.

Most explanations of LLM serving describe a prefill phase and a decode phase. The vLLM scheduler has neither. When you finish this section, you can explain what the scheduler does in one step, and why that design makes chunked prefill the default.

## One question for every request

The scheduler asks the same question about every request: how many tokens does this request still need to compute? A new request needs all of its prompt tokens. A running request needs one token, or more with speculative decoding. A comment in the scheduler source says the same in its own words. No decode phase and no prefill phase exist, only a count of tokens still to compute.

In each step, the scheduler has a budget of tokens, set by `--max-num-batched-tokens`. For `vllm serve` on a GPU with less than 70 GiB, such as the L4, the default is 2,048. It spends the budget in this order:

1. It gives each running request the tokens it needs, up to the budget.
2. It admits waiting requests while budget and room for running requests remain. `--max-num-seqs` limits the running requests. For `vllm serve`, the default is 256 on a GPU with less than 70 GiB and 1,024 on a larger one other than an A100.

A long prompt that does not fit the rest of the budget gets a part of the budget now and the rest in later steps. That is chunked prefill. It is on by default, because the budget design needs nothing else to support it.

```figure
id: fig-8-2
kind: timeline
title: one token budget
claim: Each step spends 2,048 tokens: running requests get a decode token first, and a new prompt fills the rest in chunks.
caption: Each row is one scheduler step. Prompt chunks are drawn to scale, and decode blocks are widened so you can see them. Dashed space is unused budget. From the vLLM source at v0.31.0.
```

## Why decode goes first

Running requests come first, so a user who already sees a stream keeps seeing it. A new prompt waits for the budget that is left. The vLLM documentation states the trade. A smaller budget gives a smoother stream, and a larger one gives a faster first token for long prompts. The small default of 2,048 is a choice for the stream. GPUs with 70 GiB or more get 8,192, and [the long prompts page](#s-keep-long-prompts-from-stalling-short-ones) lists the rule.

## What happens when memory runs out

A running request needs a new KV block every 16 tokens. If no block is free, the scheduler preempts a request. Under the default first-come policy, it picks the newest running request. It frees all of its blocks and puts the request back at the head of the waiting queue. When the request runs again, vLLM computes its tokens again from the start.

Older vLLM versions could also copy the blocks to CPU memory and back. The current engine only recomputes, because the documentation judges the recompute cheaper in this architecture. The cost shows up as a longer time for the preempted request, and as the `vllm:num_preemptions` counter.

## Why one budget

One budget for every kind of work keeps the scheduler simple. Prefix caching only lowers the count of tokens to compute. Speculative decoding only raises the count for a running request. The same loop serves all of them. The cost is that one number decides the balance between the first token and the stream. No single value of that number suits every workload.

```takeaways
- The scheduler gives each request the tokens it still needs, from one budget for each step.
- Running requests get the budget first, so the stream stays smooth.
- When memory runs out, vLLM frees a request and computes it again later.
```

Sources: the vLLM source at v0.31.0 (vllm/v1/core/sched/scheduler.py, vllm/config/scheduler.py), vLLM documentation at v0.31.0 (docs/configuration/optimization.md).
