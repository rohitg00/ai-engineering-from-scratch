---
id: daa-still-overoptimize
title: Does dropping the reward model end reward hacking
card: post-training
kind: concept
level: 4
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [ml-depth, design-review]
tags: [dpo, over-optimization, goodhart, implicit-reward, alignment]
minutes: 12
lessons: [phases/18-ethics-safety-alignment/03-direct-preference-optimization-family, phases/09-reinforcement-learning/09-reward-modeling-rlhf, phases/10-llms-from-scratch/08-dpo]
manuals: []
practice: []
cheatsheet: [alignment-training, rlhf-dpo]
related: [post-training/dpo-chosen-logprob-falls, post-training/reward-up-humans-flat]
updated: 2026-11-03
---

A staff engineer argues that moving every alignment run from PPO to direct preference methods ends the reward-hacking problem, because there is no reward model left to hack. Make the counter-argument with the mechanism, and say what survives in your pipeline either way.

## Short answer

Direct methods remove the explicit reward model, not the proxy. The quantity they optimize is the log ratio of policy to reference, an implicit reward that the preference data pins down only where the data has coverage. Under optimization the policy queries that ratio out of distribution, and the published curves of gold reward against KL show the same peak and then collapse as reward-model pipelines, with the KL regularization failing to stabilize it. What survives: a blind held-out eval, early stopping, broader preference data, and ensembles of signals.

## Full answer

### The mechanism

DPO rewrites the reward as beta times the log ratio of policy to reference. That function is fit from pairs, and it is constrained only on the pairs. Everywhere else its value is whatever the parameterization implies. As the policy moves to raise the margin, it samples from regions no pair covered, where the implicit reward is arbitrary. The study of scaling laws for over-optimization in direct alignment trained policies across KL budgets and found the same shape as reward-model over-optimization: the gold reward rises, peaks, and falls as the KL grows.

### Where Goodhart bites now

In the PPO stack the proxy is a trained reward model. In the direct stack the proxy is the ratio against the reference. The failures look different: the degraded chosen response, where the chosen answer loses probability while the margin grows; length exploitation, where a longer winner pads the gap; arbitrary rewards on pairs that are rare under the reference. They are one disease in a different organ.

### Why the KL does not save it

In PPO the KL term is explicit and tunable, and an adaptive controller holds it near a target. In DPO the anchor is structural: the sigmoid saturates as the ratio grows. The study's result is that this structural regularization does not stop the collapse. Beta changes the speed, not the shape.

### What survives in any pipeline

- A blind, held-out human or trusted-judge eval on a fixed prompt set, read at every checkpoint. It is the one signal the policy cannot game.
- Early stopping on that eval, not on the training margin.
- Data: coverage of the regions the policy drifts into, collected from the current policy's samples.
- Ensembles: several reward signals or several losses on one battery, because one exploit rarely fits all of them.
- Logs of the absolute chosen log-probability and of the KL to the reference, so that the drift is visible before the eval falls.

### The honest version of the claim

Direct methods do remove a model to train and host, PPO's instability, and the class of exploits that live in reward model weights. They are the default for most frontier post-training runs for those reasons. They do not remove the need to guard against over-optimization, so the guard moves into the pipeline design.

## Follow-ups

- **Level 3:** What does DPO remove from the PPO stack, concretely? Expected: a reward model to train and host, the PPO loop with its clip and value head, and an explicit KL coefficient; it keeps the frozen reference.
- **Level 4:** Which variant bounds the gap, and what does that buy against this failure? Expected: the identity-mapping loss, whose margin target is one over two beta; it stops a weak preference from producing an unbounded implicit reward, which removes one path to collapse but not the out-of-distribution query.
- **Level 4:** How do you detect over-optimization without a gold reward? Expected: a held-out eval with generation, the absolute chosen log-probability, the KL to the reference, and a comparison across checkpoints; a margin that grows while the eval falls is the signature.
- **Level 4:** Does iterating, with fresh pairs from the current policy each round, help? Expected: yes, it moves the data coverage to where the policy lives, which is what the reference-ratio proxy lacks; it also reintroduces an online loop that needs its own stop rule.

## Wrong answers

- "No reward model means nothing to hack." The implicit reward is a function the data pins down only on the pairs; the policy can push it anywhere else.
- "The structural KL in DPO is enough regularization." The published curves show the same peak and collapse across KL budgets; beta changes the speed, not the shape.
- "Use a smaller beta so the policy learns faster and you can stop earlier." A smaller beta lets the policy move further from the reference per unit of margin, which is the direction of the failure.

## Taught in

The [DPO family lesson](../../../phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/) states the universal over-optimization result and the fixes that transfer, and the [reward modeling lesson](../../../phases/09-reinforcement-learning/09-reward-modeling-rlhf/) lists the over-optimization guards that every pipeline keeps.
