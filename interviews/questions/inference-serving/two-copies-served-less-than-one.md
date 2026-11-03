---
id: two-copies-served-less-than-one
title: Two data-parallel copies, less output than one card
card: inference-serving
kind: debug
level: 3
roles: [inference-engineer]
rounds: [debugging, system-design]
tags: [data-parallel, kv-pool, round-robin, load-balance, shared-gpu]
minutes: 10
lessons: []
manuals: [sglang-101#s-tp-size-dp-size-and-attn-dp-size]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

You add a second L4 to an SGLang server with `--dp-size 2` and expect about twice the throughput. The sweep shows less than one card gave: at 64 users the pair peaks at 64 tokens per second and falls to 42, and the P99 first token is 391 seconds against 33.4 on one card. Both copies loaded the weights without an error. What do you check, and what went wrong?

## Short answer

Read the `KV Cache is allocated` line of every DP rank before you trust the sum. On that pair the second card ran two pods of another team, so its copy had 3.17 GB free after the weights against 6.59 GB and a pool of 2,925 tokens against 24,094, an eighth of the first. The round-robin controller does not look at pools, so it sent every second request to the small copy, where 4 ran and 59 waited, while the large copy held one to three requests and used 2 to 7 percent of its pool.

## Full answer

### The two pools

The startup lines of the two ranks tell the story before the first request:

- `DP0` loaded the weights in 3.61 s and had 6.59 GB left; its pool was 24,094 tokens.
- `DP1` loaded the same 15.28 GB of weights in 3.73 s and had 3.17 GB left, because two pods of 1,746 MiB each held the rest; its pool was 2,925 tokens. Four requests of 640 tokens fill it.

The decode lines at 64 running requests show the result. `DP1` ran 4 requests at a token usage of 0.82 to 0.87 with 59 in its queue. `DP0` ran one to three requests at a usage of 0.02 to 0.07 with an empty queue.

### Why the client could not help

The benchmark keeps 64 requests open at a time. Round robin alternates requests between the copies without a look at pools or queues. At 64 users, 63 requests sat on the small copy, 4 running and 59 waiting. The client could not send the large copy more work until the small copy gave a slot back.

### What it cost

One L4 reached 270 tokens per second. The pair peaked at 64 and fell to 42 as its clock fell: it ran at 765 and 675 MHz at 32 and 64 users, under the manual's clock floor, while the single card ran at 1,320 and 1,080 MHz, so part of the loss is the clock. At 64 users the median P99 first token of three seeds was 33.4 seconds on one card and 391 seconds on the pair. Up to 4 users the pair was already 16 to 41 percent slower for a reason the manual did not isolate, and at one user it took 79.6 ms per token against 60.2 at a higher clock. With a fixed arrival rate the pair completed at most 0.21 requests per second inside the latency target, against 0.96 for one card.

### Route by tokens

`--load-balance-method total_tokens` sends each request to the copy that holds the fewest tokens. On the same uneven pair it gave 114.7 tokens per second at 64 users, against 41.7 with round robin and 250.9 on one L4. At 8 users it gave 92.1 against 64.2 and 112.6. The median first token at 64 users fell from 4,763 to 3,977 ms. That run had a median clock of 1,020 MHz against 675 in the round-robin run, so part of the gain is the card. A large gain over round robin, and still a loss against one card.

### Tensor parallelism would have refused

`--tp-size 2` on the same pair stopped two seconds after the collective library started. Before it loads weights, each rank measures its free memory and the group keeps the smallest value. If that value is under 90 percent of the local free memory, the server stops. The shared card had 18.28 GB free against the 19.53 GB that the check required. Each rank of a tensor group holds the same share of weights and the same pool, so the smallest card sets the size for all. `--dp-size 2` has no such check, because each copy sizes its own pool, so it started and lost.

### The rule

Add capacity with copies only when every copy has about the same pool. Give a group whole GPUs on a shared machine. Check the `#tokens` line of each DP rank before you count on the sum. The other fix, two separate servers behind a gateway with weights, the manual did not measure.

## Follow-ups

- **Level 3:** Why did the large copy sit almost idle while 59 requests waited? Expected: the benchmark is a closed loop with 64 open requests, round robin put half of them on the small copy, and the client could not send new work to the large copy until the small copy returned a slot.
- **Level 3:** Why did a tensor split refuse the same pair while the data-parallel pair started? Expected: tensor parallelism checks that every rank has at least 90 percent of the local free memory, because every rank holds the same share and pool, and the shared card had 18.28 GB against the 19.53 GB required; data parallelism sizes each copy's pool on its own and has no such check.
- **Level 4:** Routing by total tokens lifted the pair to 114.7 at 64 users. Is the problem solved? Expected: no; one card alone gave 250.9, the token-routed run also had a higher clock than the round-robin run so part of the gain is the card, and the fix is equal pools, with whole GPUs for each copy or separate servers behind a gateway with weights.

## Wrong answers

- "Both copies loaded, so the second card is fine." The weights need 15.28 GB on each card; the pool is sized from what is left, and the shared card had 3.17 GB left against 6.59, an eighth of the pool.
- "The controller balances load, so a slow copy gets fewer requests." The default round robin does not look at pools or queues; it alternated requests, so 63 of 64 open requests ended on the small copy.
- "The pair is slower because of the clock, so run it again when the card is cool." The pair did run under the clock floor at 32 and 64 users, but it was already 16 to 41 percent slower up to 4 users, and the log shows 59 requests waiting on one copy; the pool explains the shape and the clock explains part of the size.

## Taught in

[The SGLang parallelism section](../../../manuals/sglang-101/sections/6-1-tp-size-dp-size-and-attn-dp-size.md) has the two-pool listing, the sweep and the routing fix.
