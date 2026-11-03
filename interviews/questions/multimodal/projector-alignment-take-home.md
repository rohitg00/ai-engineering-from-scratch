---
id: projector-alignment-take-home
title: Build and test a projection between two frozen models
card: multimodal
kind: take-home
level: 2
roles: [applied-ai-engineer]
rounds: [take-home, coding]
tags: [projector, cosine-loss, frozen-encoder, take-home]
minutes: 30
lessons: [phases/19-capstone-projects/60-projection-layer-modality-align, phases/19-capstone-projects/61-cross-attention-fusion, phases/12-multimodal-ai/05-llava-visual-instruction-tuning]
manuals: []
practice: [clip-contrastive-loss]
cheatsheet: [vlm-from-scratch]
related: [multimodal/train-only-the-projector]
updated: 2026-11-03
---

Take-home. You get a frozen vision encoder that emits 197 tokens of width 768 per image and a frozen text embedding table of width 512. Build the smallest module that lets the two talk, train it on paired samples, and ship tests that prove it works. Describe the design, the loss, how you train it, and the tests.

## Short answer

Pool the 197 image tokens to one vector, pass it through a two-layer MLP, 768 to 1024 to 512 with a GELU between, and compare it with the mean-pooled caption embedding through a cosine alignment loss, one minus the cosine. Train only the MLP, about 1.3M parameters, with the encoder and the table frozen, for a few hundred steps over a few dozen pairs. The tests: the output shape equals the text width, the frozen parts have no trainable parameters, the loss is zero on identical vectors and two on opposite vectors, a gradient reaches the projector after one backward pass, and the loss at the last step is lower than at the first.

## Full answer

### Design

```text
image tokens (B, 197, 768) -> pool -> (B, 768)
MLP: Linear(768, 1024) -> GELU -> Linear(1024, 512) -> (B, 512)
caption ids -> frozen table -> mean over tokens -> (B, 512)
loss = 1 - cos(image_emb, text_emb)
```

Pooling: the first token is the simplest choice; a mean over the 196 patch tokens is the alternative, and the exercise compares them. Two layers, because one linear map cannot bend the space; the GELU gives the one bend that aligns the two bases.

### Parameters

| Layer | Shape | Parameters |
|---|---|---|
| first linear | 768 by 1024 | 768 times 1024, plus 1024 |
| GELU | | 0 |
| second linear | 1024 by 512 | 1024 times 512, plus 512 |

About 1.3M in total, next to an encoder of 86M. Both big parts have `requires_grad=False` on every parameter.

### Training loop

- Build 32 synthetic pairs from a seed when no dataset is allowed, and cycle them.
- One optimizer over the projector parameters only.
- Run 200 steps and print the loss every 25 steps. The capstone's run falls from about 1.07 to about 0.80.
- Print the final cosine per pair.

### Tests

1. The projector output shape matches the configured output width.
2. The frozen text table and the frozen vision encoder have zero parameters that require a gradient.
3. The cosine loss is 0 on identical vectors and 2 on anti-parallel vectors.
4. A gradient reaches the projector weights after one backward pass.
5. The loss at step 200 is lower than at step 0.

### What you ship

The projector weights are the only new artifact. At inference the encoder still runs its forward pass, then the projector, and the output lands in the text space. The same shape appears in every open adapter model: pool, project, train alone.

### The next step, for the discussion

The per-pair cosine aligns direction; a contrastive batch loss would also push each image away from the other captions in the batch. For a decoder that grounds each word, cross-attention from text queries into the 197 image tokens replaces the pooled vector; that is the following capstone.

## Follow-ups

- **Level 2:** Why cosine and not mean squared error? Expected: alignment means the same direction in the joint space, not equal vectors; cosine is scale-invariant, so the projector is not punished for a norm the text table happens to have.
- **Level 2:** What does a learned temperature on the cosine change? Expected: a sharper or flatter loss surface; too small gives noisy gradients and too large plateaus high, as the exercise shows.
- **Level 3:** The capstone's run stops near 0.80 after 200 steps. Is that a floor? Expected: no; it is the loss of one run at 200 steps. The projector has 1024 hidden units for 32 pairs, so more steps or a different rate can push the loss lower; on natural pairs, the encoder features set how far the alignment can go.
- **Level 3:** How does this module relate to a query-based bridge? Expected: that bridge ends in the same kind of projection to the text width; the difference is that it first compresses the tokens through learned queries instead of pooling.

## Wrong answers

- "Fine-tune the encoder as well; it is only 86M parameters." The take-home gives frozen parts for a reason: a few dozen pairs cannot teach the encoder anything, and the test that checks the frozen table would fail.
- "Use a single linear layer; it is enough for a rotation." The two bases differ by more than a rotation; the non-linearity is what lets one bend close the gap.
- "Skip the tests; the loss went down." The loss can fall through a shape bug or a leak into the frozen parts; the tests pin the contract that the loss alone cannot.

## Taught in

The [projection capstone](../../../phases/19-capstone-projects/60-projection-layer-modality-align/) specifies the module, the loss, the loop and the five tests, and the [cross-attention fusion capstone](../../../phases/19-capstone-projects/61-cross-attention-fusion/) is the step after it.
