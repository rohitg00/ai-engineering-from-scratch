# Capstone 12 — 视频理解流水线（场景、QA、搜索）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Twelve Labs 把 Marengo + Pegasus 产品化。VideoDB 推出了「视频版 CRUD」API。AI2 的 Molmo 2 公开了开放 VLM checkpoint。Gemini 长上下文原生处理数小时视频。TimeLens-100K 在大规模上定义了 temporal grounding（时间定位）。2026 年的流水线已经定型：场景切分、逐场景 caption + embedding、转录对齐、多向量索引，以及一条能用 (start, end) 时间戳加帧预览来回答的查询。本 capstone 的目标是吞下 100 小时素材、跑通公开 benchmark，并测量计数题与动作题上的 hallucination（幻觉）率。

**Type:** Capstone
**Languages:** Python（流水线）、TypeScript（UI）
**Prerequisites:** Phase 4（CV）、Phase 6（语音）、Phase 7（transformers）、Phase 11（LLM 工程）、Phase 12（多模态）、Phase 17（基础设施）
**Phases exercised:** P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 hours

## 问题（Problem）

长视频 QA 是 2026 规模下最吃带宽的多模态问题。Gemini 2.5 Pro 能原生读完一段 2 小时视频，但要把 100 小时视频装进可查询的语料库，仍需要一份场景级索引。生产形态由几部分组成：场景切分（TransNetV2 或 PySceneDetect）、用 VLM 做的逐场景 captioning（Gemini 2.5、Qwen3-VL-Max 或 Molmo 2）、转录对齐（带词级时间戳的 Whisper-v3-turbo），以及一份并排存放 caption、帧 embedding 和 transcript 的多向量索引。查询流水线返回的是 (start, end) 时间戳加帧预览。

Benchmark 是公开的（ActivityNet-QA、NeXT-GQA）外加你自己的 100 题自定义集。计数题和动作类问题上的 hallucination 是公认的硬骨头失败类别；本 capstone 显式地测量它。

## 概念（Concept）

ingest 阶段并行跑三条流水线。**场景切分（Scene segmentation）** 把视频切成场景。**VLM captioning** 为每个场景生成一段 caption，并从关键帧得到一个帧 embedding。**ASR 对齐（ASR alignment）** 产出词级时间戳。三股流通过 (scene_id, time range) 联接。每个场景在多向量索引（Qdrant）里拿到三种向量：caption embedding、关键帧 embedding、transcript embedding。

查询时，自然语言问题对三种向量同时发起检索；结果用 RRF 合并；一个 temporal-grounding 适配器（TimeLens 风格）在排名第一的场景内细化 (start, end) 窗口。VLM 合成器（Gemini 2.5 Pro 或 Qwen3-VL-Max）拿到 query + top 场景 + 裁剪过的帧，给出带时间戳引用和帧预览的答案。

hallucination 测量很关键。计数题（"几个人走进了房间？"）和动作类（"厨师是先倒还是先搅？"）出了名地不靠谱。要把它们的准确率与描述类问题分开汇报。

## 架构（Architecture）

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

## 技术栈（Stack）

- 场景切分：TransNetV2（2024-26 SOTA）或 PySceneDetect
- ASR：通过 faster-whisper 跑 Whisper-v3-turbo，开词级时间戳
- VLM captioner + 答题器：Gemini 2.5 Pro、Qwen3-VL-Max 或 Molmo 2
- Temporal grounding：TimeLens-100K 训练的适配器，或 VideoITG
- 索引：支持多向量的 Qdrant（caption / frame / transcript）
- UI：Next.js 15 + HTML5 视频播放器 + 场景缩略图
- 评估：ActivityNet-QA、NeXT-GQA、自定义 100 题手工标注集
- Hallucination benchmark：计数题与动作题子集，附手工标签

## 动手实现（Build It）

1. **Ingest walker。** 接收 YouTube URL 或本地 MP4。必要时降采样到 720p。持久化 `{video_id, file_path}`。

2. **场景切分（Scene segmentation）。** 跑 TransNetV2 或 PySceneDetect，产出 `[{scene_id, start_ms, end_ms, keyframe_path}]`。目标 100 小时：约 6k-8k 场景。

3. **ASR pass。** 在音轨上跑 Whisper-v3-turbo；导出词级时间戳；按场景切成片段。

4. **VLM captioning。** 对每个场景，用 Gemini 2.5 Pro（或 Qwen3-VL-Max）配关键帧和一段简短 caption 模板调用。产出 caption + 帧 embedding。

5. **多向量索引。** Qdrant collection 含三个具名向量。Payload：`{video_id, scene_id, start_ms, end_ms, keyframe_url}`。

6. **查询。** 自然语言问题触发三路 dense 查询；用 reciprocal rank fusion 合并；top-k=5 场景。

7. **Temporal grounding。** 在排名第一的场景上跑 TimeLens 风格适配器，以细化场景内 (start, end) 窗口。

8. **VLM synth。** 用 query + top-3 场景片段（图像或短片）+ transcript 调 Gemini 2.5 Pro。要求 `(video_id, start_ms, end_ms)` 引用。

9. **评估（Eval）。** 跑 ActivityNet-QA 和 NeXT-GQA。建一个 100 题的自定义集。汇报总体准确率，并按类别细分（计数、动作、描述）。

## 用起来（Use It）

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

## 上线部署（Ship It）

`outputs/skill-video-qa.md` 是交付物。给定一个 YouTube URL 或上传的视频，流水线把场景索引化，并以带时间戳引用的方式回答问题。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Temporal grounding IoU | 在保留 grounding 集上的 IoU |
| 20 | QA 准确率 | NeXT-GQA 与自定义 100 题 |
| 20 | Ingest 吞吐 | 每美元能处理的视频小时数 |
| 20 | UI 与引用 UX | 时间戳跳转链接、缩略图条、跳到帧 |
| 15 | Hallucination 率 | 计数题与动作题分别汇报准确率 |
| **100** | | |

## 练习（Exercises）

1. 在 captioning 这一遍把 Gemini 2.5 Pro 换成 Qwen3-VL-Max。在一份 50 场景的人评样本上汇报 caption 质量差值。

2. 把每场景的帧 embedding 由多向量改成一份 pool 后的单向量。测量检索回归幅度。

3. 做一个「严格计数」模式：合成器把每个被计数实例连同时间戳分别抽出，由用户点击核验。测量用户核验是否能压低 hallucination。

4. Benchmark ingest 成本：在三种 VLM 之间比较「每美元视频小时数」。挑出甜点位。

5. 加上带说话人区分的 transcript：在音频上跑 pyannote 说话人 diarization，并按说话人分别 embed transcript。演示「Alice 关于 X 说了什么？」这类查询。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| 场景切分（Scene segmentation） | "Shot detection" | 在镜头边界处把视频切成场景 |
| 多向量索引（Multi-vector index） | "Caption + frame + transcript" | 每种表征一个具名向量的 Qdrant collection |
| Temporal grounding | "When exactly did it happen" | 为查询答案细化 (start, end) 窗口 |
| 帧 embedding | "Visual representation" | 关键帧的向量 embedding；用于场景视觉相似度 |
| RRF fusion | "Reciprocal rank fusion" | 跨多个排名列表的合并策略；混合检索的经典套路 |
| Counting hallucination | "Miscount" | VLM 在「多少个 X」问题上公认的失败模式 |
| ActivityNet-QA | "Video-QA benchmark" | 长视频 QA 准确率 benchmark |

## 延伸阅读（Further Reading）

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) — 开放 VLM checkpoint
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) — 大规模 temporal grounding
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) — 托管参考实现
- [VideoDB](https://videodb.io) — 视频版 CRUD API 参考
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) — 商业参考
- [TransNetV2](https://github.com/soCzech/TransNetV2) — 场景切分模型
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — 经典开源替代
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) — 参考评估 benchmark
