---
id: cross-attention-mask-bug
title: A caption decoder with its masks swapped
card: multimodal
kind: code-reading
level: 2
roles: [applied-ai-engineer]
rounds: [coding, debugging]
tags: [cross-attention, causal-mask, kv-cache, code-reading]
minutes: 12
lessons: [phases/19-capstone-projects/61-cross-attention-fusion, phases/12-multimodal-ai/04-flamingo-gated-cross-attention]
manuals: []
practice: []
cheatsheet: [vlm-from-scratch]
related: [multimodal/perceiver-fixed-tokens]
updated: 2026-11-03
---

A teammate's vision-language decoder trains well, but at inference the captions are wrong from the second token on, and a test with an image of 197 tokens crashes with a shape error. Read the block and the decode loop and find the problems.

```python
def causal_mask(n):
    return torch.tril(torch.ones(n, n, dtype=torch.bool))


class DecoderBlock(nn.Module):
    def forward(self, text, image, mask):
        text = text + self.self_attn(self.ln1(text), mask=None)
        text = text + self.cross_attn(self.ln2(text), image, mask=mask)
        text = text + self.ffn(self.ln3(text))
        return text


def generate(model, image, prompt_ids, steps):
    ids = prompt_ids
    for _ in range(steps):
        memory = model.encode_image(image)
        mask = causal_mask(ids.shape[1])
        logits = model.decode(ids, memory, mask)
        ids = torch.cat([ids, logits[:, -1].argmax(-1, keepdim=True)], dim=1)
    return ids
```

## Short answer

The masks are swapped. Self-attention over the text runs with no mask, so every position sees the future during training, and the model learns to copy the next token instead of predicting it, which breaks as soon as it must generate. Cross-attention gets the causal text mask, which is square over the text length and cannot apply to scores that span text by image, hence the shape error with 197 image tokens. The decode loop also re-encodes the image on every step; encode once, cache the image keys and values, and reuse them.

## Full answer

### The mask discipline

| Attention | Query | Key | Mask |
|---|---|---|---|
| Self-attention over text | text, length Nt | text, length Nt | causal, lower-triangular Nt by Nt |
| Cross-attention into the image | text, length Nt | image, length Nv | none |

Text may not look ahead during autoregression. The image is fully observed before any text exists, and its patches have no order, so every text position may attend to every patch.

### Bug 1: no mask on self-attention

With `mask=None`, position i attends to the positions after it. Under teacher forcing the target of position i is the token at i plus one, which is now visible, so the loss falls fast and the model learns to look it up. At inference the future does not exist, and from the second token the captions fall apart. That is the symptom in the report.

### Bug 2: the causal mask on cross-attention

The scores of cross-attention have the shape Nt by Nv. A causal mask of shape Nt by Nt fits only when Nv equals Nt, and then it silently hides part of the image from the early text tokens. With a 197-token image memory and a shorter text, the shapes do not broadcast and the forward pass raises. The capstone adds one shape-validation function, so that this mistake raises a clear error instead of corrupting a loss curve.

### Observation 3: no key and value cache

The image does not change during decoding. Encoding it on every step and projecting its keys and values again multiplies the cost of the heavy encoder by the number of generated tokens. Encode once, project once, store the keys and values, and pass them to every step. The capstone tests that the cached and the uncached paths give identical logits.

### The fixed block

```python
def forward(self, text, image_kv, text_mask):
    text = text + self.self_attn(self.ln1(text), mask=text_mask)
    text = text + self.cross_attn(self.ln2(text), image_kv, mask=None)
    text = text + self.ffn(self.ln3(text))
    return text
```

## Follow-ups

- **Level 2:** Why does the training loss look fine with the first bug? Expected: teacher forcing puts the target token in the input one position later, and an unmasked attention can read it; the loss measures a lookup, not a prediction.
- **Level 2:** When does cross-attention need a mask? Expected: with several images and text segments interleaved, where a segment may see only the images before it; for one image and one caption, none.
- **Level 3:** What does the gate from the Flamingo design add to this block, and why? Expected: a learned scalar through a hyperbolic tangent on the cross-attention residual, starting at zero, so that a frozen language model keeps its text behavior at initialization and mixes the image in gradually.
- **Level 3:** How do you test the cache path? Expected: run the same prompt with and without the cache and assert that the logits match to float tolerance; the capstone ships that test.

## Wrong answers

- "Use the causal mask on both attentions to be safe." Cross-attention scores are text by image, so a square text mask either raises or hides part of the image; the image needs no mask.
- "The captions are wrong because the image encoder is weak." A model that is right on the first token and wrong from the second leaked the future in training; the mask is the cause.
- "Recomputing the image each step is fine, the encoder is small." The encoder is the heaviest part per call, and the image never changes; the cache is what makes captioning fast.

## Taught in

The [cross-attention fusion capstone](../../../phases/19-capstone-projects/61-cross-attention-fusion/) sets the mask shapes and the key and value cache, and the [Flamingo lesson](../../../phases/12-multimodal-ai/04-flamingo-gated-cross-attention/) adds the gate and the interleaved mask.
