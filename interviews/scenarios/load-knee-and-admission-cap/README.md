---
id: load-knee-and-admission-cap
title: The load knee and the cap that made it worse
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [debugging, system-design]
tags: [p99-itl, admission, max-num-seqs, knee, chat, goodput]
minutes: 25
lessons: [phases/17-infrastructure-and-production/08-inference-metrics-goodput]
manuals: [vllm-101#s-tune-chat-for-many-users, vllm-101#s-why-one-token-budget-replaces-a-prefill-phase, sglang-101#s-admission-and-retraction, sglang-101#s-reading-other-peoples-benchmarks]
practice: []
cheatsheet: [inference-load-testing, serving-engines-compared]
related: [scenarios/prefix-cache-inflated-benchmark, inference-serving/goodput-sets-the-cap]
updated: 2026-11-03
system:
  version: vLLM 0.31.0 against SGLang 0.5.22
  model: Qwen/Qwen3-8B
  hardware: one L4 with 24 GB of memory; the first sweep ran at the full clock, and the reruns locked the SM clock at 900 MHz
source:
  - manuals/vllm-101/sections/3-1-tune-chat-for-many-users.md
  - manuals/sglang-101/sections/5-3-reading-other-peoples-benchmarks.md
  - manuals/sglang-101/capture/gpu/out-l4/server-h2h-sglang.log
  - manuals/sglang-101/capture/gpu/out-l4/server-h2h-vllm.log
  - manuals/vllm-101/capture/gpu/out-l4/admission-cap-64-users.txt
  - manuals/vllm-101/capture/gpu/out-l4/load-flushed-vs-unflushed.txt
---

## Situation

A chat service streams answers from `Qwen/Qwen3-8B` on one L4 with vLLM. Its target is a first token within one second and 100 ms or less between tokens. At busy hours the service has 64 users at once, and the stream stalls: users see a token, then a gap of more than a second, then a burst. Throughput on the dashboard still looks fine, 241.39 tokens per second.

An engineer reads that `--max-num-seqs` limits the requests that run at once, and lowers it from the default of 256 to 16 to make each stream smoother. The next morning the gaps are still there, and the median wait for the first token is now about a minute. A second engineer proposes to switch the engine, because a competing engine kept the gaps near 150 ms on the same card in a published table.

## Evidence

- [the chat sweep with the share of requests that met the target](evidence/chat-target-by-users.txt)
- [the share that met the target and the P99 ITL, with and without a cache reset before each run](evidence/flushed-against-unflushed.txt)
- [a cap of 16 sequences against the default at 32 users](evidence/cap-of-16-at-32-users.txt)
- [two engines with the same pool, from 1 to 64 users](evidence/two-engines-at-a-full-pool.txt)
- [the SGLang pool and one decode line at a cap of 64](evidence/sglang-stats-at-64.txt)
- [the vLLM pool and one stats line at a cap of 64](evidence/vllm-stats-at-64.txt)
- [every admission cap that we tried at 64 users](evidence/caps-at-64-users.txt)

## Questions

1. Which two numbers does a chat user feel, and why is throughput the wrong number to watch here?
2. Read the first listing. At which user count does the service stop meeting the target, and what rises first, the first token or the gaps between tokens?
3. What does a cap on running sequences change inside one scheduler step, and what does it leave unchanged?
4. Both engines write the same tokens per second at 64 users. Explain from the two log lines why one gives the first token sooner and the other keeps the stream smooth.
5. The last listing tries six caps. State the result in one sentence, then say what does fix the gaps on this card.
6. Suppose you must keep vLLM. Which flag, which replica count, and which metric do you set, and how do you prove the fix?

## Walkthrough

A chat user feels the time to the first token and the gap between tokens, the inter-token latency. Throughput is the bill, not the experience. One long pause in a stream feels worse than a slightly slower stream, so the number to watch is the P99 ITL, the worst gap in 100.

The first listing is the sweep from the full-clock session. At 8 users, 75 percent of the requests met the target and the P99 ITL was 67 ms. At 16 users the share was 64 percent at 85 ms. At 32 users the output still rose to 275.1 tokens per second, but the P99 ITL grew to 613 ms and no request met the target. At 64 users the first token took 11.18 s and the P99 ITL was 1,233 ms. So the gaps break before the output stops growing. This sweep did not reset the prefix cache between user counts, so the low rows read the first token too fast. The second listing holds the rerun that reset the cache ahead of every run and the clock locked at 900 MHz. At 8 users, 50 percent met the target against 75 to 81 percent without the reset. At 16 users it was 25 percent against 64 to 66 percent, and the P99 ITL was 522 to 523 ms with the reset against 82 to 84 ms without. So the stream breaks between 8 and 16 users on this card.

The third listing shows what the cap did. With `--max-num-seqs 16` at 32 users, the median ITL fell from 80.5 to 69.8 ms and the P99 ITL from 613 to 595 ms. The first token moved from 1.8 s to 12.3 s, and output fell from 275.1 to 171.8 tokens per second, a loss of 38 percent. The cap run had the higher clock, so the clock does not explain the loss. A cap does not make room for more users. It only chooses who waits, and it moves the wait from the stream to the queue.

The fourth listing compares two engines on the same pool of 24,096 tokens. Up to 32 users they tie on output. At 64 users SGLang gave 256.62 tokens per second and vLLM 241.39. The medians for the first token were 18,356 ms against 10,953 ms, and the P99 ITL was 114 ms against 1,363 ms. The two log lines say why. SGLang ran 37 requests and kept 27 in its queue with the pool 92 percent full. vLLM ran 40 requests and kept 11 waiting, filled 99.5 percent of its pool and prefilled new prompts at 460.3 tokens per second while the others decoded. Each new prefill shares the step with the running streams, so the streams stall. vLLM chose the first token, SGLang chose the stream.

The last listing tries to buy the smooth stream back with caps. The clock did not hold at 900 MHz in every run, so read the clock column before the cap. Three rows ran at 900 MHz. The SGLang default gave a P99 ITL of 143 to 153 ms with a first token at 19.4 s. The vLLM default gave 1,359 ms at 11.8 s. `--max-num-active-seqs 48` gave 1,329 to 1,373 ms at the same 11.8 s, so that cap changed nothing. `--max-num-seqs 32` ran at 900 and 795 MHz, gave 1,163 to 1,399 ms and pushed the first token to 17.2 to 20.6 s. `--max-num-active-seqs 16` ran at 795 and 683 MHz, so it is not a matched result, but it gave 1,133 to 1,139 ms with a first token at 44.8 to 48.8 s and the output down to 129 to 136. No cap brought the P99 ITL under 1.1 s, and the caps that changed anything moved the wait to the first token.

## Resolution

Two things were wrong. The service ran past its knee, and the cap treated a capacity problem as a scheduling problem. The knee on this card, measured with a cache reset, sits between 8 and 16 users. At 64 users the pool holds about 37 to 40 requests of 640 tokens, so the rest wait, and every new prefill that enters a step pauses the running streams.

The fix is fewer users per replica. On this card, 8 users per replica met the target for half the requests and 16 users for a quarter, so the replica count comes from the target, not from the throughput peak. Remove the `--max-num-seqs 16` setting, because at 32 users it cut output by 38 percent and pushed the first token from 1.8 s to 12.3 s at the median while the P99 ITL stayed near 600 ms. Keep the default admission and add replicas until the P99 ITL and the first token both meet the target at the busiest hour.

The engine switch is a real option, not a fix. On the same pool at 64 users SGLang kept the P99 ITL at 114 ms and made users wait 18,356 ms for the first token. vLLM did the reverse. Pick the engine by which of the two numbers your users forgive, and measure the pair on your own card.

## Wrong turns

- "Lower the batch so each step is faster." A cap on sequences does not add room. It picks who waits, and the first token then waits in the queue. At 32 users the cap cost 38 percent of the output.
- "Throughput is fine, so the server is fine." At 32 users the output still rose while no request met the target. Throughput measures the bill, the P99 ITL measures the user.
- "Shorten the maximum model length to fit more users." The pool stays the same size, so the same number of 640-token requests fit. Only a larger pool or fewer users changes that.
- "The other engine is faster." Both engines wrote about the same tokens per second at every user count. They differed in which wait they chose at a full pool, not in speed.
- "Set a cap at 48 so the pool never fills." The cap at 48 active sequences left the P99 ITL at 1,329 to 1,373 ms, the same as the default. The gaps come from the prefills that share each step, not from the number of running sequences alone.

## Generalize

When a service runs past its knee, every admission knob trades one latency for another and none of them adds capacity. Measure the two user-facing numbers together with throughput, find the last user count that meets both, and size replicas from that count. When two systems tie on throughput, their difference is the choice they make at saturation, so read the tail of the first token and the tail of the stream side by side before you switch.

## Taught in

The vLLM manual measures the sweep and the caps in [the chat tuning page](../../../manuals/vllm-101/sections/3-1-tune-chat-for-many-users.md) and explains the shared step in [the token budget page](../../../manuals/vllm-101/sections/8-2-why-one-token-budget-replaces-a-prefill-phase.md), the SGLang manual covers the queue in [the admission page](../../../manuals/sglang-101/sections/2-3-admission-and-retraction.md) and the two engines side by side in [the benchmark reading page](../../../manuals/sglang-101/sections/5-3-reading-other-peoples-benchmarks.md), and [the inference metrics lesson](../../../phases/17-infrastructure-and-production/08-inference-metrics-goodput/docs/en.md) defines the numbers.
