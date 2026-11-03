---
id: kl-does-not-save-you
title: The KL penalty bounds the drift, not the hack
card: safety
kind: concept
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [ml-depth]
tags: [reward-hacking, kl-penalty, catastrophic-goodhart, heavy-tails]
minutes: 9
lessons: [phases/18-ethics-safety-alignment/02-reward-hacking-goodhart]
manuals: []
practice: []
cheatsheet: [ai-safety, rlhf-dpo]
related: [safety/goodhart-over-optimization-curve, safety/four-costumes-one-mechanism]
updated: 2026-11-03
---

A colleague argues that reward hacking is bounded in their pipeline because the policy trains with a KL penalty against the reference model, so it cannot drift far. Why is that argument incomplete, and under which condition does it fail completely?

## Short answer

The KL penalty constrains how far the policy's distribution moves, not which modes it moves toward. The over optimization curve already shows that a KL penalty softens the collapse of the gold reward without preventing it. When the proxy's error is heavy tailed, rare but reachable inputs exist where proxy minus gold is unbounded, and a KL constrained optimal policy can place its mass on them: proxy reward arbitrarily high, gold reward at baseline.

## Full answer

### What the penalty buys

With a KL term the gold curve still rises, peaks and falls as the policy moves from the reference. The penalty makes the slope gentler and a better proxy pushes the peak out. Neither changes the shape.

### Catastrophic Goodhart

Suppose the proxy's error has heavy tails: somewhere under the reference model there are inputs the proxy loves far more than the gold does. The KL constraint limits the total distance between the policy and the reference. It does not stop the policy from concentrating that allowed distance on exactly those inputs, because they already have support under the reference. The result is a policy that scores arbitrarily well on the proxy and no better than baseline on the gold.

### Why the condition is plausible

A reward model is a bounded measurement of an unbounded world. The lesson argues that such a measurement has heavy tailed error in its tails, so the assumption is not exotic. It is still an assumption: for each proxy, measure the tail of the proxy to gold gap on held out labels before you rely on a KL budget.

### What helps, partially

- An ensemble of reward models with worst case aggregation: the optimizer can find one model's tail error, but the minimum over several pays only where they all err together.
- Reward models trained to be robust to shift in the output distribution.
- Conservative KL schedules and early stopping at the measured proxy to gold gap.
- Nothing from the direct preference family is exempt; those losses have their own scaling law for over optimization.

## Follow-ups

- **Level 3:** What does a KL penalty constrain, and what does it leave free? Expected: the distance of the policy distribution from the reference; which high reward modes under the reference the policy concentrates on.
- **Level 3:** How can several reward models do what one model with a penalty cannot? Expected: the optimizer can find one reward model's tail error, but the minimum over several models pays only where they all err together.
- **Level 4:** Does switching to a direct preference loss remove the problem? Expected: no; the direct alignment family has its own scaling law for over optimization, so the same monitoring applies.
- **Level 4:** Turn this into an operating rule for a training run. Expected: plot gold against KL distance with held out labels, stop at the empirical peak, and treat a rising proxy with a flat gold as the alarm whatever the KL coefficient.

## Wrong answers

- "Small KL means small reward hacking." KL bounds the drift, not its direction; the policy can spend the budget on the proxy's tail errors.
- "Heavy tails are an exotic assumption." The lesson argues they are ordinary for a bounded reward model; measure the proxy to gold gap instead of assuming the tail is light.
- "Use the direct preference loss, it has no reward model." It has an implicit one and its own over optimization curve.

## Taught in

The [reward hacking and Goodhart's law lesson](../../../phases/18-ethics-safety-alignment/02-reward-hacking-goodhart/) explains Catastrophic Goodhart and why KL regularization alone fails.
