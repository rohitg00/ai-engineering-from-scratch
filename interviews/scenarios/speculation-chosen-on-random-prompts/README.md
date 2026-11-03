---
id: speculation-chosen-on-random-prompts
title: Speculation chosen on random prompts
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth, design-review]
tags: [speculative-decoding, eagle3, ngram, acceptance-length, dataset, ttft]
minutes: 25
lessons: []
manuals: [sglang-101#s-speculative-decoding, vllm-101#s-speed-up-decode-with-eagle3, vllm-101#s-use-n-gram-speculation-for-copy-heavy-work]
practice: []
cheatsheet: [speculative-decoding]
related: [scenarios/speculation-depth-vs-batch]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-8B with an EAGLE3 draft of 3 tokens, and NGRAM with its defaults
  hardware: one L4 with 24 GB of memory, SM clock locked at 900 MHz
source:
  - manuals/sglang-101/capture/gpu/out-l4/spec-real-prompts.txt
  - manuals/sglang-101/sections/4-4-speculative-decoding.md
  - manuals/vllm-101/sections/4-1-speed-up-decode-with-eagle3.md
  - manuals/vllm-101/sections/4-2-use-n-gram-speculation-for-copy-heavy-work.md
---

## Situation

An inference team serves `Qwen/Qwen3-8B` on L4 cards to three internal products: a support chat, a math tutor and a code assistant. To pick one decode setting for all three, they benchmark the engine on the random dataset of the benchmark client at 8 users. EAGLE3 roughly halves the time between tokens, and the n-gram method changes nothing. They turn EAGLE3 on for every product and close the n-gram ticket as "no gain".

Two weeks later the support chat reports that at busy hours the first token comes seconds later than before the change, with no more answers per minute. The math tutor reports the opposite: the service got much faster under load. The code assistant team, which never got n-gram, reads a paper that says n-gram pays on code and asks why it was rejected. You are asked whether one setting can serve all three.

## Evidence

- [the machine, the model, the two drafts and the four datasets](evidence/the-test.txt)
- [median time per output token at 8 users, by dataset and method](evidence/time-per-token-at-8-users.txt)
- [mean acceptance length at 8 users, by dataset](evidence/acceptance-by-dataset.txt)
- [output tokens per second at 32 users, by dataset and method](evidence/output-at-32-users.txt)
- [the first token with EAGLE3 and the worst gap with NGRAM at 32 users](evidence/first-token-and-tail-at-32.txt)
- [what the random dataset is, and what other studies found on real prompts](evidence/what-random-means.txt)
- [the four numbers to compare on your own traffic](evidence/the-check-on-your-traffic.txt)

## Questions

1. Before the tables, say why one benchmark dataset cannot decide a speculation setting for three different products.
2. From the acceptance table, which dataset gives the draft the fewest accepted tokens, and what in that traffic explains it?
3. At 32 users, where does EAGLE3 lose output, and what does it cost there besides output?
4. The n-gram method had no gain on the random set. On which traffic did it pay, and what did it do to the tail?
5. What is the random dataset made of, and why did it hide both the loss and the gain?
6. Give one setting per product, and the measurement on production traffic that confirms each.

## Walkthrough

1. **Check the method before the result.** The test ran on one L4 with the clock locked at 900 MHz, the cache flushed before each run, two seeds, and 128 output tokens with ignore-eos. Only runs at a median clock of 900 MHz count. Four datasets: the random set, ShareGPT, GSM8K and code. So a difference between rows is the dataset and nothing else.
2. **Read the time per token at 8 users.** EAGLE3 cut the median TPOT on every dataset: 67.6 to 68.2 ms fell to 33.8 to 39.4 on random, 66.4 to 68.6 fell to 39.5 to 43.1 on ShareGPT, 65.5 fell to 33.3 to 34.3 on GSM8K, and 65.9 to 66.4 fell to 36.8 on code. At this load the gain holds for everyone. N-gram is another story. On random and ShareGPT it was a little slower than the default, 68.2 to 71.4 and 69.5 to 72.4 ms. On GSM8K it gave 54.6 to 55.0 and on code 58.2 to 58.8. The random-set result for n-gram was the one result that did not transfer.
3. **Read the acceptance.** EAGLE3 committed 2.69 to 2.78 tokens per step on GSM8K and 2.35 to 2.43 on ShareGPT. N-gram committed 1.44 to 1.46 on GSM8K and only 1.22 to 1.25 on ShareGPT. Chat answers repeat little of the prompt, so a method that copies from the prompt finds almost nothing there, and a learned draft guesses worse too. Math and code repeat structure, so both methods guess better. The acceptance column predicts every later column.
4. **Read the output at 32 users.** On random, EAGLE3 gave 239 to 242 tokens per second against 250 to 254 for the default. On ShareGPT, 277 to 283 against 281 to 288. On both chat-like sets it lost output under load. On GSM8K it gave 648 to 660 against 397, and on code 566 to 581 against 365 to 366. The manual calls that 1.6 times the output on GSM8K and code, and no more output on the other two. At a full batch every rejected draft token is compute taken from another user, so the gain survives only where the acceptance is high.
5. **Read the first token and the tail.** At 32 users EAGLE3 moved the median first token on random from 3.2 to 3.5 s up to 8.6 to 8.7 s, and on ShareGPT from 2.7 to 3.0 s up to 5.7 to 7.0 s. The manual's reading is that the draft took pool space that the queue needed, so requests waited longer for a slot. That is the support chat's complaint. N-gram at 32 users raised the P99 ITL to 244 to 779 ms against 83 to 106 ms for the default: a smoother median hid a rougher stream. The one-user default runs throttled below 300 MHz and were left out, which is the right call.
6. **Ask what random is.** The random dataset takes the first turn of ShareGPT conversations and cuts or repeats it to 512 tokens. It is real text, but it is not any product's traffic, and the repetition inside a cut-and-repeated prompt is not the repetition of a math answer. The studies the manual cites agree: synthetic prompts overstated speculative throughput by 23 percent on average, the best draft length fell to 1 as the batch grew, and on long answers the acceptance fell from about 3.7 to about 1.5.
7. **Use the manual's check.** Run a sample of your own traffic with and without speculation, with real output lengths and `--disable-ignore-eos`. Compare the acceptance length from `sglang:spec_accept_length`, the output and the median time per token, the P99 ITL and the P99 TTFT, and the acceptance of your longest answers alone, which each `/generate` response gives in `meta_info`.

## Resolution

One setting cannot serve the three products, because the gain of speculation is a property of the traffic, not of the engine. For the math tutor, EAGLE3 stays on: 648 to 660 tokens per second against 397 at 32 users, and 33.3 to 34.3 ms per token against 65.5 at 8 users. For the code assistant, EAGLE3 is the first choice, 566 to 581 against 365 to 366 at 32 users, and n-gram is a cheaper second that pays on code at 8 users, 58.2 to 58.8 against 65.9 to 66.4, if its P99 ITL stays inside the product's target. For the support chat, EAGLE3 comes off at busy hours: on ShareGPT at 32 users it gave no more output and moved the median first token from 2.7 to 3.0 s up to 5.7 to 7.0 s. If the chat wants the 8-user gain, it needs a user cap per replica low enough that the pool is never the limit.

Each product confirms its setting on its own traffic: the acceptance from the counter, the median and the P99 ITL, the P99 TTFT, and the acceptance of the longest answers, with the clock recorded. The random set is retired as a decision tool and kept as a smoke test.

## Wrong turns

- "EAGLE3 halved the time per token, so it helps everyone." At 8 users it did, on every dataset. At 32 users on ShareGPT it gave 277 to 283 tokens per second against 281 to 288 and a first token of 5.7 to 7.0 s against 2.7 to 3.0 s. The gain is a function of load and acceptance.
- "N-gram showed no gain, close the ticket." It showed no gain on a dataset that copies nothing. On code it cut the time per token from 65.9 to 66.4 ms down to 58.2 to 58.8 at 8 users, and on GSM8K down to 54.6 to 55.0.
- "The random set is real text, so it is representative." It is the first turn of ShareGPT conversations, cut or repeated to 512 tokens. It behaved like ShareGPT for the draft and like nothing in particular for n-gram.
- "Fix the chat's first token with a deeper draft." The first token grew because the draft took pool space the queue needed. A deeper draft takes more pool space, not less.
- "Compare medians, the tail takes care of itself." N-gram raised the P99 ITL at 32 users to 244 to 779 ms against 83 to 106 ms while its median looked fine on two datasets.

## Generalize

A decode optimization that depends on guessing right has a value that depends on what it guesses about, so its benchmark must use the traffic it will serve, at the load it will serve, and report the tail and the first token next to the median. One synthetic dataset gives one point in that space, and a decision for several products needs one measurement per product.

## Taught in

The SGLang manual runs the four datasets in [the speculative decoding page](../../../manuals/sglang-101/sections/4-4-speculative-decoding.md#real-prompts-on-the-l4), and the vLLM manual gives the limits of a random-prompt gain in [the EAGLE3 page](../../../manuals/vllm-101/sections/4-1-speed-up-decode-with-eagle3.md) and the copy-heavy case in [the n-gram page](../../../manuals/vllm-101/sections/4-2-use-n-gram-speculation-for-copy-heavy-work.md).
