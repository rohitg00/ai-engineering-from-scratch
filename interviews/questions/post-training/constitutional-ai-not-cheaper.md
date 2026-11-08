---
id: constitutional-ai-not-cheaper
title: Replacing the human labeler with a principled model
card: post-training
kind: concept
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [ml-depth, ml-breadth]
tags: [constitutional-ai, rlaif, preference-signal, red-teaming]
minutes: 10
lessons: [phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif, phases/09-reinforcement-learning/09-reward-modeling-rlhf]
manuals: []
practice: []
cheatsheet: [alignment-training]
related: [post-training/reward-model-pairwise]
updated: 2026-11-03
---

Your rater budget is gone. A colleague proposes to replace the human labelers with a model that reads a short list of principles and ranks the pairs, and to run the same RLHF pipeline on those labels. Is this just a cheaper RLHF? What changes?

## Short answer

It is the constitutional recipe, and it changes the failure modes rather than removing them. Phase one has the model critique and revise its own answers against sampled principles and trains on the revisions; phase two trains a reward model on pairs ranked by a feedback model and runs the usual RL stage. Rater psychology stops being the bias, and the reading of the principle set becomes the bias, applied uniformly over the whole dataset. Sycophancy toward a rater drops, and the proxy problem stays.

## Full answer

### The two phases

1. Self-critique and revision. Start from a helpful but not yet harmless SFT model. For a red-team prompt, the model writes an answer, a second pass reads one sampled principle and critiques the answer, and a third pass revises it. The revision is the SFT target. The original work used 16 principles and kept the set small so that critiques stay focused.
2. RL from AI feedback. Generate pairs, let a feedback model rank them against sampled principles, train a reward model on those rankings, and run PPO against it. Everything after the label is the standard pipeline.

### Why it is not only cheaper

- The bias moves. A human rater is inconsistent and pleased by agreement; a feedback model applies one reading of a principle to every pair, strict or loose, but uniform.
- The signal is legible. You can read the principle, the critique and the revision for any example; human labels are opaque.
- Goodhart stays. The proxy is now a model's reading of the principle set, still an imperfect measure, so over-optimization against it is still possible.
- The labeler is the same class of model you train, so a bias in it can be amplified rather than averaged out.

### What the original work claimed

The trained model was more harmless and about as helpful as an RLHF model with comparable data. That result has held across labs.

### A gate next to the training

A parallel defense trains light classifiers that read the same principles and gate the outputs. The first version cost 23.7 percent extra compute; the later version about 1 percent. Training shapes behavior and classifiers enforce invariants; neither one is enough alone.

## Follow-ups

- **Level 2:** Why does the recipe sample one principle per critique instead of giving the model the whole list? Expected: a focused critique is more specific and more useful as a training target; the list as a whole is covered over many samples.
- **Level 2:** Which parts of the pipeline change and which stay? Expected: the label source and the SFT targets change; the reward model, the RL stage and the KL penalty stay.
- **Level 3:** Name a sycophancy-like failure that still occurs with an AI labeler, and a check for it. Expected: the feedback model can prefer answers that quote the principles without following them; rate a held-out set with people and compare the two rankings.
- **Level 4:** How do you argue for a priority order among principles? Expected: conflicts between principles need a resolution rule; a tiered order resolves them top-down, from catastrophic harm to platform rules to general ethics to helpfulness.

## Wrong answers

- "The labels are free now, so collect ten times more pairs." More pairs with the same uniform bias make the bias stronger, not weaker; the volume gain does not fix the proxy.
- "An AI labeler removes human bias from alignment." It replaces rater bias with principle-interpretation bias; the principles and the labeler's reading of them are now the proxy.
- "This is only a safety trick; it does not touch helpfulness." The original work reports about the same helpfulness as RLHF with comparable data, and the same critique loop can target any principle you write.

## Taught in

The [Constitutional AI lesson](../../../phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/) walks both phases and the shift in failure modes, and the [reward modeling lesson](../../../phases/09-reinforcement-learning/09-reward-modeling-rlhf/) places RLAIF among the sources of a preference signal.
