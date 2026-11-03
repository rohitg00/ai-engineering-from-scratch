---
id: attention-weights-as-proof
title: A heatmap is not an explanation
card: transformers
kind: concept
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, inference-engineer]
rounds: [ml-depth, design-review]
tags: [interpretability, attention-weights, ablation, induction-heads, probing]
minutes: 10
lessons: [phases/05-nlp-foundations-to-advanced/10-attention-mechanism, phases/07-transformers-deep-dive/03-multi-head-attention, phases/19-capstone-projects/33-multihead-self-attention]
manuals: []
practice: []
cheatsheet: [transformers-attention]
related: [transformers/heads-are-nearly-free]
updated: 2026-11-03
---

A paper draft shows attention heatmaps as proof that the model "reasons over the right tokens". You are the reviewer. What do you say about the heatmaps, and what would convince you that a given head does something specific?

## Short answer

Attention weights are a distribution over positions, and on their own they are not an explanation: for some tasks they can be permuted or replaced by arbitrary alternatives without changing the prediction, so a heatmap shows where mass went, not that it mattered. Ask for an ablation or a counterfactual, zero or shuffle the head and show that the prediction moves. The head roles that have survived probing are specific and testable: heads that attend to the previous token, copy heads, and induction heads that find an earlier occurrence of the current token and copy what followed it.

## Full answer

### The caveat from the literature

A 2019 study showed that on some tasks the attention distribution can be permuted, or swapped for an adversarial alternative, while the output stays the same. The lesson's rule follows: never report attention weights as evidence of reasoning without an ablation or a counterfactual check. Reviewers like heatmaps because they are easy to read; that is a reason to be careful, not a reason to accept them.

### What a head can show you

The inspection hook in the lesson's block returns the per-head weights of shape `(B, H, T, T)`. In a trained model the patterns differ by head: some attend to the token just before, some to the start of the sequence, some spread almost uniformly. Those are descriptions. Turning a description into a claim takes an intervention.

### The evidence that convinces

1. **Ablation.** Zero the head's output or replace its weights with a uniform row and measure the change in loss or in the specific prediction. A head that matters moves the number.
2. **Counterfactual input.** Change the token the heatmap points at and show that the output changes in the direction the story predicts.
3. **A behavioral test for the claimed role.** For an induction head, feed a random token sequence repeated twice and show that the head attends from each token to the token that followed its first occurrence, and that ablating the head removes the copying.
4. **Replication across seeds and prompts.** One heatmap on one example is an anecdote.

### What to write in the review

Ask the authors to keep the heatmaps as illustration and to add the intervention results as the evidence. If the ablation does not move the prediction, the heatmap was decoration.

## Follow-ups

- **Level 3:** A head attends almost uniformly across positions. What does that tell you? Expected: little on its own; it may carry an average or nothing, and only an ablation says which.
- **Level 3:** Describe a test for an induction head in one sentence. Expected: repeat a random token sequence and check that the head attends from each token to the token after its earlier occurrence, with ablation removing the copy behavior.
- **Level 4:** Why can the weights be permuted without changing the output? Expected: the values at the attended positions may carry near-identical information, other heads may be redundant, and later layers can compensate.
- **Level 4:** What replaces the heatmap as the headline figure? Expected: the change in loss or in the target probability under ablation and counterfactual edits, with a band across seeds.

## Wrong answers

- "A high weight means the token caused the output." Weight shows where the lookup went; causation needs an intervention.
- "Average the heads to get the model's attention." Heads do different things; the average hides the roles and still is not evidence.
- "If the heatmap matches human intuition, the model reasons like a human." Agreement with intuition is not a test; the permutation result shows intuitive maps can be irrelevant to the output.

## Taught in

The [attention mechanism lesson](../../../phases/05-nlp-foundations-to-advanced/10-attention-mechanism/) states the explanation trap, the [multi-head lesson](../../../phases/07-transformers-deep-dive/03-multi-head-attention/) lists the probed head roles, and the [attention capstone](../../../phases/19-capstone-projects/33-multihead-self-attention/) exposes the weights for inspection.
