# InternVL3: Native Multimodal Pretraining

> Every open VLM before InternVL3 followed the same three-step recipe: take a text LLM trained on trillions of text tokens, bolt on a vision encoder, then fine-tune the seams. This works but has alignment debt — the text LLM has spent its full pretraining budget on pure text and does not natively understand visual tokens. When you add vision post-hoc, the LLM has to re-learn how to relate visual input to its text reasoning without forgetting the text. InternVL3 (Zhu et al., April 2025) rejects the post-hoc approach: one pretraining run, text and multimodal interleaved from step one. The result matches Gemini 2.5 Pro on MMMU-Pro at 78B params open. This lesson reads the case for native pretraining and what changes when you make it.

**Type:** Learn
**Languages:** Python (stdlib, training-corpus mixer)
**Prerequisites:** Phase 12 · 05, Phase 12 · 07 (recipes)
**Time:** ~120 minutes

## Learning Objectives

- Explain why post-hoc VLM training accumulates alignment debt, citing the three measurable symptoms (catastrophic forgetting, answer drift, visual-text inconsistency).
- Describe InternVL3's native pretraining corpus mix and why the ratio of text : interleaved : caption matters.
- Compare V2PE (variable visual position encoding) to Qwen2-VL's M-RoPE.
- Name the Visual Resolution Router (ViR) and Decoupled Vision-Language (DvD) deployment optimizations.

## The Problem

Post-hoc VLM training is the default. LLaVA, BLIP-2, Qwen-VL, Idefics — all take an already-pretrained LLM (Llama, Vicuna, Qwen, Mistral) and add vision. The training stages typically look like:

1. Frozen LLM + frozen vision encoder + trainable projector, trained on caption pairs to align embeddings.
2. Unfreeze LLM, train on instruction data (LLaVA-Instruct, ShareGPT4V).
3. Optional task-specific fine-tune.

Three symptoms of alignment debt show up:

- Catastrophic forgetting. The post-hoc VLM forgets text-only skills. GSM8K scores drop 5-10 points. Hellaswag scores drop. Pure-text agents regress.
- Answer drift. Small phrasings of the same visual question get different answers. The vision encoder connects to the LLM with weaker bindings than the LLM's own tokens.
- Visual-text inconsistency. The VLM can describe an image correctly and then answer a question contradicting its own description. Visual tokens do not participate in the LLM's internal consistency checks the same way text does.

These symptoms are well-documented. MM1.5 Section 4 quantifies them. LLaVA-OneVision's ablations hint at them. Native pretraining is the answer.

## The Concept

### Native multimodal pretraining

InternVL3 trains from scratch on a corpus that is native multimodal from step one. The mix is:

- 40% text-only data (FineWeb, Proof-Pile-2, etc.)
- 35% interleaved image-text data (OBELICS, MMC4-style)
- 20% paired image-caption data
- 5% video-text data

Vision tokens, text tokens, and cross-modal interactions all participate in the same loss from the first gradient step. No alignment pretraining, no projector freezing stage, no catastrophic forgetting to recover from.

Training is a single stage for the base model. Instruction tuning follows, but the base model already understands visual tokens as first-class citizens.

### V2PE (variable visual position encoding)

Qwen2-VL uses M-RoPE with fixed axis allocation. InternVL3 introduces V2PE: the position encoding varies per modality type (text, image, video) with learnable scaling. In practice:

- Text tokens get 1D position (text index).
- Image patches get 2D position (row, col).
- Video frames get 3D position (time, row, col).

The three share the same RoPE frequency base, but the hidden-dim allocation per band is a learned parameter rather than a fixed split. Freedom to trade off temporal vs spatial frequency resolution during pretraining.

V2PE's ablation claim: 1-2 points on video benchmarks over M-RoPE at the same compute. Not a revolution, but cleaner.

### Visual Resolution Router (ViR)

Deployment optimization. Not all images need full-resolution encoding. A photo with one object at low detail wastes tokens when encoded at 1280px native. ViR is a small classifier that predicts the minimum resolution needed to answer the question, before encoding.

The routing has three tiers: low-res (256 tokens), medium (576), high (2048+). For 60% of queries in production traffic, low or medium is sufficient. Net effect: 2-3x throughput at equal quality.

### Decoupled Vision-Language deployment (DvD)

When you serve a large VLM, the vision encoder runs once per image but the LLM runs autoregressively for every output token. The two components have different bottlenecks (vision = GPU memory bandwidth for conv + attention; LLM = KV cache). DvD splits them onto separate GPUs with streaming between.

For an 8B + 400M encoder model, DvD roughly doubles per-node throughput vs co-located.

### Single-stage vs multi-stage quality

InternVL3's primary benchmark claim: at 78B params, match Gemini 2.5 Pro's MMMU-Pro. At 38B, match GPT-4o. At 8B, lead the open-8B leaderboard. All on a single-stage pretrain + instruction-tune recipe.

The alignment-debt hypothesis is measurable: InternVL3-8B loses fewer text-benchmark points (MMLU, GSM8K) than Qwen2.5-VL-7B per unit of vision-benchmark gain. The model is more of a generalist because training was one piece, not two.

### InternVL3.5 and InternVL-U

InternVL3.5 (August 2025) scales the recipe. Same native-pretrain approach, more data, more params. MMMU improvements are incremental.

InternVL-U (2026) adds unified generation — image output via MMDiT heads on top of the same backbone. The "U" stands for "Understanding + generation," chasing Transfusion-style unified models (Lesson 12.13). The same native-pretrain backbone supports both understanding and generation heads.

### Trade-offs of native pretraining

Native pretraining is not free:

- Compute. Training a new VLM from scratch costs the same as training a text LLM — millions of GPU-hours. Post-hoc adaptation reuses existing LLM weights, saves most of the cost.
- Data. Interleaved image-text corpora at scale are rare. OBELICS is 141M documents; MMC4 is 571M. Text alone ships at 15T tokens. Multimodal pretraining data scarcity is a hard constraint.
- Base-LLM reuse. Native pretraining gives up the option to drop in a new LLM later. Post-hoc lets you swap Llama-3.1 for Llama-4 by retraining only the adapter.

The bet InternVL3 makes: the alignment debt is worse than the reuse loss. The benchmarks back the claim. The cost-to-produce bars future labs from cheaply replicating. Post-hoc VLMs will keep existing because they remain cheaper for most projects.

## Use It

`code/main.py` is a training-corpus mixer and ViR router simulator. It:

- Takes a target corpus mix (%text, %interleaved, %caption, %video) and computes expected steps per modality.
- Simulates ViR routing on a batch of queries (distribution: 50% low-detail, 30% medium, 20% high-detail) and reports average token count.
- Reports DvD throughput estimates given encoder vs LLM FLOPs.
- Prints a side-by-side of post-hoc vs native pretraining in params, compute, data, and expected alignment-debt symptoms.

## Ship It

This lesson produces `outputs/skill-native-vs-posthoc-auditor.md`. Given a proposed VLM training plan, it audits whether to go native or post-hoc, flags alignment-debt risk, and recommends a corpus mix. Use it when you are sizing a new open-VLM project and need to pick the training strategy.

## Exercises

1. Estimate the compute delta between InternVL3-8B (native pretrain) and LLaVA-OneVision-7B (post-hoc). Ratio of GPU-hours approximately? What explains the gap?

2. InternVL3 reports 40% text / 35% interleaved / 20% caption / 5% video. If your target task is video-heavy, propose a new ratio and argue why the base model still needs substantial text and caption data.

3. Read MM1.5 Section 4 on forgetting. Name the exact benchmark where post-hoc training showed the largest regression. How much did the regression cost?

4. ViR routes 60% of traffic to low-resolution encoding. What kinds of queries does it misroute (sends to low-res when high-res was needed)? Propose three router-failure modes.

5. DvD splits vision and LLM onto separate GPUs. Under what traffic pattern does DvD hurt throughput instead of helping?

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Native multimodal pretraining | "From scratch together" | Text + image + video tokens participate in the loss from step 1, not bolted on later |
| Alignment debt | "Post-hoc penalty" | Measurable regression in text skills and answer consistency that comes from bolting vision onto a frozen LLM |
| V2PE | "Variable visual pos encoding" | Per-modality learnable position encoding allocation; InternVL3's M-RoPE successor |
| ViR | "Resolution router" | Small classifier that picks minimum resolution needed per query before encoding, saving inference tokens |
| DvD | "Decoupled deployment" | Vision encoder on one GPU, LLM on another, with stream handoff; doubles throughput for large VLMs |
| InternVL-U | "Unified understanding + generation" | 2026 follow-up that adds image-generation heads to the native-pretrain backbone |
| Interleaved corpus | "OBELICS / MMC4" | Documents with text and images in natural reading order; the raw material for native pretraining |

## Further Reading

- [Chen et al. — InternVL 1 (arXiv:2312.14238)](https://arxiv.org/abs/2312.14238)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
- [InternVL3.5 (arXiv:2508.18265)](https://arxiv.org/abs/2508.18265)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Zhang et al. — MM1.5 (arXiv:2409.20566)](https://arxiv.org/abs/2409.20566)
