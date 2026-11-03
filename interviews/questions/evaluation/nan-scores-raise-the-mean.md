---
id: nan-scores-raise-the-mean
title: The judge failed to parse and the mean went up
card: evaluation
kind: debug
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [debugging, design-review]
tags: [llm-as-judge, parse-failure, nan, aggregation]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/mean-hides-the-tail]
updated: 2026-11-03
---

Your judge returns a JSON object with a score for each case. The pipeline parses it, and mean faithfulness rose from one week to the next with no change to the product. The logs show that the judge's output failed to parse on a growing share of cases. Explain the rise and fix the pipeline.

## Short answer

A parse failure becomes a missing score, and the aggregate silently drops missing scores. The cases that fail to parse are often the worst outputs, so dropping them lifts the mean. Catch the failure explicitly, record it as its own outcome, count it against the score or report it next to the mean, and alert when the failure share grows.

## Full answer

### The mechanism

Bad JSON from the judge becomes a not a number value. A mean over a column with such values excludes them. The lesson names this as the second silent failure of a judge and asks for the parse to fail loudly with its own status.

### Why the exclusion is biased

The judge breaks its format most often on long, odd or refused outputs. Those are also the low scoring outputs. So the exclusion removes the bottom of the distribution, and the mean rises for a reason that has nothing to do with quality.

### The fix

1. Wrap the parse in an explicit check and give every case a status: scored, parse failed, judge error.
2. Report the parsed share with every run. A rising failure share fails the run.
3. Publish the mean two ways: with failures counted as zero and with failures excluded. If the two differ a lot, the failures are not random.
4. Allow one retry with a repair prompt, record that a retry happened, and cap retries.
5. Store the raw judge text so a reviewer can read what broke.

### Verify the diagnosis

Recompute last week's mean with failures counted as zero. If the rise disappears, you have the cause.

## Follow-ups

- **Level 3:** Why are the failed cases not a random sample? Expected: the judge breaks its format most on long, odd or refused outputs, which are also the low scoring ones.
- **Level 3:** Do you score a failed parse as a zero or leave it out? Expected: both, with the parsed share; a gate should treat a rising failure share as a failed run.
- **Level 4:** How do you design the judge output so this cannot happen silently again? Expected: a strict schema, a validator that rejects anything else, a status field per case, and a run level parse failure metric with an alert.

## Wrong answers

- "The mean rose, so quality rose." Nothing in the product changed; the denominator did.
- "Retry until it parses." Retries without a record hide the failure and can change the score; record every retry and cap them.
- "Exclude failures, they are judge bugs." The exclusion is biased toward bad outputs; the product number is wrong whatever the cause.

## Taught in

The [LLM evaluation frameworks lesson](../../../phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/) lists JSON parsing failures as a silent judge failure and requires an explicit failure mode.
