---
id: peeking-at-an-ab-test
title: Stopping an experiment on the first good morning
card: production-mlops
kind: tradeoff
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [ml-depth, system-design]
tags: [ab-testing, sequential-testing, multiple-comparisons, cuped]
minutes: 12
lessons: [phases/17-infrastructure-and-production/21-ab-testing-llm-features]
manuals: []
practice: []
cheatsheet: [progressive-delivery]
related: [production-mlops/evals-or-ab-test, production-mlops/split-ratio-mismatch]
updated: 2026-11-03
---

A product manager reads the experiment dashboard every morning and wants to end the test on the first day the variant looks significant. Twenty other experiments run this quarter under the same plan. What is wrong with it, and what do you offer instead?

## Short answer

A fixed-sample test assumes one look at a sample size chosen in advance. Looking every day and stopping at the first significant result gives noise many chances to cross the line, so the false positive rate climbs. Offer a sequential test, which stays valid under repeated looks and still allows an early stop on a clear winner. Across many experiments, correct for multiple comparisons, and reduce variance with pre-experiment data so each test needs fewer samples.

## Full answer

### The peeking problem

Classical A/B analysis assumes the sample size is fixed before the test. Each extra look is another test, and a stop at the first significant look selects the noise. The manager's plan is not wrong because it looks often. It is wrong because it decides on a procedure that was not built for repeated decisions.

### Sequential testing

Always-valid sequential procedures, such as the mixture sequential probability ratio test and confidence sequences, control the false positive rate under repeated looks. You can check daily and stop early on a clear winner, and the error rate stays what you set. The lesson's simulator shows the fixed and the sequential boundaries side by side.

### Twenty experiments

At 95 percent confidence, 20 experiments produce about one false positive by chance. Two corrections exist. Bonferroni divides the error rate by the number of tests, which is strict. Benjamini-Hochberg controls the false discovery rate and is less conservative. Choose by the cost of one false launch against the cost of missing a real win.

### Variance reduction

CUPED regresses out the variance that pre-experiment data explains. The lesson gives a typical reduction of 30 to 70 percent, which raises the effective sample size at no cost in traffic. That is the honest way to shorten a test.

### Two more checks

A sample ratio mismatch check catches a broken assignment before you read any result. Non-determinism in model output lowers the effective sample size, so the lesson multiplies the required sample by about 1.3 to 1.5.

## Follow-ups

- **Level 3:** Bonferroni or Benjamini-Hochberg for the quarter? Expected: Bonferroni when any false launch is costly, Benjamini-Hochberg when you accept a controlled share of false discoveries in exchange for power.
- **Level 3:** What does CUPED need, and what does it give? Expected: it needs a pre-period metric for each unit, and it gives a tighter estimate from the same traffic.
- **Level 4:** A new model needs a larger sample than the quarter allows. What do you change? Expected: pick a primary metric with lower variance, apply CUPED, or extend the test. Do not shorten it by stopping early under a fixed-sample procedure.

## Wrong answers

- "Stopping early is fine when the p-value is small." Under a fixed-sample test, a small p-value on the first day is partly selected noise. Only a sequential procedure keeps that stop valid.
- "Run all the tests at 95 percent and ship the winners." About one winner is a false positive by chance. Correct for multiple comparisons.
- "A longer test is always more reliable." Longer helps only if the assignment is sound. Check the sample ratio first.

## Taught in

The [A/B testing lesson](../../../phases/17-infrastructure-and-production/21-ab-testing-llm-features/) covers sequential tests, CUPED, SRM checks and multiple-comparison corrections.
