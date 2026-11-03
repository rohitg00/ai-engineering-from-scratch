---
id: two-pass-at-k-formulas
title: Two harnesses, two pass at k formulas
card: evaluation
kind: code-reading
level: 3
roles: [ai-evaluation-reliability-engineer, agentic-ai-engineer, applied-ai-engineer]
rounds: [coding, ml-depth]
tags: [pass-at-k, estimator, code-exec, bias]
minutes: 10
lessons: [phases/19-capstone-projects/27-eval-harness-fixture-tasks, phases/19-capstone-projects/72-code-exec-metric]
manuals: []
practice: []
cheatsheet: [eval-driven-agents]
related: [evaluation/pass-at-k-reading]
updated: 2026-11-03
---

Two harnesses in the repository compute pass at k. The first takes the empirical pass rate p and returns `1 - (1 - p) ** k`. The second takes the sample count n, the pass count c and k, and returns `1 - C(n - c, k) / C(n, k)`. Read both. When do they agree, when do they differ, and which one goes in the report?

## Short answer

The first formula treats every draw as independent with success probability p and is a plug in estimate. The second counts the exact chance that k samples drawn from the n you ran contain at least one pass, and it is the unbiased estimator that code generation benchmarks use. They agree only as n grows large; for the samples you ran, the plug in is lower and noisier, and it extrapolates when k exceeds n. Report the unbiased one with the raw counts next to it.

## Full answer

### Reading the first function

```python
def pass_at_k(empirical_pass_rate, k):
    if k <= 0:
        return 0
    p = max(0, min(1, empirical_pass_rate))
    return 1 - (1 - p) ** k
```

It clamps p and assumes independent draws. It accepts any k, including a k larger than the number of samples the harness ran, so it can print a pass at ten from five samples.

### Reading the second function

```python
def pass_at_k(n, c, k):
    if k > n:
        return float(c > 0)
    if n - c < k:
        return 1
    log_prob = 0
    for i in range(k):
        log_prob += math.log(n - c - i) - math.log(n - i)
    return 1 - math.exp(log_prob)
```

It refuses to extrapolate: for k above n it returns whether any sample passed, which is a different quantity and should be labeled as such. When fewer than k samples failed, every k subset holds a pass, so it returns one. Otherwise it multiplies the chance that each of k draws without replacement is a failure, in log space to avoid large binomial coefficients. The estimator layer averages this value over tasks.

### Where they differ

Take k equal to n. The second says one whenever a single sample passed. The first says less than one, because it imagines drawing with replacement. In general, drawing without replacement makes all k failures less likely, so the exact value is at or above the plug in for the same n and c. The plug in is also a biased estimate with high variance at small n.

### What to report

Run n samples per task with n at least k, as in the capstone's example of ten samples and pass at five. Report pass at one as c over n, pass at k from the unbiased function, and the raw counts. Never print a pass at k for a k you did not sample.

## Follow-ups

- **Level 3:** In the second function, why return one when n minus c is smaller than k? Expected: you cannot pick k failing samples from fewer than k failures, so every k subset contains a pass.
- **Level 3:** Why compute the product in log space? Expected: binomial coefficients overflow for moderate n; the log of the ratio is a short sum of logs.
- **Level 4:** A team ran five samples per task and reports pass at ten. What is wrong? Expected: k exceeds n, so nothing was measured; the second function falls back to whether any sample passed and the first extrapolates.
- **Level 4:** Do the two functions agree on pass at one? Expected: yes; both reduce to c over n when k is one.

## Wrong answers

- "They are the same formula." They agree only as n grows; for the samples you ran, the plug in is lower and noisier.
- "Pass at k is the probability the agent is right." It is the chance that a set of k samples contains at least one pass; without a selector the user still gets one sample.
- "More samples per task raise pass at one." They make the estimate more precise; the value is the per sample pass rate.

## Taught in

The [eval harness capstone](../../../phases/19-capstone-projects/27-eval-harness-fixture-tasks/) uses the independence formula, and the [code exec metric capstone](../../../phases/19-capstone-projects/72-code-exec-metric/) gives the unbiased estimator and its edge cases.
