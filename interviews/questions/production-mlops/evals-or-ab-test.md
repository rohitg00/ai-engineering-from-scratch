---
id: evals-or-ab-test
title: Why a higher eval score still needs an experiment
card: production-mlops
kind: concept
level: 1
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [screen, ml-breadth]
tags: [evals, ab-testing, experiments, product-metrics]
minutes: 5
lessons: [phases/17-infrastructure-and-production/21-ab-testing-llm-features, phases/17-infrastructure-and-production/20-shadow-canary-progressive]
manuals: []
practice: []
cheatsheet: [progressive-delivery, llm-evaluation]
related: [production-mlops/peeking-at-an-ab-test, production-mlops/shadow-mode-is-a-smoke-test]
updated: 2026-11-03
---

Your new prompt scores higher than the old one on your labeled set. A product manager asks why you still want a randomized online test before the full launch. Give the two-minute version.

## Short answer

An eval tells you whether the model can do the task on a fixed, labeled distribution. A randomized test with live users tells you whether users notice and care. A prompt can win on the labeled set and move no product metric, or move it the wrong way. You need both: the eval blocks a regression before any user sees it, and the experiment confirms the product effect after.

## Full answer

### Two different questions

An eval runs offline on a labeled set with a judge, which can be a rubric, a model or a person. It answers: is the output correct, helpful and safe on this distribution?

An A/B test runs online with live users assigned at random. It answers: does the variant move the user-level metric that matters, such as retention or task completion?

### Why one is not enough

Every senior engineer can name a feature that shipped because it felt better, with no experiment. Many of them regressed a product metric that nobody watched for months. The eval cannot see user preference. The experiment cannot catch a regression before exposure. Each one covers the blind spot of the other.

### What to test online

The lesson names three testable axes:

1. Prompt wording and structure. Metrics: task success, retention, cost per request.
2. Model choice. Metrics: task accuracy, cost per request and latency P99 together.
3. Generation parameters such as temperature and top-p. Metric: task-specific.

### The order

Eval first. Then shadow and a canary to prove the variant is stable. Then an A/B test at a 50 percent split when the variant is a distinct alternative. When it is only an improved version of the same behavior, the canary can go to 100 percent without the A/B step. Improved means that the eval showed the gain. The canary gates do not measure task completion, so the skip trusts the eval for it.

## Follow-ups

- **Level 1:** Name one metric an experiment produces that an eval cannot. Expected: a user-level metric such as retention, conversion or the thumbs-down rate.
- **Level 2:** The canary passed, and the experiment shows a small drop in conversion. Ship? Expected: not by default. Write the escalation criterion before the test starts, and treat a negative primary metric as a stop.
- **Level 2:** When do you skip the experiment after a canary? Expected: when the new version is an improvement of the same behavior, not an alternative with a different cost curve or tone.
- **Level 3:** Why does model non-determinism change the sample size? Expected: identical inputs give different outputs, so the effective sample is smaller than the nominal one. The lesson multiplies the required sample by about 1.3 to 1.5.

## Wrong answers

- "The eval set is larger, so it is more reliable." The eval set is fixed and labeled, and it measures correctness, not what users prefer.
- "Run the experiment and skip the eval to save a week." Without the eval, a regression reaches users before anyone can see it.
- "If the eval and the experiment disagree, the experiment is wrong." They measure different things. A correct answer that users dislike is a real result.

## Taught in

The [A/B testing lesson](../../../phases/17-infrastructure-and-production/21-ab-testing-llm-features/) separates evals from experiments, and the [progressive delivery lesson](../../../phases/17-infrastructure-and-production/20-shadow-canary-progressive/) places the experiment after the canary.
