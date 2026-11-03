---
id: perplexity-from-cross-entropy
title: Read a perplexity from a mean cross-entropy
card: math-classical-ml
kind: estimate
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [screen, ml-breadth]
tags: [information-theory, perplexity, cross-entropy, language-model]
minutes: 6
lessons: [phases/01-math-foundations/09-information-theory]
manuals: []
practice: []
cheatsheet: [information-numerics]
related: [math-classical-ml/cross-entropy-is-kl-plus-entropy, math-classical-ml/log-probs-instead-of-products]
updated: 2026-11-03
---

A language model has a vocabulary of V tokens. On a held-out text, its mean cross-entropy per token, measured in nats, equals the natural log of V. Estimate the perplexity and say what the number tells you about the model.

## Short answer

Perplexity is the exponential of the mean cross-entropy, so here it equals V. On average the model is as uncertain as a uniform pick over the whole vocabulary. A trained model should sit far below V. The mean alone does not prove that the model learned nothing, because other per-token predictions can give the same average, so check per-token predictions and the data.

## Full answer

### The definition

```text
perplexity = e ^ H(P, Q)    when the loss is in nats
perplexity = 2 ^ H(P, Q)    when the loss is in bits
```

The two give the same number, because 1 nat is 1.4427 bits and the base of the exponential changes with the base of the log. Perplexity reads as the effective number of equally likely choices the model is torn between at each step. A perplexity of 50 means the model is, on average, as confused as if it had to pick uniformly from 50 tokens.

### The estimate

The loss is ln V. The exponential of ln V is V. Uniform logits over V tokens give exactly this loss and exactly this perplexity. Other per-token predictions can give the same average, so this number alone does not prove that the model learned nothing. Look at the per-token predictions and at the data distribution before you decide. The lesson gives a scale: GPT-2 reached about 30 on common benchmarks, and modern models are in the single digits on well-represented domains.

### What to check before you blame the model

- The text and the tokenizer must match the training setup. A different tokenizer changes the token count and the vocabulary, and the per-token number is not comparable.
- A perplexity near V on an in-domain text points at a bug: a shuffled label stream, a wrong vocabulary mapping, or weights that never loaded.

## Follow-ups

- **Level 2:** The loss is reported in bits instead of nats. What changes? Expected: raise 2 to the loss instead of e; the perplexity is the same number.
- **Level 2:** What does a perplexity of 50 mean in words? Expected: on average the model is as uncertain as a uniform pick among 50 tokens.
- **Level 3:** Two models use different tokenizers. Can you compare their perplexities? Expected: not directly; the token count and the vocabulary differ, so the per-token numbers measure different things.
- **Level 3:** A perplexity equal to V shows up on in-domain text after training. What do you suspect first? Expected: a pipeline bug, such as labels that do not line up with inputs or weights that did not load, because the model is doing no better than chance.

## Wrong answers

- "Perplexity equal to V means the model is perfect." A perfect model has perplexity 1. V is what a uniform guess gets.
- "Divide the loss by V to get the perplexity." Perplexity is the exponential of the loss, not a ratio.
- "A lower perplexity on any text means a better model." Only on the same text with the same tokenizer. A different text or vocabulary moves the number without any change in the model.

## Taught in

The [information theory lesson](../../../phases/01-math-foundations/09-information-theory/) defines perplexity as the exponential of cross-entropy and gives the uniform case as a check.
