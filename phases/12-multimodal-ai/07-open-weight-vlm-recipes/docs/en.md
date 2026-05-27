# Open-Weight VLM Recipes: What Actually Matters

> The 2024-2026 open-weight VLM literature is a forest of ablation tables. Apple's MM1 tested 13 combinations of image encoder, connector, and data mix. Allen AI's Molmo proved detailed human captions beat GPT-4V distillation. Cambrian-1 ran 20+ encoder comparisons. Idefics2 formalized the five-axis design space. Prismatic VLMs compared 27 training recipes on a controlled benchmark. Out of all that noise, a small set of results holds across papers: image encoder matters more than connector architecture, data mixture matters more than either, and detailed human captions beat distilled synthetic data. This lesson reads those tables so you do not have to.

**Type:** Learn + lab
**Languages:** Python (stdlib, ablation table parser + recipe picker)
**Prerequisites:** Phase 12 · 05 (LLaVA baseline)
**Time:** ~180 minutes

## Learning Objectives

- Name the five-axis VLM design space: image encoder, connector, LLM, data mix, resolution schedule.
- Read an MM1 / Idefics2 / Cambrian-1 ablation table and predict which knob moves a given benchmark.
- Pick a recipe (encoder, connector, data, resolution) for a new VLM given a compute budget and task mix.
- Explain why detailed human captions beat GPT-4V distillation at the same token count.

## The Problem

Hundreds of open-weight VLMs exist. Most of the gap between "good" and "state-of-the-art" is not architecture. It is data, resolution schedule, and encoder choice. Knowing which knob to turn first when your model underperforms saves you a 5-million-GPU-hour mistake.

The 2023 wave (LLaVA-1.5, InstructBLIP, MiniGPT-4) ran on caption-pair pretraining + LLaVA-Instruct-150k. Good baseline. Topped out around MMMU 35%.

The 2024 wave (MM1, Idefics2, Molmo, Cambrian-1, Prismatic VLMs) ran exhaustive ablations. Results were surprising and practical.

## The Concept

### The five-axis design space

Idefics2 (Laurençon et al., 2024) named the axes:

1. Image encoder. CLIP ViT-L/14, SigLIP SO400m/14, DINOv2 ViT-g/14, InternViT-6B. Encoders differ in patch size, resolution, and pretraining objective.
2. Connector. MLP (2-4 layers), Q-Former (32 queries + cross-attn), Perceiver Resampler (64 queries), C-Abstractor (convolutional + bilinear pooling).
3. Language model. Llama-3 8B / 70B, Mistral 7B, Phi-3, Gemma-2, Qwen2.5. LLM size is the dominant param cost.
4. Training data. Caption pairs (CC3M, LAION), interleaved (OBELICS, MMC4), instruction (LLaVA-Instruct, ShareGPT4V, PixMo, Cauldron).
5. Resolution schedule. Fixed 224/336/448, AnyRes, native dynamic. Ramped during training or constant.

Every production VLM makes a choice on each axis. Most of the variance in MMMU scores is explained by axes 1, 4, and 5 — not by which connector you picked.

### Axis 1: encoder > connector

MM1 Section 3.2 showed: swapping from CLIP ViT-L/14 to SigLIP SO400m/14 added 3+ points MMMU. Swapping the connector from MLP to Perceiver Resampler added less than 1 point. Idefics2 replicated: SigLIP > CLIP, Q-Former ≈ MLP ≈ Perceiver at the same token count.

Cambrian-1's "Cambrian Vision Encoders Match-Up" (Tong et al., 2024) ran 20+ encoders on a vision-centric benchmark (CV-Bench). The top of the leaderboard is a mix of DINOv2 and SigLIP; CLIP is middle of the pack; ImageBind and ViT-MAE are lower. The gap from CLIP ViT-L to DINOv2 ViT-g/14 is ~5-7 points on CV-Bench.

The 2026 default encoder for open VLMs is SigLIP 2 SO400m/14 for semantic + dense features, sometimes concatenated with DINOv2 ViT-g/14 features (Cambrian's "Spatial Vision Aggregator" does this).

### Axis 2: connector design is a wash

MM1, Idefics2, Prismatic, and MM-Interleaved all reached the same conclusion: at a fixed visual-token count, connector architecture barely matters. A 2-layer MLP on mean-pooled patches performs within 1 point of a 32-query Q-Former at the same token budget.

What does matter is the token count. More visual tokens = more LLM compute = better performance up to a point, then diminishing returns. 64 tokens per image is too few for OCR. 576-1024 tokens is the sweet spot for most open VLMs. 2048+ helps only for documents and charts.

Q-Former vs MLP is a cost question, not a quality question: Q-Former caps tokens at 32-64 regardless of image resolution; MLP emits all patch tokens. For high-res inputs, Q-Former saves LLM context; for low-res, the difference is noise.

### Axis 3: LLM size sets the ceiling

Doubling the LLM from 7B to 13B reliably adds 2-4 points on MMMU across every VLM paper. At 70B you saturate most benchmarks. The VLM's multimodal reasoning ceiling is the LLM's text reasoning ceiling — the visual encoder can only feed it, not reason for it.

This is why Qwen2.5-VL-72B and Claude Opus 4.7 crush MMMU-Pro and ScreenSpot-Pro: the language brain is huge. A 7B VLM cannot substitute for a 70B VLM through clever connector design.

### Axis 4: data — detailed human captions beat distillation

Molmo + PixMo (Deitke et al., 2024) is the 2024 result everyone should read. Allen AI had human annotators describe images in 1-3 minute dense speech-to-text passes, yielding 712K densely-captioned images. No GPT-4V distillation anywhere in the training data.

Molmo-72B beat Llama-3.2-90B-Vision on 11 of 11 benchmarks. The delta is not architecture — it is caption quality. Detailed human captions contain 5-10x more information per image than short web captions and stay factually grounded where GPT-4V distillation hallucinates.

ShareGPT4V (Chen et al., 2023) and Cauldron (Idefics2) followed the same playbook with mixed human + GPT-4V captions. The trend is clear: for the 2026 frontier, caption density > caption quantity > distillation convenience.

### Axis 5: resolution and its schedule

Idefics2's ablations: 384 -> 448 adds 1-2 points. 448 -> 980 with image splitting (AnyRes) adds another 3-5 on OCR benchmarks. Flat resolution training plateaus at medium accuracy; resolution ramping (start 224, finish 448 or native) trains faster and ends higher.

Cambrian-1 ran a resolution vs tokens trade-off: at fixed compute, you can have more tokens at lower resolution or fewer tokens at higher resolution. Higher resolution wins for OCR; lower-res-more-tokens wins for general scene understanding.

The 2026 production recipe: train Stage 1 at 384 fixed, Stage 2 with dynamic resolution up to 1280 for OCR-heavy tasks.

### The Prismatic controlled comparison

Prismatic VLMs (Karamcheti et al., 2024) is the paper that controlled all the axes. Same 13B LLM, same instruction data, same evaluation — only one axis varies at a time. Results:

- Per-image visual-token count explains ~60% of variance.
- Encoder choice explains ~20%.
- Connector architecture explains ~5%.
- Everything else (data mix, scheduler, LR) the remaining ~15%.

This is a rough decomposition, but it is the cleanest answer to "what should I ablate first" in the literature.

### A picker for 2026

Given the evidence, the default open-VLM recipe for a new project in 2026:

- Encoder: SigLIP 2 SO400m/14 at native resolution with NaFlex, concatenated with DINOv2 ViT-g/14 for dense features if you need segmentation/grounding.
- Connector: 2-layer MLP on patch tokens. Skip Q-Former unless you are token-constrained.
- LLM: Qwen2.5 / Llama-3.1 / Gemma 2, 7B for cost, 70B for quality, picked by target latency.
- Data: PixMo + ShareGPT4V + Cauldron, topped up with task-specific instruction data.
- Resolution: dynamic (min 256, max 1280 pixels per long side).
- Schedule: Stage 1 alignment (projector-only), Stage 2 full fine-tune, Stage 3 task-specific fine-tune.

Every one of those defaults traces back to a measured ablation in the papers cited at the end of this lesson.

## Use It

`code/main.py` is an ablation table parser and recipe picker. It encodes the MM1 and Idefics2 ablation tables (condensed) and lets you query:

- "Given budget X and task Y, what recipe wins?"
- "If I swap SigLIP for CLIP on a 7B Llama, what is the expected MMMU delta?"
- "Which axis should I ablate first for an 80% confidence answer?"

The output is a ranked recipe list with expected benchmark deltas and an "ablate first" recommendation.

## Ship It

This lesson produces `outputs/skill-vlm-recipe-picker.md`. Given a target task mix, a compute budget, and a latency target, it emits a full recipe (encoder, connector, LLM, data mix, resolution schedule) with citations to the ablation that justifies each choice. Stops engineers from reinventing the Idefics2 ablation table every time a new VLM project starts.

## Exercises

1. Read MM1 Section 3.2. For a fixed 2B LLM at budget 50M images, which encoder wins? Would the answer flip at 13B LLM? Why?

2. Cambrian-1 finds that concatenating DINOv2 + SigLIP outperforms either alone on vision-centric benchmarks but adds no signal on MMMU. Predict which benchmarks gain and which stay flat.

3. Your target is a mobile UI agent on a 2B LLM. Pick encoder, connector, resolution, and data mix. Justify each choice with a specific ablation table.

4. Molmo ships 4B and 72B models. The 4B is competitive with closed 7B VLMs; the 72B beats Llama-3.2-90B-Vision on 11/11 benchmarks. What does that tell you about the LLM-size plateau hypothesis?

5. Design an ablation table to isolate data-mix quality from encoder quality on a 7B VLM. How many training runs minimum? Propose the four axis settings.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Ablation | "Turning one knob" | Training multiple runs that differ in exactly one design-space axis, holding everything else constant |
| Connector | "Bridge" / "projector" | Trainable module that maps vision encoder output into the LLM's token space (MLP, Q-Former, Perceiver) |
| Detailed human caption | "Dense caption" | A multi-sentence human-written description (typically 80-300 tokens) richer than a web alt text |
| Distillation | "GPT-4V captions" | Training data generated by a stronger proprietary VLM; convenient but prone to inherited hallucination |
| AnyRes / dynamic res | "High-res path" | Strategy to feed images larger than the encoder's native resolution via tiling or M-RoPE |
| Resolution ramp | "Curriculum" | Training schedule that starts low-resolution and increases, speeding alignment learning |
| Vision-centric bench | "CV-Bench / BLINK" | Evaluation that stresses fine-grained visual perception rather than language-heavy reasoning |
| PixMo | "Molmo's data" | Allen AI's 712K densely-captioned image dataset; human speech transcribed into dense captions |

## Further Reading

- [McKinzie et al. — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon et al. — Idefics2 / What matters building VLMs (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke et al. — Molmo and PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong et al. — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)
