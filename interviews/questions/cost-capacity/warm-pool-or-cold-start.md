---
id: warm-pool-or-cold-start
title: A warm replica all night, or a cold start at eight
card: cost-capacity
kind: tradeoff
level: 2
roles: [inference-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, ml-breadth]
tags: [cold-start, warm-pool, serverless, scale-to-zero]
minutes: 10
lessons: [phases/17-infrastructure-and-production/10-cold-start-mitigation]
manuals: [vllm-101#s-run-vllm-in-production]
practice: []
cheatsheet: [llm-cost-caching, serving-engines-compared]
related: [cost-capacity/batch-lane-triage]
updated: 2026-11-03
---

Your serverless endpoint scales to zero overnight. The first request in the morning waits minutes while a 70B model loads, and the product wants the first token within two seconds. One engineer wants a replica that never sleeps. Another calls that a GPU burning money all night. Settle it.

## Short answer

Both are right, and the decision is arithmetic per path. A warm replica costs one GPU hour every hour whether anyone calls or not, and it removes a cold start of several minutes for a large model. An interactive path with a tight first-token target on a large model needs the warm replica, while a small model with a cold start of seconds, or a background path that tolerates minutes, scales to zero. Then shrink the cold start itself, so that fewer paths need a warm replica at all.

## Full answer

### What a cold start is made of

The lesson's anatomy for a 70B model on a fresh node: node provision 45 to 60 seconds, image pull 120 to 300 seconds, weights into GPU memory 45 to 120 seconds, engine init 10 to 30 seconds. The sum is 220 to 510 seconds, which is 3 to 8 minutes before one token. The vLLM manual measured one part of that on its own machine: 330 seconds to load 57 GiB of weights.

### The warm-pool arithmetic

The lesson calls the arithmetic brutal on small models and kind on large ones. You pay 0.85 to 1.50 dollars an hour to avoid a 30 second start on a small model, and about 4 dollars an hour to avoid a 5 minute start on a large one. Five products with one warm replica each are 3,600 GPU-hours a month, called or not. The lesson's threshold: a warm pool becomes mandatory when the first-token target at P99 is under 60 seconds on a model of 70B or more.

### Tier the paths

| Path | Policy |
|---|---|
| live chat, voice agent | one or two warm replicas |
| nightly classification, batch | scale to zero, a cold start of minutes is fine |
| premium tenant | dedicated warm capacity |

### Shrink the cold start

Five layers, each removing a phase: a pre-seeded node image removes the image pull, model streaming halves the weight load, a GPU memory snapshot restores the loaded state in a fraction of the time, warm pools hide the rest, and tiered loading keeps weights in host memory. The lesson's table takes a 328 second cold start to about 15 seconds with the layers stacked, a reduction of 22 times. The vLLM manual adds the operational half: keep the weights on local disk, keep the compile cache on a persistent volume, and measure a cold and a warm start for every new image.

## Follow-ups

- **Level 2:** Which paths get a warm replica first? Expected: the interactive ones with a tight first-token target on a large model, such as live chat or a voice agent.
- **Level 2:** Whose cold start is cheaper to hide, a small model's or a large one's? Expected: in proportion, the large one's. For a small model you pay a full GPU hour to avoid seconds, and for a large one the same hour avoids minutes.
- **Level 3:** Name two mitigations that remove whole phases of the cold start. Expected: a pre-seeded node image removes the image pull, and a GPU memory snapshot removes most of the weight load and the init.
- **Level 3:** What is the break-even request rate for a warm replica? Expected: the rate above which the cost of cold starts, in requests that miss the target, exceeds the hourly price of the idle GPU. The lesson's simulator computes it.

## Wrong answers

- "Keep one warm replica everywhere, it is the simple answer." It is one GPU hour every hour per product. Five products idle all night cost thousands of GPU hours a month.
- "Scale to zero everywhere and let the first user wait." A first-token wait of minutes on an interactive path is an outage, not a wait.
- "A bigger GPU loads faster." The load is bound by the storage and the copy path. The fix is where the weights live and whether a snapshot exists.

## Taught in

The [cold start lesson](../../../phases/17-infrastructure-and-production/10-cold-start-mitigation/) gives the cost of a warm replica and the five mitigation layers, and the [production section of vLLM 101](../../../manuals/vllm-101/sections/7-2-run-vllm-in-production.md) measures the weight load and keeps the compile cache.
