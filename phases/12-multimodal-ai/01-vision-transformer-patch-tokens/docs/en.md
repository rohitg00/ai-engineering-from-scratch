# Vision Transformers and the Patch-Token Primitive

> Before anything multimodal, an image has to become a sequence of tokens a transformer can eat. The 2020 ViT paper answered this with 16x16 pixel patches, a linear projection, and a position embedding. Five years later every 2026 frontier model (Claude Opus 4.7 at 2576px native, Gemini 3.1 Pro, Qwen3.5-Omni) still begins this way — the encoder changed from ViT to DINOv2 to SigLIP 2, register tokens were added, the positional scheme became 2D-RoPE, but the primitive held. This lesson reads the patch-token pipeline end to end and builds it in stdlib Python so the rest of Phase 12 has a concrete mental model for "visual tokens."

**Type:** Learn
**Languages:** Python (stdlib, patch tokenizer + geometry calculator)
**Prerequisites:** Phase 7 (Transformers), Phase 4 (Computer Vision)
**Time:** ~120 minutes

## Learning Objectives

- Convert an HxWx3 image into a sequence of patch tokens with correct positional encoding.
- Compute sequence length, parameter count, and FLOPs for a ViT of a given (patch size, resolution, hidden dim, depth).
- Name the three upgrades that took ViT from 2020 research to 2026 production: self-supervised pretraining (DINO / MAE), register tokens, and native-resolution packing.
- Pick between CLS pooling, mean pooling, and register tokens for a downstream task.

## The Problem

Transformers operate on sequences of vectors. Text is already a sequence (bytes or tokens). An image is a 2D grid of pixels with three color channels — not a sequence. If you flatten every pixel, a 224x224 RGB image becomes 150,528 tokens, and self-attention at that length is a non-starter (quadratic in sequence length).

Pre-2020 approaches bolted a CNN feature extractor onto the front: ResNet produces a 7x7 feature map of 2048-dim vectors, feed those 49 tokens to a transformer. This works but inherits the CNN's biases (translation equivariance, local receptive fields) and loses the transformer's appetite for scale.

Dosovitskiy et al. (2020) asked the blunt question: what if we skip the CNN? Split the image into fixed-size patches (say 16x16 pixels), linearly project each patch into a vector, add a positional embedding, and feed the sequence to a vanilla transformer. At the time this was heresy — vision without convolutions. With enough data (JFT-300M, then LAION) it beat ResNet on ImageNet and kept improving.

By 2026 the ViT primitive is the unquestioned foundation. Every open-weights VLM's vision tower is some descendant (DINOv2, SigLIP 2, CLIP, EVA, InternViT). The question is no longer "should we use patches?" but "what patch size, what resolution schedule, what pretraining objective, what positional encoding."

## The Concept

### Patches as tokens

Given an image `x` of shape `(H, W, 3)` and a patch size `P`, you carve the image into a grid of `(H/P) x (W/P)` non-overlapping patches. Each patch is a `P x P x 3` cube of pixels. Flatten each cube to a `3 P^2` vector. Apply a shared linear projection `W_E` of shape `(3 P^2, D)` to map each patch into the model's hidden dimension `D`.

For the ViT-B/16 canonical config:
- Resolution 224, patch size 16 → grid 14x14 → 196 patch tokens.
- Each patch is `16 x 16 x 3 = 768` pixel values, projected to `D = 768`.
- Add a learnable `[CLS]` token → sequence length 197.

The patch projection is mathematically identical to a 2D convolution with kernel size `P`, stride `P`, and `D` output channels. That is how production code actually implements it — `nn.Conv2d(3, D, kernel_size=P, stride=P)`. The "linear projection" framing is conceptual; the kernel framing is efficient.

### Positional embeddings

Patches have no inherent order — the transformer sees them as a bag. Early ViTs added a learnable 1D positional embedding (one 768-dim vector per position, 197 of them). Works, but ties the model to the training resolution: at inference you have to interpolate the position table if you change the grid.

Modern vision backbones use 2D-RoPE (Qwen2-VL's M-RoPE, SigLIP 2's default) or factorized 2D positions. 2D-RoPE rotates the query and key vectors based on the patch's (row, column) index, so the model infers relative 2D position from the rotation angle. No position table. The model handles arbitrary grid sizes at inference.

### CLS token, pooled output, and register tokens

What is the image-level representation? Three choices coexist:

1. `[CLS]` token. Prepend a learnable vector to the patch sequence. After all transformer blocks, the CLS token's hidden state is the image representation. Inherited from BERT. Used by original ViT, CLIP.
2. Mean pool. Average the patch tokens' output hidden states. Used by SigLIP, DINOv2, most modern VLMs.
3. Register tokens. Darcet et al. (2023) observed that ViTs trained without an explicit sink token develop high-norm "artifact" patches that hijack self-attention. Adding 4–16 learnable register tokens absorbs this load and improves dense-prediction quality (segmentation, depth). DINOv2 and SigLIP 2 both ship with registers.

The choice matters for downstream tasks. CLS is fine for classification. For VLMs that feed patch tokens into an LLM, you skip pooling entirely — every patch becomes an LLM input token. Registers get discarded before handoff (they are scaffolding, not content).

### Pretraining: supervised, contrastive, masked, self-distilled

The 2020 ViT was pretrained with supervised classification on JFT-300M. Quickly supplanted by:

- CLIP (2021): contrastive image-text on 400M pairs. Lesson 12.02.
- MAE (2021, He et al.): mask 75% of patches, reconstruct pixels. Self-supervised, works on pure images.
- DINO (2021) / DINOv2 (2023): self-distillation with student-teacher, no labels, no captions. The 2023 DINOv2 ViT-g/14 is the strongest purely-visual backbone and the default for "dense features" use cases.
- SigLIP / SigLIP 2 (2023, 2025): CLIP with a sigmoid loss and NaFlex for native aspect ratio. The dominant vision tower in 2026 open VLMs (Qwen, Idefics2, LLaVA-OneVision).

Your choice of pretraining determines what the backbone is good for: CLIP/SigLIP for semantic matching with text, DINOv2 for dense visual features, MAE as a starting point for downstream finetuning.

### Scaling laws

ViT scaling (Zhai et al. 2022) established that a ViT's quality obeys predictable laws in model size, data size, and compute. At fixed compute:
- Bigger model + more data → better quality.
- Patch size is a lever on sequence length vs fidelity. Patch 14 (typical for DINOv2/SigLIP SO400m) gives more tokens per image than patch 16; better for OCR and dense tasks, worse for speed.
- Resolution is the other big lever. Going from 224 to 384 to 512 almost always helps, at quadratic cost in FLOPs.

ViT-g/14 (1B params, patch 14, resolution 224 → 256 tokens) and SigLIP SO400m/14 (400M params, patch 14) are the two workhorse encoders for 2026 open VLMs.

### Parameter count for a ViT

The full calculation lives in `code/main.py`. For ViT-B/16 at 224:

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

Ball-park every ViT this way before you load the checkpoint. The backbone size sets your VRAM floor in any downstream VLM.

### 2026 production config

The encoder most open VLMs ship with in 2026 is SigLIP 2 SO400m/14 at native resolution (NaFlex). It has:
- 400M parameters.
- Patch size 14, default resolution 384 → 729 patch tokens per image.
- Mean pool for image-level tasks; all 729 patches flow into the LLM for VQA.
- 4 register tokens, discarded before LLM handoff.
- 2D-RoPE with image-level scaling for native aspect ratio.

Every decision in that config traces back to a paper you can read.

## Use It

`code/main.py` is a patch tokenizer and geometry calculator. It takes (image H, W, patch P, hidden D, depth L) and reports:

- Grid shape and sequence length after patching.
- Token sequence for a synthetic 8x8 pixel toy image (walk through the flatten + project path).
- Parameter count broken down by patch embed, position embed, transformer blocks, and head.
- FLOPs per forward pass at the target resolution.
- A comparison table across ViT-B/16 @ 224, ViT-L/14 @ 336, DINOv2 ViT-g/14 @ 224, SigLIP SO400m/14 @ 384.

Run it. Match the parameter counts to the published numbers. Play with patch size and resolution to feel the token-count cost.

## Ship It

This lesson produces `outputs/skill-patch-geometry-reader.md`. Given a ViT config (patch size, resolution, hidden dim, depth), it produces a token-count, parameter-count, and VRAM estimate with justifications. Use this skill whenever you pick a vision backbone for a VLM — it prevents "the tokens exploded and my LLM context filled up" surprises.

## Exercises

1. Compute the patch-token sequence length for Qwen2.5-VL at native 1280x720 input with patch size 14. How does that compare to a CLS-only representation?

2. A 1080p frame (1920x1080) at patch 14 produces how many tokens? At 30 FPS over a 5-minute video, how many total visual tokens? Which cost saves you most: pooling, frame sampling, or token merging?

3. Implement mean pooling over patch tokens in pure Python. Verify that mean-pool over 196 tokens of a DINOv2 output matches what the model's `forward` returns when you ask for a pooled embedding.

4. Read Section 3 of "Vision Transformers Need Registers" (arXiv:2309.16588). Describe in two sentences what artifact the registers absorb and why it matters for downstream dense prediction.

5. Modify `code/main.py` to support patch-n'-pack: given a list of images of different resolutions, produce a single packed sequence and the block-diagonal attention mask. Verify against Lesson 12.06 when you reach it.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Patch | "16x16 pixel square" | A fixed-size non-overlapping region of the input image; becomes one token |
| Patch embedding | "Linear projection" | A shared learned matrix (or Conv2d with stride=P) mapping flattened patch pixels to D-dim vectors |
| CLS token | "Class token" | Prepended learnable vector whose final hidden state represents the whole image; optional in 2026 |
| Register token | "Sink token" | Extra learnable tokens that absorb the high-norm attention artifacts ViTs develop during pretraining |
| Position embedding | "Positional info" | Per-position vector or rotation making the sequence-order-aware; 2D-RoPE is the modern default |
| Grid | "Patch grid" | The (H/P) x (W/P) 2D array of patches for a given resolution and patch size |
| NaFlex | "Native flexible resolution" | SigLIP 2 feature: single model serves multiple aspect ratios and resolutions without retraining |
| Backbone | "Vision tower" | The pretrained image encoder whose patch-token outputs feed the LLM in a VLM |
| Pooling | "Image-level summary" | Strategy to turn patch tokens into one vector: CLS, mean, attention pool, or register-based |
| Patch 14 vs 16 | "Finer vs coarser grid" | Patch 14 produces more tokens per image, better fidelity for OCR, slower; patch 16 is the classic default |

## Further Reading

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) — original ViT.
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) — MAE, self-supervised pretraining.
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) — self-distillation at scale, no labels.
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) — register tokens and artifact analysis.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — the 2026 default vision tower.
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) — empirical scaling laws.
