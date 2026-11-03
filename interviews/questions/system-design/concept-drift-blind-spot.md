---
id: concept-drift-blind-spot
title: Accuracy fell and every input monitor stayed green
card: system-design
kind: debug
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [system-design, debugging]
tags: [concept-drift, monitoring, label-delay, retraining]
minutes: 12
lessons: [phases/02-ml-fundamentals/20-model-monitoring-and-drift]
manuals: []
practice: []
cheatsheet: [ml-system-design, ml-evaluation-metrics]
related: [system-design/drift-monitoring-design, system-design/fraud-check-100ms]
updated: 2026-11-03
---

A payment model's accuracy, measured as labels arrive, fell from 0.946 to between 0.76 and 0.79. The feature monitors and the score distribution stayed quiet the whole time. The team proposes retraining on the last quarter of labeled data tonight. What happened, why did the monitors miss it, and is the proposal right?

## Short answer

The relation between inputs and labels changed while the inputs themselves did not, which is concept drift. Input and prediction monitors compare distributions of features and scores, so a change in the conditional label distribution is invisible to them, and only the outcome monitor can see it, after the label delay. Retraining tonight on the last quarter is the wrong move: most of those labels still describe the old relation, so the model relearns it; collect labels from after the change first, then retrain on them.

## Full answer

### Three kinds of drift

| Drift | What changes | Which monitor sees it |
|---|---|---|
| Covariate | The input distribution | Input monitors |
| Prior | The label rate | Prediction and outcome monitors |
| Concept | The label given the input | Outcome monitors only |

Covariate drift moves features and often leaves accuracy alone. Prior drift moves the positive rate. Concept drift changes which answer is right for the same input, so nothing upstream of the label moves.

### What the demo shows

The lesson's stream injects both kinds. During the covariate segment the PSI and the KS statistic alert on the amount feature while accuracy stays between 0.89 and 0.95. During the concept segment the inputs are identical to the reference, both input monitors stay at their clean values, and accuracy falls from 0.946 to the 0.76 to 0.79 range. The accuracy alert fires 1000 events after the change, and the label delay of 500 events accounts for half of that lag.

### Why the lag

The outcome monitor always looks one label delay into the past, because it can only score the events whose outcome has arrived. The persistence rule, which requires consecutive drift windows before an alert, adds the rest. Both are deliberate: without them the alert rate is unusable.

### Why the retraining proposal is wrong

Retraining answers covariate drift into regions with little data. Concept drift needs labels from after the change. A quarter of labels where the change happened late in the window teaches mostly the old concept. The right sequence is: confirm the change point from the outcome monitor, gather enough labels past it, retrain on those, test on the most recent labeled slice, roll out through shadow and canary, and reset the reference window to the new training data.

### What to do tonight

Route more cases to review if the business impact is large, as a temporary measure while labels from after the change arrive. A threshold move is the lesson's action for prior drift. For concept drift it helps only when the boundary moved on the same score, and it cannot restore a risk order that changed. Keep the model; replace it only with labels that describe the new relation.

## Follow-ups

- **Level 3:** Which signal could you add that reacts before the labels? Expected: none for pure concept drift; a proxy such as a review queue outcome or a faster partial label is the only earlier signal.
- **Level 3:** How does a performance estimator that uses predicted probabilities behave here? Expected: it assumes the calibration still holds, so it misses concept drift; the lesson notes that such estimators handle covariate shift and not concept drift.
- **Level 4:** How do you choose how many post-change labels are enough? Expected: enough to test the retrained model on a recent held-out slice with a tolerance you set in advance; the test on recent labels is the gate, not a count.
- **Level 4:** After retraining, the input monitors start to alert on the clean reference. Why? Expected: the reference window was not reset to the new training data, so it compares live traffic with an old distribution.

## Wrong answers

- "The feature monitors are broken; nothing changed in the inputs." They worked as designed; the inputs did not change, the labels did.
- "Retrain on everything so the model sees the new pattern." The old labels outnumber the new ones and the model relearns the old relation.
- "Shorten the windows to catch it faster." Smaller windows add noise and false alarms; the lag here comes from the label delay, which windows cannot remove.

## Taught in

The [model monitoring lesson](../../../phases/02-ml-fundamentals/20-model-monitoring-and-drift/) runs the stream with injected covariate and concept drift and shows which monitor reacts to each.
