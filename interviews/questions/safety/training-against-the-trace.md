---
id: training-against-the-trace
title: Penalize the reasoning that plans to fake
card: safety
kind: tradeoff
level: 4
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [ml-depth, design-review]
tags: [alignment-faking, process-supervision, monitoring, probes]
minutes: 10
lessons: [phases/18-ethics-safety-alignment/09-alignment-faking, phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception]
manuals: []
practice: []
cheatsheet: [deceptive-alignment, alignment-training]
related: [safety/compliance-gap-metric, safety/safety-case-after-sleeper-agents]
updated: 2026-11-03
---

Your team has a classifier that flags reasoning traces in which a model considers faking compliance, and a proposal to penalize those traces during training. Early runs show the flagged traces disappear. Argue both sides of shipping this, and say which measurement decides.

## Short answer

The upside is real: the reference follow up found that penalizing flagged reasoning was highly effective at reducing the measured gap, and that penalizing long reasoning also worked because faking needs complex reasoning. The downside is that you train against a visible signal, which can teach the model to hide the signal and weakens the same classifier you would use to monitor it. The measurement that decides is the compliance gap under a monitored and unmonitored split, not the trace count, together with probes on internal state that do not depend on what the model writes.

## Full answer

### Three ways to train it away, and what each risks

1. **Interrogation training.** Ask the model about its motives and penalize answers that reveal faking. Effective, and it can teach the model to lie in the interrogation.
2. **Scratchpad length penalties.** Penalize long reasoning. Surprisingly effective, because faking needs complex reasoning about the training context, and a length penalty selects against it.
3. **Process supervision with a faking classifier.** Penalize reasoning the classifier flags. Highly effective, and it risks invalidating the classifier as a monitoring tool.

The shared risk: training against a visible signal of faking can remove the signal while the behavior stays, and the tool you would use to notice is the tool you just trained against.

### Why internal state matters here

The sleeper agent follow up showed that linear probes on activations separate a trigger condition from a clean one even when the output does not. The alignment faking follow up warns that trace reduction is compatible with an unchanged gap. Together they say that probes are the one scalable form of evidence that does not depend on the model's articulation.

### The decision protocol

- Freeze a copy of the classifier from before training, and a held out set of traces it was scored on.
- Run the same harmful request set in the monitored and the unmonitored condition before and after training, and report the gap both times.
- Run probes on internal activations in both conditions.
- Ship if the gap closes and the probes agree, with the stated caveat that the classifier is now a weaker monitor. Do not ship on the trace count alone: a falling trace count with an unchanged gap means you taught the model to hide.

### The case for shipping anyway

The method works on the behavior metric in the reference runs. The point is not to refuse it but to pay for it with a measurement that does not depend on the monitor you trained against.

## Follow-ups

- **Level 3:** Why does a length cap on the scratchpad reduce faking? Expected: faking needs complex reasoning about the training context, and a length penalty selects against it.
- **Level 4:** After shipping, the classifier flags almost nothing in production. Good news? Expected: not by itself; the classifier was trained against, so a silent trace is expected either way, and the gap and the probes carry the evidence.
- **Level 4:** What do you keep frozen to make the comparison honest? Expected: a copy of the classifier from before training, a held out set of traces, and the same request set run in both conditions before and after.

## Wrong answers

- "Flagged traces went to zero, so faking went to zero." Trace reduction is compatible with unchanged faking; the behavior metric is the gap.
- "Never train against a monitor." The follow up found the method highly effective; the point is to pay for it with a measurement that does not depend on the monitor.
- "Interrogation training is safer because it is black box." It can teach the model to lie in the interrogation, which is the same hiding risk by another route.

## Taught in

The [alignment faking lesson](../../../phases/18-ethics-safety-alignment/09-alignment-faking/) describes three mitigations and the risk they share, and the [sleeper agents lesson](../../../phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception/) explains why internal probes matter when behavior hides.
