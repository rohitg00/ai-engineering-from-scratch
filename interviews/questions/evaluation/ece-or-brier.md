---
id: ece-or-brier
title: An ECE of 0.02 on too few predictions
card: evaluation
kind: concept
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [ml-depth, design-review]
tags: [calibration, ece, brier, reliability-diagram]
minutes: 9
lessons: [phases/19-capstone-projects/73-perplexity-calibration]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/perplexity-health-check]
updated: 2026-11-03
---

Your multiple choice eval reports an expected calibration error of 0.02 on a hundred predictions with ten bins, and the team calls the model well calibrated. What does that number measure, what does it miss, and which second number do you add?

## Short answer

ECE bins predictions by confidence and averages the gap between confidence and accuracy, weighted by bin size. With ten bins and a hundred predictions you cannot tell 0.02 from noise, and inside one bin overconfident and underconfident predictions can offset each other in the bin average. Add the Brier score, the mean squared error between confidence and outcome per prediction, and report how many bins were populated.

## Full answer

### What ECE computes

Sort the predictions into equal width confidence bins, ten by the publishing convention or 15 by the comparison convention. In each bin take the mean confidence and the mean accuracy. ECE is the sum over bins of the absolute gap, weighted by the bin's share of the predictions. The capstone returns the count of populated bins with the value, so the runner can refuse to report a single number on too few samples.

### What it misses

ECE is biased by bin count and sample size. The absolute gap per bin stops gaps in different bins from cancelling, but the bin means can hide spread: overconfident and underconfident predictions in the same bin offset each other, so a low ECE can hide poor calibration at the level of single predictions.

### What Brier adds

Brier is the mean of the squared difference between confidence and the outcome, per prediction. It penalizes every miss directly, so cancellation is impossible. It decomposes into reliability, resolution and uncertainty. A predictor that says one half on everything has a Brier score of exactly 0.25, and an ECE equal to the gap between one half and the accuracy.

### The diagram

Keep the per bin mean confidence, mean accuracy and count. Plotted, the diagonal is perfect calibration. That data also lets a reader compute adaptive variants of ECE later.

### Where confidence comes from

For multiple choice, a softmax over the option log likelihoods. For free text, the model's stated probability or the exponential of its mean log likelihood. The harness accepts any number in the unit range per prediction; where it comes from is the adapter's job. A model that states high confidence and is right far less often shows the gap in that bin.

## Follow-ups

- **Level 3:** A predictor says one half on every item. What is its Brier score, and why? Expected: exactly 0.25, because the squared error is 0.25 whether the outcome is zero or one.
- **Level 3:** Why can ECE be low while calibration is bad? Expected: inside one bin, overconfident and underconfident predictions offset each other in the bin means; the absolute gap stops cancelling only across bins, and Brier penalizes each prediction's error.
- **Level 4:** Why is calibration a per model report and not a per task metric? Expected: the runner accumulates confidence and correctness pairs across the whole eval and computes it once; per task bins would be nearly empty.
- **Level 4:** One model has higher accuracy and a worse Brier score than a rival. Which do you deploy? Expected: the capstone argues for the better calibrated one, because it reports its uncertainty reliably; confirm with the reliability diagram.

## Wrong answers

- "An ECE of 0.02 means calibrated." On a hundred predictions with ten bins the value is inside the noise; report populated bins and collect a larger sample.
- "Accuracy is enough." Two models with equal accuracy can differ in whether their confidence means anything; the capstone calls calibration the most ignored axis.
- "Brier replaces ECE." They answer different questions; ECE shows the shape per bin and Brier the per prediction error. Report both with the diagram data.

## Taught in

The [perplexity and calibration capstone](../../../phases/19-capstone-projects/73-perplexity-calibration/) defines ECE, Brier and the reliability diagram and explains the sample size caveat.
