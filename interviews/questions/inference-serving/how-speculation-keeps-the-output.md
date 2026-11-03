---
id: how-speculation-keeps-the-output
title: How speculative decoding keeps the output the same
card: inference-serving
kind: concept
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [ml-depth, screen]
tags: [speculative-decoding, eagle3, ngram, acceptance, rejection-sampling]
minutes: 8
lessons: [phases/17-infrastructure-and-production/05-eagle3-speculative-decoding]
manuals: [vllm-101#s-how-speculative-decoding-checks-drafts, sglang-101#s-speculative-decoding, vllm-101#s-use-n-gram-speculation-for-copy-heavy-work]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Speculative decoding promises several tokens per step with no change to what the model writes. Explain how the engine keeps that promise, where the speedup comes from, and why the gain shrinks as more users share the server.

## Short answer

A cheap proposer guesses the next few tokens, and the target model runs once over all the guesses and computes its own distribution at every position. A rejection sampler keeps each guess that the target supports, samples a correct token from the target at the first rejection, and stops, so one pass gives at least one token and at most the number of guesses plus one, with the same output distribution as plain decoding. The gain comes from idle GPU time: a small decode batch waits for memory, and as the batch grows that idle time goes away, so the checks of rejected guesses start to cost real compute.

## Full answer

### Guess, then check

A decode step on a small batch reads all the weights to produce one token per request, and most of the GPU sits idle while it waits for memory. Speculation uses that idle time. With greedy sampling a guess stays only if it equals the top token of the target at that position. With random sampling the rejection rule keeps the output distribution equal to the target's distribution. In SGLang the accept thresholds default to 1.0, so a greedy request produces the same tokens it would produce without speculation.

The acceptance length is the number of tokens committed per verify pass: the accepted drafts plus one bonus token from the target. One real Qwen3-8B request on our L4 got about 1.8 tokens per pass.

### The proposers

| Method | Where the guesses come from |
|---|---|
| `ngram` | earlier text in the same request that matches the last few tokens |
| `suffix` | a suffix tree over earlier prompts and answers |
| `eagle`, `eagle3` | a small draft head that reads the hidden states of the target |
| `*_mtp` | extra prediction heads that come with some models |
| `draft_model` | a separate small model |

N-gram costs almost nothing and needs no extra weights. It pays when the answer copies the prompt: an edit of a document, a summary that quotes the source, a code change that keeps most lines, extraction from a long input. On our L4 with random prompts it cut the time per token from 241.7 to 76.6 ms at one user, and at four users the P99 ITL rose from 290 to 1,691 ms. It also turns off async scheduling, with only a warning in the log. An EAGLE3 head needs training for your target; the public head for Qwen3-8B has one layer and a draft vocabulary of 32,000 tokens.

### Why the gain falls with load

The idle time exists only while the step reads more memory than it computes. As the batch grows, the step does more compute for each byte, and the idle time goes away. The checks of rejected guesses then cost real compute. One report shows both ends on the same GPU and model: at batch 1 output went from 42.0 to 92.5 tokens per second, and at concurrency 20 it fell from 217.8 to 164.4. The maintainer's answer was that speculation is meant for small batches. The dynamic mode follows from this rule: it sets the number of guesses from the batch size and stops guessing for large batches.

### The lesson's arithmetic

Expected tokens per target forward are 1 + K x alpha, with K the draft length and alpha the acceptance rate. For K of 5 and alpha of 0.7, with about 10 percent verify overhead, that is 4.5 divided by 1.1, about 4.1 times. Real gains cluster around 2 to 3 times, because alpha is rarely that high on production traffic and the overhead grows with the batch. The lesson puts the break-even alpha at high concurrency near 0.45 to 0.55.

### What to watch

The engine exports the proposed and the accepted tokens. Divide accepted by proposed for the acceptance rate, and read the mean tokens per step. A high acceptance rate with no gain in the time per token means the batch is already compute bound.

## Follow-ups

- **Level 2:** Which proposer needs no extra model, and when does it pay? Expected: n-gram, which matches the last tokens of the output against earlier text in the request; it pays for edits, quotes, code changes and extraction, and fails on open chat.
- **Level 3:** Acceptance is high but the time per token did not fall. What does that tell you? Expected: the batch is already compute bound; the idle memory time that speculation uses is gone, so the checks cost as much as they save.
- **Level 3:** With greedy sampling, how does the check decide at each position? Expected: a guess stays only if it equals the top token of the target there; the first mismatch is replaced by the target's token and the rest are dropped.
- **Level 4:** Why can one verify pass never commit more tokens than the draft length plus one? Expected: the target computes a distribution at every draft position and one past the last guess, so when all guesses pass the sampler still draws one bonus token from that last distribution; at a rejection it samples a correct token there and stops.

## Wrong answers

- "Speculation changes the output a little, so you trade some quality for speed." With greedy sampling a guess stays only if it equals the target's top token, and with random sampling the rejection rule keeps the output distribution equal to the target's, so the quality does not change, although one sampled run can differ from a run without speculation.
- "The draft is where the speed comes from, so a faster draft always helps." The gain comes from idle GPU time in a small batch; a fast draft with low acceptance adds checks that cost compute, and at concurrency 20 one report lost a quarter of its throughput.
- "Turn it on for the stress test too." At batch 1 one report more than doubled its speed and at concurrency 20 it was slower; the maintainer's answer was that speculation is for small batches.

## Taught in

[How speculative decoding checks drafts](../../../manuals/vllm-101/sections/8-7-how-speculative-decoding-checks-drafts.md) and [the SGLang speculative decoding section](../../../manuals/sglang-101/sections/4-4-speculative-decoding.md) explain the rule, [the n-gram section](../../../manuals/vllm-101/sections/4-2-use-n-gram-speculation-for-copy-heavy-work.md) measures the free proposer, and [the EAGLE-3 lesson](../../../phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/docs/en.md) gives the acceptance arithmetic.
