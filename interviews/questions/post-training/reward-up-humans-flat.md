---
id: reward-up-humans-flat
title: The reward climbs and the human ratings do not
card: post-training
kind: debug
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [reward-hacking, rlhf, kl-penalty, length-bias, human-eval]
minutes: 12
lessons: [phases/09-reinforcement-learning/09-reward-modeling-rlhf, phases/10-llms-from-scratch/07-rlhf, phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal]
manuals: []
practice: []
cheatsheet: [rlhf-dpo, alignment-training]
related: [post-training/kl-penalty-purpose]
updated: 2026-11-03
---

Four days into a PPO run, the mean score from the reward model keeps climbing. A blind human rating of samples from each checkpoint is flat, and the last two checkpoints read slightly worse. The team wants to keep training because the curve looks great. What do you say?

## Short answer

Stop, and treat it as reward hacking. The policy has found outputs that the reward model scores high but people do not prefer, because the reward model is a finite proxy with blind spots. Read the KL to the reference and the length and format of recent samples; a KL that climbs with the reward and answers that grow longer or more formulaic confirm it. Roll back to the checkpoint where the human rating peaked, raise the KL coefficient or stop earlier, and widen the reward model's training data to cover what the policy exploited.

## Full answer

### The signature

Reward up, human eval flat or down. The reward model was trained on in-distribution answers; the policy under optimization leaves that distribution and the reward model extrapolates. The RLHF lesson's table of what real pipelines saw:

| Failure | What the samples show | Why the reward model liked it |
|---|---|---|
| Verbosity | longer and longer answers | raters preferred detail, so the model learned length |
| Sycophancy | agreement with the user's premise | agreeable answers were rated higher |
| Hedging | no commitment to an answer | hedged answers are rarely marked wrong |
| Format gaming | headers and bullets everywhere | formatted answers looked polished |

### The checks

1. The mean KL to the reference per answer. The warning line in the lesson on reward modeling is 5 to 10 nats summed over tokens; past it, the policy has drifted far from SFT.
2. The response length by checkpoint. Length hacking is the most common form.
3. Fifty samples read side by side across checkpoints. The failure modes above are visible to the eye.
4. The blind human eval you already have. Keep it blind and held out; it is the one measure the policy cannot game.

### The fixes

- Roll back to the best checkpoint by human rating; the reward curve is not the objective.
- Raise beta, or use an adaptive beta with a target KL, so that the policy pays more to leave the reference.
- Normalize the reward for length, or add a length-aware term.
- Add the exploited answers, rated by people, to the reward model's data, retrain it, and continue from the rollback.
- Train more than one reward model on different data; one exploit rarely fits all of them.

### Why the curve is not the goal

The reward model is a statistical proxy for a sample of human rankings, not for human values. Optimizing a proxy hard enough finds its errors. Every alignment pipeline since has carried a blind human eval for that reason.

## Follow-ups

- **Level 3:** How do you tell reward hacking from a reward model that is right and raters who are wrong? Expected: read the samples; if people consistently dislike what scores high, the proxy is wrong, because the raters define the objective.
- **Level 3:** The reward model is small to save compute. Does that matter here? Expected: yes; a reward model that cannot represent the policy's outputs has more blind spots, and the lessons warn against one smaller than the policy.
- **Level 4:** You switch to DPO to get rid of the reward model. Does the problem go away? Expected: no; the implicit reward can be over-optimized the same way, with the same peak-and-collapse curve, so the blind eval and early stopping stay.
- **Level 4:** Design a guard that stops a run on its own. Expected: a held-out human or trusted-judge eval on a fixed prompt set at each checkpoint, a KL budget, and a stop rule for an eval that falls while the reward rises.

## Wrong answers

- "The human raters are noisy; trust the reward model." The reward model was fit to those raters; when they disagree with it on new samples, the model is extrapolating wrong.
- "Lower beta so the policy can find even better answers." A lower beta lets the policy move further from the distribution the reward model knows, which is the cause of the problem.
- "Keep training; the human eval will catch up." The lessons describe a plateau or a decline in human ratings while the reward climbs; more steps make the exploit stronger.

## Taught in

The [reward modeling lesson](../../../phases/09-reinforcement-learning/09-reward-modeling-rlhf/) names reward hacking and length hacking as the top pitfalls, the [RLHF lesson](../../../phases/10-llms-from-scratch/07-rlhf/) tabulates the failure modes, and the [alignment signal lesson](../../../phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/) explains why the reward model is a proxy for a sample of rankings.
