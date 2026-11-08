---
id: ten-thousand-calls-on-threads
title: Ten thousand concurrent model calls on threads
card: multi-agent
kind: estimate
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, system-design]
tags: [async, threads, concurrency, memory, io-bound]
minutes: 8
lessons: [phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints]
manuals: []
practice: []
cheatsheet: [production-agent-runtimes]
related: [multi-agent/a-worker-died-mid-run]
updated: 2026-11-03
---

A swarm runtime uses one thread per in-flight model call. At peak it holds about 10,000 calls at once. Estimate the memory the threads take before any work is done, say what those threads are doing most of the time, and say what you would change.

## Short answer

A thread stack is about 1 MB, so 10,000 threads need about 10 GB of memory for stacks alone, before the first token arrives. Those threads are idle about 99 percent of the time, waiting for the next token from a model service. Move the model calls to cooperative fibers through asynchronous I/O, where the same 10,000 calls fit in one process, and keep threads or processes only for CPU-bound work such as embeddings.

## Full answer

### The estimate

| Quantity | Value |
|---|---|
| Stack per thread | about 1 MB |
| Concurrent calls | 10,000 |
| Memory for stacks | about 10 GB |

That is the cost of holding the calls open, not of doing anything with them. A model call is I/O bound. The thread sends a request and then waits for tokens, and it is idle for about 99 percent of its life.

### What fibers change

Cooperative fibers yield on I/O instead of holding a stack while they wait. In the lesson's demo, 500 concurrent simulated calls finish in under one second on the asynchronous version, while the thread version takes several seconds and uses orders of magnitude more memory per concurrent unit. At agent scale, asynchronous I/O is the architecture, not an optimization.

### The exception

CPU-bound post-processing wants threads or processes: embedding, tokenizer tricks, anything that computes rather than waits. Separate the I/O layer from the CPU layer and give each its own concurrency model.

### How this fits the rest of the runtime

The asynchronous layer handles the calls in flight. Durability is a separate concern: a checkpoint per step under a run id so that a crash of the process loses the in-flight calls and nothing else, and any worker resumes from the last checkpoint. Peak load at ten times the average is a reason for both: fibers to hold the calls cheaply, and queues with leases to spread them across workers.

## Follow-ups

- **Level 2:** Why does the thread count matter more than the request count? Expected: each thread holds a stack whether or not it is doing work, so memory scales with concurrency, not with throughput.
- **Level 2:** What breaks if you run the embedding step on the asynchronous loop? Expected: a CPU-bound task blocks the loop, so every waiting call stalls behind it, which is why CPU work goes to threads or processes.
- **Level 3:** The memory fits after the change. What is the next limit? Expected: the model service's rate limits and the queue depth, so the runtime needs back-pressure and a lease per run rather than more concurrency.
- **Level 3:** How do you prove the change before you ship it? Expected: run the lesson's comparison on your own call shape, measure wall-clock and peak memory for both versions at the same concurrency, and keep the numbers next to the decision.

## Wrong answers

- "Add memory until the threads fit." Memory for idle stacks is waste, and the next peak needs more, while fibers remove the cost.
- "Make the threads smaller with a reduced stack size." A smaller stack is still a stack per idle call, and the idle time stays at 99 percent.
- "Use fibers for everything, including embeddings." A CPU-bound step on the cooperative loop blocks every waiting call, so the CPU layer keeps threads or processes.

## Taught in

The [production scaling lesson](../../../phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/) runs the asynchronous and thread versions side by side.
