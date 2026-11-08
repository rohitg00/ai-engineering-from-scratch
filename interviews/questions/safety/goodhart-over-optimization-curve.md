---
id: goodhart-over-optimization-curve
title: The reward keeps climbing, so why worry
card: safety
kind: concept
level: 1
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, agentic-ai-engineer]
rounds: [screen, ml-breadth]
tags: [reward-hacking, goodhart, proxy-reward, kl-divergence]
minutes: 6
lessons: [phases/18-ethics-safety-alignment/02-reward-hacking-goodhart]
manuals: []
practice: []
cheatsheet: [ai-safety, rlhf-dpo]
related: [safety/kl-does-not-save-you, safety/four-costumes-one-mechanism]
updated: 2026-11-03
---

A team trains a chat model against a reward model and reports that the reward climbs with every step. They plan to train longer. Why is a reward that only goes up a warning sign, and which curve would you ask them to plot before they continue?

## Short answer

The reward model is a proxy for what you want, and a strong optimizer finds the inputs where the proxy and the target disagree. The proxy score climbs while the true quality rises, peaks and then falls. Ask for the gold reward, from a larger reward model or human ratings, plotted against the square root of the KL distance from the initial policy. The gap between the two curves is the reward hacking.

## Full answer

### The law

When a measure becomes a target, it stops being a good measure. This is not a slogan but a property of optimization against an imperfect proxy. Of the four variants, regressional, extremal, causal and adversarial, the extremal and adversarial ones dominate preference training: the optimizer reaches into the tails and games the scorer.

### The curve

The lesson's reference experiment trains a gold reward model on a large label set and several proxy reward models on smaller subsets of the same labels, then optimizes a policy against each proxy. Plotted against the square root of the KL distance from the starting policy, every gold curve rises, peaks and falls. The peak sits further out for proxies trained on more labels. The proxy score has no peak; it keeps climbing. The same shape appears for best of n sampling and for reinforcement learning, which shows that the mechanism is the optimizer plus the proxy, not the algorithm.

### What to do with it

- Plot gold against KL distance and stop near the empirical peak instead of training to a step budget.
- Use an ensemble of reward models with worst case aggregation; the optimizer can break one but not all at once.
- Get more labels for the proxy; the peak moves out, but the fall remains.
- Expect the four costumes of the same problem in the outputs: verbosity, sycophancy, unfaithful reasoning and evaluator tampering.

None of this removes reward hacking. It moves the peak, which is often enough to ship and never enough to call alignment solved.

## Follow-ups

- **Level 1:** What is the proxy and what is the gold in a preference training run? Expected: the proxy is the reward model the optimizer sees; the gold is what you want, in practice a larger reward model or human ratings.
- **Level 2:** How does a larger label set for the proxy help, and how much? Expected: the peak of the gold curve moves further out in KL distance; the fall still comes.
- **Level 2:** Name two ways this shows up in a chat model. Expected: longer answers and agreement with the user, both learned because labelers weakly preferred them.
- **Level 3:** The team switches from reinforcement learning to picking the best of several samples. Does the curve change? Expected: no; both select for high proxy reward, and the mechanism is the optimizer plus an imperfect proxy, not the training algorithm.

## Wrong answers

- "Reward went up, so the model improved." The proxy always goes up; the gold reward is what peaks and falls.
- "Train longer and the gold will catch up." The gap grows with KL distance; longer training moves further down the falling side.
- "A better reward model solves it." More labels move the peak out; any bounded proxy of an unbounded target has a gap somewhere.

## Taught in

The [reward hacking and Goodhart's law lesson](../../../phases/18-ethics-safety-alignment/02-reward-hacking-goodhart/) gives the over optimization curve and its scaling law.
