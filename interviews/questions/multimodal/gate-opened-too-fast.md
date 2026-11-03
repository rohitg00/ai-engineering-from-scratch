---
id: gate-opened-too-fast
title: A gated VLM fine-tune that forgot how to write
card: multimodal
kind: debug
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [gated-cross-attention, catastrophic-forgetting, fine-tuning, flamingo]
minutes: 12
lessons: [phases/12-multimodal-ai/04-flamingo-gated-cross-attention, phases/19-capstone-projects/61-cross-attention-fusion]
manuals: []
practice: []
cheatsheet: [vlm-architectures, vlm-from-scratch]
related: [multimodal/perceiver-fixed-tokens, multimodal/cross-attention-mask-bug]
updated: 2026-11-03
---

You fine-tune a model built like Flamingo, with a gated cross-attention block after every few layers of a frozen language model, on a small captioning dataset. Captions improve, but text-only quality degrades: the model rambles on plain prompts and loses facts it knew. What is the likely cause, how do you confirm it, and how do you fix it?

## Short answer

The gates opened too wide too fast. Each gated layer adds the hyperbolic tangent of a learned scalar times the cross-attention output to the residual stream; at zero the layer is a no-op and the model is the pretrained text model. A high learning rate on the gates, or no regularization, lets visual noise flood the residual stream even when the prompt has no image. Confirm it by reading the gate values per layer against the base and by running a text-only eval with the gates forced to zero; fix it with a lower rate or a schedule on the gates, a text-only data mix, and a check that the layers add nothing when no image is present.

## Full answer

### The mechanism

```text
x_after = llm_block(x_before)
cross   = cross_attn(x_after, visual_latents)
x_next  = tanh(alpha) * cross + x_after
```

At initialization alpha is zero, so the model is exactly the frozen language model. As alpha grows, visual information is added on top of the text representation. The residual means that even a fully open gate does not erase the text path, but a large gate adds a large term at every fourth block. If the cross-attention output is noise, that noise reaches the output.

### Why a fine-tune breaks it

- The gates are the cheapest parameters to move, so a learning rate chosen for the cross-attention weights pushes them fast.
- A caption-only dataset never shows a text-only prompt, so nothing penalizes gates that add visual terms when there is no image to attend to.
- With few images per prompt, the masked cross-attention has little to read, and an open gate still adds its output.

### Confirm

1. Log the gate value per layer. Compare it with the base checkpoint and with the step at which text quality fell.
2. Run the text-only eval with the gates forced to zero. If the quality returns, the gates are the cause.
3. Send a text-only prompt through the model and measure the norm of the gated term per layer. It should be near zero when no image is present.

### Fix

- A lower learning rate or a warm-up schedule for the gate scalars, so that they open over the run rather than in the first steps.
- A text-only mix in the fine-tuning data, so that the loss covers the case the product sees.
- A regularizer on the gates, or a cap on their magnitude.
- A mask check: text tokens with no preceding image must attend to nothing, and the gated term must add nothing.
- Fewer gated layers, if the task does not need one every fourth block.

### Why the design is still right

The gate is what let the original work keep a frozen 70B language model intact while it learned to read images. The failure here is in the schedule, not in the architecture.

## Follow-ups

- **Level 3:** What does the residual connection buy once the gate is open? Expected: the text representation is never overwritten, only added to; even a fully open gate leaves the text path intact, which is why the fix is the schedule and not a redesign.
- **Level 3:** How would you spot the same damage in a model that concatenates image tokens instead? Expected: there is no gate to read; the damage shows as a shift in the language model weights, so compare the text-only eval before and after, and freeze the language model or limit it to adapters.
- **Level 4:** Design a unit test that catches this before training. Expected: build the block with alpha at zero and assert that the output equals the block output exactly for a text-only input, then set a large alpha and assert that a text-only input with an empty mask still equals the block output.
- **Level 4:** How do you decide how many gated layers to keep? Expected: ablate the insertion frequency against caption quality and text-only quality on one eval; every fourth block is the reference, and fewer layers mean fewer places for noise to enter.

## Wrong answers

- "The captioning data is too small; add more images." More caption data with no text-only prompts pushes the gates further the same way; the fix is the gate schedule and the data mix.
- "Unfreeze the language model so that it can adapt to the visual input." That trades a schedule problem for catastrophic forgetting of the text model, which the frozen design exists to prevent.
- "Replace gated cross-attention with the simpler concatenation design." The symptom is a schedule problem; the gate is the mechanism that protects the text model, and the simpler design has no such protection.

## Taught in

The [Flamingo lesson](../../../phases/12-multimodal-ai/04-flamingo-gated-cross-attention/) explains why the gate starts at zero and names an over-fast gate as the cause of degraded text performance, and the [cross-attention fusion capstone](../../../phases/19-capstone-projects/61-cross-attention-fusion/) builds the block and the gate exercise.
