# Evidence: cheatsheets/vlm-model-families.md

Abbreviations: P = phases/12-multimodal-ai. L05 = P/05-llava-visual-instruction-tuning, L06 = P/06-any-resolution-patch-n-pack, L08 = P/08-llava-onevision-single-multi-video, L09 = P/09-qwen-vl-family-dynamic-fps, L10 = P/10-internvl3-native-multimodal. d = docs/en.md, c = code/main.py.

## Families side by side (comparison, 7 rows)
- Vision to LLM: LLaVA 2-layer MLP with GELU L05/d:37. OneVision same projector L05/d:95. Qwen2-VL MLP on merged patch tokens L09/d:47. InternVL3 no alignment pretraining, no projector freezing stage L10/d:44.
- Recipe: post-hoc list (LLaVA, Qwen-VL) L10/d:19, L10/c:73. Native pretraining L10/d:37, L10/c:73.
- High resolution: AnyRes 336 crops plus thumbnail L05/d:89. AnyRes-9 and AnyRes-4 with 384 tiles L08/d:37. Native res divisible by 28 L09/d:45. ViR tiers L10/d:62-64.
- Video: per-frame concat L05/d:106. 32 frames, 196 tokens L08/d:39. Dynamic FPS and absolute-time M-RoPE L09/d:56-57. 5% video-text L10/d:42.
- Visual tokens: 576 and 2880 L05/d:101. 6000-9000 per sample L08/d:35. Budget scales with input L08/d:83. 256, 576, 2048+ L10/d:64.
- Training: two stages L05/d:53-61. Stages SI, OV, TT L08/d:45-49. Stages emphasize OCR, grounding, agent behavior L09/d:3. Single stage then instruction tuning L10/d:46.
- Swap the LLM: retrain the projector L05/d:78. Post-hoc retrains only the adapter, native gives up the option L10/d:90. Base-LLM swap impossible for native L10/c:72.

## LLaVA forward pass (architecture, 6 nodes, 5 edges)
- Image 336x336, CLIP ViT-L/14 @ 336: L05/d:36.
- 576 patches of dim 1024: L05/d:43.
- 2-layer MLP 1024 → 4096 → 4096, GELU: L05/d:37, 44.
- Prompt with system + <image> + user: L05/d:45.
- Replace <image> with 576 projected tokens: L05/d:46.
- LLM Vicuna-13B, later Llama-3.1-8B: L05/d:38. Feed full sequence: L05/d:47.

## Qwen-VL lineage (flow, 5 steps)
1. Qwen-VL 448 res, grounding as text, Q-Former with 256 queries: L09/d:33-36, L09/c:168.
2. Qwen2-VL M-RoPE, native dynamic resolution, MLP projector: L09/d:41-47, L09/c:169.
3. Qwen2.5-VL dynamic FPS, absolute-time M-RoPE, window attention: L09/d:52-58.
4. JSON tool calls, ScreenSpot 55% to 84%: L09/d:59, 112.
5. Qwen3-VL Qwen3 base, thinking mode, OCR, ViT and M-RoPE stay: L09/d:66, L09/c:171.

## Use each family when (tips, 6)
- LLaVA ~20 hours on 8xA100: L05/d:127.
- OneVision one model for three scenarios, predictability: L08/d:41, 83.
- Qwen2.5-VL timestamps, JSON agent output, min_pixels/max_pixels: L09/d:56-59, 153.
- InternVL3 fewer text-benchmark points lost, native compute cost: L10/d:76, 88.
- Post-hoc LLM swap and cheaper: L10/d:90, 92.
- AnyRes when encoder frozen at 336x336: L06/c:175-176, L06/d:58.

## Toy code by lesson (task-table, 8)
- MLPProjector(PATCH_DIM, HIDDEN_DIM, LLM_DIM): L05/c:98.
- build_llava_prompt(system, user, image_tokens=576): L05/c:67, 116.
- pack_batch(images, patch): L06/c:42.
- build_dense_mask(pack): L06/c:52.
- anyres_cost(img, tile=336, thumb=336): L06/c:64.
- square_cost(img, side=336, patch=14): L06/c:92.
- plan_video(budget): L08/c:77.
- vir_sim(tiers): L10/c:46.

## M-RoPE, dynamic FPS, tool calls (annotated-code, 10 lines)
- MRoPEConfig(hidden=48, temporal_dim=16, height_dim=16, width_dim=16): L09/c:110.
- mrope_angles for image (0, 5, 7) and video t=3: L09/c:27, 114-115.
- mrope_rotate rotates each band by its axis: L09/c:40-59.
- VideoPlan(duration_s, tokens_per_frame=81, budget=32768, motion): L09/c:62-67, 132-135. 600.0 low motion: L09/c:129.
- plan.fps() first candidate <= fps_max: L09/c:69-80.
- plan.frame_times(): L09/c:82-86.
- plan.total_tokens() frames times tokens_per_frame: L09/c:88-89.
- parse_tool_call json.loads then slice { to }: L09/c:92-104.

## Token math (concepts, 8)
- 576 tokens, 1472 left at 2048: L05/d:51.
- 4 * 576 + 576 = 2880: L06/d:56.
- 1344x1344 at 4x4 is 9216 + 576 ≈ 9800: L06/d:58.
- 1120x672 is 40x24 merged patches, 960 tokens: L09/d:45.
- AnyRes-9, 2x2 pool, 9 * 182 + 182 = 1820: L08/d:37.
- 32 * 196 = 6272: L08/d:39.
- fps_max = B / (T * tokens_per_frame): L09/d:92.
- 60 s at 4 FPS with 81 tokens per frame = 19440: L09/d:97.

## Training recipes (comparison, 5 rows)
- First: train MLP only on 558k pairs L05/d:55. SI single image AnyRes L08/d:47. Native pretrain L10/d:37, 46.
- Second: 158k GPT-4 turns, projector + LLM L05/d:61. OV mix 0.5 / 0.3 / 0.2 L08/c:109. Instruction tuning follows L10/d:46.
- Third: TT target task mix L08/d:49.
- Frozen: ViT and LLM frozen in stage 1 L05/d:55. No weight reset L08/d:48. No projector freezing stage L10/d:44.
- Data: LAION-CC-SBU L05/d:55, LLaVA-Instruct L05/d:166. LLaVA-NeXT data plus OneVision data L08/d:47. 40/35/20/5 mix L10/d:39-42.

## Defaults in the lessons (defaults, 8)
- anyres_cost tile and thumb 336: L06/c:64. 576 per 336 tile: L05/c:131, L06/d:56.
- square_cost side 336: L06/c:92.
- image_tokens=576: L05/c:116.
- MRoPEConfig base 10000.0: L09/c:24.
- Qwen2-VL video 1-2 FPS default, any frame count: L09/d:48.
- OneVision toy planner budget = 4096: L08/c:125.
- Dynamic-FPS budget = 32768, 81 tokens after 3x pool: L09/c:124, 132.
- dvd_throughput llm_tokens 128: L10/c:52-53.

## Troubleshooting (troubleshooting, 6)
- Square resize distorts text and chart labels: L06/d:25. Max-pixels cap, native aspect: L06/d:94.
- AnyRes 4x4 about 9800 tokens, M-RoPE no tile overhead: L06/d:58, 66.
- Block-diagonal mask, cu_seqlens: L06/d:40, 76-83.
- Wrong curriculum order hurts image performance: L08/d:51.
- GSM8K drops 5-10 points from post-hoc: L10/d:27. 40% text floor: L10/c:92.
- MRoPE-v2 scaling for long video frequency range: L09/d:60.

## Abbreviations (glossary, 6)
- M-RoPE: L06/d:137, L09/d:148.
- V2PE: L10/d:50-56, 129.
- NaFlex 256/729/1024: L06/d:70, 136.
- ViR: L10/d:62, 130.
- DvD: L10/d:68, 131.
- SI, OV, TT: L08/d:47-49.

## Questions (qa, 5)
- MLP beat Q-Former, LM loss, LLM swap, 32k-128k+ contexts: L05/d:76-78, 109.
- OneVision fixes budget and scales pooling, Qwen2.5-VL scales with input: L08/d:83.
- M-RoPE (t, h, w), t = 0 for images, no table: L09/d:46, 84.
- Native costs: compute, data scarcity, no LLM reuse: L10/d:88-90.
- DvD 8B + 400M encoder roughly doubles throughput: L10/d:70.
