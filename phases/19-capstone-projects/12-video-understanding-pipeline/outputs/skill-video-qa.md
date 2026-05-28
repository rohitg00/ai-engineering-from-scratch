---
name: video-qa
description: Scene segmentation、multi-vector indexing、temporal grounding、timestamped citation を備えた video understanding pipeline を構築する。
version: 1.0.0
phase: 19
lesson: 12
tags: [capstone, video, multimodal, gemini, qwen-vl, molmo, transnet, qdrant]
---

100 時間の video を与え、(start, end) timestamp と frame preview 付きで natural-language question に答える ingestion pipeline と query system を構築する。

Build plan:

1. Video (YouTube URL または MP4) を ingest し、必要なら 720p に downscale する。
2. TransNetV2 または PySceneDetect で scene segmentation を行い、`[{scene_id, start_ms, end_ms, keyframe_path}]` を出力する。
3. Whisper-v3-turbo (faster-whisper) で ASR を行い、word-level timestamp を生成する。Scene ごとに slice する。
4. Gemini 2.5 Pro または Qwen3-VL-Max または Molmo 2 で VLM captioning を行い、caption + frame embedding を出力する。
5. Scene ごとに 3 つの named vector (caption_emb、frame_emb、transcript_emb) と payload {video_id, scene_id, start_ms, end_ms, keyframe_url} を持つ Qdrant multi-vector index。
6. Query: 3 本の parallel dense query を投げ、reciprocal rank fusion で merge し、top-k=5 scenes を得る。
7. Temporal grounding (TimeLens adapter または VideoITG) が top scene 内の (start, end) を refine する。
8. VLM synthesis (Gemini 2.5 Pro) に query + top-3 scene clips + transcript を渡し、`(video_id, start_ms, end_ms)` citation を必須にする。
9. ActivityNet-QA、NeXT-GQA、100-query hand-labeled custom set で eval する。Overall と question class 別 (descriptive、counting、action-type) の accuracy を報告する。

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Temporal grounding IoU | held-out grounding set 上の IoU |
| 20 | QA accuracy | NeXT-GQA と 100-query custom set |
| 20 | Ingest throughput | 1 dollar あたりに index できる video hours |
| 20 | UI and citation UX | Timestamp links、thumbnail strip、jump-to-frame |
| 15 | Hallucination rate | Counting と action-type の accuracy を別々に報告 |

Hard rejects:

- Scene ごとに single vector へ pool する pipeline。Class distinction を出すには multi-vector が必須。
- (start, end) citation のない回答。
- Counting/action subset breakdown なしで overall accuracy だけを報告すること。
- Scene frame を直接受け取らない VLM synthesis。Text-only input では visual grounding が失われる。

Refusal rules:

- License provenance が不明な video は提供しない。すべての video_id に license tag を必須にする。
- Measured throughput を超える ingest rate で "real-time" response を主張しない。
- Counting/action hallucination number を overall accuracy figure の中に隠さない。

Output: scene segmentation + ASR + captioning pipeline、multi-vector Qdrant collection、temporal grounding adapter、timestamp deep-link 付き Next.js 15 viewer、3 benchmark の eval results (ActivityNet-QA、NeXT-GQA、custom)、観測した counting または action-type failure class top 3 と、それぞれを減らした retrieval または synthesis の変更を記した write-up を含む repo。
