# From CLIP to BLIP-2 — Q-Former as Modality Bridge

> CLIP aligns image and text but cannot generate captions, answer questions, or hold a conversation. BLIP-2 (Salesforce, 2023) solved that with a small trainable bridge: 32 learnable query vectors attend over a frozen ViT's features via cross-attention, then slot directly into a frozen LLM's input stream. 188M parameters of bridge connected an 11B LLM to a ViT-g/14. Every adapter-based VLM through 2026 — MiniGPT-4, InstructBLIP, LLaVA's cousins — is a descendant. This lesson reads the Q-Former's architecture, explains its two-stage training, and builds a toy version that feeds visual tokens into a frozen text decoder.

**Type:** Build
**Languages:** Python (stdlib, cross-attention + learnable-query demo)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 7 (Transformers)
**Time:** ~180 minutes

## Learning Objectives

- Explain why a trainable bottleneck between a frozen vision encoder and frozen LLM beats end-to-end finetuning in cost and stability.
- Implement a cross-attention block where a fixed set of learnable queries attend to external image features.
- Walk through BLIP-2's two-stage pretraining: representation (ITC + ITM + ITG) then generative (LM loss with frozen decoder).
- Compare Q-Former to the simpler MLP projector used in LLaVA and argue when each choice wins.

## The Problem

You have a frozen ViT that produces 256 patch tokens of dim 1408 per image. You have a frozen 7B LLM that expects token embeddings of dim 4096. The obvious bridge — a linear layer from 1408 to 4096 — works, but feeding all 256 patch tokens into the LLM's context costs 256 extra tokens per image. Over a batch of 32 images that is 8192 tokens consumed by the visual modality alone.

The BLIP-2 question: can you compress the 256-token image representation into far fewer tokens (say 32) while preserving enough information for the LLM to caption, answer questions, and reason about the image? And can you train this bridge without touching the frozen backbones, keeping the training cost at just the bridge's parameters?

The answer: a Q-Former. 32 learnable "query" vectors that cross-attend to the ViT's patch tokens, producing a 32-token visual summary that the LLM consumes. 188M parameters total. Trained with contrastive, matching, and generative objectives before ever touching the LLM.

## The Concept

### Learnable queries

The Q-Former's core trick: instead of letting the LLM's text tokens attend to image patches, introduce a new set of 32 learnable query vectors `Q` and let *them* attend to image patches. The queries are parameters of the model — they are learned during training and the same 32 queries are used for every image.

After cross-attention, each query holds a compressed summary of the image — "describe the main object", "describe the background", "count the objects", etc. The queries do not literally specialize on semantic labels; they learn whatever encoding makes downstream losses drop.

### Architecture

The Q-Former is a small transformer (12 layers, ~100M params) with two paths:

1. Query path: 32 query vectors flow through self-attention (among themselves), then cross-attention over the frozen ViT's patch tokens, then FFN.
2. Text path: a BERT-like text encoder shares the self-attention and FFN weights with the query path. Cross-attention is disabled for the text path.

At training time both paths run. The queries and text interact through shared self-attention, which means the queries can condition on text for tasks that need it (ITM, ITG). At inference time for VLM handoff, only the queries flow through, yielding 32 visual tokens.

### Two-stage training

BLIP-2 pretrains in two stages:

Stage 1: representation learning (no LLM). Three losses:
- ITC (image-text contrastive): CLIP-style contrastive between pooled query tokens and text CLS token.
- ITM (image-text matching): binary classifier — is this image-text pair a match? Hard-negative-mined.
- ITG (image-grounded text generation): causal LM head on text, conditioned on the queries. Forces queries to encode text-generatable content.

Only the Q-Former trains. The ViT is frozen. No LLM involved.

Stage 2: generative learning. Attach a frozen LLM (OPT-2.7B or Flan-T5-XL, etc.). Project the 32 query outputs to the LLM's embedding dim via a small linear layer. Prepend them to the text prompt. Train only the linear projection and the Q-Former on LM loss over the concatenated prompt + image + caption sequence.

After stage 2, the Q-Former + projection is the full visual adapter. At inference: image → ViT → Q-Former → linear proj → prepended to text → frozen LLM emits output.

### Parameter economics

BLIP-2 with ViT-g/14 (1.1B, frozen) + OPT-6.7B (6.7B, frozen) + Q-Former (188M, trained) = 8B total, 188M trained. The Q-Former alone is ~2.4% of the full stack's parameters. Training cost reflects this: days on a handful of A100s vs weeks for end-to-end.

Quality: BLIP-2 matches or beats Flamingo-80B on zero-shot VQA while being 50x smaller. The bridge works.

### InstructBLIP and the instruction-aware Q-Former

InstructBLIP (2023) extends the Q-Former with an extra input: the instruction text itself. At cross-attention time, the queries now have access to both the image patches and the instruction. The queries can specialize per-instruction ("count the cars", "describe the mood") rather than learning a single fixed summary. Benchmark gains on held-out tasks.

### MiniGPT-4 and the projector-only approach

MiniGPT-4 kept the Q-Former but trained only the output linear projection while freezing everything else. Cheap, but cost is quality — the queries were BLIP-2's, not yours. Good for rapid iteration, not the best architecture.

### Why LLaVA went simpler

LLaVA (2023, Lesson 12.05) replaced the Q-Former with a plain 2-layer MLP that projects every ViT patch token into LLM space — 576 tokens per image for a 24x24 grid, all fed to the LLM. Worse compression but lets the LLM attend over raw patches. At the time this was controversial; by late 2023 it was dominant because visual instruction data (LLaVA-Instruct-150k) proved that the MLP could be trained to preserve enough signal. The tradeoff: LLaVA's context fills faster, but it scales naturally to multi-image and video.

By 2026 the field split: Q-Former survives where token budget matters (long video, many images); MLP projector dominates where raw quality per token is the priority.

### Gated cross-attention: Flamingo, the ancestor

Flamingo (Lesson 12.04) predated BLIP-2 and used the same cross-attention idea but at every frozen LLM layer, not as a single bridge. BLIP-2 showed you can compress to the input layer only and still work. Gemini and Idefics combine both: interleaved input tokens plus optional gated cross-attention for in-context few-shot.

### The 2026 descendants

- Q-Former: BLIP-2, InstructBLIP, MiniGPT-4, and most video-language models for token budget reasons.
- Perceiver resampler: Flamingo's variant (Lesson 12.04); Idefics family, Eagle, OmniMAE.
- MLP projector: LLaVA, LLaVA-NeXT, LLaVA-OneVision, Cambrian-1.
- Attention pool: VILA, PaliGemma.

All four are valid. The deciding question is whether you are constrained on token budget or on quality-per-token.

## Use It

`code/main.py` builds a stdlib Q-Former-style cross-attention:

1. Simulate 256 image patch tokens (dim 128).
2. Instantiate 32 learnable queries (dim 128).
3. Run scaled-dot-product cross-attention (Q from queries, K/V from patches).
4. Project to LLM-dim (512) via a linear layer.
5. Output the 32 LLM-ready visual tokens.

All math in pure Python (nested loops over vectors). Toy but correct shape. The attention-weight matrix is printed so you can see which patches each query pulled from.

## Ship It

This lesson produces `outputs/skill-modality-bridge-picker.md`. Given a target VLM configuration (vision encoder token count, LLM context budget, deployment constraints, quality target), it recommends Q-Former vs MLP vs Perceiver resampler with a short justification and a parameter-count estimate for each bridge.

## Exercises

1. Implement the cross-attention block in PyTorch. Verify that with 32 queries and 256 keys/values, the attention-weight matrix is 32 x 256 and each row sums to 1 after softmax.

2. In BLIP-2 stage 1 the Q-Former runs three losses simultaneously: ITC, ITM, ITG. Write the forward signature for each in pseudo-code. Which one requires the text encoder path to be active?

3. Compare parameter counts: Q-Former (12 layers, 768 hidden) vs a 2-layer MLP projector (1408 → 4096, two layers). At what LLM scale does the 188M Q-Former cost pay back in training efficiency?

4. Read Section 3.2 of the BLIP-2 paper (arXiv:2301.12597) on how the Q-Former is initialized. Explain why initializing from BERT-base (not random) accelerates convergence.

5. For a 10-minute video at 1 FPS sampled to 60 frames, compute the per-frame token cost at (Q-Former → 32 tokens/frame) vs (MLP projector → 576 tokens/frame). Which fits into a 128k-token LLM context window?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Q-Former | "Querying transformer" | Small transformer with 32 learnable query vectors that cross-attend to frozen ViT features |
| Learnable queries | "Soft prompt for vision" | A fixed set of parameters that serve as the query side of cross-attention; learned per model, shared across all inputs |
| Cross-attention | "Q from here, K/V from there" | Attention where query, key, and value come from different sources; how the queries pull from ViT patches |
| ITC | "Image-text contrastive" | CLIP-style loss applied to Q-Former pooled queries vs text CLS |
| ITM | "Image-text matching" | Binary classifier on hard-negative-mined pairs; forces the queries to discriminate fine-grained mismatches |
| ITG | "Image-grounded text generation" | Causal LM loss where text is generated conditioned on queries; forces queries to encode text-decodable content |
| Two-stage pretraining | "Representation then generative" | Stage 1 trains Q-Former alone (ITC/ITM/ITG); Stage 2 attaches frozen LLM and trains only the projection + Q-Former |
| Frozen backbone | "Do not finetune" | The vision encoder and LLM weights are fixed; only the bridge trains |
| Projection head | "Linear to LLM dim" | Final linear layer mapping Q-Former output to the LLM's embedding dimension |
| Perceiver resampler | "Flamingo's version" | Similar learnable-query cross-attention, used by Flamingo at every layer rather than as a single bridge |

## Further Reading

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597) — the core paper.
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086) — the predecessor with the ITC/ITM/ITG trio.
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651) — "align before fuse" — the conceptual ancestor of stage 1 training.
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500) — instruction-aware Q-Former.
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592) — projector-only approach.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) — general architecture for learnable-query cross-attention.
