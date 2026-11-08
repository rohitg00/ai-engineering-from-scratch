# How speculative decoding checks drafts

> This page explains draft proposal, verification, and acceptance.

Speculative decoding promises more tokens for each step without a change to the output. When you finish this section, you can explain how vLLM keeps that promise, and why the gain shrinks as the batch grows.

## Guess, then check

A decode step on a small batch reads all the weights to produce one token for each request. Most of the GPU sits idle while it waits for memory. Speculative decoding uses that idle time.

A cheap proposer guesses the next few tokens. The target model then runs once over the guesses and computes its own distribution at every position. A rejection sampler walks the guesses in order. It keeps each guess that the target model's distribution supports, and at the first rejection it samples a correct token from the target and stops. One step therefore gives at least one token and at most the number of guesses plus one.

The check is what keeps the output the same. With greedy sampling, a guess stays only if it equals the target's top token. With random sampling, the rejection rule keeps the output distribution equal to the target's distribution.

```figure
id: fig-8-7
kind: sequence
title: one verify pass
claim: One target pass keeps the drafts up to the first rejection and adds one token, so one real request got about 1.8 tokens per pass.
caption: The top half shows the rule by position. The bottom half is a real Qwen3-8B request on our L4, served by SGLang with EAGLE3, the same rule vLLM uses. Green tokens came from verify passes. From manuals/sglang-101/capture/gpu/out-l4/eagle3-generate.txt.
```

## The proposers

vLLM 0.31.0 has several kinds of proposer, set with `--speculative-config`:

| Method | Where the guesses come from |
|---|---|
| `ngram` | earlier text in the same prompt that matches the last few tokens |
| `suffix` | a suffix tree over earlier prompts and answers |
| `eagle`, `eagle3` | a small draft head that reads the target model's hidden states |
| `*_mtp` | extra prediction heads that come with some models, such as DeepSeek |
| `draft_model` | a separate small model |

N-gram and suffix methods cost almost nothing, and they help when the answer copies the prompt, as in code edits. A draft head like EAGLE3 needs a trained head for your model, and it helps on open text. For `Qwen/Qwen3-8B`, a public EAGLE3 head exists with one layer and a draft vocabulary of 32,000 tokens.

## Why the gain falls with load

The idle time that speculation uses exists only while the step reads more memory than it computes. As the batch grows, the step does more compute for each byte, and the idle time goes away. The checks of rejected guesses then cost real compute. The vLLM documentation rates the gain of EAGLE as high at a low request rate and lower at a high one.

The dynamic mode follows from this. It sets the number of guesses from the batch size and stops guessing for large batches. At 0.31.0, its online example runs on the older model runner.

## What to watch

The engine exports the proposed and the accepted tokens. The acceptance rate and the mean number of tokens for each step tell you whether the proposer guesses well on your text. A high acceptance rate with no gain in the time per token means the batch is already compute-bound.

```takeaways
- A proposer guesses tokens, and one pass of the target model keeps or rejects them.
- The rejection rule keeps the output distribution equal to the target's distribution.
- The gain comes from idle GPU time, so it falls as the batch grows.
```

Sources: the vLLM source at v0.31.0 (vllm/config/speculative.py, vllm/v1/spec_decode/, vllm/v1/sample/rejection_sampler.py), vLLM documentation at v0.31.0 (docs/features/speculative_decoding/), the model config of Tengyunw/qwen3_8b_eagle3.
