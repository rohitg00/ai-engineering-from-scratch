---
id: wilson-or-bootstrap
title: Error bars for a pass rate and for a mean
card: evaluation
kind: concept
level: 3
roles: [ai-evaluation-reliability-engineer, ai-data-engineer, applied-ai-engineer]
rounds: [ml-depth, design-review]
tags: [confidence-interval, wilson, bootstrap, statistics]
minutes: 8
lessons: [phases/11-llm-engineering/10-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/fifty-cases-is-not-enough]
updated: 2026-11-03
---

Your eval report shows two kinds of numbers: a pass rate, which is the share of cases that scored 4 or more, and a mean judge score on a 1 to 5 scale. A reviewer asks for error bars on both. Which interval do you use for each, and why not the same one?

## Short answer

Use a Wilson interval for the pass rate and a bootstrap interval for the mean score. A pass rate is a proportion, and the Wilson interval stays correct at small samples and near zero or one, where the normal approximation breaks. A mean of ordinal judge scores has no clean closed form, and the bootstrap resamples the scores with replacement and works with any distribution.

## Full answer

### The Wilson interval

```text
center = (p + z^2 / (2n)) / (1 + z^2 / n)
spread = z * sqrt( (p (1 - p) + z^2 / (4n)) / n ) / (1 + z^2 / n)
```

With z at 1.96 for 95 percent. The center moves toward one half when n is small, and the bounds are clamped to zero and one. At 50 cases and 90 percent accuracy it gives 78 to 97 percent. The normal interval would give bounds that can leave the unit range and a width that is wrong at the extremes.

### The bootstrap interval

Resample the n scores with replacement, compute the mean, repeat a thousand times, sort the means and read the percentiles at alpha over two from each end. It assumes only that the sample represents the population. It cannot repair a biased or tiny sample, and it costs compute rather than algebra.

### Comparing two runs

Neither interval compares two systems by itself. For two prompt versions that ran on the same cases, build the interval on the paired per case difference, by bootstrap over cases or a paired test. Two separate intervals that overlap do not prove equality, and two that do not overlap are not needed to prove a difference.

## Follow-ups

- **Level 3:** What goes wrong with a plus or minus one standard error interval on a proportion? Expected: at small n or near zero or one it gives bounds outside the unit range and the wrong width; Wilson corrects both.
- **Level 3:** What does a bootstrap assume? Expected: that the sample represents the population; it needs no distribution shape, but it cannot fix a biased or tiny sample.
- **Level 4:** Two prompt versions ran on the same 200 cases. Which interval decides? Expected: an interval on the paired per case difference; two overlapping intervals do not prove equality.

## Wrong answers

- "Plus or minus the standard error is fine." The normal interval fails at small samples and extreme proportions, exactly where releases are decided.
- "Bootstrap works for the pass rate too, so use it everywhere." It works, but Wilson is closed form, cheap and built for proportions; keep the code auditable.
- "Overlapping intervals mean no difference." Two separate intervals can overlap while the paired difference excludes zero; compare the difference.

## Taught in

The [evaluation and testing lesson](../../../phases/11-llm-engineering/10-evaluation/) builds the Wilson and the bootstrap interval and explains when each applies.
