---
id: prefix-cache-inflated-benchmark
title: The prefix cache inflated a benchmark
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [prefix-cache, benchmark, ttft, knee, methodology]
minutes: 20
lessons: [phases/17-infrastructure-and-production/22-load-testing-llm-apis]
manuals: [vllm-101#s-benchmark-your-server-in-15-minutes, vllm-101#s-tune-chat-for-many-users, vllm-101#s-ref-lab-notes, sglang-101#s-sglang-benchmark-serving]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
system:
  version: vLLM 0.31.0 and SGLang 0.5.22
  model: Qwen/Qwen3-8B
  hardware: one L4 with 24 GB of memory, SM clock locked at 900 MHz
source:
  - manuals/vllm-101/sections/5-1-benchmark-your-server-in-15-minutes.md
  - manuals/vllm-101/capture/gpu/out-l4/prefix-cache-flush.txt
  - manuals/vllm-101/capture/gpu/out-l4/load-flushed-vs-unflushed.txt
---

## Situation

A team sizes a chat service. They run a concurrency sweep from 1 to 64 users against one server with `Qwen/Qwen3-8B` on an L4. Each request sends 512 prompt tokens and asks for 128 tokens back. They keep one server up for the whole sweep and repeat it with three seeds. The published table shows 191 to 288 ms to the first token up to 16 users, then a jump to 1,800 ms at 32. They call the knee "between 16 and 32" and plan one replica for every 16 users.

In production, replicas at 12 users each show first tokens above one second for a quarter of the requests. The dashboards show no queue, no preemption and no memory pressure. The benchmark client, the model, the GPU and the engine version are the same as in the sweep.

## Evidence

- [the first sweep, as the team published it](evidence/sweep-as-published.txt)
- [one load sent four times to one server](evidence/same-load-four-times.txt)
- [median TTFT with a cache reset before each run, against the old method](evidence/flushed-against-unflushed.txt)
- [the share of requests that met the target, and the P99 ITL, with and without the reset](evidence/share-and-tail.txt)

## Questions

1. The sweep used a fixed seed for the random dataset. What does a fixed seed send at every user count, and what in the server can notice it?
2. Which of the four benchmark numbers can a warm cache change, and which does it leave alone? Why?
3. You have the server up and ten minutes. How do you show the effect without a new sweep?
4. Read the reset rows. Where is the knee on this card, and how many users per replica does that give for a target of one second to the first token?
5. Write the protocol for two runs that you want to compare.

## Walkthrough

Start with the published table. Up to 16 users the first token sits at 191 to 288 ms while the output grows from 13.5 to 201.3 tokens per second. At 32 users the first token takes 1,800 ms and the P99 ITL goes from 85 to 613 ms. The table looks like a clean knee. A strong candidate asks what the server kept between the user counts, because the same server served all of them.

The second listing answers that. One load of 64 prompts at 16 users ran four times on one server with the same seed. The first run had a median first token of 925 ms. The repeat without a reset read 148 ms. A reset of the prefix cache brought the next run back to 1,163 ms, and a repeat after that read 184 ms again. Nothing changed in the server between the runs except the cache state. A fixed seed makes the random dataset send the same prompts each time, and the prefix cache keeps the KV blocks of the prompts that it saw. The same file notes that the time per output token moved by less than 15 percent, because a cache hit removes prefill work and leaves the decode work the same.

The third listing applies this to the sweep. With a reset before each run, the median first token at 4 users was 650 ms against 145 ms without it, a ratio of 4.5. At 8 users it was 951 to 978 ms against 264 to 274 ms, and at 16 users 1,550 to 1,587 ms against 294 to 295 ms. From 32 users the two methods agree, because the queue dominates and the cache cannot hide it. The old sweep did not reset the cache between the user counts, and each seed sent the same first prompts at every count, so the low counts read the first token too fast.

The last listing gives the knee. The share of requests that met a first token within 1 s and a mean ITL of 100 ms or less was 100 percent at 4 users in both methods. At 8 users it was 50 percent with the reset against 75 to 81 percent without. At 16 users it was 25 percent against 64 to 66 percent. The P99 ITL with the reset was 69 to 72 ms at 8 users and 522 to 523 ms at 16, while the run without a reset read 82 to 84 ms at 16. So the stream breaks between 8 and 16 users on this card, not between 16 and 32.

## Resolution

The cause was the method, not the server. The sweep kept one server and one seed, so every user count after the first found its prompts in the prefix cache. The cache moved the first token and left the decode alone, which is why the table looked plausible.

The fix has three parts. Start each run with an empty cache: restart the server, or call `POST /reset_prefix_cache`, which exists only with `VLLM_SERVER_DEV_MODE=1`, or `POST /flush_cache` on SGLang. Use a new seed for each run, so the dataset sends new prompts. Record the cached tokens from `vllm:prefix_cache_hits_total` and `vllm:prefix_cache_queries_total` before and after each run, and write them next to the result.

With the reset in place, the measured knee on this L4 sits between 8 and 16 users. The median first token was about 0.65 s at 4 users, 1.0 s at 8 and 1.6 s at 16, and the P99 ITL jumped from about 70 ms at 8 users to 522 ms at 16. One replica for every 8 users meets the target. The old plan of 16 users per replica put every replica past the knee, which is what production showed.

## Wrong turns

- "Turn the prefix cache off for the sweep." Production runs with the cache on, so the test must reset the cache between runs, not remove it. The reset keeps the hits that real traffic gets inside one run.
- "The knee is where throughput stops rising." Output peaked at 275.1 tokens per second at 32 users in the old table, but the latency broke well before that. The throughput peak and the latency knee are two different points.
- "Three seeds make the result safe." Each seed sent the same first prompts at every user count, so the second and third seeds hit the same warm blocks. More seeds repeat the error, they do not cancel it.
- "Restart the server once at the start of the sweep." Every user count after the first still inherits the blocks of the counts before it. The reset has to happen before each run.

## Generalize

Any cache between the client and the work under test turns a repeated benchmark into a cache test. That holds for a prefix cache, a compile cache, a page cache or a result cache in front of a model API. Before you compare two runs, decide the cache state on purpose, set it the same way for both runs, and record the hit count next to the numbers. When a result looks too good below some load and normal above it, look for a cache that the load defeats.

## Taught in

The vLLM manual covers the protocol in [the benchmark page](../../../manuals/vllm-101/sections/5-1-benchmark-your-server-in-15-minutes.md) and the corrected knee in [the chat tuning page](../../../manuals/vllm-101/sections/3-1-tune-chat-for-many-users.md), [the lab notes](../../../manuals/vllm-101/sections/r-7-lab-notes.md) record the sessions, the SGLang manual gives the same protocol in [its benchmark page](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md), and [the load testing lesson](../../../phases/17-infrastructure-and-production/22-load-testing-llm-apis/docs/en.md) covers the client side.
