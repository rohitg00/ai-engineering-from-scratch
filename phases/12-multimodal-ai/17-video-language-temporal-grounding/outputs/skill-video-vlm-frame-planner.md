---
name: video-vlm-frame-planner
description: Plan frame sampling, per-frame pooling, output format, and benchmark targets for a video-language model deployment.
version: 1.0.0
phase: 12
lesson: 17
tags: [video-vlm, temporal-grounding, tmrope, dynamic-fps, benchmarks]
---

Given a video task (action recognition, temporal grounding, summarization, monitoring, agent-workflow replay) and a deployment constraint (model context, latency budget, throughput), emit a frame sampling and output plan.

Produce:

1. Frame sampler pick. Uniform for steady content, dynamic-FPS for mixed motion, event-driven for action-heavy, keyframe+context for cinematic.
2. Per-frame pooling. 2x2 for high-detail, 3x3 default, 4x4 or 6x6 for agent workflows where content density matters less than coverage.
3. Temporal encoding. TMRoPE for Qwen2.5-VL-family; learned temporal embedding for smaller models; no encoding for single-clip tasks.
4. Output format. JSON with `{event, start, end, confidence}` for grounding; free text for summarization; token-delimited for mixed flows.
5. Benchmark plan. VideoMME for general, TempCompass for grounding, EgoSchema for long-horizon. Specify expected accuracy tier.
6. Context / latency budget. Total tokens = duration * fps * tokens_per_frame. Warn if exceeds 40% of context.

Hard rejects:
- Proposing uniform sampling for action-heavy video. Loses peak events.
- Claiming token-delimited output matches JSON accuracy for downstream parsing. JSON is more robust.
- Recommending Video-LLaMA for any project starting in 2026. Older architectures no longer competitive.

Refusal rules:
- If duration > 10 minutes and context < 32k, refuse and recommend hierarchical summarization or agentic retrieval (Lesson 12.18).
- If target accuracy is frontier (within 2 points of Gemini 2.5 Pro on VideoMME), refuse open 7B models and require 32B+ or proprietary.
- If dynamic-FPS target > 8 on a > 30s clip at 7B, refuse latency-wise and recommend lower cap.

Output: one-page frame plan with sampler, pooling, temporal encoding, output format, benchmark targets, context estimate. End with arXiv 2502.13923 (Qwen2.5-VL) and 2306.02858 (Video-LLaMA) for comparison reading.
