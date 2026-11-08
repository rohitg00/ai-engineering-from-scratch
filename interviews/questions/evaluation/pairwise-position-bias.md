---
id: pairwise-position-bias
title: The winner changed when you swapped the order
card: evaluation
kind: debug
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth]
tags: [llm-as-judge, pairwise, position-bias, win-rate]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks, phases/11-llm-engineering/10-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/judge-calibration-before-trust]
updated: 2026-11-03
---

You compare two prompt versions by showing a judge model both outputs and asking which one is better. Version B wins 70 percent of the pairs. You then swap the two outputs and version A wins most of them. What went wrong, and how do you run the comparison?

## Short answer

The judge has position bias: it prefers the option it reads first. Your first run measured the order, not the prompt. Score every pair in both orders, count a win only when the same version wins twice, and treat split decisions as ties. Then report the win rate with a confidence interval.

## Full answer

### Why pairwise at all

A pairwise judge never has to decide whether an output is a 3 or a 4 on a scale. It only picks a winner, so it avoids the scale calibration problem of a single grader. That makes it the right tool for a head to head test of two prompt versions.

### The bias

Judges prefer the first option presented. The lesson's rule is short: always randomize the order and run both. One order gives you a number about the layout of the prompt.

### The protocol

1. For each input, score the pair in both orders.
2. A version wins the pair only when it wins in both orders.
3. A pair that flips with the order is a tie.
4. Report the win rate and its confidence interval. A win rate near one half means the judge cannot separate the versions.

Also check length. If version B is longer, the judge may reward verbosity. Normalize for length or state in the rubric that length does not count, and see if the preference survives.

## Follow-ups

- **Level 2:** Why does a pairwise comparison avoid rubric calibration problems? Expected: the judge only picks a winner and never places an output on a numeric scale.
- **Level 2:** Version B is also longer. What else do you control? Expected: verbosity bias; normalize for length or exclude it in the rubric, then check whether the preference remains.
- **Level 3:** After both orders, 40 percent of the pairs flip with the order. What does that tell you? Expected: the judge cannot tell the versions apart on those pairs; count them as ties and expect a win rate close to one half.
- **Level 3:** How many pairs make a 55 percent win rate real? Expected: enough that the interval excludes one half; use a Wilson or bootstrap interval, and expect to need hundreds of pairs.

## Wrong answers

- "The judge is random, so use a different judge." Position bias is systematic, not random; another judge has it too, and the protocol is the fix.
- "Always put the baseline first." That fixes the bias in one direction and hides it; run both orders.
- "Pairwise comparison is only for human raters." Judges run pairwise well once the order is randomized and both orders are scored.

## Taught in

The [LLM evaluation frameworks lesson](../../../phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/) names position bias and the both orders rule, and the [evaluation and testing lesson](../../../phases/11-llm-engineering/10-evaluation/) explains why pairwise comparison avoids scale calibration.
