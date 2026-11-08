---
id: vlm-architectures
title: Vision-Language Model Architectures
code: VL
subtitle: ViT, bridge, LLM. Projector, Q-Former, Perceiver, gated cross-attention, training stages and recipe numbers.
hue: 265
sources: phases/04-computer-vision/25-vision-language-models, phases/12-multimodal-ai/03-blip2-qformer-bridge, phases/12-multimodal-ai/04-flamingo-gated-cross-attention, phases/12-multimodal-ai/05-llava-visual-instruction-tuning, phases/12-multimodal-ai/07-open-weight-vlm-recipes, phases/19-capstone-projects/60-projection-layer-modality-align, phases/19-capstone-projects/61-cross-attention-fusion
source_hash: b92752a01ece3c9a
---

## The ViT-MLP-LLM pattern
type: architecture
from: phases/04-computer-vision/25-vision-language-models/docs/en.md

```arch
node | img | 1,1 | Image | H x W x 3 | client
node | vit | 2,1 | Vision encoder | CLIP-L, SigLIP, DINOv3 | model
node | proj | 3,1 | Projector | 2-4 layer MLP or Q-former | process
node | txt | 1,2 | Text prompt | | client
node | tok | 2,2 | LLM tokenizer | text tokens (M, d_llm) | process
node | cat | 3,2 | Interleave or concat | image tokens in LLM space | process
node | llm | 4,2 | Decoder LLM | generates the text answer | model
edge | img | vit |
edge | vit | proj | (N, d_vit)
edge | proj | cat | (N, d_llm)
edge | txt | tok |
edge | tok | cat |
edge | cat | llm |
```

## Bridge mechanisms
type: concepts
from: phases/04-computer-vision/25-vision-language-models/docs/en.md, phases/12-multimodal-ai/03-blip2-qformer-bridge/docs/en.md, phases/12-multimodal-ai/04-flamingo-gated-cross-attention/docs/en.md, phases/19-capstone-projects/60-projection-layer-modality-align/docs/en.md, phases/19-capstone-projects/61-cross-attention-fusion/docs/en.md

- **MLP projector**: Linear, GELU, Linear. Maps `(N_patches, d_vit)` to `(N_patches, d_llm)`.
- **Q-Former**: 32 learnable queries cross-attend to frozen ViT patches. Output is 32 visual tokens.
- **Perceiver resampler**: K = 64 learnable latents. Any patch count exits as 64 tokens.
- **Gated cross-attention**: $y = \tanh(\alpha) \cdot \mathrm{cross} + x$. Alpha starts at 0.
- **Cross-attention**: Q comes from the text stream. K and V come from the image stream.
- **Cosine alignment loss**: $1 - \cos(\mathrm{image}, \mathrm{text})$. 0 is aligned, 2 is opposite.
- **DeepStack**: stacks features from several ViT depths, not the last layer only.
- **CMER**: share of outputs with high text confidence and low image-text similarity.

## Three training stages
type: flow
from: phases/04-computer-vision/25-vision-language-models/docs/en.md, phases/12-multimodal-ai/05-llava-visual-instruction-tuning/docs/en.md

1. **Alignment**: freeze ViT and LLM. Train only the projector on image-caption pairs.
2. **LLaVA stage 1**: 558k image-caption pairs, LM loss on the caption, a few hours.
3. **Pre-training**: unfreeze everything. Train on 500M+ interleaved image-text pairs.
4. **Instruction tuning**: fine-tune on (image, question, answer) triples.
5. **LLaVA stage 2**: projector and LLM train on 158k visual-instruction turns.

## Tasks in code
type: task-table
span: 2
from: phases/04-computer-vision/25-vision-language-models/docs/en.md, phases/04-computer-vision/25-vision-language-models/code/main.py, phases/12-multimodal-ai/04-flamingo-gated-cross-attention/code/main.py, phases/12-multimodal-ai/05-llava-visual-instruction-tuning/code/main.py, phases/19-capstone-projects/61-cross-attention-fusion/code/main.py

| Task | Code |
|---|---|
| Build a projector | `Projector(vit_dim=768, llm_dim=4096, hidden=4096)` |
| Stack ViT depths | `deepstack_features(per_layer_features)` |
| Measure CMER | `cross_modal_error_rate(image_emb, text_emb, text_confidence)` |
| Resample patches to fixed latents | `perceiver_resampler(patches, num_latents=8, num_blocks=2)` |
| Gated step, closed gate | `gated_cross_attention_step(text_hidden, visual, alpha=0.0)` |
| One image per text token | `interleaved_mask(seq)` |
| LLaVA prompt with 576 tokens | `build_llava_prompt(system, user, image_tokens=576)` |
| Self-attention mask | `causal_mask(length)` |

## Merge image tokens into the text
type: annotated-code
lang: python
from: phases/04-computer-vision/25-vision-language-models/docs/en.md

```python
vision_tokens = self.vit(image)                 # (B, N_patches, d_vit)
vision_embeds = self.projector(vision_tokens)   # (B, N_patches, d_llm)
text_embeds = self.llm.get_input_embeddings()(input_ids)  # (B, M, d_llm)
out = text_embeds.clone()                       # copy, then fill
for b in range(input_ids.size(0)):              # one sample at a time
    positions = (input_ids[b] == self.image_token_id).nonzero(as_tuple=True)[0]
    out[b, positions] = vision_embeds[b]        # <image> slots get vision
```

## Train only the projection
type: annotated-code
lang: python
from: phases/19-capstone-projects/60-projection-layer-modality-align/code/main.py

```python
cfg = AlignConfig()                    # 768 -> 1024 -> 512, 200 steps
encoder = VisionEncoder(encoder_cfg).eval()
freeze(encoder)                        # requires_grad_(False)
projector = MLPProjector(cfg.vision_hidden, cfg.projection_hidden, cfg.text_hidden)
with torch.no_grad():
    _, cls = encoder(img)              # CLS pool, no encoder grads
    text_emb = text(ids)               # frozen MockTextEmbedding
image_emb = projector(cls)
loss = cosine_alignment_loss(image_emb, text_emb)
```

## Bridge numbers
type: defaults
from: phases/12-multimodal-ai/03-blip2-qformer-bridge/docs/en.md, phases/12-multimodal-ai/04-flamingo-gated-cross-attention/docs/en.md, phases/12-multimodal-ai/05-llava-visual-instruction-tuning/docs/en.md, phases/12-multimodal-ai/07-open-weight-vlm-recipes/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Q-Former queries | 32 | 188M trained params in BLIP-2 |
| Perceiver latents K | 64 | After 6 resampler blocks |
| Gated block every M layers | 4 | Flamingo, alpha init 0 |
| LLaVA tokens per image | 576 | 24x24 grid, MLP `1024 → 4096 → 4096` |
| AnyRes tokens per image | 2880 | Tiles of 336x336 plus a thumbnail |
| Token sweet spot | 576-1024 | 64 is too few for OCR |
| Dynamic resolution | min 256, max 1280 | Pixels per long side |

## Troubleshooting
type: troubleshooting
from: phases/04-computer-vision/25-vision-language-models/docs/en.md, phases/12-multimodal-ai/04-flamingo-gated-cross-attention/docs/en.md, phases/12-multimodal-ai/07-open-weight-vlm-recipes/docs/en.md, phases/12-multimodal-ai/03-blip2-qformer-bridge/docs/en.md, phases/19-capstone-projects/61-cross-attention-fusion/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `ValueError` on image tokens | Placeholder count differs from patches | Pre-pad each sample to the same count |
| Confident wrong objects | 12% of crawled pairs are not grounded | Track CMER, route high CMER to review |
| Above, below, count wrong | VLMs score 50-60% on spatial tests | Use a pose, depth or detection model |
| Text skill drops after tuning | The gate got too wide too fast | Start alpha at 0, check the gate schedule |
| Weak OCR | Too few visual tokens | Use 576-1024 tokens or AnyRes |
| Context fills fast | 576 tokens per image, more per frame | Use a Q-Former at 32 tokens |

## Abbreviations
type: glossary
from: phases/04-computer-vision/25-vision-language-models/docs/en.md, phases/12-multimodal-ai/03-blip2-qformer-bridge/docs/en.md, phases/12-multimodal-ai/05-llava-visual-instruction-tuning/docs/en.md, phases/19-capstone-projects/61-cross-attention-fusion/docs/en.md

- **VLM**: Vision-Language Model. Image encoder plus a full language model.
- **ITC**: image-text contrastive. CLIP-style loss on pooled queries and text CLS.
- **ITM**: image-text matching. Binary classifier on hard negatives.
- **ITG**: image-grounded text generation. Causal LM loss on the queries.
- **CMER**: Cross-Modal Error Rate. The hallucination KPI.
- **AnyRes**: split a high-res image into tiles and concatenate their tokens.

## Questions
type: qa
from: phases/12-multimodal-ai/03-blip2-qformer-bridge/docs/en.md, phases/12-multimodal-ai/04-flamingo-gated-cross-attention/docs/en.md, phases/12-multimodal-ai/07-open-weight-vlm-recipes/docs/en.md, phases/19-capstone-projects/61-cross-attention-fusion/docs/en.md, phases/19-capstone-projects/60-projection-layer-modality-align/docs/en.md

- **Q-Former or MLP?** Q-Former when token budget matters. MLP when quality per token matters.
- **BLIP-2 or Flamingo?** BLIP-2 for single-image VQA on a budget. Flamingo for few-shot and many images.
- **Why init alpha at 0?** At step 0 the model is the pretrained LLM on text.
- **Why no mask on cross-attention?** The whole image is visible before any text.
- **Why two layers, not one?** GELU gives one non-linear bend. One linear layer only rotates and scales.
- **What to ablate first?** Visual-token count explains ~60% of variance. Encoder ~20%. Connector ~5%.

## Default open-VLM recipe
type: tips
from: phases/12-multimodal-ai/07-open-weight-vlm-recipes/docs/en.md

- Encoder: SigLIP 2 SO400m/14. Add DINOv2 ViT-g/14 for segmentation or grounding.
- Connector: 2-layer MLP on patch tokens. Skip Q-Former unless you are token-constrained.
- LLM: 7B for cost, 70B for quality. LLM size sets the ceiling.
- Data: PixMo + ShareGPT4V + Cauldron. Dense human captions beat distillation.
- Train Stage 1 at 384 fixed. Ramp to dynamic resolution up to 1280 for OCR.
- Swap the encoder before the connector. SigLIP over CLIP added 3+ points MMMU.
