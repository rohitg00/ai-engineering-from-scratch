---
id: dpo-chosen-logprob-falls
title: Margin up, chosen answers down, in a DPO run
card: post-training
kind: debug
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [dpo, degraded-chosen, over-optimization, length-bias]
minutes: 12
lessons: [phases/18-ethics-safety-alignment/03-direct-preference-optimization-family, phases/19-capstone-projects/40-dpo-from-scratch, phases/10-llms-from-scratch/08-dpo]
manuals: []
practice: [dpo-loss]
cheatsheet: [alignment-training, rlhf-dpo]
related: [post-training/dpo-implicit-reward]
updated: 2026-11-03
---

During a DPO run the loss falls and the reward margin that the trainer logs grows every epoch. Yet the model's samples get shorter and less fluent, and the policy now gives the chosen training answers a lower probability than they had under the reference. Explain the mechanism and what you change.

## Short answer

The DPO loss cares only about the difference of two log ratios. It can lower the probability of the chosen answer as long as the rejected answer falls faster, and the margin still grows. This is the degraded chosen response failure: the policy moves probability mass away from both training answers, often toward short degenerate outputs. Log the absolute chosen log-probability, add a penalty on downward moves of the chosen term as the behavior-preserving variant does or switch to a loss with a bounded margin, and keep a generation eval next to the margin.

## Full answer

### Why the margin can lie

The DPO gradient pushes the chosen log ratio up and the rejected log ratio down, but only their difference enters the loss. If the rejected answers are easy to suppress, the cheapest way to grow the margin is to suppress them hard while the chosen answers drift down too. The implicit reward gap is also unbounded: a weak preference can produce an arbitrarily large gap. Nothing in the loss asks the policy to keep generating the chosen answers.

### What you log

- The absolute chosen log-probability under the policy, per epoch, next to the margin. The capstone's margin function reports the difference; add the chosen term alone.
- Sample lengths and a small generation eval. A margin that grows while samples degrade is the signature.
- The KL to the reference. The move away from both answers shows up as a growing distance.

### The fixes

1. A penalty on downward moves of the chosen log-probability. The behavior-preserving variant of the family adds that one correction and reports a gain over plain DPO on reasoning tasks.
2. A bounded margin. The identity-mapping variant replaces the log sigmoid with a squared error on a target of one over two beta, so the gap and the preference strength stay proportional.
3. A conservative beta and early stopping, chosen against a generation eval, not against the training margin.
4. Better pairs. Pairs where both answers are rare under the reference produce arbitrary implicit rewards; filter them.

### Why this is still over-optimization

Direct alignment methods remove the explicit reward model, not the proxy. The quantity they optimize is a ratio against the reference, and that ratio can be pushed to places the preference data never covered. The same peak-and-collapse curve that reward models show appears here across KL budgets.

## Follow-ups

- **Level 3:** Why does length matter in this failure? Expected: a long rejected answer has a more negative total log-probability by construction, so suppressing it is cheap and the gap grows for the wrong reason; length normalization removes that incentive.
- **Level 3:** How does a reference-free, length-normalized loss change the picture? Expected: it scores the average log-probability per token with a margin, which removes the length bias and the reference, but it also removes the anchor, so drift needs its own guard.
- **Level 4:** Which variant do you pick when preference strengths vary widely across pairs? Expected: the bounded one; it keeps the gap proportional to the preference, so strong pairs do not saturate the loss and weak pairs do not blow up.
- **Level 4:** Does a lower beta help here? Expected: no; a lower beta lets the policy move further from the reference for the same margin, which makes the degradation worse.

## Wrong answers

- "The margin grows, so training works; the samples are a decoding problem." The margin can grow while both answers lose probability; the generation eval is the objective, not the margin.
- "Raise beta until the samples recover." A higher beta slows the drift but does not change the direction of the gradient on the chosen term; the penalty on that term does.
- "Train more epochs; the chosen probability will come back." The loss has no term that rewards a higher chosen probability on its own, so more epochs push further the same way.

## Taught in

The [DPO family lesson](../../../phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/) names this chosen-answer failure and the variants that fix it, and the [DPO capstone](../../../phases/19-capstone-projects/40-dpo-from-scratch/) derives the gradient that pushes the chosen up and the rejected down.
