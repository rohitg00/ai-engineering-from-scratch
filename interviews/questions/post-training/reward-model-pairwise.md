---
id: reward-model-pairwise
title: Why reward models learn from pairs, not scores
card: post-training
kind: concept
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [ml-depth, screen]
tags: [reward-model, bradley-terry, preference-data, rlhf]
minutes: 10
lessons: [phases/10-llms-from-scratch/07-rlhf, phases/09-reinforcement-learning/09-reward-modeling-rlhf]
manuals: []
practice: []
cheatsheet: [rlhf-dpo]
related: [post-training/kl-penalty-purpose, post-training/reward-up-humans-flat]
updated: 2026-11-03
---

You need a reward model for a helpfulness objective. A product manager suggests asking raters to score each answer from one to ten and regressing on the scores. Why do most pipelines collect pairwise comparisons instead, and what loss do you train with?

## Short answer

People are poor at absolute scores and good at relative judgments, so pipelines show two answers to one prompt and ask which is better. The reward model is the SFT model with its vocabulary head replaced by a scalar head. It trains with the Bradley-Terry loss, the negative log of the sigmoid of the reward difference between the preferred and the rejected answer. The difference in reward becomes a log-odds of preference, which turns many relative judgments into one consistent scale.

## Full answer

### The loss

```text
loss = -log( sigmoid( r(x, y_preferred) - r(x, y_rejected) ) )
```

The sigmoid of the difference is the probability that the preferred answer wins. Training pushes the preferred reward up and the rejected reward down. The model reads the hidden state at the last position, because causal attention has seen the whole prompt and answer there, and projects it to one number.

### What accuracy to expect

A random reward model ranks half of the pairs right. The reference pipeline in the RLHF lesson trained its reward model on 33,000 comparisons from 40 raters, about 5 minutes each, and reached about 72 percent accuracy on held-out pairs. That sounds low, but the raters agreed with each other about 73 percent of the time. That agreement estimates the noise in the labels. It is not a hard bound, but a score far above it is a reason to look for a leak.

### Noise in the labels

Roughly 30 percent of human labels are noisy or ambiguous. Filter pairs by rater agreement, or add a temperature to the sigmoid. Pairs where both answers are bad still teach the model which one is less bad.

### Size

A reward model that is too small cannot score the policy's outputs faithfully. The lesson's table lists a 6B reward model for a 175B policy in one pipeline, and a 52B reward model trained on 22,000 comparisons in another. Larger reward models gave more stable signals to the RL stage.

### Where the reward model lives later

The same scalar head powers best-of-N sampling at decode time and the reward side of reasoning pipelines. It is the entry to the whole alignment stack.

## Follow-ups

- **Level 2:** Why read the last token's hidden state and not a mean over positions? Expected: with a causal mask the last position has attended to the whole sequence, so it holds the most complete summary; mean pooling is an alternative worth a test.
- **Level 2:** Your reward model ranks 90 percent of the test pairs right. Good news? Expected: suspicious; with rater agreement near 73 percent, that score suggests a leak or a shortcut such as length, so check what the model keys on.
- **Level 3:** How do you turn comparisons into a reward for several criteria at once? Expected: one reward model per criterion, such as helpfulness and safety, combined with weights; a single model learns a blur of the criteria.
- **Level 4:** Why does the reward model need protection from the policy later? Expected: it saw only in-distribution answers; a policy under optimization moves off that distribution and finds answers that score high for the wrong reasons, which is why the RL stage carries a KL penalty.

## Wrong answers

- "Regress on a one-to-ten score; it is more information per label." Absolute scores drift between raters and sessions; a pairwise judgment is cheap and consistent, and the Bradley-Terry fit recovers a scale from it.
- "72 percent accuracy means the reward model is broken." The raters agreed only about 73 percent of the time; the model is near the agreement of its labels.
- "Use a small reward model to save compute." A reward model that cannot represent the policy's outputs gives a noisy signal, and the policy exploits its blind spots.

## Taught in

The [RLHF lesson](../../../phases/10-llms-from-scratch/07-rlhf/) builds the reward model and its pairwise loss, and the [reward modeling lesson](../../../phases/09-reinforcement-learning/09-reward-modeling-rlhf/) places it in the full pipeline.
