---
id: regression-gate-ci
title: An eval gate on every pull request
card: evaluation
kind: design
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, agentic-ai-engineer]
rounds: [system-design, design-review]
tags: [ci, regression, llm-as-judge, cost, golden-set]
minutes: 12
lessons: [phases/11-llm-engineering/10-evaluation, phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/fifty-cases-is-not-enough, evaluation/judge-upgrade-moved-every-score, evaluation/anchored-rubric]
updated: 2026-11-03
---

Design the evaluation gate that runs on every pull request that touches prompts or model code for a support assistant. Say what runs, what blocks the merge, what it costs per month, and how you stop the gate from blocking on noise.

## Short answer

Trigger on changes to the prompt and model paths, run a fixed versioned suite of about 200 cases through the proposed prompt, score four anchored criteria with a frozen calibrated judge, and compare with the stored scores of the last known good baseline. Block when any criterion drops beyond the threshold and the interval on the difference excludes zero, and store the results as artifacts. With a small judge tier a 200 case run costs about 4 dollars, so ten merges a week cost about 160 dollars a month.

## Full answer

### What runs

- **Trigger.** A path filter on the prompt directory and the model code, so documentation commits do not pay for a run.
- **Suite.** A golden core of 50 to 100 curated cases, 20 to 50 adversarial cases such as injections, out of domain questions and harmful requests, and 100 to 200 samples of real traffic. Version the suite and tag every change.
- **Scoring.** Deterministic assertions first, such as a contains check or a regex, because they are free. Then the judge on relevance, correctness, helpfulness and safety, each on an anchored 1 to 5 scale, with the judge model and version frozen and calibrated against hand labels.

### What blocks

Score the baseline once, when it becomes the last known good version, and store its scores. Each pull request scores only the new prompt on the same suite version. For each criterion compute the mean difference and the pass rate at 4 or more with a Wilson interval. The lesson's code blocks on any mean drop of more than 0.3. It computes a bootstrap interval for each run separately, not an interval on the difference, so a noisy drop can block. Its written workflow asks for a statistical test, a paired t test or a bootstrap. Add a paired bootstrap on the per case differences to the code, and block only when both hold: a drop of more than 0.3 and an interval on the difference that excludes zero. The report lists the cases that degraded so the author can read them.

### What it costs

| Suite | Small judge tier | Time |
|---|---|---|
| 100 cases, 4 criteria | about 2 dollars | about 2 minutes |
| 200 cases, 4 criteria | about 4 dollars | about 4 minutes |
| 500 cases, 4 criteria | about 10 dollars | about 10 minutes |
| 1000 cases, 4 criteria | about 20 dollars | about 20 minutes |

Ten pull requests a week at 200 cases is about 160 dollars a month, because each pull request pays for one run and reuses the stored baseline scores. If you score the baseline again on every pull request, the cost doubles. The lesson's counter example is a prompt change that cut answer completeness by 34 percent and went unnoticed for 11 days.

### How to keep noise out

At 50 cases the interval is 19 points wide and a 5 percent regression is invisible, so the suite needs about 200 cases. Freeze the judge, because a judge upgrade moves every score. Keep the suite versioned and never edit it inside the pull request that fails it. Add a bottom quantile alert and a per category breakdown, because a prompt can improve overall and regress on safety.

## Follow-ups

- **Level 3:** Why a path filter on the trigger? Expected: the eval costs money and minutes; run it when prompts or model code change, not on every commit.
- **Level 3:** A criterion moved by 0.1 and the author calls it a regression. Expected: the threshold is 0.3 on the mean with intervals; 0.1 is inside noise at 200 cases, so report it and do not block.
- **Level 4:** The gate blocks the merge and the author says the suite is stale. What is the process? Expected: suite changes are their own reviewed and versioned change; rerun the baseline when the suite version changes, and never edit the suite inside the failing pull request.
- **Level 4:** How do you catch an aggregate improvement that regresses one category? Expected: a stratified per category report with intervals and a block rule on any category.

## Wrong answers

- "Run the eval nightly instead." Nightly finds the regression after the merge; the lesson's story is 11 days of a shipped drop. Run before merge.
- "Fifty golden cases are enough for a gate." At 50 cases the interval is 19 points wide, and a 5 percent regression cannot be detected.
- "Use the newest judge model on each run." Judge changes move every score; freeze the judge and change it only with a parallel baseline.

## Taught in

The [evaluation and testing lesson](../../../phases/11-llm-engineering/10-evaluation/) gives the pipeline, the thresholds and the cost table, and the [LLM evaluation frameworks lesson](../../../phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/) gives the test gate pattern and the calibration rules.
