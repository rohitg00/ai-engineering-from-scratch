# Capstone 12 — Video Understanding Pipeline (Scene, QA, Search)

> Twelve Labs productized Marengo + Pegasus. VideoDB shipped the CRUD-for-video API. AI2's Molmo 2 published open VLM checkpoints. Gemini long-context handles hours of video natively. TimeLens-100K defined temporal grounding at scale. The 2026 pipeline is settled: scene segmentation, per-scene caption + embedding, transcript alignment, multi-vector index, and a query that answers with (start, end) timestamps plus frame previews. The capstone is ingesting 100 hours, hitting public benchmarks, and measuring hallucination on counting and action questions.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (UI)
**Prerequisites:** Phase 4 (CV), Phase 6 (speech), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:** P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 hours

## Problem

Long-form video QA is the most bandwidth-hungry multimodal problem at 2026 scale. Gemini 2.5 Pro can read a 2-hour video natively, but ingesting 100 hours of video into a queryable corpus still requires a scene-level index. The production shape combines scene segmentation (TransNetV2 or PySceneDetect), per-scene captioning with a VLM (Gemini 2.5, Qwen3-VL-Max, or Molmo 2), transcript alignment (Whisper-v3-turbo with word timestamps), and a multi-vector index that stores caption, frame embedding, and transcript side by side. The query pipeline answers with (start, end) timestamps plus frame previews.

Benchmarks are public (ActivityNet-QA, NeXT-GQA) plus your own 100-query custom set. Hallucination on counting and action-type questions is the known-hard failure class; the capstone explicitly measures it.

## Concept

Three pipelines run in parallel at ingest. **Scene segmentation** cuts the video into scenes. **VLM captioning** generates a caption per scene and a frame embedding from a keyframe. **ASR alignment** produces word-level timestamps. The three streams are joined by (scene_id, time range). Each scene gets three vector types in a multi-vector index (Qdrant): caption embedding, keyframe embedding, transcript embedding.

At query time, the natural-language question fires against all three vectors; results merge with RRF; a temporal-grounding adapter (TimeLens-style) refines the (start, end) window within the top scene. The VLM synthesizer (Gemini 2.5 Pro or Qwen3-VL-Max) takes query + top scenes + cropped frames and answers with cited timestamps and a frame preview.

The hallucination measurement matters. Counting ("how many people enter the room?") and action-type ("does the chef pour before stirring?") questions are notoriously unreliable. Report accuracy separately from descriptive questions.

## Architecture

```
video file / URL
      |
      v
PySceneDetect / TransNetV2  (scene segmentation)
      |
      +--- per-scene keyframe --- VLM caption + frame embedding
      |                            (Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2)
      |
      +--- audio channel --- Whisper-v3-turbo ASR + word timestamps
      |
      v
multi-vector Qdrant: {caption_emb, keyframe_emb, transcript_emb}
      |
query:
  dense queries against all three -> RRF merge -> top-k scenes
      |
      v
TimeLens / VideoITG temporal grounding (refine start/end within scene)
      |
      v
VLM synth: query + top scenes + frame previews
      |
      v
answer + (start, end) timestamps + frame thumbs + citations
```

## Stack

- Scene segmentation: TransNetV2 (state-of-the-art 2024-26) or PySceneDetect
- ASR: Whisper-v3-turbo via faster-whisper with word timestamps
- VLM captioner + answerer: Gemini 2.5 Pro or Qwen3-VL-Max or Molmo 2
- Temporal grounding: TimeLens-100K-trained adapter or VideoITG
- Index: Qdrant with multi-vector support (caption / frame / transcript)
- UI: Next.js 15 with HTML5 video player and scene thumbnails
- Eval: ActivityNet-QA, NeXT-GQA, custom 100-question hand-labeled set
- Hallucination benchmark: counting and action-type subsets with hand labels

## Build It

1. **Ingest walker.** Accept YouTube URLs or local MP4s. Downscale to 720p if needed. Persist `{video_id, file_path}`.

2. **Scene segmentation.** Run TransNetV2 or PySceneDetect to produce `[{scene_id, start_ms, end_ms, keyframe_path}]`. Target 100 hours: ~6k-8k scenes.

3. **ASR pass.** Run Whisper-v3-turbo on audio; export word-level timestamps; split into per-scene transcript slices.

4. **VLM captioning.** Per scene, call Gemini 2.5 Pro (or Qwen3-VL-Max) with the keyframe and a short caption template. Produce caption + frame embedding.

5. **Multi-vector index.** Qdrant collection with three named vectors. Payload: `{video_id, scene_id, start_ms, end_ms, keyframe_url}`.

6. **Query.** Natural-language question fires three dense queries; merge with reciprocal rank fusion; top-k=5 scenes.

7. **Temporal grounding.** Run TimeLens-style adapter on the top scene to refine the (start, end) window within the scene.

8. **VLM synth.** Call Gemini 2.5 Pro with query + top-3 scene clips (as images or short clips) + transcripts. Require `(video_id, start_ms, end_ms)` citations.

9. **Eval.** Run ActivityNet-QA and NeXT-GQA. Build a 100-query custom set. Report overall accuracy + per-class breakdown (counting, action, descriptive).

## Use It

```
$ video-qa ask --url=https://youtube.com/watch?v=X "how many cars pass the intersection in the first minute?"
[scene]    23 scenes detected
[asr]      transcript complete, 4m12s
[index]    69 vectors written (23 scenes x 3)
[query]    top scene: scene 3 [01:32-01:54], confidence 0.84
[ground]   refined window: [00:12-00:58]
[synth]    gemini 2.5 pro, 1.4s
answer:    5 cars pass the intersection between 00:12 and 00:58.
citations: [scene 3: 00:12-00:58]
          [frame preview at 00:14, 00:27, 00:44, 00:51, 00:57]
```

## Ship It

`outputs/skill-video-qa.md` is the deliverable. Given a YouTube URL or uploaded video, the pipeline indexes scenes and answers questions with timestamped citations.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Temporal grounding IoU | Intersection-over-union on held-out grounding set |
| 20 | QA accuracy | NeXT-GQA and custom 100-query |
| 20 | Ingest throughput | Hours of video per dollar spent |
| 20 | UI and citation UX | Timestamp links, thumbnail strip, jump-to-frame |
| 15 | Hallucination rate | Counting and action-type accuracy separately |
| **100** | | |

## Exercises

1. Swap Gemini 2.5 Pro for Qwen3-VL-Max on the captioning pass. Report caption quality delta on a human-rated 50-scene sample.

2. Reduce per-scene frame embedding to one pooled vector instead of multi-vector. Measure the retrieval regression.

3. Build a "counting strict" mode: the synthesizer extracts each counted instance with a timestamp and the user clicks to verify. Measure whether user-verification reduces hallucination.

4. Benchmark ingest cost: hours-of-video-per-dollar across three VLM choices. Pick the sweet spot.

5. Add speaker-diarized transcript: run pyannote speaker diarization on the audio and embed per-speaker transcripts. Demonstrate "what did Alice say about X?" queries.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scene segmentation | "Shot detection" | Cutting video into scenes at shot boundaries |
| Multi-vector index | "Caption + frame + transcript" | Qdrant collection with named vectors per representation |
| Temporal grounding | "When exactly did it happen" | Refining the (start, end) window for a query answer |
| Frame embedding | "Visual representation" | A vector embedding of a keyframe; used for scene-visual similarity |
| RRF fusion | "Reciprocal rank fusion" | Merge strategy across multiple ranked lists; a classic hybrid-retrieval trick |
| Counting hallucination | "Miscount" | Known failure mode of VLMs on "how many X" questions |
| ActivityNet-QA | "Video-QA benchmark" | Long-form video QA accuracy benchmark |

## Further Reading

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) — open VLM checkpoints
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) — temporal grounding at scale
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) — the hosted reference
- [VideoDB](https://videodb.io) — CRUD-for-video API reference
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) — commercial reference
- [TransNetV2](https://github.com/soCzech/TransNetV2) — scene segmentation model
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — classic open alternative
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) — reference eval benchmark
