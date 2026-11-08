---
id: rlaif-is-not-cheaper-rlhf
title: Replace the labelers with a model that reads principles
card: safety
kind: tradeoff
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, agentic-ai-engineer]
rounds: [ml-depth, design-review]
tags: [constitutional-ai, rlaif, preference-signal, principles]
minutes: 8
lessons: [phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif]
manuals: []
practice: []
cheatsheet: [alignment-training, constitutional-classifiers]
related: [safety/sycophancy-is-the-loss]
updated: 2026-11-03
---

Your team wants to replace human preference labelers with a model that reads a list of written principles and ranks completions, mainly to save money. Is this cheaper preference training and nothing more? What changes in the failure modes, and what stays?

## Short answer

No. Moving the preference signal from people to a model changes which failures the pipeline has, not whether it has them. Labeler psychology gives way to principle interpretation that is uniform across the dataset and legible, sycophancy toward the user can drop because the labeler model has no user to please but must still be measured, and Goodhart's law remains because the proxy is now the model's reading of the principle set. The rest of the pipeline, a reward model and policy optimization, is unchanged.

## Full answer

### The two phases

Phase one is supervised: the model drafts a response to a red team prompt, a model reads one sampled principle and critiques the draft, a revision answers the critique, and the revision becomes the training target. Phase two is reinforcement learning from AI feedback: a feedback model ranks pairs of completions against sampled principles, a reward model is trained on those rankings, and the policy is optimized against it. The original principle set had 16 entries and was kept small so that critiques stayed focused.

### What changes

- Bias moves from labeler psychology to principle interpretation. The labeler model can read "be honest" more or less strictly than any person, and its strictness is the same across the whole dataset.
- The signal becomes legible. You can read the principle, the critique and the revision. A human label is a bare preference.
- Sycophancy toward the user can drop, because the labeler has no user to please. The lesson also warns that the sycophancy argument still applies once the labeler moves inside the loop, so measure it instead of assuming it is gone.
- Goodhart's law stays. The proxy is now the model's interpretation of the principles, still an imperfect measurement of what you want.

### What stays

A reward model, policy optimization and the claim, which has held across labs, that the result is more harmless and about as helpful as training on human preferences with comparable data.

### Two related ideas

A constitution needs a priority order, because principles conflict. The 2026 rewrite the lesson describes ranks four tiers: avoid catastrophic outcomes, follow platform guidelines, be broadly ethical, be helpful and candid, resolved top down. Separately, lightweight classifiers that read the constitution can gate outputs at serving time; the first version cost 23.7 percent extra compute and the second about 1 percent. Training shapes behavior; classifiers enforce invariants.

## Follow-ups

- **Level 2:** Why can sycophancy drop under a model labeler, and why do you still measure it? Expected: the labeler has no user to please, so agreement with the user's premise is rewarded less; but the labeler is now inside the loop and can reward answers that match its own taste, so the drop must be measured.
- **Level 2:** What is legible here that is opaque in human labeling? Expected: the principle, the critique and the revision can all be read; a human label is a bare preference.
- **Level 3:** Name a sycophancy like failure that can still occur. Expected: the feedback model can over reward completions that match its own reading of a principle, such as preachy or hedged answers, which is Goodhart on the principle set.
- **Level 3:** Why does a constitution need a priority order? Expected: principles conflict; a tiered order resolves conflicts top down instead of leaving them to the labeler model's taste.

## Wrong answers

- "It is the same pipeline with a cheaper labeler." The failure modes change: uniform interpretation bias, sycophancy that can drop but must be measured, the same Goodhart.
- "Written principles remove the proxy problem." The proxy is now the model's interpretation of the principles, still an imperfect measurement.
- "A longer list of principles is safer." The original set was kept small so critiques stayed focused; the order matters more than the count.

## Taught in

The [constitutional AI and RLAIF lesson](../../../phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/) gives the two phases, the changed failure modes and the four tier priority order.
