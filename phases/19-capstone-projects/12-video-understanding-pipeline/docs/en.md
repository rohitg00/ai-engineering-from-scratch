# キャップストーン 12 — Video Understanding Pipeline (Scene, QA, Search)

> Twelve Labs は Marengo + Pegasus を productize した。VideoDB は CRUD-for-video API を出した。AI2 の Molmo 2 は open VLM checkpoint を公開した。Gemini の long-context は数時間の video を native に扱える。TimeLens-100K は大規模な temporal grounding を定義した。2026 年の pipeline は固まっている: scene segmentation、scene ごとの caption + embedding、transcript alignment、multi-vector index、そして (start, end) timestamp と frame preview 付きで答える query。キャップストーンでは 100 時間を ingest し、public benchmark を満たし、counting と action question における hallucination を測定する。

**種類:** Capstone
**言語:** Python (pipeline)、TypeScript (UI)
**前提:** Phase 4 (CV)、Phase 6 (speech)、Phase 7 (transformers)、Phase 11 (LLM engineering)、Phase 12 (multimodal)、Phase 17 (infrastructure)
**演習対象フェーズ:** P4 · P6 · P7 · P11 · P12 · P17
**時間:** 30 時間

## 問題

Long-form video QA は、2026 年規模でもっとも bandwidth を消費する multimodal problem である。Gemini 2.5 Pro は 2 時間の video を native に読めるが、100 時間の video を queryable corpus として取り込むには、依然として scene-level index が必要だ。本番構成は、scene segmentation (TransNetV2 または PySceneDetect)、VLM による scene ごとの captioning (Gemini 2.5、Qwen3-VL-Max、Molmo 2)、transcript alignment (word timestamp 付き Whisper-v3-turbo)、caption、frame embedding、transcript を並べて持つ multi-vector index を組み合わせる。Query pipeline は (start, end) timestamp と frame preview 付きで回答する。

Benchmark は public な ActivityNet-QA、NeXT-GQA に加え、自分で作る 100-query custom set を使う。Counting ("how many people enter the room?") と action-type ("does the chef pour before stirring?") の質問は既知の難所なので、この capstone では明示的に測定する。

## コンセプト

Ingest では 3 つの pipeline が並列に走る。**Scene segmentation** は video を scene に分割する。**VLM captioning** は scene ごとに caption を生成し、keyframe から frame embedding を作る。**ASR alignment** は word-level timestamp を生成する。3 つの stream は (scene_id, time range) で join される。各 scene は multi-vector index (Qdrant) に 3 種類の vector を持つ: caption embedding、keyframe embedding、transcript embedding。

Query 時には、natural-language question を 3 種類すべての vector に投げ、結果を RRF で merge し、TimeLens-style の temporal-grounding adapter が top scene 内の (start, end) window を refined する。VLM synthesizer (Gemini 2.5 Pro または Qwen3-VL-Max) は query + top scenes + cropped frames を受け取り、timestamp citation と frame preview 付きで回答する。

Hallucination measurement は重要だ。Counting ("how many people enter the room?") と action-type ("does the chef pour before stirring?") の質問は VLM で特に信頼しにくい。Descriptive question とは別に accuracy を報告する。

## アーキテクチャ

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

## スタック

- Scene segmentation: TransNetV2 (2024-26 の state-of-the-art) または PySceneDetect
- ASR: word timestamp 付き Whisper-v3-turbo via faster-whisper
- VLM captioner + answerer: Gemini 2.5 Pro または Qwen3-VL-Max または Molmo 2
- Temporal grounding: TimeLens-100K-trained adapter または VideoITG
- Index: multi-vector support 付き Qdrant (caption / frame / transcript)
- UI: HTML5 video player と scene thumbnail を備えた Next.js 15
- Eval: ActivityNet-QA、NeXT-GQA、hand-labeled custom 100-question set
- Hallucination benchmark: hand label を持つ counting subset と action-type subset

## 実装

1. **Ingest walker.** YouTube URL または local MP4 を受け付ける。必要なら 720p に downscale する。`{video_id, file_path}` を永続化する。

2. **Scene segmentation.** TransNetV2 または PySceneDetect を走らせ、`[{scene_id, start_ms, end_ms, keyframe_path}]` を生成する。100 時間ではおよそ 6k-8k scenes が目安。

3. **ASR pass.** Audio に Whisper-v3-turbo を実行し、word-level timestamp を export する。Transcript を scene ごとに slice する。

4. **VLM captioning.** Scene ごとに、keyframe と短い caption template を使って Gemini 2.5 Pro (または Qwen3-VL-Max) を呼ぶ。Caption + frame embedding を作る。

5. **Multi-vector index.** 3 つの named vector を持つ Qdrant collection。Payload は `{video_id, scene_id, start_ms, end_ms, keyframe_url}`。

6. **Query.** Natural-language question を 3 本の dense query として投げる。Reciprocal rank fusion で merge し、top-k=5 scenes を得る。

7. **Temporal grounding.** Top scene に TimeLens-style adapter を実行し、scene 内の (start, end) window を refined する。

8. **VLM synth.** Query + top-3 scene clips (image または short clip) + transcripts を与えて Gemini 2.5 Pro を呼ぶ。`(video_id, start_ms, end_ms)` citation を必須にする。

9. **Eval.** ActivityNet-QA と NeXT-GQA を実行する。100-query custom set を作る。Overall accuracy と question class ごとの breakdown (counting、action、descriptive) を報告する。

## 使ってみる

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

`outputs/skill-video-qa.md` が提出物である。YouTube URL または uploaded video を与えると、pipeline が scene を index し、timestamped citation 付きで質問に答える。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Temporal grounding IoU | Held-out grounding set 上の intersection-over-union |
| 20 | QA accuracy | NeXT-GQA と custom 100-query |
| 20 | Ingest throughput | 1 dollar あたりの video hours |
| 20 | UI and citation UX | Timestamp link、thumbnail strip、jump-to-frame |
| 15 | Hallucination rate | Counting と action-type の accuracy を別々に報告 |
| **100** | | |

## 演習

1. Captioning pass で Gemini 2.5 Pro を Qwen3-VL-Max に差し替える。Human-rated 50-scene sample で caption quality delta を報告する。

2. Scene ごとの frame embedding を multi-vector ではなく 1 つの pooled vector に減らす。Retrieval regression を測定する。

3. "counting strict" mode を作る: synthesizer が count した各 instance を timestamp 付きで抽出し、user が click して検証する。User-verification が hallucination を減らすか測る。

4. Ingest cost を benchmark する: 3 つの VLM choice で hours-of-video-per-dollar を比較し、sweet spot を選ぶ。

5. Speaker-diarized transcript を追加する: audio に pyannote speaker diarization を実行し、speaker ごとの transcript を embed する。"what did Alice say about X?" query を実演する。

## 重要用語

| Term | よくある言い方 | 実際の意味 |
|------|-----------------|------------|
| Scene segmentation | "Shot detection" | Shot boundary で video を scene に分割すること |
| Multi-vector index | "Caption + frame + transcript" | representation ごとに named vector を持つ Qdrant collection |
| Temporal grounding | "When exactly did it happen" | Query answer 用の (start, end) window を refine すること |
| Frame embedding | "Visual representation" | Keyframe の vector embedding。Scene visual similarity に使う |
| RRF fusion | "Reciprocal rank fusion" | 複数の ranked list を merge する戦略。古典的な hybrid-retrieval technique |
| Counting hallucination | "Miscount" | "how many X" 質問で VLM が数え間違える既知の failure mode |
| ActivityNet-QA | "Video-QA benchmark" | Long-form video QA accuracy benchmark |

## 参考資料

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) — open VLM checkpoint
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) — 大規模 temporal grounding
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) — hosted reference
- [VideoDB](https://videodb.io) — CRUD-for-video API reference
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) — commercial reference
- [TransNetV2](https://github.com/soCzech/TransNetV2) — scene segmentation model
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — classic open alternative
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) — reference eval benchmark
