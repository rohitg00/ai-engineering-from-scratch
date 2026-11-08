---
id: video-language
title: Video-Language Models and Long Video
code: VV
subtitle: Sample frames, budget tokens, encode time, ground events and index long video with timestamped answers.
hue: 320
sources: phases/12-multimodal-ai/17-video-language-temporal-grounding, phases/12-multimodal-ai/18-long-video-million-token, phases/04-computer-vision/12-video-understanding, phases/19-capstone-projects/12-video-understanding-pipeline
source_hash: 196574547a8febbc
---

## Scene index pipeline (capstone)
type: architecture
from: phases/19-capstone-projects/12-video-understanding-pipeline/docs/en.md

```arch
node | video | 1,1 | Video file | YouTube URL or local MP4 | client
node | scene | 2,1 | Scene segmentation | TransNetV2 or PySceneDetect | process
node | cap | 3,1 | VLM caption | caption + frame embedding | model
node | index | 4,1 | Multi-vector Qdrant | three named vectors | store
node | asr | 3,2 | ASR pass | Whisper-v3-turbo, word timestamps | model
node | query | 1,3 | Question | natural language | client
node | rrf | 2,3 | RRF merge | top-k=5 scenes | process
node | ground | 3,3 | Temporal grounding | refine start, end in scene | process
node | synth | 4,3 | VLM synth | answer + timestamps | model
edge | video | scene |
edge | scene | cap | keyframe
edge | scene | asr | audio
edge | cap | index |
edge | asr | index |
edge | query | rrf |
edge | index | rrf | three queries
edge | rrf | ground | top scene
edge | ground | synth | window
```

## Video VLM designs
type: comparison
span: 2
from: phases/12-multimodal-ai/17-video-language-temporal-grounding/docs/en.md, phases/12-multimodal-ai/17-video-language-temporal-grounding/code/main.py

| Factor | Video-LLaMA | Video-LLaVA | Qwen2.5-VL |
|---|---|---|---|
| Frames | 16-frame clips at 2 FPS | 8 frames | Dynamic FPS |
| Compressor | Video Q-former, 32 queries | MLP | time-aligned M-RoPE per token |
| Time position | 1D temporal RoPE | Learned temporal embeddings | Absolute timestamp (t, h, w) |
| Note | Audio branch, ImageBind | Shared image+video encoder | Best open 2025 |
| Answer to "when" | "early in the clip" | 8-16 frame system | "at 4.2 seconds" |
| Weakness | Fixed clip length | No long video | None stated |

## Long video: four paths
type: comparison
span: 2
from: phases/12-multimodal-ai/18-long-video-million-token/docs/en.md, phases/12-multimodal-ai/18-long-video-million-token/code/main.py

| Factor | Brute context | Ring attention | Token compression | Agentic retrieval |
|---|---|---|---|---|
| Example | Gemini 1.5, Gemini 2.5 Pro | LWM, LongVILA | Video-XL, LongVA | VideoAgent |
| Mechanism | All tokens in one pass | Chunks rotate across devices | One summary token per clip | LLM queries a clip tool |
| Cost | Millions of tokens | Linear in context | Small context | Only relevant clips |
| Weakness | Closed, not open-source | Spreads over many devices | Misses exact frames | Retrieval quality |
| Pick for | >1h general QA | 15-60 min | 15-60 min | >1h specific query |

## VideoAgent loop
type: flow
from: phases/12-multimodal-ai/18-long-video-million-token/docs/en.md, phases/12-multimodal-ai/18-long-video-million-token/code/main.py

1. **LLM**: reads the question.
2. **LLM**: calls `find_clips(keyword='<word>')` for relevant clips.
3. **Tool**: returns matching clip timestamps.
4. **VLM**: encodes 3 x 30s clips (~7290 tokens total).
5. **LLM**: composes the answer or asks follow-up queries.

## Token math
type: concepts
from: phases/12-multimodal-ai/17-video-language-temporal-grounding/docs/en.md, phases/12-multimodal-ai/18-long-video-million-token/docs/en.md, phases/12-multimodal-ai/18-long-video-million-token/code/main.py

- **Budget**: `tokens(duration_s, fps, per_frame)` is duration times FPS times tokens per frame.
- **Raw**: 1 minute at 30 FPS and 196 tokens per frame is 352k tokens.
- **3x3 pool**: 64 tokens per frame. 5 minutes at 1 FPS is 19,200 tokens.
- **384 native**: ~729 tokens per frame. 3x3 pooling gives 81.
- **30 min**: 1 FPS at 81 tokens is 145,800 tokens. 2 FPS is 291,600.
- **2 hours**: 1 FPS at 81 tokens is 583k tokens.
- **Retrieval**: `3 * 30 * 81 + 200` tokens for 3 clips. 99% cheaper.

## Video model families (vision)
type: concepts
from: phases/04-computer-vision/12-video-understanding/docs/en.md

- **2D + pool**: 2D CNN per frame, average over time. Cannot model motion.
- **3D conv**: kernels over (T, H, W). C3D, I3D, SlowFast.
- **I3D inflation**: copy a 2D kernel along time. 3x3 becomes 3x3x3.
- **(2+1)D**: 2D spatial conv, then 1D temporal conv. Fewer parameters.
- **Joint attention**: one attention over (t, h, w). Quadratic in `T*H*W`.
- **Divided attention**: one attention over time, one over space, per block.
- **Factorised attention**: time and space attention alternate across blocks.

## Functions in code
type: task-table
span: 2
from: phases/12-multimodal-ai/17-video-language-temporal-grounding/code/main.py, phases/04-computer-vision/12-video-understanding/code/main.py, phases/19-capstone-projects/12-video-understanding-pipeline/code/main.py

| Task | Code |
|---|---|
| Uniform timestamps | `uniform_sample(duration, n)` |
| Motion-aware timestamps | `dynamic_sample(motion, fps_cap=4, total_budget=32)` |
| Score grounding | `evaluate_grounding(predictions, ground_truth, tol_iou=0.3)` |
| Interval overlap | `iou(a_start, a_end, b_start, b_end)` |
| Uniform frame indices | `sample_uniform(num_frames_total, T)` |
| Random contiguous window | `sample_dense(num_frames_total, T, rng=None)` |
| Lift 2D conv to 3D | `inflate_2d_to_3d(conv2d, time_kernel=3)` |
| Search three vectors | `multi_vector_search(query, scenes, k=5)` |

## Sample, ground, inflate
type: annotated-code
lang: python
span: 2
from: phases/12-multimodal-ai/17-video-language-temporal-grounding/code/main.py, phases/04-computer-vision/12-video-understanding/code/main.py

```python
uni = uniform_sample(duration, 8)                          # step * (i + 0.5)
dyn = dynamic_sample(motion, fps_cap=4, total_budget=12)   # 1 to fps_cap per second
result = evaluate_grounding(predictions, ground)           # hit when IoU >= tol_iou
result["recall"]                                           # hits over ground truth events
model = FramePool(num_classes=10, pretrained=False)        # ResNet-18 per frame, mean over T
c3d = inflate_2d_to_3d(c2d, time_kernel=3)                 # repeat on time, divide by time_kernel
c21 = Conv2Plus1D(3, 16)                                   # spatial, BN, ReLU, temporal
```

## Run the capstone
type: command-table
from: phases/19-capstone-projects/12-video-understanding-pipeline/code/main.py, phases/19-capstone-projects/12-video-understanding-pipeline/code/ts/README.md, phases/19-capstone-projects/12-video-understanding-pipeline/code/ts/src/server.ts, phases/19-capstone-projects/12-video-understanding-pipeline/code/ts/src/types.ts

| Command | What it does |
|---|---|
| `python main.py` | Index demo: RRF search, grounded window |
| `npm run typecheck` | Type checks the UI half |
| `npm test` | Job state and store tests |
| `npm start` | Self-terminating demo |
| `npm run serve` | HTTP server on :8123 |
| `GET /jobs` | Job summaries as JSON |
| `GET /job/:id` | Stage timeline, 404 when unknown |
| Stages | chunk, embed, index, qa |

## Defaults
type: defaults
span: 1
from: phases/12-multimodal-ai/17-video-language-temporal-grounding/code/main.py, phases/12-multimodal-ai/17-video-language-temporal-grounding/docs/en.md, phases/04-computer-vision/12-video-understanding/code/main.py, phases/04-computer-vision/12-video-understanding/docs/en.md, phases/19-capstone-projects/12-video-understanding-pipeline/code/main.py

| Setting | Default | Note |
|---|---|---|
| `fps_cap` | 4 | Max samples per second |
| `total_budget` | 32 | Total dynamic samples |
| `tol_iou` | 0.3 | IoU for a grounding hit |
| `time_kernel` | 3 | Inflation time depth |
| RRF constant | 60 | Adds `1.0 / (60 + rank + 1)` |
| `k` in search | 5 | Top scenes after fusion |
| Clip length T | 8 | Also 16, 32 or 64 |

## Troubleshooting
type: troubleshooting
span: 2
from: phases/04-computer-vision/12-video-understanding/docs/en.md, phases/12-multimodal-ai/17-video-language-temporal-grounding/docs/en.md, phases/12-multimodal-ai/18-long-video-million-token/docs/en.md, phases/19-capstone-projects/12-video-understanding-pipeline/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| "open door" equals "close door" | Temporal pooling is order-invariant | Use 3D conv or a transformer |
| Near-chance on motion classes | Appearance alone is insufficient | Train R(2+1)D, not FramePool |
| Inflated model breaks batch norm | Activation scale grows | Divide by `time_kernel` |
| Joint attention runtime balloons | Quadratic in `T*H*W` | Use divided attention |
| Uniform sampling misses the action | Loses motion peaks | Use dynamic FPS with a max-frame cap |
| Answer says "early in the clip" | No absolute time position | Use time-aligned M-RoPE and JSON output |
| Context overflow on 2h video | 583k tokens at 1 FPS | Pool more or use VideoAgent |
| Miscounts "how many X" | Counting hallucination | Report counting accuracy separately |

## Questions
type: qa
from: phases/12-multimodal-ai/17-video-language-temporal-grounding/docs/en.md, phases/12-multimodal-ai/18-long-video-million-token/docs/en.md, phases/04-computer-vision/12-video-understanding/docs/en.md, phases/19-capstone-projects/12-video-understanding-pipeline/docs/en.md

- **What does time-aligned M-RoPE add?** Absolute time per token. It handles uneven dynamic FPS spacing.
- **Which output format?** Structured JSON with time and event fields.
- **Which pooling?** 3x3 bilinear for most tasks. 6x6 for agent workflows.
- **Which path for a 15-minute clip?** Open 72B with native context.
- **Which path for 2+ hours?** VideoAgent or hierarchical summaries.
- **78% clip, 82% video?** The model relies on test-time averaging.
- **Why three vectors per scene?** One pooled vector gives a retrieval regression.

## Benchmarks
type: concepts
from: phases/12-multimodal-ai/17-video-language-temporal-grounding/docs/en.md, phases/12-multimodal-ai/18-long-video-million-token/docs/en.md

- **VideoMME**: short, medium and long video. 2500+ samples.
- **TempCompass**: "before" / "after" ordering questions.
- **EgoSchema**: long-horizon first-person video.
- **Needle-in-a-haystack**: hide a marker at a random point. Score Recall@k.
