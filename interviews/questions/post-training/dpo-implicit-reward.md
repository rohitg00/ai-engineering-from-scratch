---
id: dpo-implicit-reward
title: Where the reward model went in DPO
card: post-training
kind: concept
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [ml-depth]
tags: [dpo, implicit-reward, preference-tuning, beta]
minutes: 12
lessons: [phases/10-llms-from-scratch/08-dpo, phases/19-capstone-projects/40-dpo-from-scratch, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family]
manuals: []
practice: [dpo-loss]
cheatsheet: [rlhf-dpo, alignment-training]
related: [post-training/kl-penalty-purpose]
updated: 2026-11-03
---

DPO is often described as RLHF without a reward model. Walk me through where the reward went. Start from the RLHF objective with its KL term and end at the loss you would implement.

## Short answer

The penalized objective has a closed-form optimum: the optimal policy equals the reference policy times the exponential of reward over beta, normalized per prompt. Invert it and the reward equals beta times the log ratio of policy to reference, plus a term that depends on the prompt alone. Put that reward into the Bradley-Terry preference probability and the prompt-only term cancels, because both answers share the prompt. What is left is a loss in the policy's own log-probabilities: minus the log sigmoid of beta times the difference of the two log ratios.

## Full answer

### The derivation in four lines

```text
optimum:  pi*(y|x) = pi_ref(y|x) * exp( r(x,y) / beta ) / Z(x)
invert:   r(x,y) = beta * log( pi*(y|x) / pi_ref(y|x) ) + beta * log Z(x)
BT:       P(y_w > y_l | x) = sigmoid( r(x,y_w) - r(x,y_l) )
loss:     -log sigmoid( beta * [ log pi(y_w|x)/pi_ref(y_w|x) - log pi(y_l|x)/pi_ref(y_l|x) ] )
```

The log Z term depends on the prompt alone, so it is the same for the chosen and the rejected answer and drops out of the difference.

### What you compute per pair

Four sequence log-probabilities: the policy and the reference on the chosen answer, and both on the rejected answer. Each is the sum of next-token log-probabilities over the answer tokens only, with the prompt positions masked. The reference runs under no gradient.

### The implicit reward

`beta * (log pi(y|x) - log pi_ref(y|x))` is the reward that DPO assigns to an answer. Log the margin between the chosen and the rejected implicit rewards; it should grow during training. The gradient on the chosen log-probability is `-beta * (1 - sigmoid(z))`, negative for every z, so training pushes the chosen answer up and the rejected answer down.

### Where the KL went

No KL term appears in the loss. The constraint is structural: a large move from the reference makes the log ratio large, the sigmoid saturates, and the gradient fades. Beta sets how far the policy may move. The DPO lesson gives 0.1 to 0.5 as the range and 0.1 to 0.3 as the usual sweet spot. A small beta allows large moves and risks degenerate answers; a value near 1.0 pins the policy to the reference.

### What it saves

Two models in memory instead of three or four, and one supervised loop instead of PPO. For a 70B model each copy takes 140GB in FP16, so the reward model you never load is a large saving.

## Follow-ups

- **Level 2:** Why must the policy start as a copy of the reference? Expected: the derivation treats the optimum as the reference plus a learned shift, and a copy makes every implicit reward start at zero.
- **Level 2:** What does a positive log ratio mean? Expected: the policy now gives that answer a higher probability than the reference does.
- **Level 3:** Why does the derivation need both answers to share one prompt? Expected: the partition term depends on the prompt only; with different prompts it would not cancel, and the implicit rewards would not be comparable.
- **Level 4:** Which assumptions of the derivation fail in practice? Expected: that the optimum is reachable, that the pairs are in-distribution for the reference, and that the reference is the true anchor; each later method in the family repairs one of them.

## Wrong answers

- "DPO has no reference model, that is the point." It removes the reward model and PPO; the frozen reference stays in the loss, and the methods that drop it are a later variant.
- "DPO maximizes the probability of the chosen answer." It maximizes the margin of two log ratios; the chosen absolute probability can fall as long as the rejected falls faster.
- "Beta is a learning rate." Beta scales the implicit reward and sets how far the policy may move from the reference; the optimizer step size is a separate setting.

## Taught in

The [DPO lesson](../../../phases/10-llms-from-scratch/08-dpo/) derives the loss and sweeps beta, the [DPO capstone](../../../phases/19-capstone-projects/40-dpo-from-scratch/) checks the gradient sign and the reference invariance, and the [DPO family lesson](../../../phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/) names the assumptions.
