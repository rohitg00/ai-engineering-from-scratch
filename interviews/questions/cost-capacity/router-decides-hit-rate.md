---
id: router-decides-hit-rate
title: A second replica that undoes the prefix cache
card: cost-capacity
kind: design
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [system-design, ml-depth]
tags: [routing, prefix-cache, replicas, session-affinity]
minutes: 15
lessons: [phases/17-infrastructure-and-production/19-ai-gateways]
manuals: [sglang-101#s-sgl-model-gateway, vllm-101#s-run-vllm-on-kubernetes]
practice: []
cheatsheet: [sglang-serving, llm-routing-gateways, gpu-kubernetes]
related: [cost-capacity/hit-rate-gauge-lies, inference-serving/prefix-cache-order]
updated: 2026-11-03
---

You add a second serving replica to double capacity. Throughput rises, but the first-token time of long chat sessions gets worse, and the cache hit rate on both servers falls. Explain the cause, and design the routing so that the second replica stops undoing the cache.

## Short answer

Each replica has its own KV cache, and a router that spreads requests at random or in turn sends turn five of a chat to the replica that never saw turns one to four. That replica prefills the whole history again, which is the prefix miss the cache exists to avoid. Route each conversation back to the replica that holds its prefix with a cache-aware policy that remembers which server saw which text, with a load-balance check in front of it. Then read the hit rate on the servers themselves, because the router's record is a guess.

## Full answer

### The mechanism

A plain Kubernetes Service spreads requests at random. The in-server data parallel controller of SGLang defaults to round robin, which ignores prefixes. Either way, a conversation's turns land on different replicas, and each replica computes the history that the other one already holds. A field report in the SGLang manual measured the damage: with turn-by-turn routing, 23 percent of input tokens were computed again. One request header that pinned each conversation to one GPU raised the cache hit rate from 64.7 to 92.1 percent and halved the median time to first token.

### How a cache-aware router picks a server

The SGLang gateway keeps one approximate radix tree per model, over the characters of the request text, so it never tokenizes to route. For each request it does three things in order:

1. It checks balance. When the busiest server's load is more than 64 above the lightest and more than 1.5 times the lightest, the request goes to the least-loaded server.
2. Otherwise it computes the match rate, the share of the request text that matches the tree. Above 0.3, the request goes to the server with the longest match.
3. Below 0.3, it goes to the least-loaded server.

Every 120 seconds a background task trims each tree to at most 67,108,864 nodes. The balance check comes first on purpose: a prefix-first policy would pile every long conversation onto one hot server.

### The tree is a guess

The gateway records where it sent text. It never asks a server what it still holds, and a server can evict the prefix later. So a request can arrive at the server the tree names and still prefill. Check the hit rate on the servers themselves, from their counters over a window, and not only the routing decisions.

### Pick the policy by traffic

Cache-aware routing for chat and agent traffic, where turns share long prefixes. A power-of-two or round-robin policy for batch traffic with unique prompts, because a match rate under the threshold gives no affinity anyway. Do not put multi-turn traffic behind in-server data parallelism with its round-robin default.

### The same idea in the vLLM layers

The vLLM manual lists routers that read the engine's metrics to pick a replica, and one that also reads the KV cache events the engine publishes with `--kv-events-config`, so that a request goes to the replica that holds its prefix. The production stack's router keeps a session on one replica. In the gateway lesson's vocabulary, this is provider routing one level down: the AI gateway routes across providers, and the engine router routes across replicas.

### Pin the router with the engine

The SGLang manual records an incident where the same engine build gave 132,140 tokens per second with one router version and 69,767 with the next. Benchmark the router and the engine as one system, and pin both versions.

## Follow-ups

- **Level 3:** Why does the router check load balance before the prefix match? Expected: a prefix-first policy would send every long conversation to one hot server. The imbalance test sends the request to the least-loaded server when the gap is large.
- **Level 3:** Which traffic should not use the cache-aware policy? Expected: batch traffic with unique prompts. A match rate under the threshold gives no affinity, so a load-based policy does the same work with less state.
- **Level 4:** One server's hit rate stays low although the gateway routes its conversations there. Why? Expected: the gateway's tree records where it sent text, not what the server still holds. The server evicted the prefix, so the request prefills. Read the server's own counters.
- **Level 4:** You upgrade the router without touching the engine. What do you measure? Expected: throughput and hit rate of the router and the engine as one system, because a router change alone halved throughput in a reported incident.

## Wrong answers

- "Add a replica and each server's hit rate stays the same." Each replica has its own cache, and random routing splits every conversation across both.
- "Hash the user id to a server and be done." It keeps a user on one server and ignores load. The manual's gateway balances first, so a hot user cannot saturate one replica with no relief.
- "Turn on in-server data parallelism instead of a gateway." Its default method is round robin, which ignores prefixes, which is the problem you are solving.

## Taught in

The [model gateway section of SGLang 101](../../../manuals/sglang-101/sections/6-4-sgl-model-gateway.md) explains cache-aware routing and the field report, the [Kubernetes section of vLLM 101](../../../manuals/vllm-101/sections/6-4-run-vllm-on-kubernetes.md) names the routers that read engine metrics and cache events, and the [AI gateways lesson](../../../phases/17-infrastructure-and-production/19-ai-gateways/) places routing among the gateway features.
