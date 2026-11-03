---
id: disaggregated-benchmark-false-success
title: A split benchmark that counted failures as wins
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [disaggregation, benchmark, kv-transfer, retokenized, false-success, router]
minutes: 20
lessons: [phases/17-infrastructure-and-production/22-load-testing-llm-apis]
manuals: [sglang-101#s-prefill-decode-disaggregation, sglang-101#s-sglang-benchmark-serving, sglang-101#s-sgl-model-gateway, vllm-101#s-split-prefill-and-decode]
practice: []
cheatsheet: [async-disaggregated-inference, inference-load-testing]
related: [scenarios/prefix-cache-inflated-benchmark]
updated: 2026-11-03
system:
  version: SGLang 0.5.22 with the mooncake_tcp transfer backend
  model: Qwen/Qwen3-8B
  hardware: two L4s in one node, the second shared with another team
source:
  - manuals/sglang-101/capture/gpu/incidents/l4-pd-mooncake-tcp-queue.txt
  - manuals/sglang-101/capture/gpu/incidents/l4-pd-summary-lines.txt
  - manuals/sglang-101/capture/gpu/out-l4/bench-pd-swap.txt
  - manuals/sglang-101/sections/6-3-prefill-decode-disaggregation.md
---

## Situation

A team wants to stop long prompts from pausing other users' streams, so they split `Qwen/Qwen3-8B` into a prefill server on the first L4 and a decode server on the second L4, behind the router. The two cards have no RDMA, so the KV cache moves over TCP. The second card also runs another team's pods.

They run the fixed-rate sweep through the router. At a fixed rate of 8 per second, the summary prints 240 successful requests of 240 and output throughput of 751.85 tokens per second, higher than the 728.61 of their best single server at the same rate. The slide is ready. A reviewer reads the summary once more and stops at one line: the mean time to first token is 0.00 ms.

## Evidence

- [the transfer backend and the two KV pools at startup](evidence/two-pools.txt)
- [the decode server waits, the transfer queue fills, the session dies](evidence/queue-fills.txt)
- [the count of failed transfers and the benchmark summary at 8 requests per second](evidence/the-summary-that-lied.txt)
- [the summary lines of the sweep with prefill on the full card and decode on the shared card](evidence/sweep-summary-lines.txt)
- [the same sweep with the roles swapped](evidence/the-swap.txt)

## Questions

1. Read the two pool lines. What asymmetry do they describe, and what does it do to a request that prefills on one card and decodes on the other?
2. The decode line shows 2 running requests and 19 pre-allocated. What is the decode server waiting for, and what piles up on the prefill side while it waits?
3. After the session failed, every later request still counted as a success. How can a router return a 200 with no text, and which two summary numbers expose it?
4. The swapped split worked up to 8 users and lost text from 16. What does that say about where the small pool hurts?
5. Write the rule that your benchmark kit applies before it prints a throughput number.
6. When is a prefill-decode split worth its new failure modes, and what measurement must exist before you keep one?

## Walkthrough

Start with the pools. The prefill server allocated a KV cache of 24,094 tokens, and the decode server, on the shared card, allocated 2,925 tokens. A request prefills on the large pool and must then find room on the small one. The decode pool holds about four requests of our size at once, so almost every request that the prefill side finishes has to wait for decode memory.

The second listing shows the wait. The decode server ran 2 requests, with 19 more pre-allocated and waiting for memory. Prefill kept producing KV caches for them, and the TCP transfer lane to decode filled: the log counts 4,096 queue-full rejections. About three minutes into the sweep the transfer session failed. Every transfer after that failed too, from both sides: prefill could not send its KV chunk, and decode could not get the cache from a prefill instance that it thought was dead. The session never came back.

The third listing is the dangerous part. The prefill log holds 2,902 transfer failures, and the benchmark still counts every one of its 240 requests as a success at that rate, with 30,720 generated tokens. Two numbers give it away. The retokenized token count is 0, so no text came back for the client to count. The mean TTFT is 0.00 ms, because no first token ever arrived. The router returned 200 for a request whose decode never ran, and the client counted the requested output length as generated. That is how a throughput of 751.85 came from a server that wrote nothing.

The sweep summary lines show that the split failed early at every load. At 2 users only 512 of 2,048 generated tokens came back as text, and at 4 users none did, while the printed throughput jumped to 2,516.97. The fixed-rate sweep lost most of its text from 0.5 requests per second. The swapped split, with decode on the full card and prefill on the shared one, worked from 1 to 8 users with every token retokenized. At 16 users 2,048 of 8,192 tokens came back as text, and at 32 users none did, while the printed throughput still read 333.41. So the small pool breaks the split on whichever side it sits, only later when it sits on the prefill side.

## Resolution

There is no measured result for the split under load on this pair of cards, and the team must not claim one. The transfer session between the two servers failed under the asymmetric pools and did not recover, and the router then counted empty responses as successes.

Three fixes follow. First, the benchmark kit refuses any run in which every request has a time to first token of 0, and reports `Total generated tokens (retokenized)` next to the generated count on every summary. Second, a split needs two pools of a size that matches the traffic, which the shared card could not give, and the metrics `sglang:num_transfer_failed_reqs_total` and `sglang:num_bootstrap_failed_reqs_total` must stay flat during the run. Third, the team goes back to one server, measures the inter-token latency when long prompts arrive, and splits only if that measurement shows prefill interference that data-parallel copies behind the gateway cannot remove.

## Wrong turns

- "The split gave 751.85 tokens per second, more than the single server." The retokenized token count was 0. The throughput counted tokens that the client asked for, not tokens that arrived.
- "240 successful requests of 240 means the router and both servers are healthy." The router returned 200 for requests whose transfer had failed. Only the retokenized count and the first-token time show that the text was empty.
- "Raise the transfer queue size so the lane does not reject." The lane filled because decode could hold two requests in a 2,925-token pool. A larger queue delays the same failure.
- "Give decode the full card, then the split works." The swapped split lost text from 16 users and everything at 32. The small pool breaks the split on either side, only at a different load.
- "Add a fifth check later, the slide is due." A throughput number from a run with no text is not late, it is wrong. The acceptance rule belongs in the kit before the first slide.

## Generalize

A pipeline of two services can report success at the boundary while the work never happened, because the component that answers the client is not the component that failed. Every benchmark summary needs a check that the output exists, not only that the request returned, and every split architecture needs a single-server baseline and a transfer-failure counter before its number means anything.

## Taught in

The SGLang manual records both splits in [the disaggregation page](../../../manuals/sglang-101/sections/6-3-prefill-decode-disaggregation.md), gives the benchmark client in [the benchmark page](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md) and the router in [the gateway page](../../../manuals/sglang-101/sections/6-4-sgl-model-gateway.md), the vLLM manual covers the same split in [its prefill and decode page](../../../manuals/vllm-101/sections/6-3-split-prefill-and-decode.md), and [the load testing lesson](../../../phases/17-infrastructure-and-production/22-load-testing-llm-apis/docs/en.md) explains why a client can lie.
