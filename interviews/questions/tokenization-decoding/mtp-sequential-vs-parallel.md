---
id: mtp-sequential-vs-parallel
title: Which multi-token design gives a free draft
card: tokenization-decoding
kind: concept
level: 3
roles: [inference-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [ml-depth, design-review]
tags: [multi-token-prediction, speculative-decoding, pretraining, causal-chain, shared-head]
minutes: 10
lessons: [phases/10-llms-from-scratch/18-multi-token-prediction]
manuals: []
practice: []
cheatsheet: [speculative-decoding]
related: [tokenization-decoding/hidden-state-drafts]
updated: 2026-11-03
---

A pretraining team wants to supervise each position on more than the next token. One design puts several independent output heads on the backbone. Another chains small modules, one per extra depth. Which design gives you a usable speculative draft at inference, and what does it cost during training?

## Short answer

The chained design. Module k takes the previous depth's hidden state and the embedding of the actual next token, runs its own small transformer block, and reuses the shared embedding and the shared output head, so its prediction of the token at t plus k plus 1 is conditioned on the token at t plus k, which is the same causal chain a decoder follows and lets the module draft tokens at inference with acceptance at depth one of 80 percent or more for about 1.8 times throughput. Independent heads all read the same hidden state and cannot condition on each other. The training cost is about 10 percent slower pretraining and about 14 h squared parameters per module, with a loss weight of 0.3 early and 0.1 later.

## Full answer

### The sequential recipe

For a prefix through position i, depth zero is the main backbone, and depth k builds on depth k minus 1:

```text
h_i^(k) = T_k( M_k · concat( RMSNorm(h_i^(k-1)), RMSNorm(E(t_{i+k})) ) )
logits_{i+k+1} = Out( h_i^(k) )
L_k = cross-entropy( logits_{i+k+1}, t_{i+k+1} )
L_MTP = (lambda / D) · sum over k of L_k
```

`E` is the embedding table and `Out` is the output head, both shared with the main model. `M_k` folds the previous hidden state and the next token's embedding into one vector. `T_k` is one transformer block. The total loss is the main next-token loss plus `L_MTP`, with lambda at 0.3 for the first 10 percent of training and 0.1 afterward.

### Why the chain matters

To predict two tokens ahead, module one sees what the next token actually was. At inference you feed it the drafted token instead, and it predicts the one after. That is exactly how a hidden-state draft works, so the trained module is a draft network for free. Parallel heads fire from one hidden state, so head two cannot use head one's answer. A verifier can still check their guesses, but they are accepted less often.

### The accounting

Per module: the projection is `2 h^2`, the block is about `12 h^2` for attention and a gated MLP, so about `14 h^2`. At a hidden size of 7168 and one module that is about 720M on paper; the published figure is 14B on a 671B main model, about 2 percent, because the module's MLP inherits the expert structure of the main model. The embedding and head add nothing, because they are shared.

### What you get

1. A denser training signal: every hidden state is supervised on D plus 1 targets, and the report shows consistent gains on reasoning, math and code evaluations.
2. A draft at inference with 80 percent or more acceptance at depth one, for about 1.8 times generation throughput, and the training-time cost is paid back the first time the model serves.

### Against a post-hoc draft

| | Post-hoc hidden-state draft | Baked-in modules |
|---|---|---|
| When trained | after pretraining | during pretraining |
| Works with existing weights | yes | no, retrain |
| Draft parameters | one or two layers | one block plus a projection |
| Acceptance | 0.88 to 0.92 | 0.80 and above at depth one |
| Benefit beyond speed | none | denser training signal |

Use the baked-in design when you control pretraining and the hidden size is at least 4096; at a 1B scale the overhead hurts more than it helps. Use the post-hoc draft when the weights already exist.

## Follow-ups

- **Level 3:** Why share the embedding and the output head with the main model? Expected: no extra parameters, and the module predicts in the same vocabulary space as the backbone.
- **Level 3:** Why is the published parameter overhead larger than the `14 h^2` estimate? Expected: the module's MLP has the same expert structure as the main model, which multiplies its parameters.
- **Level 4:** With two modules, what does the second one take as input? Expected: the first module's hidden state and the embedding of the token two ahead, to predict the token three ahead.
- **Level 4:** A team wants to add this to an existing dense model by fine-tuning a new head. Your answer? Expected: the module is not trained and the backbone was not shaped by the extra loss; the lesson's position is that it needs a pretraining run, and a post-hoc draft is the right tool for existing weights.

## Wrong answers

- "The extra loss replaces next-token prediction." It is added to the main loss with a small weight; the main objective stays.
- "The module can be bolted onto a trained model with a quick fine-tune." The design is a pretraining choice; existing weights get a post-hoc draft instead.

## Taught in

The [multi-token prediction lesson](../../../phases/10-llms-from-scratch/18-multi-token-prediction/) gives the sequential recipe, the loss, the parameter accounting and the comparison with post-hoc drafts.
