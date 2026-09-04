---
name: video-qa
description: Build a video understanding pipeline with scene segmentation, multi-vector indexing, temporal grounding, and timestamped citations.
version: 1.0.0
phase: 19
lesson: 12
tags: [capstone, video, multimodal, gemini, qwen-vl, molmo, transnet, qdrant]
---

Given 100 hours of video, build an ingestion pipeline and a query system that answers natural-language questions with (start, end) timestamps plus frame previews.

Build plan:

1. Ingest videos (YouTube URLs or MP4); downscale to 720p if needed.
2. Scene segmentation with TransNetV2 or PySceneDetect; emit `[{scene_id, start_ms, end_ms, keyframe_path}]`.
3. ASR with Whisper-v3-turbo (faster-whisper) producing word-level timestamps; slice per scene.
4. VLM captioning with Gemini 2.5 Pro or Qwen3-VL-Max or Molmo 2; emit caption + frame embedding.
5. Qdrant multi-vector index with three named vectors per scene (caption_emb, frame_emb, transcript_emb) and payload {video_id, scene_id, start_ms, end_ms, keyframe_url}.
6. Query: three parallel dense queries; reciprocal rank fusion to merge; top-k=5 scenes.
7. Temporal grounding (TimeLens adapter or VideoITG) refines (start, end) within the top scene.
8. VLM synthesis (Gemini 2.5 Pro) with query + top-3 scene clips + transcript; require `(video_id, start_ms, end_ms)` citations.
9. Eval on ActivityNet-QA, NeXT-GQA, plus a 100-query hand-labeled custom set. Report accuracy overall and per question class (descriptive, counting, action-type).

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Temporal grounding IoU | IoU on held-out grounding set |
| 20 | QA accuracy | NeXT-GQA and 100-query custom set |
| 20 | Ingest throughput | Hours of video indexed per dollar |
| 20 | UI and citation UX | Timestamp links, thumbnail strip, jump-to-frame |
| 15 | Hallucination rate | Counting and action-type accuracy reported separately |

Hard rejects:

- Pipelines that pool a single vector per scene. Multi-vector is required for the class distinctions to show.
- Answers without (start, end) citations.
- Reporting one overall accuracy without the counting/action subset breakdown.
- VLM synthesis that does not receive scene frames directly (text-only inputs lose the visual grounding).

Refusal rules:

- Refuse to serve videos with unclear license provenance; require a license tag on every video_id.
- Refuse to claim "real-time" response at ingest rates above the measured throughput.
- Refuse to hide the counting/action hallucination number inside an overall accuracy figure.

Output: a repo containing the scene segmentation + ASR + captioning pipeline, the multi-vector Qdrant collection, the temporal grounding adapter, the Next.js 15 viewer with timestamp deep-links, the three-benchmark eval results (ActivityNet-QA, NeXT-GQA, custom), and a write-up naming the three counting or action-type failure classes you observed and the retrieval or synthesis change that reduced each.
