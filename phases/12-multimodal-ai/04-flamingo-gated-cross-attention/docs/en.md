# Flamingo and Gated Cross-Attention for Few-Shot VLMs

> DeepMind's Flamingo (2022) did two things before anyone else. It showed a single model could process arbitrarily interleaved sequences of images, videos, and text. And it showed VLMs could learn in-context — give a few-shot prompt with three example (image, caption) pairs and the model captions a new image without any gradient step. The mechanism: gated cross-attention layers, inserted between the frozen LLM's existing layers, with a learned tanh gate that starts at zero so the LLM's text capability is preserved at initialization. This lesson walks Flamingo's Perceiver resampler and gated cross-attention architecture — the ancestor of Gemini's interleaved inputs and Idefics2's visual tokens.

**Type:** Learn
**Languages:** Python (stdlib, gated cross-attention + Perceiver resampler demo)
**Prerequisites:** Phase 12 · 03 (BLIP-2 Q-Former)
**Time:** ~120 minutes

## Learning Objectives

- Explain how gated cross-attention preserves a frozen LLM's text capability at initialization via tanh(gate) = 0.
- Walk through a Perceiver resampler: N image patches → K fixed "latent" queries via cross-attention.
- Describe how Flamingo handles interleaved image-text sequences with causal masking that respects image placement.
- Reproduce a few-shot multimodal prompt structure (3 image-caption examples then a query image).

## The Problem

BLIP-2 feeds 32 visual tokens into a frozen LLM's input layer. Works for one image per prompt. But what if you want to feed *many* images interleaved with text, as in "here is image A, caption it; here is image B, caption it; now here is image C, caption it"? The LLM's self-attention would need to handle image tokens and text tokens in a single stream, and the question of which positions can attend to which images gets fussy.

Flamingo's answer: do not change the LLM's input stream at all. Insert extra cross-attention layers between existing LLM blocks. Text tokens still flow through the LLM's causal self-attention as always. Between every few LLM blocks, text tokens also cross-attend to image features via a new gated layer. The gate (initialized to zero) means at step zero the new layers are no-ops — the model behaves exactly like the pretrained LLM. As training progresses the gate opens and visual information starts flowing.

The second question Flamingo answered: how do you handle a variable number of images (0, 1, or many) per prompt? A Perceiver resampler — a small cross-attention module that takes whatever number of patches you have and produces a fixed number of visual latent tokens. The LLM cross-attention layer sees the same shape regardless of how many images are in the prompt.

## The Concept

### The frozen LLM

Flamingo starts with a frozen Chinchilla 70B LLM. All 70B weights untouched. The existing text self-attention and FFN operate normally.

### Perceiver resampler

For each image in the prompt, the ViT produces N patch tokens. The Perceiver resampler has K fixed learnable latents (Flamingo uses K=64). Each resampler block is two sub-steps:

1. Cross-attention: the K latents attend over the N patch tokens (Q from latents, K/V from patches).
2. Self-attention + FFN within the latents.

After 6 resampler blocks, the output is K=64 visual tokens of dim 1024, regardless of how many patches the ViT produced. A 224x224 image (196 patches) and a 480x480 image (900 patches) both exit as 64 resampler tokens.

For video, the resampler is applied temporally: each frame's patches produce 64 latents, and a temporal positional encoding lets the model distinguish t=0 from t=N. The full video becomes T * 64 visual tokens.

### Gated cross-attention

Between every M layers of the frozen LLM (Flamingo uses M=4), insert a new gated cross-attention block:

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha` is a learnable scalar initialized to zero.
- `tanh(0) = 0`, so at init the gated branch contributes zero.
- As `alpha` moves away from zero, the cross-attention contribution grows smoothly.
- The residual connection means even a fully-open gate does not overwrite the LLM's text representation; it just adds visual information on top.

This is the single most important design choice in Flamingo: visual conditioning is additive, gated, and zero at initialization. A Flamingo at step 0 is a perfect Chinchilla 70B on text-only inputs.

### Masked cross-attention for interleaved inputs

In a prompt like "<image A> caption A <image B> caption B <image C> ?", each text token should only see images that came before it in the sequence. The cross-attention mask enforces: text token at position `t` attends only to image resampler tokens whose image index `i < i_t` where `i_t` is the most recent image before position `t`. "Sees only the last preceding image" or "sees all preceding images" are both valid choices; Flamingo chose the former.

### In-context few-shot learning

A Flamingo prompt looks like:

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

The model sees the completion pattern and outputs "bird" (or whatever image3 shows). No gradient steps. The frozen LLM's in-context learning capability carries through the gated cross-attention — this is the punchline of the paper and why it matters.

### Training data

Flamingo trained on three datasets:

1. MultiModal MassiveWeb (M3W): 43M web pages with interleaved images and text, reconstructing reading order.
2. Image-Text Pairs (ALIGN + LTIP): 4.4B pairs.
3. Video-Text Pairs (VTP): 27M short video clips.

OBELICS (2023) is an open reproduction of the interleaved web corpus, which Idefics, Idefics2, and most open "Flamingo-like" models train on.

### OpenFlamingo and Otter

OpenFlamingo (2023) is the open reproduction. Architecture identical (Perceiver resampler + gated cross-attention on frozen LLaMA or MPT). Checkpoints at 3B, 4B, 9B. Quality lags Flamingo due to smaller base LLM and less data.

Otter (2023) builds on OpenFlamingo with instruction tuning on MIMIC-IT (a dataset of multimodal instructions), showing gated cross-attention works for instruction following too.

### The descendants

- Idefics / Idefics2 / Idefics3: Hugging Face's gated cross-attention lineage, progressively simpler (Idefics2 dropped the resampler in favor of direct patch tokens with adaptive pooling).
- Flamingo-to-Chameleon transition: by 2024 many teams moved to early-fusion (Lesson 12.11); Flamingo-style gated cross-attention remains in production where backbone freezing is required.
- Gemini's interleaved input: conceptually inherits Flamingo's interleaved-format flexibility, though the exact mechanism is proprietary.

### Comparison to BLIP-2

| | BLIP-2 | Flamingo |
|---|---|---|
| Visual bridge | Q-Former once at input | Gated cross-attention at every M layers |
| Visual tokens | 32 per image | 64 per image per cross-attn layer |
| Frozen LLM | Yes | Yes |
| Few-shot in-context | Weak | Strong — the paper's centerpiece |
| Interleaved inputs | No native support | Yes, the design target |
| Training data | 130M pairs | 1.3B pairs + 43M interleaved pages |
| Parameter count | 188M trained | ~10B trained (cross-attn layers) |
| Compute | Days on 8 A100s | Weeks on thousands of TPUv4 |

Pick BLIP-2 for single-image VQA on a budget. Pick Flamingo/Idefics2 for interleaved, few-shot, or multi-image reasoning.

## Use It

`code/main.py` demonstrates:

1. A Perceiver resampler on 36 fake patch tokens with 8 learnable latents (pure Python cross-attention).
2. A gated cross-attention step with `alpha = 0` → output equals input (LLM unchanged), then `alpha = 2.0` → visual contribution mixed in.
3. An interleaved-mask builder that produces the 2D attention mask for a "(image 1) (text 1) (image 2) (text 2)" sequence.

## Ship It

This lesson produces `outputs/skill-gated-bridge-diagnostic.md`. Given an open VLM's config (resampler Y/N, cross-attn frequency, gate scheme), it identifies the Flamingo lineage elements and explains the freezing strategy. Useful for debugging why a fine-tune degraded text performance (answer: the gate got too wide too fast).

## Exercises

1. Compute Flamingo-9B's visual parameter count: 9B LLM + 1.4B gated cross-attention layers + 64M resampler. What fraction of total params is trained?

2. Implement the gated residual `y = tanh(alpha) * cross + x` in PyTorch. Show experimentally that with `alpha=0`, `y==x` exactly at init.

3. Read OpenFlamingo Section 3.2 (arXiv:2308.01390) on how they handle multiple images in a batch when each prompt has a different image count. Describe the padding strategy.

4. Why does Flamingo's cross-attention mask let a text token attend to *only the most recent* preceding image rather than all preceding images? Read the Flamingo paper Section 2.4 and explain the tradeoff.

5. In-context few-shot: construct a prompt with 4 examples of "image → color of main object" for a new Flamingo variant. Describe the expected accuracy pattern as you vary the number of examples from 0 to 8.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Perceiver resampler | "Fixed-latent cross-attention" | Module that produces K fixed tokens from a variable number of input patches |
| Gated cross-attention | "Tanh-gated bridge" | Residual layer `y = tanh(alpha)*cross + x`, learnable alpha, init 0 |
| Interleaved input | "Mixed sequence" | Prompt format with images and text mixed freely in reading order |
| Frozen LLM | "No LLM gradients" | The text LLM's weights do not update; only resampler + cross-attn layers train |
| Few-shot | "In-context examples" | Give a few (image, answer) pairs in the prompt; model generalizes without finetuning |
| OBELICS | "Interleaved web corpus" | Open dataset of 141M web pages with images and text in reading order |
| Chinchilla | "70B frozen base" | Flamingo's frozen text LLM, from DeepMind's Chinchilla paper |
| Gate schedule | "How alpha moves" | The rate at which the cross-attention gate opens during training |
| Cross-attn frequency | "Every M layers" | How often a gated cross-attention block is inserted; Flamingo uses M=4 |
| OpenFlamingo | "Open reproduction" | MosaicML/LAION open checkpoint at 3-9B; architecture-identical to Flamingo |

## Further Reading

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198) — the original paper.
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) — open reproduction.
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) — interleaved web corpus.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) — the general Perceiver architecture.
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726) — instruction-tuned Flamingo descendant.
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) — modern simplification of the Flamingo approach.
