---
id: eval-pipeline-take-home
title: Build an offline eval pipeline for a small model
card: evaluation
kind: take-home
level: 4
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [take-home]
tags: [eval-pipeline, perplexity, exact-match, token-f1, mock-judge]
minutes: 60
lessons: [phases/19-capstone-projects/41-eval-pipeline, phases/11-llm-engineering/10-evaluation, phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/regression-gate-ci, evaluation/perplexity-padding-and-shift, evaluation/exact-match-vs-token-f1]
updated: 2026-11-03
---

Take home. We give you a small instruction tuned model, a held out corpus, a set of short factual prompts with gold answers, a set of open form prompts with reference answers, and no network access. Build an evaluation pipeline that reports more than one number and explains its aggregate, and describe how it would run in CI once a network and a judge model are available. What do you deliver, and what do you leave out on purpose?

## Short answer

Deliver one runnable file with four evals: held out perplexity with honest token accounting, normalized exact match on the factual set, token F1 on the open form set, and a deterministic mock judge on a 1 to 5 scale with the same interface a real judge will have. Report every per eval number, a weighted aggregate with the weights in a config, and per example records for diagnosis. Leave out the real judge, intervals on the aggregate and anything that needs a network, and say so in the readme.

## Full answer

### The four evals

Each eval covers a dimension the others miss. Perplexity says whether the model fits the language at all. Exact match says whether it produces the gold string on short answers. Token F1 forgives paraphrase on open answers. The judge scores quality that string metrics cannot see. Each is a function from the model and a dataset to a result with the metric, the per example details and a name.

### The details a reviewer checks

- **Perplexity.** Sum the loss over real target positions, exclude pad targets from the denominator, shift the targets by one, divide once at the end.
- **Normalization.** Lowercase, strip, collapse whitespace, drop trailing terminal punctuation when the sides differ only by it. Token F1 is one when both sides are empty and zero when only one is.
- **Mock judge.** A 5 when the normalized strings match, a 4 at token F1 of at least 0.8, a 3 between 0.5 and 0.8, a 2 between 0.2 and 0.5, a 1 otherwise, with a one line rationale. It is not a judge. It fixes the interface so a real model is a one function swap.

### The aggregate

Normalize each eval into the unit range: perplexity as one over one plus the log of perplexity, exact match and F1 as they are, the judge divided by 5. The default weights are 0.2, 0.3, 0.3 and 0.2. Put them in a config and print them in the report, because the choice is a product decision, not a fact. Write the report with stable JSON keys and a table for the terminal.

### The CI story

When a network exists, swap the mock judge for a real one and calibrate it against at least 50 hand labeled cases, with a Spearman correlation of 0.7 or more, before its scores gate anything. Grow the suite to about 200 cases, compare two runs with Wilson and bootstrap intervals, block on a regression beyond 0.3 on any criterion, trigger on prompt and model paths, and upload the report as an artifact.

### What to leave out and why

The real judge, because there is no network and no human labels to calibrate it. Intervals on the aggregate, because the weights make it a product number; put intervals on the components. Contamination checks, because the training corpus is not provided. Say each omission in the readme.

## Follow-ups

- **Level 3:** Why keep a mock judge in the deliverable at all? Expected: it fixes the interface and the aggregation path so the real judge is a one function swap, and it keeps the loop runnable offline.
- **Level 3:** Why is the weighted mean a product decision? Expected: weights encode what the product values; the pipeline exposes them in config and reports every component so a reviewer can see what the aggregate hides.
- **Level 4:** What is the first thing you add when a network appears? Expected: a real judge behind the same function, then a calibration run against hand labels before any of its scores gate anything.

## Wrong answers

- "One accuracy number is the deliverable." A single metric never describes a model; the brief asks for several and for an explanation of the aggregate.
- "Skip perplexity, it is not a task metric." It is the cheapest check that the model fits the language at all, and wrong accounting there is what a reviewer looks for.
- "Hard code the weights." The weights are the product decision; expose them and print them next to the numbers.

## Taught in

The [eval pipeline capstone](../../../phases/19-capstone-projects/41-eval-pipeline/) builds the four evals and the aggregator, the [evaluation and testing lesson](../../../phases/11-llm-engineering/10-evaluation/) adds the CI gate, and the [LLM evaluation frameworks lesson](../../../phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/) gives the judge calibration rules.
