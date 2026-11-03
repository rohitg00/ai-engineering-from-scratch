---
id: request-id-at-prompt-start
title: A request ID that opens the prompt
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, applied-ai-engineer, agentic-ai-engineer]
rounds: [debugging, ml-depth]
tags: [prefix-cache, prompt-layout, radix-cache, cached-tokens, ttft]
minutes: 15
lessons: [phases/17-infrastructure-and-production/06-sglang-radixattention]
manuals: [sglang-101#s-prefix-friendly-prompts, sglang-101#s-radixcache, vllm-101#s-make-repeated-prompts-hit-the-prefix-cache]
practice: []
cheatsheet: [sglang-serving]
related: [scenarios/prefix-cache-inflated-benchmark, inference-serving/prefix-cache-order]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-8B
  hardware: one L4 with 24 GB of memory, and a GB10 as the second machine
source:
  - manuals/sglang-101/capture/gpu/out-l4/cache-experiment.txt
  - manuals/sglang-101/capture/gpu/out-l4/server-default.log
  - manuals/sglang-101/capture/gpu/out-gb10/cache-experiment.txt
  - manuals/sglang-101/sections/3-4-prefix-friendly-prompts.md
---

## Situation

An agent product sends every request through a relay. For tracing, the relay puts a new first line in the system prompt, in the form `Request id <hex>.`, with a new value on each call. The system prompt itself is 2,999 tokens long and never changes. The team serves `Qwen/Qwen3-8B` with SGLang on an L4, with `--enable-cache-report` on.

Users report that the first token takes about two seconds on every turn, even when they repeat a question. The team doubles the memory fraction, tries a different eviction policy and turns on hierarchical caching. The wait does not move. The metrics endpoint reports a cache hit rate near zero.

## Evidence

- [five requests whose system prompt starts with a request id](evidence/id-at-start.txt)
- [the same five requests with a stable system prompt](evidence/stable-prompt.txt)
- [the same request id moved to the end of the system prompt](evidence/id-at-end.txt)
- [the scheduler log while the three forms went through](evidence/scheduler-view.txt)
- [the summary of the same experiment on a GB10 with a larger model](evidence/second-machine.txt)

## Questions

1. The first listing shows five requests. What does the cached token count tell you about where the match stopped?
2. How does the radix tree match a prompt, and why can nothing after the first difference match?
3. In the third listing the id comes last in the prompt. Predict the cached token count before you read it, then explain the difference.
4. Which three places can confirm a hit or a miss on a running server, from the closest to the request to the most general?
5. The team tuned the cache tiers and the eviction policy first. Why did none of those settings help, and in which order do you change prompts and server flags?

## Walkthrough

Read the first listing one field at a time. Each request sends about 3,030 prompt tokens and the server reports `cached_tokens` of 3 or 6. The first token takes 2,159.2 to 2,171.2 ms on every round. So each request pays the full prefill of the system prompt, and the only tokens that the cache found are the few that come before the random hex digits.

The second listing is the control. The same question after a stable system prompt reports 2,998 cached tokens of 2,999 from the second round on, and the first token arrives in 80.7 to 85.1 ms. The first round shows 3 cached tokens and 2,143.9 ms, because it filled the cache. So the server and the model can serve this prompt about twenty-five times faster when the prompt matches.

The third listing moves the same random id to the end of the system prompt. The count rises to 2,983 to 2,987 cached tokens. The first token takes 93.1 to 99.7 ms. The tokens are almost the same in all three forms. Only their order differs. The radix tree compares tokens from the first one and stops at the first difference. Nothing after a difference can match, because the attention values of every later token depend on every earlier token. A cache that reused the later tokens would return wrong answers.

The scheduler log shows the same story from the server side. The stable rounds log `#cached-token: 2998` with one new token. Then five prefill batches log about 3,025 to 3,029 new tokens with 3 or 6 cached. Then the id-at-end rounds log 45 to 50 new tokens with 2,983 to 2,987 cached. The last listing repeats the experiment on a GB10 with a mixture-of-experts model. The times are different, 632.2 ms against 44.75 ms, and the cached token counts are the same: 6 against 2,998.

## Resolution

The relay put a changing value at the start of the only part of the prompt that every request shares. One edit fixed it. Move the trace id out of the system prompt and send it as request metadata, or put it at the end. In our measurement on the L4 the median first token fell from 2,161.4 ms with the id at the start to 98.2 ms with the id at the end, and the median cached token count rose from 6 to 2,986 of about 3,030.

Prove the fix from three places. Start the server with `--enable-cache-report` and read `cached_tokens` in the usage block of each response. Read `#cached-token` on each `Prefill batch` line of the scheduler log. Read `sglang:cache_hit_rate` from `/metrics`. On vLLM, read `vllm:prefix_cache_hits_total` and `vllm:prefix_cache_queries_total`. The cache settings that the team changed first were not the problem, because no eviction policy or host tier can match tokens that differ from the start.

## Wrong turns

- "Raise the memory fraction so the cache holds more." The pool was not full. The misses came from the prompt order, so a larger pool holds more blocks that nothing matches.
- "Turn on hierarchical caching." A host tier keeps evicted prefixes, and nothing was evicted. The prefix never matched in the first place.
- "The hit rate is low because the questions differ." The question is about 30 tokens at the end of a prompt of 2,999 tokens. A changing question costs about 30 tokens of prefill, not 2,999.
- "Hash the system prompt and route by it." Routing matters when several servers split the traffic, but this was one server, and the prompt differed on every request before routing could help.

## Generalize

Treat the prompt layout as part of the serving system. Put the content that never changes first, the content that changes per session next, and the content that changes per request last. Keep ids, timestamps, hashes and random seeds out of the system prompt, and keep tool definitions and JSON keys in a fixed order. Before you change any cache flag, read the cached token count on your real requests. A prompt fix can recover a hit rate that no server flag can.

## Taught in

The SGLang manual measures the three prompt forms in [the prefix-friendly prompts page](../../../manuals/sglang-101/sections/3-4-prefix-friendly-prompts.md) and explains the tree in [the RadixCache page](../../../manuals/sglang-101/sections/3-3-radixcache.md), the vLLM manual gives the same rule in [its prefix cache page](../../../manuals/vllm-101/sections/3-2-make-repeated-prompts-hit-the-prefix-cache.md), and [the RadixAttention lesson](../../../phases/17-infrastructure-and-production/06-sglang-radixattention/docs/en.md) builds the mechanism from scratch.
