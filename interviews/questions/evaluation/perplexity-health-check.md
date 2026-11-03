---
id: perplexity-health-check
title: What a perplexity of 10 tells you
card: evaluation
kind: concept
level: 1
roles: [ai-evaluation-reliability-engineer, ai-data-engineer, applied-ai-engineer]
rounds: [screen, ml-breadth]
tags: [perplexity, language-modeling, sanity-check]
minutes: 5
lessons: [phases/10-llms-from-scratch/10-evaluation, phases/19-capstone-projects/73-perplexity-calibration]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/perplexity-padding-and-shift]
updated: 2026-11-03
---

A colleague reports that the new checkpoint reaches a perplexity of 10 on the held out text, better than last week, and wants to ship it as the stronger model. What does the number mean, and what does it not tell you?

## Short answer

Perplexity is the exponential of the mean negative log likelihood per token. A value of 10 means that at each position the model is as uncertain as a uniform choice among 10 options. Lower is better only while the test set and the tokenizer stay fixed. It says nothing about instruction following, reasoning or factual accuracy, so treat it as a sanity check and run the task evals before you ship.

## Full answer

### The definition

```text
PPL = exp( -(1/N) * sum_i log P(token_i | context) )
```

A perplexity of one means the model assigns probability one to every real token. A perplexity equal to the vocabulary size means the model is uniform and learnt nothing. A strong base model on a standard corpus sits around eight to twelve; a bad one on the same text sits at fifty plus.

### What it misses

A model can reach low perplexity by predicting common patterns well while it is bad at rare but important ones. The number also ignores everything a chat model is for: following instructions, reasoning and being right. Use it to catch a broken checkpoint or a tokenizer mismatch, not to pick a winner.

### Two checks before you trust it

1. **Same text, same tokenizer.** The number depends on both. Two models measured on different held out sets cannot be compared.
2. **Honest counting.** Sum the loss over real token positions and divide once at the end. Pad positions must not be in the denominator, and the logits at one position predict the next token. A value below one is impossible. It means the summed negative log likelihood came out negative, and the usual cause is an adapter that returned log p instead of negative log p.

## Follow-ups

- **Level 1:** Which perplexity value means the model is never surprised? Expected: one, because every real token then has probability one.
- **Level 2:** Two models were measured on different test sets. Can you compare their perplexities? Expected: no; the number depends on the text and the tokenizer, so measure both on the same set.
- **Level 2:** The adapter reports a perplexity of 0.8. What happened? Expected: the summed loss is negative, most likely because the adapter returned log p instead of negative log p; a perplexity below one is impossible, so the contract was violated.
- **Level 3:** Why does the eval sum the loss over non pad positions and divide at the end instead of averaging per batch perplexities? Expected: averaging per batch gives each token of a short batch more weight than each token of a long batch, and pad positions shrink the loss; the sum over real tokens matches the definition.

## Wrong answers

- "Lower perplexity means a better assistant." It measures fit to the text distribution, not instruction following or correctness.
- "Perplexities from two papers are comparable." They depend on the test set and the tokenizer, so only same set comparisons hold.
- "Aim for a perplexity near one." The held out text is not the model's own output; a value near one would suggest the test text was in the training data.

## Taught in

The [evaluation lesson](../../../phases/10-llms-from-scratch/10-evaluation/) presents perplexity as a quick health check, and the [perplexity and calibration capstone](../../../phases/19-capstone-projects/73-perplexity-calibration/) gives the corpus level computation and its contract.
