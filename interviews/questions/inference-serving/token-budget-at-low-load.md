---
id: token-budget-at-low-load
title: A larger token budget at low load
card: inference-serving
kind: tradeoff
level: 3
roles: [inference-engineer]
rounds: [design-review, ml-depth]
tags: [token-budget, chunked-prefill, p99-itl, ttft]
minutes: 10
lessons: []
manuals: [vllm-101#s-keep-long-prompts-from-stalling-short-ones]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

A teammate proposes `--max-num-batched-tokens 16384` so that long prompts get their first token sooner. The server runs a model with mixture-of-experts layers on one card. Requests arrive at about half a request per second, with prompts between 1,024 and 4,096 tokens. What do you expect to change, and what would you measure before you accept the change?

## Short answer

A larger budget lets a long prompt finish its prefill in fewer steps, but each of those steps takes longer, and every running stream waits for it. At low load I expect a faster first token and a worse P99 ITL, and I would measure both with several seeds at the real request rate. On our GB10 at 0.5 requests per second, 16,384 raised the P99 ITL from 574 to 798 ms, while the first-token gain did not clear the seed spread.

## Full answer

### What the manual measured

Budgets of 2,048 and 16,384 tokens on the GB10 with Qwen3-30B-A3B, requests at a fixed rate, three seeds per point, each request asking for 64 to 256 tokens:

| Requests per second | Budget | Median TTFT | Median TPOT | P99 ITL |
|---|---|---|---|---|
| 0.5 | 2,048 | 1,145 ms | 149.3 ms | 574 ms |
| 0.5 | 16,384 | 906 ms | 139.4 ms | 798 ms |
| 1 | 2,048 | 454 ms | 156.5 ms | 405 ms |
| 1 | 16,384 | 477 ms | 156.9 ms | 395 ms |
| 2 | 2,048 | 560 ms | 205.5 ms | 587 ms |
| 2 | 16,384 | 595 ms | 205.1 ms | 586 ms |

At 0.5 requests per second the larger budget raised the P99 ITL by 39 percent, and the seed ranges did not overlap. The first token came sooner, but the seed ranges of the first token overlapped. So the cost is clear and the gain is not confirmed. At 1 and 2 requests per second the two budgets gave the same numbers within the seed ranges. All runs held a median clock of 2,398 to 2,411 MHz, so the clock does not explain any row.

### Why the effect fades with the rate

At a higher rate more requests share each step. One long prompt then fills a smaller share of the budget, and how it is chunked matters less. The result is narrow: two budgets, three low rates, one model, one machine. The P-PAS paper found that no single fixed budget was best at every load: a large budget won at low prefill pressure, a small one when several prefills competed with running streams.

### An open result

The median first token at 0.5 requests per second was slower than at 1 request per second for both budgets. All three seeds at 0.5 were above 900 ms with the 2,048 budget, and all three at 1 were below 600 ms. One slow seed does not explain it. The manual did not find the cause and says so.

### How to decide

1. Read the budget that your server uses. The run with no flag matched 2,048 on this machine.
2. If the P99 ITL is too high and long prompts arrive, lower the budget.
3. If the first token of long prompts is too slow and the P99 ITL has room, raise it.
4. Measure at your real request rate, and again when your load changes.

`--long-prefill-token-threshold` caps the tokens that one long prompt gets in a step when other requests wait. It is off by default and the manual did not test it.

## Follow-ups

- **Level 3:** At the two higher rates the budgets tied. Why does the difference vanish as the rate rises? Expected: more requests share each step, so one long prompt fills a smaller share of the budget and its chunking matters less.
- **Level 3:** Both budgets gave a later first token at the lowest rate than at the next rate up. How do you report that? Expected: all three seeds agreed, so it is not one slow seed; the cause was not found, so it stays an open result and no rule is built on it.
- **Level 4:** Is there one budget that wins at every load? Expected: no; a large budget wins when prefill pressure is low and a small one when several prefills compete with streams, so the value must move with the load.

## Wrong answers

- "A larger budget is free because the GPU has spare compute at low load." Each step with a bigger chunk takes longer and every running stream waits for it; the P99 ITL rose 39 percent at 0.5 requests per second.
- "Set the budget once from the GPU size and leave it." The best value moved with the request rate in these runs, so measure at your real rate and again when the load changes.
- "The drop from 1,145 to 906 ms proves the first-token gain." The seed ranges of the first token overlapped, so the cost is confirmed and the gain is not.

## Taught in

[Keep long prompts from stalling short ones](../../../manuals/vllm-101/sections/3-3-keep-long-prompts-from-stalling-short-ones.md) has the six measured rows and the tuning order.
