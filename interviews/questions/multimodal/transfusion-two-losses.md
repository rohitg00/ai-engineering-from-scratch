---
id: transfusion-two-losses
title: Two losses, one transformer, one gradient step
card: multimodal
kind: concept
level: 4
roles: [applied-ai-engineer]
rounds: [ml-depth]
tags: [transfusion, two-loss, flow-matching, attention-mask]
minutes: 15
lessons: [phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified, phases/12-multimodal-ai/11-chameleon-early-fusion-tokens]
manuals: []
practice: []
cheatsheet: [unified-multimodal, image-generation-compared]
related: [multimodal/vq-tokenizer-ceiling, multimodal/show-o-parallel-decoding]
updated: 2026-11-03
---

Explain how a single transformer can train the text objective of next-token prediction together with a denoising loss on images in one gradient step. Cover the input representation, the attention mask, how the loss is routed per position, and the balance problem that follows. Then say what a sibling architecture changed.

## Short answer

Text enters as discrete tokens through the embedding table; images enter as continuous 16 by 16 pixel patches through a linear projection, bracketed by image start and end tags. One forward pass runs over the mixed sequence, and the loss is picked per position: cross-entropy on the vocabulary head for text positions, and a flow-matching regression for image patches, which predicts the velocity from a noised patch toward the clean one at a sampled time. The mask is block-triangular, causal over text and bidirectional among the patches of one image, with text attending to images that closed before it and patches attending to the preceding text. Both losses backpropagate through the same weights, so their relative magnitude must be balanced by hand; the sibling architecture keeps the joint attention but gives text and image their own weights in every block.

## Full answer

### The input

Two kinds of positions in one sequence. A text position holds a token id and goes through the embedding table. An image position holds a real-valued patch vector, projected into the hidden size by a linear layer, the way a vision transformer embeds its input. Tags mark where an image starts and ends.

### The mask

```text
M[i, j] = 1 if
  i and j are text and j <= i                        causal text
  or i and j are patches of the same image           bidirectional inside an image
  or i is text, j is a patch, and that image closed before i
  or i is a patch, j is text, and j precedes the image start
```

Teacher forcing on text requires the causal part. An image is one snapshot, so its patches may all see each other.

### The loss per position

- Text: the cross-entropy of the vocabulary head against the next token.
- Image: sample a time t, interpolate between the clean patch and noise with weight t, feed the noisy patch, and regress the velocity, the noise minus the clean patch, with a mean squared error.

Both terms add into one loss and one backward pass; the shared body receives both gradients.

### Generation

Text decodes token by token. When the model emits the image start tag, generation switches to a denoising loop over the image patches, conditioned on the text so far, for a few dozen steps, then returns to text.

### The balancing problem

The two losses live on different scales. The lesson's exercise poses a mix of 70 percent text and 30 percent image positions where the image loss is about ten times the text loss in magnitude; without weights, one head dominates the shared gradient. The weights, and any mismatch in schedules between the two objectives, are a search of their own, which is the price of avoiding a quantizer. The reward is image quality above a discrete model of the same size, by 3 to 5 points on the standard image score in the paper.

### The sibling

The multimodal diffusion transformer behind a well-known image generator keeps the joint attention across modalities but gives text and image their own query, key, value and MLP weights in every block, trains with rectified flow, and ships in 2B and 8B parameter variants. Separate weights remove some of the balancing pressure at the cost of more parameters.

### Where it sits

Discrete-code designs trade this plumbing for one loss and a tokenizer ceiling; the masked discrete design keeps one loss and parallel decoding. This design is the pick when fidelity is paramount and the two-loss recipe is acceptable.

## Follow-ups

- **Level 3:** Why may image patches attend bidirectionally when text may not? Expected: text is generated left to right under teacher forcing, so a token must not see its target; an image is produced as one snapshot, and its patches have no order.
- **Level 4:** How would you set the loss weights? Expected: measure the magnitude and the gradient norm of each loss on a held-out batch, scale them to comparable contributions, and tune from there against a text eval and an image eval together, because one can improve while the other regresses.
- **Level 4:** What does the sampled time t do in the training loss? Expected: it picks how much noise the patch carries, so the model learns the whole path from noise to clean; at generation each step moves along that path.
- **Level 4:** What does the sibling's per-modality weight set cost and buy? Expected: more parameters per block; it buys separate capacity for two very different input statistics and eases the balance, while the joint attention still lets the modalities condition each other.

## Wrong answers

- "One transformer can only have one loss." The loss is a function of the outputs per position; routing a different loss to different positions is one summed objective with one backward pass.
- "Use a causal mask everywhere for simplicity." Causal attention inside an image hides part of each image from its own patches and hurts generation; the mask must be bidirectional inside an image block.
- "The two losses balance themselves because they share the weights." Shared weights are the problem: the larger loss dominates the shared gradient until you weight them.

## Taught in

The [Transfusion lesson](../../../phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/) builds the two-loss trainer and the mask and names its sibling design, and the [Show-o lesson](../../../phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/) places it against the discrete designs.
