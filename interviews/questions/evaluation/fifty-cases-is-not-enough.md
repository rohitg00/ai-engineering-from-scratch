---
id: fifty-cases-is-not-enough
title: A four point win on fifty cases
card: evaluation
kind: estimate
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [screen, ml-depth]
tags: [sample-size, confidence-interval, wilson, regression]
minutes: 8
lessons: [phases/11-llm-engineering/10-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/mean-hides-the-tail]
updated: 2026-11-03
---

A prompt change scores 90 percent on your 50 case golden set, and the baseline scored 86 on the same set. The author wants to ship it as a four point win. How sure can you be, and what sample size would you need to make this call?

## Short answer

At 50 cases and 90 percent observed accuracy, the 95 percent interval runs from 78 to 97 percent, a 19 point spread. A four point gap sits well inside that spread, so the win cannot be told from noise. You need about 200 cases to detect a 5 percent change, and 500 or more when two systems are close.

## Full answer

### The table

| Cases | Observed accuracy | 95 percent interval width | Detects a 5 percent regression |
|---|---|---|---|
| 50 | 90 percent | 19 points | no |
| 100 | 90 percent | 12 points | barely |
| 200 | 90 percent | 9 points | yes |
| 500 | 90 percent | 5 points | with confidence |
| 1000 | 90 percent | 3 points | precisely |

The width falls roughly with the square root of the sample size. Four times the cases cut the width by about half.

### The interval

For a pass rate the lesson uses the Wilson interval, which stays correct at small samples and at proportions near zero or one. The normal interval fails in both places, and those are the places where releases get decided.

### The paired case

Both versions ran on the same 50 cases, so compare them as pairs. A paired test or a paired bootstrap on the per case differences is tighter than two separate intervals. It still will not rescue a four point gap on 50 cases, but it is the right test once the set is large enough.

### How to build to 200

The lesson splits the set into a golden core of 50 to 100 curated cases, 20 to 50 adversarial cases and 100 to 200 samples of real traffic. Version the set, and compare two runs only on the same version.

## Follow-ups

- **Level 2:** Why does the interval shrink slowly as you add cases? Expected: the width falls with the square root of the sample size, so four times the cases halve the width.
- **Level 2:** The two runs used identical cases. Does that help? Expected: yes; a paired comparison on per case differences is tighter than two independent intervals.
- **Level 3:** Which interval does the lesson use for a pass rate, and why? Expected: the Wilson interval, because it behaves correctly at small samples and extreme proportions where the normal approximation fails.
- **Level 3:** You can afford 200 judge calls per run. How do you split them? Expected: a golden core, an adversarial slice and a sample of production traffic, versioned and fixed between the two runs you compare.

## Wrong answers

- "Four points is four points." On 50 cases the interval is 19 points wide; a four point gap is noise.
- "Run the same 50 cases three times." Repeating the cases measures the model's variance, not the population; the interval over cases stays wide.
- "Always use a thousand cases." A thousand cases give a 3 point width but cost five times a 200 case run; use 200 for routine decisions and 500 or more for close calls.

## Taught in

The [evaluation and testing lesson](../../../phases/11-llm-engineering/10-evaluation/) gives the sample size table, the Wilson interval and the three layers of an eval set.
