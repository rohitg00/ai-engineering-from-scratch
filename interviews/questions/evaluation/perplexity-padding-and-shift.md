---
id: perplexity-padding-and-shift
title: Perplexity improves when the batch grows
card: evaluation
kind: code-reading
level: 3
roles: [ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [coding, debugging]
tags: [perplexity, padding, off-by-one, language-modeling]
minutes: 10
lessons: [phases/19-capstone-projects/41-eval-pipeline, phases/19-capstone-projects/73-perplexity-calibration]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/perplexity-health-check]
updated: 2026-11-03
---

A colleague's perplexity eval computes the cross entropy at every position of every padded batch, averages it over the batch, exponentiates, and then averages the per batch values. The reported perplexity looks very good and gets better whenever the batch size grows. Read the description, name the bugs and give the correct computation.

## Short answer

There are three bugs: pad positions sit in the denominator, so the loss is diluted and the number improves with more padding, which is what a larger batch brings. Averaging per batch gives each token of a short batch more weight than each token of a long batch. And the targets must shift by one, because the logits at a position predict the next token. Sum the loss over real target positions across the corpus, count those positions, divide once, and exponentiate.

## Full answer

### The correct accounting

```python
pred = logits[:, :-1, :]
target = ids[:, 1:]
target_mask = attn[:, 1:]
loss_per_pos = cross_entropy(pred, target, reduction="none") * target_mask
total_nll += loss_per_pos.sum()
total_tokens += target_mask.sum()
ppl = exp(total_nll / total_tokens)
```

The shift aligns a prediction with the token that follows it. The mask removes pad targets from the numerator and from the denominator. The division happens once, at the end, over the whole corpus. The calibration capstone wraps the same rule in a function that takes per sequence negative log likelihoods and token counts and divides the two sums.

### Why each bug matters

- **Padding in the denominator.** A pad target contributes zero loss after masking but still counts as a position. The mean falls as padding grows, so a larger batch with more padding reports a better model.
- **Mean of per batch values.** A batch of short sequences and a batch of long ones get equal weight, so short sequences count more per token than long ones. The sum then divide form weights every real token the same.
- **No shift.** The loss still falls during training if the targets are misaligned, so the bug is silent there. In the metric it means the number is not next token likelihood.

### Contract checks

A perplexity below one is impossible; the total loss is negative, which most often means the adapter returned log p instead of negative log p. Zero real tokens must not divide; the capstone returns not a number for that case and lets the runner decide.

## Follow-ups

- **Level 3:** Why is the off by one silent during training but fatal in the metric? Expected: the model still learns from misaligned targets and the loss keeps going down, but the metric no longer measures next token likelihood.
- **Level 3:** The adapter returns per sequence means. Can the harness combine them? Expected: only with the token counts; a mean of means weights sequences equally instead of tokens.
- **Level 4:** Perplexity on the held out set is far lower than on production text. What do you suspect? Expected: a tokenizer mismatch or a leak of the held out text into training; check both before you claim quality.

## Wrong answers

- "Masking the loss is enough." The mask must also leave the denominator; counting pad positions dilutes the mean.
- "Averaging per batch perplexities is close enough." It gives short sequences more weight per token and depends on the batch composition; the sum then divide form is the definition.
- "A lower number is always a better model." It is a better fit to this text; it says nothing about the task.

## Taught in

The [eval pipeline capstone](../../../phases/19-capstone-projects/41-eval-pipeline/) names the two traps and the correct accounting, and the [perplexity and calibration capstone](../../../phases/19-capstone-projects/73-perplexity-calibration/) gives the corpus level function and its contract.
