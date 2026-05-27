# Video-Language Models: Temporal Tokens and Grounding

> Video is not a stack of photos. A 5-second clip has causal ordering, action verbs, and event timing that an image model cannot represent. Video-LLaMA (Zhang et al., June 2023) shipped the first open video-LLM with audio-visual grounding. VideoChat and Video-LLaVA scaled the pattern. By 2025 Qwen2.5-VL's TMRoPE closed the gap with frontier proprietary models. Each system solved temporal tokens differently — Q-former per clip, concat-pool per frame, TMRoPE per token. This lesson reads the patterns, builds a uniform-vs-dynamic frame sampler, and evaluates on temporal grounding tasks.

**Type:** Build
**Languages:** Python (stdlib, frame sampler + temporal-grounding evaluator)
**Prerequisites:** Phase 12 · 08 (LLaVA-OneVision)
**Time:** ~180 minutes

## Learning Objectives

- Explain why temporal positional encoding changes video VLM performance independently of the vision encoder.
- Compare uniform, dynamic-FPS, and event-driven frame sampling on tokens-per-second vs grounding accuracy.
- Describe Q-former-per-clip (Video-LLaMA) vs pooled-per-frame (Video-LLaVA) vs M-RoPE-per-token (Qwen2.5-VL) designs.
- Name the four video benchmarks: VideoMME, TempCompass, EgoSchema, Video-MMMU.

## The Problem

A 1-minute video at 30 FPS is 1800 frames. At 196 visual tokens per frame (ViT-B at 224), that is 352k tokens — larger than any 2024-era LLM context.

Three reduction strategies exist:

1. Subsample frames (1-8 FPS depending on content).
2. Pool each frame's patch tokens aggressively (3x3 or 4x4 bilinear pool).
3. Compress via a Q-former that takes a 16-frame clip and outputs 64 tokens.

Each trade-off is different. Subsampling loses temporal detail. Pooling loses spatial detail. Q-former loses both a little but saves tokens.

Temporal position encoding is the other axis: how does the model know frame 5 came before frame 6? Options include simple 1D temporal RoPE (Video-LLaMA), learned temporal embeddings (Video-LLaVA), and TMRoPE (Qwen2.5-VL, full 3D).

## The Concept

### Video-LLaMA: Q-former per clip + audio branch

Video-LLaMA (2023) was the first open video-LLM. Architecture:

- 16-frame clips at 2 FPS (so 8 seconds).
- Per-frame ViT features -> Video Q-former that cross-attends over all 16 frames -> 32 learned queries -> LLM.
- Parallel audio branch: waveform -> ImageBind audio encoder -> Audio Q-former -> 32 queries -> LLM.

Strength: audio-visual joint reasoning. Weakness: fixed clip length, no arbitrary time grounding.

### VideoChat and Video-LLaVA

VideoChat kept the Video-LLaMA idea but dropped audio and simplified. Video-LLaVA (Lin et al., 2023) trained a single visual encoder on both images and video frames ("alignment before projection"), giving a unified representation. Both are frozen-CLIP-encoder + MLP + LLM.

Neither handles long video. Both are 8-16 frame systems.

### Qwen2.5-VL and TMRoPE

Qwen2.5-VL introduced TMRoPE — Temporal-Modality Rotary Position Embedding. Each patch token carries an (t, h, w) position where t is the actual timestamp (not frame index).

Key differences from simple temporal embedding:

- Absolute time, not index. The model sees "at 4.2 seconds" not "at frame 15."
- Per-token rotation, not per-clip. Each visual token rotates independently by its timestamp.
- Compatible with dynamic FPS. If you sample at 2 FPS here and 4 FPS there, TMRoPE handles the uneven spacing natively.

TMRoPE enables "at what second does the cat jump?" queries. The model can output "at 4.2 seconds." Video-LLaMA could only say "early in the clip."

### Frame sampling strategies

Uniform: sample N frames evenly over duration. Simple, loses motion peaks.

Dynamic FPS: sample adaptively based on motion intensity. Optical flow or frame differencing picks high-motion segments for denser sampling. Qwen2.5-VL trains on this.

Event-driven: run a lightweight detector, sample more where action happens. Used by VideoAgent.

Keyframe + context: sample at shot boundaries + a few adjacent frames. Used for cinematic content.

### Pooling per frame

At 1 FPS and 576 tokens per frame, a 5-minute clip is 172,800 tokens. Doable with Qwen2.5-VL-72B's 128k context but expensive.

3x3 bilinear pool reduces to 64 tokens per frame -> 19,200 tokens for 5 minutes. Sweet spot for most tasks.

Pool more aggressively (6x6 -> 16 tokens per frame) for agent workflows where spatial detail matters less.

### The four video benchmarks

- VideoMME: comprehensive video understanding, short + medium + long.
- TempCompass: fine-grained temporal reasoning, "before" / "after" questions.
- EgoSchema: long-horizon first-person video.
- Video-MMMU: multimodal multi-discipline video questions.

A full video-VLM evaluation hits all four. They stress different axes — TempCompass is all about ordering, EgoSchema is about 3+ minute reasoning, VideoMME spans durations.

### Grounding output formats

Output formats for temporal grounding:

- Free text: "The cat jumps around the 4-second mark." Easy to parse but imprecise.
- Structured JSON: `{"event": "jump", "start": 4.1, "end": 4.3}`. Qwen2.5-VL trains this.
- Token-based: special `<time>4.1</time>` tokens interleaved with the answer. Qwen2.5-VL's internal format.

Token-based is most accurate for downstream use. Qwen2.5-VL's JSON output format parses directly.

### 2026 best practice

For video VLMs in 2026:

- Encoder: SigLIP 2 with M-RoPE or TMRoPE (Qwen2.5-VL).
- Frame sampling: dynamic FPS (1-4 depending on motion) with max-frame cap.
- Per-frame pooling: 3x3 bilinear.
- Output: structured JSON with time + event fields.
- Benchmarks: VideoMME + TempCompass for general; EgoSchema for long-horizon.

## Use It

`code/main.py` includes:

- Uniform and dynamic-FPS frame samplers.
- A toy temporal-grounding evaluator: given a "ground truth" event at time T and a model output, score accuracy with tolerance.
- A comparison across Video-LLaMA (16 frames, Q-former), Video-LLaVA (8 frames, MLP), Qwen2.5-VL (dynamic FPS + TMRoPE).

## Ship It

This lesson produces `outputs/skill-video-vlm-frame-planner.md`. Given a video task (monitoring, action recognition, temporal grounding, summarization), it picks the frame sampler, pooling factor, output format, and expected accuracy tier.

## Exercises

1. For a 3-minute cooking demo, pick uniform vs dynamic FPS. Justify with a token count.

2. TMRoPE adds what specifically that a simple temporal embedding table cannot do?

3. Write a JSON schema for temporal grounding that a VLM can learn to emit. Include error cases.

4. Read Video-LLaVA's Section 3 on "Alignment Before Projection." Why is this better than training separate image and video encoders?

5. Given the VideoMME leaderboard, what is the gap between the top open model and the top proprietary model as of 2026? How much of that gap is attributable to temporal encoding vs base LLM scale?

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Temporal grounding | "Time-localized answers" | VLM outputs a specific timestamp range for when an event happens |
| TMRoPE | "Time-Multimodal RoPE" | 3D rotary position with absolute timestamps, used by Qwen2.5-VL |
| Dynamic FPS | "Motion-aware sampling" | Sample more frames in high-motion segments, fewer in static ones |
| Frame pooling | "Spatial compress per frame" | Reduce patches per frame with bilinear interpolation before the LLM |
| Video Q-former | "Clip compressor" | Cross-attention bottleneck mapping N frames to K learned queries |
| VideoMME | "Video bench" | Comprehensive short/medium/long video benchmark, 2500+ samples |

## Further Reading

- [Zhang et al. — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858)
- [Li et al. — VideoChat (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Qwen Team — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Lin et al. — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
