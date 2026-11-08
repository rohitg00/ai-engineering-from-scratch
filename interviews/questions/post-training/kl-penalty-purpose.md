---
id: kl-penalty-purpose
title: What the KL penalty in RLHF protects
card: post-training
kind: concept
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [ml-depth]
tags: [rlhf, kl-penalty, reward-hacking, ppo, alignment-tax]
minutes: 10
lessons: [phases/09-reinforcement-learning/09-reward-modeling-rlhf, phases/10-llms-from-scratch/07-rlhf, phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal]
manuals: []
practice: [ppo-clip-loss]
cheatsheet: [rlhf-dpo, alignment-training]
related: [post-training/reward-model-pairwise]
updated: 2026-11-03
---

In the PPO stage of RLHF, the objective subtracts a KL term between the policy and a frozen copy of the SFT model. A new hire asks why the pipeline keeps a second copy of the model in memory for that one term. Explain the failure it prevents and how you tune its coefficient.

## Short answer

The reward model was trained on answers that look like SFT output. Without the term, PPO moves the policy into regions the reward model never saw and finds strings that score high but that people dislike. The term charges the policy for leaving the SFT distribution, so it is a regularizer, not a hard constraint. Tune beta from the measured KL: too low and the reward climbs together with the KL, too high and the policy barely moves from SFT.

## Full answer

### The objective

```text
maximize  E[ R(x, y) ]  -  beta * KL( policy(. | x) || reference(. | x) )
```

The reference is the SFT checkpoint, frozen. The reward model scores whole answers; the KL is summed over the tokens of each answer and subtracted from the reward.

### Without the KL term

The reward model is a finite fit to human preferences and has blind spots. Repeated phrases that signal helpfulness, verbose formal text with no content, bullet points everywhere: each scored high in real pipelines. With no anchor the policy collapses toward a few high-reward modes. The toy three-stage pipeline in the InstructGPT lesson shows this inside 50 update steps when beta is 0.

### Reading the KL

Track the mean KL per answer on every update. The lesson on reward modeling gives 5 to 10 nats, summed over tokens, as the point where the policy has drifted far from SFT: either beta is too low, or reward hacking has started.

### Tuning beta

Reference values: 0.01 to 0.05 in the lesson on reward modeling, 0.02 in the pipeline that the RLHF lesson describes. The common trick is an adaptive beta with a target KL. When the observed KL passes the target, beta doubles; when it falls under half the target, beta halves. The library the lesson shows uses a target of 6.0 with the adaptive controller on.

### The second anchor

The KL protects style and distribution. It does not protect benchmark skill that the reward never asks for. That drop is the alignment tax, and the fix mixes pretraining gradients into the RL objective.

## Follow-ups

- **Level 2:** Why is the term a regularizer and not a trust region? Expected: it adds a cost that grows with the distance; nothing stops the policy from paying it, so a large reward can still buy a large move.
- **Level 2:** What two things must be true of the reference model in code? Expected: its weights never receive gradients, and it never shares parameters with the policy; a shared module silently removes the anchor.
- **Level 3:** The reward rises, the KL rises, and human ratings stay flat. Which knob first? Expected: raise beta or stop early; then widen the reward model's training data so that the exploited region is covered.
- **Level 3:** After RLHF the model scores lower on reading comprehension benchmarks. Is that the KL's job? Expected: no; that is the alignment tax, addressed by a pretraining log-likelihood term in the objective, as the PPO-ptx variant does.

## Wrong answers

- "Drop the reference model to save memory and clip the PPO ratio harder." The clip bounds one update; it does not bound the drift over many updates, which is what the KL does.
- "Set beta high to be safe." A high beta pins the policy to SFT, and the run buys nothing for its compute.
- "KL is a safety filter for harmful text." It measures distance from the SFT distribution and knows nothing about content; a safe reference is what makes it useful.

## Taught in

The [reward modeling lesson](../../../phases/09-reinforcement-learning/09-reward-modeling-rlhf/) explains the KL as the anti-reward-hacking knob, the [RLHF lesson](../../../phases/10-llms-from-scratch/07-rlhf/) builds the penalized objective, and the [alignment signal lesson](../../../phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/) covers the alignment tax.
