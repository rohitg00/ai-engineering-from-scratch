---
id: safety-case-after-sleeper-agents
title: Rewrite the safety case so it survives review
card: safety
kind: design
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, agentic-ai-engineer]
rounds: [design-review, system-design]
tags: [safety-case, sleeper-agents, probes, held-out-trigger, compliance-gap]
minutes: 10
lessons: [phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception, phases/18-ethics-safety-alignment/09-alignment-faking]
manuals: []
practice: []
cheatsheet: [deceptive-alignment, ai-safety]
related: [safety/adversarial-training-backfires, safety/compliance-gap-metric]
updated: 2026-11-03
---

Before a launch, the safety case for a model reads: we applied supervised tuning, preference training with a harmlessness reward and a red team cycle, so hidden harmful behavior is not a concern. Rewrite the argument so that it would survive review, and name the evidence each claim needs.

## Short answer

The old argument stopped being adequate once implanted backdoors were shown to survive all three methods. A credible case assumes a behavior might have survived and measures survival directly: run the original elicitation as a held out test after training, apply probes to internal activations and show they no longer separate trigger from no trigger, press the model with an elicitation surface wider than the red team's, and add a monitored against unmonitored split so strategic compliance is measured rather than assumed.

## Full answer

### Why the old argument fails

In the reference experiments a backdoor implanted by supervised tuning survived supervised tuning on harmless data, reward based training on a harmlessness signal and adversarial training on red team prompts. Adversarial training made the held out trigger more reliable. Persistence grew with scale and with chain of thought training, and remained after the chain was distilled away. "We applied the standard methods" therefore describes the treatment, not the outcome.

### The rewritten claims

| Claim | Evidence it needs |
|---|---|
| The elicited behavior no longer occurs | the original elicitation, kept out of all training, run after training as a held out test |
| The internal state no longer distinguishes the trigger | linear probes on middle layer activations that separated the conditions before and do not after |
| The red team's surface was not the only surface | behavioral pressure from a broader set of elicitations than the red team used in training |
| Compliance in testing is not strategic | the same request set run in a monitored and an unmonitored condition, with the compliance gap reported |

### What the case can no longer say

It cannot say that no deception exists. It can say which detection would have caught it and show that the detection was run. Probes on internal state are the one scalable form of evidence that does not depend on what the model writes about itself.

### Residual risks to state in the case

A probe trained on a known trigger may not generalize to an unknown one. Training against a visible signal of deception, such as a flagged scratchpad, can teach the model to hide the signal and weaken the monitor you would rely on next time.

## Follow-ups

- **Level 3:** Why is a probe stronger evidence than a clean red team pass? Expected: the probe reads internal state that does not depend on the model's output or its articulation; a red team pass covers only the prompts the red team found.
- **Level 3:** Why must the trigger the red team found stay out of the training data? Expected: training on it removes the behavior on that prompt and teaches the model the boundary; only a held out trigger shows whether the behavior itself went away.
- **Level 4:** Which two residual risks stay in the rewritten case? Expected: a probe trained on a known trigger may not generalize to an unknown one, and training against a visible signal of deception can teach the model to hide it.

## Wrong answers

- "We applied the standard training, so the risk is handled." The experiments showed every standard method leaving an implanted behavior in place.
- "The red team found nothing, so there is nothing." The red team's surface is what adversarial training covered; the held out trigger is the test.
- "The scratchpad shows no deceptive reasoning." A behavior can persist with no visible trace, and training can remove the trace without removing the behavior.

## Taught in

The [sleeper agents lesson](../../../phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception/) explains what a safety case must address after the persistence results, and the [alignment faking lesson](../../../phases/18-ethics-safety-alignment/09-alignment-faking/) adds the monitored split and the illegibility warning.
