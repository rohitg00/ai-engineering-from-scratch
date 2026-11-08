---
id: variance-of-large-numbers
title: A variance that comes out wrong on large values
card: math-classical-ml
kind: debug
level: 3
roles: [ai-data-engineer, applied-ai-engineer, inference-engineer]
rounds: [debugging, ml-depth]
tags: [numerical-stability, catastrophic-cancellation, float32, variance]
minutes: 10
lessons: [phases/01-math-foundations/13-numerical-stability]
manuals: []
practice: []
cheatsheet: [information-numerics]
related: [math-classical-ml/softmax-inf-at-large-logits, math-classical-ml/gradient-check-step-size]
updated: 2026-11-03
---

A feature pipeline computes the variance of a column with the formula mean of x squared minus the square of the mean, in float32. On a column with values near one million the result is far from the true value and sometimes negative. Explain the cause and propose a formula that holds.

## Short answer

The two terms are each about 10 to the 12 and almost equal, and their difference is the small true variance. In float32 the spacing between neighboring numbers at that size is far larger than the variance, so the subtraction returns rounding noise, which can be negative. Compute the variance from centered values instead: subtract the mean first, or use the running update that the lesson calls the Welford algorithm.

## Full answer

### Catastrophic cancellation

When two nearly equal floating point numbers are subtracted, their leading digits cancel and the rounding error of each operand becomes the leading digits of the result. The lesson's small example subtracts 1.0000001 and 1.0 in float32 and gets a relative error of 19.2 percent from a single operation. The variance formula does this at a much larger scale.

### The numbers in the question

float32 keeps about 7 decimal digits. For values near one million, x squared is near 10 to the 12, and the gap between representable numbers there is far above 1. The true variance of the lesson's exercise values, 1000000.0, 1000001.0 and 1000002.0, is 0.6667. Both terms of the formula round to the nearest representable value, and the difference carries the rounding, not the variance. A negative result is possible because nothing in the formula stops the rounding from flipping the sign.

### A formula that holds

Center first, then square:

```text
mean = sum(x) / n
variance = sum((x - mean)^2) / n
```

The deviations are small numbers, their squares are small, and no large nearly equal terms are subtracted. For a stream of values where two passes over the data cost too much, the Welford update keeps a running mean and a running sum of squared deviations, and updates both with each new value. Both approaches give a result close to 0.6667 for the exercise values where the naive formula fails.

### The same shape elsewhere

The lesson lists the other places this pattern appears: subtracting nearly equal log probabilities, and a finite difference with a step that is too small. The cure is the same each time: rearrange the arithmetic so that the large nearly equal terms are never subtracted.

## Follow-ups

- **Level 3:** Why can the naive result be negative when a variance cannot? Expected: the result is rounding noise, and nothing in the formula bounds the sign of noise.
- **Level 3:** Would float64 fix the pipeline? Expected: it moves the problem to larger values, around 10 to the 15 digits of precision, but the same inputs scaled up break it again; the centered formula fixes it at any scale.
- **Level 4:** The column arrives as a stream and you cannot hold it in memory for two passes. What do you do? Expected: use the Welford update, which keeps a running mean and a running sum of squared deviations in one pass.
- **Level 4:** Where does this same cancellation hide inside a normalization layer? Expected: a layer norm or batch norm that computes variance as mean of squares minus squared mean on activations with a large mean; implementations center first for this reason.

## Wrong answers

- "The formula is correct algebra, so the code must have a typo." The algebra is exact and the arithmetic is not. The two terms are correct to about 7 digits each, and the variance lives below that.
- "Clamp the result at zero." That hides the sign and keeps the wrong magnitude.
- "Divide the column by one million first and multiply the variance back." Scaling helps here, but it moves the mean, not the problem; a column with a large mean and a tiny spread still cancels. Center first.

## Taught in

The [numerical stability lesson](../../../phases/01-math-foundations/13-numerical-stability/) explains how nearly equal numbers cancel and sets this variance as its first exercise.
