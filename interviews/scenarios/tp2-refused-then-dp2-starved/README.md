---
id: tp2-refused-then-dp2-starved
title: Tensor parallel refused, data parallel starved
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, forward-deployed-ai-engineer]
rounds: [debugging, system-design]
tags: [tensor-parallel, data-parallel, shared-gpu, kv-pool, load-balancing, round-robin]
minutes: 25
lessons: []
manuals: [sglang-101#s-tp-size-dp-size-and-attn-dp-size, sglang-101#s-mem-fraction-static-and-startup-sizing]
practice: []
cheatsheet: []
related: [scenarios/startup-oom-shared-gpu, scenarios/load-knee-and-admission-cap]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-8B
  hardware: a node with two L4 GPUs, the second shared with another team's pods
source:
  - manuals/sglang-101/capture/gpu/incidents/l4-tp-unbalanced-memory.txt
  - manuals/sglang-101/capture/gpu/out-l4/server-dp2.log
  - manuals/sglang-101/capture/gpu/out-l4/server-dp2-tokens.log
  - manuals/sglang-101/sections/6-1-tp-size-dp-size-and-attn-dp-size.md
  - manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md
---

## Situation

A team serves `Qwen/Qwen3-8B` from one L4 and wants more capacity. The node has a second L4, so the plan is to use both. The first attempt is `--tp-size 2`. The server dies two seconds after NCCL comes up, with a `RuntimeError` that says the memory capacity is unbalanced and that some GPUs may be occupied by other processes. A quick look at the node shows two small pods from another team on the second card.

The second attempt is `--dp-size 2`, two copies of the model behind one controller. It starts, and the team runs its load sweep. At 64 users the pair delivers less output each second than the single card did, and each first token takes many seconds. An engineer from the other team suggests that the node itself is half broken and asks for a hardware ticket. You are asked to read the logs first.

## Evidence

- [what the second GPU held minutes before the start](evidence/the-other-tenant.txt)
- [the tensor parallel start, two seconds after NCCL came up](evidence/tp2-refused.txt)
- [the data parallel start: the weights and the pool of each rank](evidence/dp2-two-pools.txt)
- [four decode lines of the two ranks under a load of 64 requests](evidence/dp2-under-load.txt)
- [what the tensor parallel check does, and why it is right](evidence/the-check-and-the-rule.txt)
- [how the default load balancing method filled the small copy](evidence/what-round-robin-did.txt)
- [the same pair with requests routed by token count](evidence/routed-by-tokens.txt)

## Questions

1. What does the tensor parallel check compare, and why did the data parallel start pass where it failed?
2. The two copies loaded the same weights. Why is one pool an eighth of the other?
3. Under load, which rank held the queue and which one sat near idle? Which default sent the work there?
4. Would two copies with equal pools have doubled the capacity? What would you read before you claim it?
5. Name two fixes that keep both cards and one that does not, and say which of them the manual measured.

## Walkthrough

1. **Read the check in the tensor parallel error.** Before it loads weights, each rank measures its free memory, and the group keeps the smallest value. If that value is below 90 percent of the local free memory, the server stops. The error prints the three numbers: the free memory before loading, 18.28 GB, the local memory of the card, and 90 percent of that local memory, 19.53 GB, as the line. The second card had 3,506 MiB in use by two pods of 1,746 MiB each, and that put it under the line. No flag turns the check off at this version. The check is right to stop, because every rank of a tensor parallel group holds the same share of the weights and the same pool, so the smallest card would set the pool for both.
2. **Read why data parallel started.** Each copy sizes its own pool, so there is no balance check. Both ranks loaded 15.28 GB of weights. Rank 0 then had 6.59 GB free and rank 1 had 3.17 GB, because the pods held the rest. The pools came out at 24,094 tokens against 2,925. Four requests of 640 tokens fill the small one.
3. **Read the four decode lines.** Rank 1 ran 4 requests at a token usage of 0.82 to 0.87, wrote about 25 tokens per second, and had 59 requests in its queue. Rank 0 ran 1 to 3 requests at a usage of 0.02 to 0.07, wrote under 10 tokens per second, and had no queue. The controller's default method, `auto`, resolves to `round_robin` outside disaggregation, and round robin does not look at pools or queues. The benchmark keeps 64 requests open, so 63 of them sat on the small copy, 4 running and 59 waiting, and the client could not send the large copy more work until the small copy gave a slot back.
4. **Put a number on the loss.** At 64 users the pair gave 41.7 tokens per second against 250.9 on one L4, and the median P99 time to the first token over three seeds was 391 seconds for the pair and 33.4 for one L4. The pair also ran at 765 and 675 MHz at the two highest loads, under the clock floor, while the single card ran at 1,320 and 1,080 MHz, so part of the loss is the clock. Up to 4 users the pair was already 16 to 41 percent slower, for a reason the manual did not isolate.
5. **Read the one fix that was measured.** With `--load-balance-method total_tokens`, each request goes to the copy that holds the fewest tokens. The same uneven pair then gave 114.7 tokens per second at 64 users, against 41.7 with round robin and 250.9 on one card, and the median first token fell from 4,763 to 3,977 ms. The clock was 1,020 MHz in that run against 675 before, so part of that gain can be the card. The manual did not measure a pair with equal pools, and it did not measure two servers behind a gateway with weights. Its expectation is that data parallelism adds capacity only when every copy has about the same pool.

## Resolution

The node is not broken. The second card carries another tenant, and both layouts answered that fact in their own way: the balance check stopped the first layout before it loaded, and the second layout gave one copy a pool of 2,925 tokens and then fed it every second request. The team went back to one L4 for production traffic, because it beat the pair at every load, and asked for the pods to move. With two whole cards, they will start `--dp-size 2` again and accept it only after the two `#tokens` lines of the `DP0` and `DP1` ranks read about the same.

The pair of decode lines is the evidence for this reading: the rank with the small pool held 59 waiting requests while the rank with the large pool used 2 to 7 percent of its pool. Routing by token count raised the pair from 41.7 to 114.7 tokens per second at 64 users and still lost to the single card, so the pool, and not the router, is the limit to fix.

## Wrong turns

- "Tensor parallel is refused, so use data parallel, which starts." Starting is not serving. Read the `#tokens` line of every rank before the load test, because each copy sizes its own pool and nobody checks them against each other.
- "Lower the memory fraction so the tensor parallel check passes." The check compares free memory before the weights load, not the fraction. The smaller card would still set the pool for both ranks.
- "Round robin is fair, so the loss must be the hardware." Round robin does not read pools or queues. At 64 open requests, 63 sat on the copy with the small pool.
- "Fix the routing and the two copies will double throughput." Routed by tokens, the pair gave 114.7 tokens per second against 250.9 for one card. The small pool is still there, and part of the gain was a higher clock.

## Generalize

A parallel layout is a promise that every member carries an equal share. Tensor parallelism checks that promise before it loads and stops when a card is short. Data parallelism makes no check and gives each copy what its card has left, so a shared card becomes a small copy that a blind router fills first. Before you add a GPU, read what else lives on it, and after the start, read the pool line of every rank. Capacity that you did not verify per rank is a sum that does not add.

## Taught in

The parallelism page of SGLang 101 records both starts and the routing fix in [what happened on two L4s](../../../manuals/sglang-101/sections/6-1-tp-size-dp-size-and-attn-dp-size.md#what-happened-on-two-l4s) and [data parallelism on the same pair lost](../../../manuals/sglang-101/sections/6-1-tp-size-dp-size-and-attn-dp-size.md#data-parallelism-on-the-same-pair-lost), and the memory page explains why a pool is sized from the free memory of its own card in [how SGLang decides the split](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md#how-sglang-decides-the-split).
