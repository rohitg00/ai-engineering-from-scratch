# Chameleon and Early-Fusion Token-Only Multimodal Models

> Every VLM we have seen so far keeps images and text separate. Visual tokens come from a vision encoder, flow into a projector, then meet text inside the LLM. The vision and text vocabularies never overlap. Chameleon (Meta, May 2024) asked: what if they did? Train a VQ-VAE that turns an image into a sequence of discrete tokens from a shared vocabulary. Every multimodal document is now one sequence — text tokens and image tokens interleaved, a single autoregressive loss. Side effect: the model can generate mixed-modality outputs — alternating text and image tokens in a single inference call. This lesson reads the early-fusion thesis and builds a toy version end to end.

**Type:** Build
**Languages:** Python (stdlib, VQ-VAE tokenizer + interleaved decoder)
**Prerequisites:** Phase 12 · 05, Phase 8 (Generative AI)
**Time:** ~180 minutes

## Learning Objectives

- Explain why a shared vocabulary + single loss changes what the model can do.
- Describe how a VQ-VAE tokenizes an image into a discrete sequence compatible with a transformer's next-token objective.
- Name Chameleon's training-stability tricks: QK-Norm, dropout placement, LayerNorm ordering.
- Compare Chameleon vs BLIP-2's Q-Former approach and describe when each is the right choice.

## The Problem

Adapter-based VLMs (LLaVA, BLIP-2, Qwen-VL) treat text and image as two different things. A text token goes through `embed(text_token)`; an image goes through `visual_encoder(image) → projector → ... pseudo_tokens`. The model has two input paths that merge partway in.

Three consequences:

1. The LLM can only consume images, not emit them. Output is text only.
2. Mixed-modality documents (alternating paragraphs and images, as in an article) are awkward — you either parse the multimodal input outside the model or chain generations.
3. Distributional mismatch. Visual tokens and text tokens live in different regions of the hidden space, creating subtle alignment issues.

Chameleon rejects the premise: images are just sequences of discrete tokens from a shared vocabulary. Train the model on interleaved documents, one loss, one autoregressive decoder, and you unlock mixed-modality generation for free.

## The Concept

### VQ-VAE as image tokenizer

The tokenizer is a vector-quantized variational autoencoder. The architecture:

- Encoder: CNN + ViT that maps image to a spatial feature map, say 32x32 features of dim 256.
- Codebook: a learned vocabulary of K vectors (Chameleon uses 8192), also dim 256.
- Quantization: for each spatial feature, look up the nearest codebook entry by L2 distance. Replace the continuous feature with the integer index.
- Decoder: CNN that takes quantized features back to pixels.

Training: VAE reconstruction loss + commitment loss + codebook loss. The codebook indices form a discrete alphabet for images.

For Chameleon: one image becomes 32*32 = 1024 tokens drawn from a vocabulary of 8192. Concatenate with text tokens (from the LLM's BPE vocabulary, say 32000). Final vocabulary: 40192. The transformer sees one sequence, one loss.

### The shared vocabulary

Chameleon's vocabulary combines text tokens, image tokens, and modality separators. Each token has a single ID. The input embedding layer maps every ID to a D-dim hidden vector. The output projection maps hidden back to vocab logits. Softmax picks the next token, whatever modality.

Separators matter: `<image>` and `</image>` tags bracket the image-token sequence. At generation time, if the model emits `<image>`, downstream software knows the next 1024 tokens are VQ indices to send to the decoder for pixel rendering.

### Mixed-modality generation

Inference is next-token prediction in the shared vocabulary. Example prompt: "Draw a cat and describe it." Chameleon emits:

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

The model picks the order autonomously — it may produce image then text, text then image, or interleave. Same decoder, same loss.

Compare to adapter VLMs where generation is text-only. Chameleon reopens the question of model output modalities.

### Training stability — QK-Norm, dropout, LayerNorm ordering

Early-fusion training is unstable at scale. Chameleon's paper documents three tricks:

- QK-Norm. Apply LayerNorm to the query and key projections inside attention, before the dot product. Prevents logit magnitude explosion at depth. Used by multiple post-2024 large models.
- Dropout placement. Dropout after every residual-add, not just after attention and MLP. More regularization required when gradients from image tokens can dominate.
- LayerNorm ordering. Pre-LN on the residual branch (standard), plus an extra LN on the skip connection of the last block. Stabilizes final-layer gradient flow.

Without these tricks, 34B-param Chameleon training diverged at multiple checkpoints. With them, it converges. The training recipe is as much of the contribution as the architecture.

### The tokenizer's reconstruction ceiling

VQ-VAE is lossy. At 8192 codebook entries and 1024 tokens per 512x512 image, reconstruction PSNR caps around 26-28 dB. This is enough for recognizable image gen but visibly worse than continuous-space diffusion (Stable Diffusion 3 achieves 32+ dB).

The tokenizer is the bottleneck. Better tokenizers (MAGVIT-v2, IBQ, SBER-MoVQGAN) lift the ceiling. Emu3 (Lesson 12.12) achieves SDXL-quality generation via a better tokenizer alone.

### Chameleon vs BLIP-2 / LLaVA

Chameleon (early fusion, shared vocab):
- One loss, one decoder.
- Generates mixed-modality output.
- Tokenizer is the quality ceiling.
- Expensive: VQ-VAE decoder per generated image on inference path.

BLIP-2 / LLaVA (late fusion, separate towers):
- Vision in, text out only.
- Reuses pretrained LLM.
- No tokenizer bottleneck for understanding.
- Cheap: single forward pass.

Pick by task. If you need image generation, Chameleon family. If you only need understanding, adapter-VLM is simpler and reuses more pretrained compute.

### Fuyu and AnyGPT

Fuyu (Adept, 2023) is a related approach: skip the separate vision encoder entirely, feed raw image patches through the LLM's input projection as if they were tokens, no tokenizer. Simpler than Chameleon, loses the shared-vocab output generation.

AnyGPT (Zhan et al., 2024) extends Chameleon to four modalities: text, image, speech, music. Same VQ-VAE trick for each, shared transformer. Any-to-any generation. Covered more in Lesson 12.16.

## Use It

`code/main.py` builds a toy end-to-end early-fusion model:

- A tiny VQ-VAE-style quantizer that maps 8x8 patches to codebook indices (K=16).
- A shared vocabulary of (text ids 0..31) + (image ids 32..47) + (separators 48, 49).
- A toy autoregressive decoder (bigram table) trained on synthetic captions + image-token sequences.
- Sampling loop that emits alternating text + image tokens given a prompt.

The code intentionally keeps the transformer tiny (bigrams) so you can trace the signal flow end to end.

## Ship It

This lesson produces `outputs/skill-tokenizer-vs-adapter-picker.md`. Given a product spec (understand only vs understand + generate, required image quality, cost budget), it picks between Chameleon-family (early fusion) and LLaVA-family (late fusion) and justifies with quantitative rules of thumb.

## Exercises

1. Chameleon uses K=8192 codebook entries and 1024 tokens per 512x512 image. Estimate the compression ratio vs a 24-bit RGB image. Is it lossy? How lossy?

2. A 4K image (3840x2160) at the same VQ-VAE density produces how many image tokens? Can a Chameleon-style model generate a 4K image in one inference call? What breaks first — context, tokenizer quality, or KV cache?

3. Implement QK-Norm in pure Python. Given a 64-dim query and key, show the dot product before and after LayerNorm. Why is magnitude control important at depth?

4. Read Chameleon Section 2.3 on training stability. Describe the exact failure mode the paper observed at 34B without QK-Norm. What was the "norm explosion" signature?

5. Extend the toy decoder to emit a mixed-modality response given a text-only prompt. Measure how often the model picks image-first vs text-first given training-data distribution 60% text-first / 40% image-first.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Early fusion | "Unified tokens" | Images converted to discrete tokens sharing the transformer's vocabulary from step one |
| VQ-VAE | "Image tokenizer" | CNN + ViT + codebook that maps images to integer indices the transformer can predict |
| Shared vocabulary | "One dictionary" | A single token ID space covering text + image + modality separators |
| QK-Norm | "Attention stabilizer" | LayerNorm applied to query and key before their dot product, prevents norm blowup |
| Mixed-modality generation | "Text + image output" | Inference that autonomously produces interleaved text and image tokens in one pass |
| Codebook size | "K entries" | Number of discrete vectors the VQ-VAE can quantize to; trades compression for fidelity |
| Tokenizer ceiling | "Reconstruction limit" | Best PSNR achievable by decoding VQ tokens; bounds the model's image quality |

## Further Reading

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
