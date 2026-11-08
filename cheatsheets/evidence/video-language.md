# Evidence: cheatsheets/video-language.md

Abbreviations: L17 = phases/12-multimodal-ai/17-video-language-temporal-grounding, L18 = phases/12-multimodal-ai/18-long-video-million-token, CV12 = phases/04-computer-vision/12-video-understanding, C12 = phases/19-capstone-projects/12-video-understanding-pipeline. d = docs/en.md, c = code/main.py, ts = code/ts.

## Scene index pipeline (capstone) (architecture, 9 nodes, 9 edges)
- Video file, YouTube URL or local MP4: C12/d:28, 71
- Scene segmentation, TransNetV2 or PySceneDetect: C12/d:31, 73
- VLM caption + frame embedding from keyframe: C12/d:33, 77
- ASR pass, Whisper-v3-turbo, word timestamps, audio channel: C12/d:36, 75
- Multi-vector Qdrant, three named vectors: C12/d:39, 79
- Question, natural language: C12/d:81
- RRF merge, top-k=5 scenes, three dense queries: C12/d:42, 81
- Temporal grounding refines start, end within the top scene: C12/d:45, 83
- VLM synth, answer + timestamps: C12/d:48, 51, 85

## Video VLM designs (comparison, 6 rows)
- Frames: 16-frame clips at 2 FPS L17/d:37, Video-LLaVA 8 frames L17/c:114, dynamic FPS L17/c:116
- Compressor: Video Q-former, 32 queries L17/d:38, MLP L17/c:114, time-aligned M-RoPE per-token rotation L17/d:56, L17/c:116
- Time position: 1D temporal RoPE, learned temporal embeddings, time-aligned M-RoPE: L17/d:29; (t, h, w) absolute timestamp L17/d:51, 55
- Note: audio branch with ImageBind L17/d:39, shared image+video encoder L17/c:114, best open 2025 L17/c:116
- Answer to "when": "early in the clip", "at 4.2 seconds" L17/d:59, 8-16 frame systems L17/d:47
- Weakness: fixed clip length L17/d:41, no long video L17/d:47

## Long video: four paths (comparison, 5 rows)
- Example: Gemini 1.5, Gemini 2.5 Pro L18/d:27, 31; LWM, LongVILA L18/d:35, 39, 41; Video-XL, LongVA L18/d:43, 47, 49; VideoAgent L18/d:53, 57
- Mechanism: one forward pass L18/d:29; ring of chunks L18/d:37; one summary token per clip L18/d:47; LLM queries tool L18/d:55-60
- Cost: millions of tokens L18/d:29; linear in context L18/d:39; shrinks context L18/d:47; only relevant clips encoded L18/d:65
- Weakness: not open-source L18/d:33; across devices L18/d:37; misses exact frames L18/d:51; retrieval quality bottleneck L18/d:65
- Pick for: strategy picker L18/c:108-111

## VideoAgent loop (flow, 5 steps)
1. LLM reads the question: L18/d:59, L18/c:75
2. find_clips(keyword=...): L18/d:60, L18/c:77
3. Tool returns clip timestamps: L18/d:61, L18/c:79
4. VLM encodes 3 x 30s clips (~7290 tokens total): L18/d:62, L18/c:80
5. LLM composes answer or asks follow-up queries: L18/d:63

## Token math (concepts, 7)
- tokens(duration_s, fps, per_frame): L18/c:15-16
- 1 min at 30 FPS, 196 tokens, 352k: L17/d:19
- 3x3 pool 64 tokens, 19,200 for 5 min: L17/d:75
- ~729 tokens at 384, 81 with 3x3: L18/d:19
- 30 min 145,800, 2 FPS 291,600: L18/d:19
- 2 hours 583k: L18/d:21
- 3 * 30 * 81 + 200, 99% cheaper: L18/c:82, 94

## Video model families (vision) (concepts, 7)
- 2D + pool, cannot model motion: CV12/d:46, 54
- 3D conv (T, H, W), C3D, I3D, SlowFast: CV12/d:61
- I3D inflation 3x3 to 3x3x3: CV12/d:63
- (2+1)D fewer parameters: CV12/d:211
- Joint attention quadratic in T*H*W: CV12/d:80
- Divided attention: CV12/d:81
- Factorised attention: CV12/d:82

## Functions in code (task-table, 8)
- uniform_sample(duration, n): L17/c:18
- dynamic_sample(motion, fps_cap=4, total_budget=32): L17/c:25-26
- evaluate_grounding(predictions, ground_truth, tol_iou=0.3): L17/c:56-57
- iou(a_start, a_end, b_start, b_end): L17/c:43
- sample_uniform(num_frames_total, T): CV12/c:7
- sample_dense(num_frames_total, T, rng=None): CV12/c:16
- inflate_2d_to_3d(conv2d, time_kernel=3): CV12/c:42
- multi_vector_search(query, scenes, k=5): C12/c:91

## Sample, ground, inflate (annotated-code, 7 lines)
- uni = uniform_sample(duration, 8), step * (i + 0.5): L17/c:80, 21-22
- dyn = dynamic_sample(motion, fps_cap=4, total_budget=12), clamp 1 to fps_cap: L17/c:83, 34
- result = evaluate_grounding(predictions, ground), hit at best_iou >= tol_iou: L17/c:102, 69
- result["recall"] = hits / ground truth: L17/c:73, 103
- FramePool(num_classes=10, pretrained=False), ResNet-18, mean over T: CV12/c:90, 26-39
- inflate_2d_to_3d(c2d, time_kernel=3), repeat and divide: CV12/c:99, 56
- Conv2Plus1D(3, 16), spatial, bn, act, temporal: CV12/c:106, 80

## Run the capstone (command-table, 8)
- python main.py: C12/c:9, 153-162
- npm run typecheck: C12/ts/README.md:24
- npm test: C12/ts/README.md:25, C12/ts/tests/stages.test.ts
- npm start, self-terminating demo: C12/ts/README.md:26
- npm run serve, :8123: C12/ts/README.md:27
- GET /jobs: C12/ts/src/server.ts:26
- GET /job/:id, 404: C12/ts/src/server.ts:28-31
- Stages chunk, embed, index, qa: C12/ts/src/types.ts:21

## Defaults (defaults, 7)
- fps_cap 4: L17/c:25
- total_budget 32: L17/c:26
- tol_iou 0.3: L17/c:57
- time_kernel 3: CV12/c:42
- RRF 1.0 / (60 + rank + 1): C12/c:104
- k 5 in multi_vector_search: C12/c:91
- T 8, also 16, 32 or 64: CV12/d:103, CV12/c:86

## Troubleshooting (troubleshooting, 8)
- "open door" and "close door", order-invariant pooling: CV12/d:55; fix 3D conv or transformer: CV12/d:66, 73
- Near-chance accuracy on motion, train R(2+1)D: CV12/d:255-256
- Batch norm and division by time_kernel: CV12/d:207
- Joint attention quadratic, divided attention: CV12/d:80-81, 91
- Uniform loses motion peaks, dynamic FPS with max-frame cap: L17/d:63, 103
- "early in the clip", time-aligned M-RoPE, JSON output: L17/d:59, 102, 105
- 2h at 1 FPS 583k, pool more or VideoAgent: L18/d:21, 83
- Counting hallucination, report separately: C12/d:23, 138

## Questions (qa, 7)
- time-aligned M-RoPE absolute time, dynamic FPS spacing: L17/d:55-57
- Structured JSON with time and event fields: L17/d:105
- 3x3 bilinear, 6x6 for agent workflows: L17/d:75, 77
- 15-minute clip, open 72B + native context: L18/d:79
- 2+ hours, VideoAgent or hierarchical summaries: L18/d:83
- 78% clip / 82% video, test-time averaging: CV12/d:111
- One pooled vector, retrieval regression: C12/d:121

## Benchmarks (concepts, 4)
- VideoMME short, medium, long, 2500+ samples: L17/d:81, 145
- TempCompass before / after: L17/d:82
- EgoSchema long-horizon first-person: L17/d:83
- Needle-in-a-haystack marker, Recall@k: L18/d:69, 71
