---
id: log-probs-instead-of-products
title: A sentence score that comes out as exactly zero
card: math-classical-ml
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [screen, ml-breadth]
tags: [probability, log-probability, underflow, cross-entropy]
minutes: 5
lessons: [phases/01-math-foundations/06-probability-and-distributions]
manuals: []
practice: []
cheatsheet: [probability-statistics]
related: [math-classical-ml/softmax-inf-at-large-logits]
updated: 2026-11-03
---

A language model scores a sentence as the product of the probability of each word. For long sentences the score is exactly zero, and two long sentences can no longer be compared. What went wrong, and what do you compute instead?

## Short answer

The product of many small probabilities underflows to zero in floating point. Add the log probabilities instead, and the sum stays a finite negative number. A more negative sum means a less likely sentence, and the order of the sentences is unchanged.

## Full answer

### Why the product dies

Each word has a probability below 1, often far below. The lesson shows the product falling to 0.0 after about 30 terms. Once the product is zero, every longer sentence gets the same score, and a comparison between them is meaningless.

### What the log does

The log turns a product into a sum: log(a times b) equals log(a) plus log(b). Each term is at most 0, because each probability is at most 1, so the sum is a negative number that grows in size with the sentence length but never underflows. The lesson gives the extreme case: 50 words with probability 0.01 each have a raw probability of 10 to the minus 100, and a log probability of about minus 230.26.

### Where you already use it

Cross-entropy loss is the negative log probability of the correct class. Training a classifier or a language model already works in log space. Log-softmax computes the log probabilities straight from the logits, so the tiny probabilities are never formed.

### Comparing sentences

A longer sentence has a more negative sum even when every word is likely. To compare a short sentence with a long one, divide by the token count, or report the perplexity, which is the exponential of the mean negative log probability.

## Follow-ups

- **Level 1:** Why is every log probability zero or negative? Expected: a probability is between 0 and 1, and the log of such a number is at most 0.
- **Level 2:** How do you compare two sentences of different length? Expected: compare the mean log probability per token, or the perplexity, not the raw sum.
- **Level 2:** Where does this appear in a loss function? Expected: cross-entropy is the negative log probability of the correct class, so training already runs in log space.
- **Level 3:** How do you get log probabilities from logits without forming the probabilities first? Expected: log-softmax, which subtracts the log-sum-exp of the logits from each logit.

## Wrong answers

- "Use a wider float type and the product will be fine." A wider format only moves the point of underflow. Fifty words with probability 0.01 give 10 to the minus 100, and a longer sentence pushes it further down.
- "Multiply the probabilities and take the log at the end." The product is already zero before the log, and the log of zero is minus infinity.
- "Clip each probability to a minimum value." That changes the score of every rare word and still underflows for a long enough sentence.

## Taught in

The [probability lesson](../../../phases/01-math-foundations/06-probability-and-distributions/) shows the underflow, the log rules, and the log-softmax function.
