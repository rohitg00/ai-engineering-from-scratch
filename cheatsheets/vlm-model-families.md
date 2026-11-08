---
id: vlm-model-families
title: Open VLM Families: LLaVA, Qwen-VL, InternVL
code: OV
subtitle: LLaVA, LLaVA-OneVision, Qwen-VL and InternVL3 side by side: connector, resolution, video, tokens and training.
hue: 265
sources: phases/12-multimodal-ai/05-llava-visual-instruction-tuning, phases/12-multimodal-ai/06-any-resolution-patch-n-pack, phases/12-multimodal-ai/08-llava-onevision-single-multi-video, phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps, phases/12-multimodal-ai/10-internvl3-native-multimodal
source_hash: 854d13f0d4ee45ed
---

## Families side by side
type: comparison
span: 2
from: phases/12-multimodal-ai/05-llava-visual-instruction-tuning/docs/en.md, phases/12-multimodal-ai/08-llava-onevision-single-multi-video/docs/en.md, phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/docs/en.md, phases/12-multimodal-ai/10-internvl3-native-multimodal/docs/en.md, phases/12-multimodal-ai/10-internvl3-native-multimodal/code/main.py

| Factor | LLaVA-NeXT | LLaVA-OneVision | Qwen-VL family | InternVL3 |
|---|---|---|---|---|
| Vision to LLM | 2-layer MLP, GELU | Same MLP projector | Qwen2-VL: 2-layer MLP on merged patches | Native, no align stage |
| Recipe | Post-hoc on a text LLM | Post-hoc on a text LLM | Post-hoc on a text LLM | Native multimodal pretrain |
| High resolution | AnyRes: 336 tiles plus thumbnail | AnyRes-9 or AnyRes-4, 384 tiles | Qwen2-VL: any H and W divisible by 28 | ViR picks low, medium or high |
| Video | Per-frame concat | 32 frames, 196 tokens each | Dynamic FPS, absolute-time M-RoPE | 5% video-text in pretrain |
| Visual tokens | 576 base, 2880 AnyRes | 6000-9000 per sample, balanced | Scales with input | 256, 576 or 2048+ via ViR |
| Training | Align, then instruct | Stages SI, OV, TT | Qwen3-VL: stages stress OCR, grounding, agents | One pretrain stage, then instruct |
| Swap the LLM | Retrain the projector | Retrain the projector | Retrain the adapter | Not possible later |

## LLaVA forward pass
type: architecture
from: phases/12-multimodal-ai/05-llava-visual-instruction-tuning/docs/en.md

```arch
node | img | 1,1 | Image | 336x336 | client
node | vit | 2,1 | CLIP ViT-L/14 @ 336 | 576 patches, dim 1024 | model
node | mlp | 3,1 | 2-layer MLP | 1024 → 4096 → 4096, GELU | process
node | prompt | 1,2 | Prompt | system + <image> + user | client
node | splice | 2,2 | Replace <image> | 576 projected tokens | process
node | llm | 3,2 | LLM | Vicuna-13B, later Llama-3.1-8B | model
edge | img | vit |
edge | vit | mlp | patches
edge | mlp | splice | 576 tokens
edge | prompt | splice |
edge | splice | llm | full sequence
```

## Qwen-VL lineage
type: flow
from: phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/docs/en.md, phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/code/main.py

1. **Qwen-VL (2023)**: 448 res, grounding boxes as text, Q-Former with 256 queries.
2. **Qwen2-VL (2024)**: M-RoPE, native dynamic resolution, MLP projector.
3. **Qwen2.5-VL (2025)**: dynamic FPS, absolute-time M-RoPE, window attention in the ViT.
4. **Qwen2.5-VL agents**: JSON tool calls. ScreenSpot goes from 55% to 84%.
5. **Qwen3-VL (2025)**: Qwen3 base, thinking mode, more OCR data. ViT and M-RoPE stay.

## Use each family when
type: tips
from: phases/12-multimodal-ai/05-llava-visual-instruction-tuning/docs/en.md, phases/12-multimodal-ai/06-any-resolution-patch-n-pack/docs/en.md, phases/12-multimodal-ai/06-any-resolution-patch-n-pack/code/main.py, phases/12-multimodal-ai/08-llava-onevision-single-multi-video/docs/en.md, phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/docs/en.md, phases/12-multimodal-ai/10-internvl3-native-multimodal/docs/en.md

- **LLaVA**: you need a cheap, reproducible recipe. Stage 2 takes ~20 hours on 8xA100.
- **LLaVA-OneVision**: one model serves single image, multi-image and video at a predictable cost.
- **Qwen2.5-VL**: video with timestamps, GUI agents with JSON output, `min_pixels` and `max_pixels` caps.
- **InternVL3**: text skills must not regress and you can pay for native pretraining.
- **Post-hoc recipe**: you want to swap in a new LLM later. It stays cheaper for most projects.
- **AnyRes tiling**: the encoder is frozen at 336x336, but you need detail.

## Toy code by lesson
type: task-table
from: phases/12-multimodal-ai/05-llava-visual-instruction-tuning/code/main.py, phases/12-multimodal-ai/06-any-resolution-patch-n-pack/code/main.py, phases/12-multimodal-ai/08-llava-onevision-single-multi-video/code/main.py, phases/12-multimodal-ai/10-internvl3-native-multimodal/code/main.py

| Task | Code |
|---|---|
| Project ViT patches | `MLPProjector(PATCH_DIM, HIDDEN_DIM, LLM_DIM)` |
| Build a LLaVA prompt | `build_llava_prompt(system, user, 576)` |
| Pack a mixed batch | `pack_batch(images, patch)` |
| Dense block-diagonal mask | `build_dense_mask(pack)` |
| AnyRes token cost | `anyres_cost(img, tile=336, thumb=336)` |
| Square-resize cost | `square_cost(img, side=336, patch=14)` |
| OneVision video plan | `plan_video(budget)` |
| ViR average tokens | `vir_sim(tiers)` |

## M-RoPE, dynamic FPS, tool calls
type: annotated-code
lang: python
from: phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/code/main.py

```python
cfg = MRoPEConfig(hidden=48, temporal_dim=16, height_dim=16, width_dim=16)
mrope_angles(cfg, 0, 5, 7)      # image patch: t=0, h=row, w=col
mrope_angles(cfg, 3, 5, 7)      # video frame t=3
mrope_rotate(cfg, vec, 3, 5, 7) # rotates each band by its axis
plan = VideoPlan(duration_s=600.0, tokens_per_frame=81,
                 budget=32768, motion="low")
plan.fps()                      # first candidate <= fps_max
plan.frame_times()              # one timestamp per frame
plan.total_tokens()             # frames times tokens_per_frame
parse_tool_call(raw)            # json.loads, then slice { to }
```

## Token math
type: concepts
from: phases/12-multimodal-ai/05-llava-visual-instruction-tuning/docs/en.md, phases/12-multimodal-ai/06-any-resolution-patch-n-pack/docs/en.md, phases/12-multimodal-ai/08-llava-onevision-single-multi-video/docs/en.md, phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/docs/en.md

- **LLaVA base**: 576 tokens per image. At 2048 context, 1472 tokens stay for text.
- **AnyRes 2x2**: 4 * 576 + 576 = 2880 visual tokens.
- **AnyRes 4x4**: a 1344x1344 image gives 9216 + 576, about 9800 tokens.
- **Qwen2-VL native**: 1120x672 gives 40x24 merged patches, 960 tokens.
- **OneVision image**: AnyRes-9 with 2x2 pool, 9 * 182 + 182 = 1820 tokens.
- **OneVision video**: 32 frames with 2x2 pool, 32 * 196 = 6272 tokens.
- **Dynamic FPS cap**: $fps_{max} = B / (T \cdot \text{tokens per frame})$
- **Qwen2.5-VL video**: 60 s at 4 FPS with 81 tokens per frame is 19440 tokens.

## Training recipes
type: comparison
from: phases/12-multimodal-ai/05-llava-visual-instruction-tuning/docs/en.md, phases/12-multimodal-ai/08-llava-onevision-single-multi-video/docs/en.md, phases/12-multimodal-ai/08-llava-onevision-single-multi-video/code/main.py, phases/12-multimodal-ai/10-internvl3-native-multimodal/docs/en.md

| Step | LLaVA | OneVision | InternVL3 |
|---|---|---|---|
| First | Train MLP only, 558k captions | SI: single image, AnyRes | Native pretrain |
| Second | MLP + LLM, 158k GPT-4 turns | OV: 0.5 / 0.3 / 0.2 mix | Instruction tuning |
| Third | None | TT: target task mix | None |
| Frozen | ViT and LLM in stage 1 | No weight reset | No freezing stage |
| Data | LAION-CC-SBU, LLaVA-Instruct | LLaVA-NeXT data plus own | 40/35/20/5 text, interleaved, caption, video |

## Defaults in the lessons
type: defaults
from: phases/12-multimodal-ai/05-llava-visual-instruction-tuning/code/main.py, phases/12-multimodal-ai/06-any-resolution-patch-n-pack/code/main.py, phases/12-multimodal-ai/08-llava-onevision-single-multi-video/code/main.py, phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/docs/en.md, phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/code/main.py, phases/12-multimodal-ai/10-internvl3-native-multimodal/code/main.py

| Setting | Default | Note |
|---|---|---|
| `anyres_cost` tile, thumb | 336 | 576 tokens per tile at patch 14 |
| `square_cost` side | 336 | Fixed 576 tokens per image |
| LLaVA prompt image_tokens | 576 | Replaces the image placeholder |
| `MRoPEConfig` base | 10000.0 | RoPE frequency base per band |
| Qwen2-VL video sampling | 1-2 FPS | Accepts any frame count |
| OneVision toy planner budget | 4096 | Visual tokens per sample in the lesson code |
| Dynamic-FPS demo budget | 32768 | 81 tokens per frame after 3x pool |
| `dvd_throughput` llm_tokens | 128 | Output tokens per request |

## Troubleshooting
type: troubleshooting
from: phases/12-multimodal-ai/06-any-resolution-patch-n-pack/docs/en.md, phases/12-multimodal-ai/08-llava-onevision-single-multi-video/docs/en.md, phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/docs/en.md, phases/12-multimodal-ai/10-internvl3-native-multimodal/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Squished text, lost chart labels | Square resize to 336 | Native aspect ratio with a max-pixels cap |
| Large image fills the context | AnyRes 4x4 is about 9800 tokens | Native pack or M-RoPE, no tile overhead |
| Patches attend across images | No block-diagonal mask | Mask from cumulative offsets, or use the `cu_seqlens` path |
| Weak image skills after training | Video-first or multi-image-first order | Train SI, then OV, then TT |
| GSM8K drops 5-10 points | Post-hoc alignment debt | Native pretrain with a 40% text floor |
| Long video runs out of frequency range | Fixed position scale | MRoPE-v2 scaling with max input size |

## Abbreviations
type: glossary
from: phases/12-multimodal-ai/06-any-resolution-patch-n-pack/docs/en.md, phases/12-multimodal-ai/08-llava-onevision-single-multi-video/docs/en.md, phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/docs/en.md, phases/12-multimodal-ai/10-internvl3-native-multimodal/docs/en.md

- **M-RoPE**: Multimodal RoPE. Time, height and width bands in the hidden dim.
- **V2PE**: variable visual position encoding. Learned band split per modality.
- **NaFlex**: SigLIP 2 native-flex mode. One checkpoint serves 256, 729 or 1024 tokens.
- **ViR**: Visual Resolution Router. Picks the minimum resolution before encoding.
- **DvD**: Decoupled Vision-Language deployment. Encoder and LLM on separate GPUs.
- **SI, OV, TT**: OneVision stages. Single-image, OneVision mix, task transfer.

## Questions
type: qa
from: phases/12-multimodal-ai/05-llava-visual-instruction-tuning/docs/en.md, phases/12-multimodal-ai/08-llava-onevision-single-multi-video/docs/en.md, phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/docs/en.md, phases/12-multimodal-ai/10-internvl3-native-multimodal/docs/en.md

- **Why did MLP beat Q-Former?** LM loss only and easy LLM swap. Contexts grew to 32k-128k+, so 576 tokens became cheap.
- **OneVision or Qwen2.5-VL budget?** OneVision fixes the budget and scales the pooling. Qwen2.5-VL budget scales with input.
- **Why does M-RoPE need no position table?** Each token rotates by its (t, h, w) position. Images use t = 0.
- **Why not always pretrain native?** Compute is like a text LLM. Interleaved data is rare. The LLM cannot change later.
- **What does DvD give?** For an 8B LLM with a 400M encoder, about 2x per-node throughput.
