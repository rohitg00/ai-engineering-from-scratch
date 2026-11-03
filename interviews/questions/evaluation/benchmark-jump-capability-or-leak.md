---
id: benchmark-jump-capability-or-leak
title: Eight points after a new training corpus
card: evaluation
kind: design
level: 4
roles: [ai-evaluation-reliability-engineer, ai-data-engineer, applied-ai-engineer]
rounds: [design-review, ml-depth]
tags: [contamination, benchmarks, model-diff, custom-eval]
minutes: 12
lessons: [phases/10-llms-from-scratch/10-evaluation, phases/11-llm-engineering/10-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/benchmarks-stop-discriminating]
updated: 2026-11-03
---

A model you fine tuned jumped eight points on a public benchmark after you added a new web scraped corpus to the training mix. Leadership wants to announce it. Design the audit that tells you whether the jump is capability or leakage, and say what you would publish instead if it is leakage.

## Short answer

Audit for contamination before anyone announces anything. Search the new corpus for the benchmark questions and their close paraphrases and report the share found, then rerun the model on a versioned custom eval that the corpus cannot contain and diff the individual test cases against the previous model. If the overlap is material and the custom eval did not move, the jump is memorization, and you publish the custom eval result with the contamination share.

## Full answer

### Why the jump is suspect

Training corpora scrape the web and the benchmark questions live on the web. Nobody has to intend it. A new scraped corpus is the most likely path for the test to enter training, and a saturated benchmark rewards memorization with large jumps. The same lesson lists teaching to the test and saturation as the other two mechanisms that move a score without moving capability.

### The audit

1. **Contamination search.** Check what share of the eval questions, or close paraphrases of them, appear in the new corpus. Report exact matches and near matches separately with the method.
2. **Model diff.** Compare the two model versions case by case: which items improved, which regressed, which stayed. If the improvements cluster on the items the search found, the diff names the leak.
3. **Custom eval.** Run both models on your own versioned suite of at least 200 cases with edge cases, kept separate from every training and prompt example. A real gain shows there with an interval; a leak does not.
4. **Separation check.** Confirm that no eval case overlaps with the prompt examples or the fine tuning data, because a test case that was also a training example measures memorization.

### What to publish

The custom eval numbers with intervals, the contamination share and the method, and the benchmark score with that caveat attached. Never a bare benchmark number. And add the dedup step to the training pipeline so the next corpus is checked against every eval set before training starts.

## Follow-ups

- **Level 3:** The search finds exact matches for a small share and paraphrases for more. Which count? Expected: both; paraphrases leak the answer as well, so report exact and near matches separately with the method.
- **Level 3:** The custom eval also rose. Is the jump real? Expected: more likely, if the suite is versioned, separate from training data and large enough that the rise exceeds its interval.
- **Level 4:** How do you prevent the question next time? Expected: deduplicate training corpora against every eval set before training, keep eval data out of prompts and fine tuning data, and record the check in the training report.

## Wrong answers

- "We did not include the benchmark on purpose, so it is clean." Web scale scraping includes it without intent; the lesson calls this the normal path to contamination.
- "Eight points is too large to be noise." Noise is not the alternative; memorization is, and it produces large jumps.
- "Announce the benchmark and add the caveat later." Publish the custom eval with intervals and the contamination share; a bare benchmark number is the claim you cannot defend.

## Taught in

The [evaluation lesson](../../../phases/10-llms-from-scratch/10-evaluation/) explains contamination and sets the contamination detection and model diff exercises, and the [evaluation and testing lesson](../../../phases/11-llm-engineering/10-evaluation/) warns against testing on training examples.
