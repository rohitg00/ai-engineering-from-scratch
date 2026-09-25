# 毕业项目 12 — 视频理解流水线(场景、问答、搜索)

> Twelve Labs 将 Marengo + Pegasus 产品化。VideoDB 发布了面向视频的 CRUD API。AI2 的 Molmo 2 发布了开源 VLM 检查点。Gemini 长上下文可原生处理数小时的视频。TimeLens-100K 定义了大规模的时间定位。2026 年的流水线已经定型：场景切分、逐场景字幕 + 嵌入、转写对齐、多向量索引，以及一个返回 (start, end) 时间戳加帧预览的查询。本毕业项目要摄入 100 小时视频、达到公开基准水平，并测量计数类和动作类问题上的幻觉。

**Type:** 毕业项目
**Languages:** Python(流水线),TypeScript(UI)
**Prerequisites:** Phase 4(CV)、Phase 6(语音)、Phase 7(transformers)、Phase 11(LLM 工程)、Phase 12(多模态)、Phase 17(基础设施)
**Phases exercised:** P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 小时

## 问题

长视频问答是 2026 年规模下最消耗带宽的多模态问题。Gemini 2.5 Pro 可以原生读取 2 小时的视频，但把 100 小时视频摄入可查询语料库仍需要场景级索引。生产形态结合了场景切分(TransNetV2 或 PySceneDetect)、用 VLM 逐场景生成字幕(Gemini 2.5、Qwen3-VL-Max 或 Molmo 2)、转写对齐(带词级时间戳的 Whisper-v3-turbo),以及一个并排存储字幕、帧嵌入和转写的多向量索引。查询流水线以 (start, end) 时间戳加帧预览作答。

基准是公开的(ActivityNet-QA、NeXT-GQA),外加你自己的 100 条查询自定义集。计数类和动作类问题上的幻觉是已知的困难失败类别；本毕业项目将明确测量它。

## 概念

三条流水线在摄入时并行运行。**场景切分**将视频切成场景。**VLM 字幕生成**为每个场景生成一条字幕，并从关键帧生成帧嵌入。**ASR 对齐**产出词级时间戳。三路数据流通过 (scene_id, 时间区间) 关联。每个场景在多向量索引(Qdrant)中获得三种向量：字幕嵌入、关键帧嵌入、转写嵌入。

查询时，自然语言问题对三种向量发起检索；结果用 RRF 合并；一个时间定位适配器(TimeLens 风格)在顶部场景内细化 (start, end) 窗口。VLM 合成器(Gemini 2.5 Pro 或 Qwen3-VL-Max)接收查询 + 顶部场景 + 裁剪后的帧，并带引用时间戳和帧预览作答。

幻觉测量很重要。计数类(“有多少人走进房间？”)和动作类(“厨师是先倒东西还是先搅拌？”)问题出了名地不可靠。将其准确率与描述类问题分开报告。

## 架构

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

## 技术栈

- 场景切分:TransNetV2(2024-26 年最先进)或 PySceneDetect
- ASR:通过 faster-whisper 使用带词级时间戳的 Whisper-v3-turbo
- VLM 字幕生成 + 回答：Gemini 2.5 Pro 或 Qwen3-VL-Max 或 Molmo 2
- 时间定位：TimeLens-100K 训练的适配器或 VideoITG
- 索引：支持多向量的 Qdrant(字幕 / 帧 / 转写)
- UI:Next.js 15,带 HTML5 视频播放器和场景缩略图
- 评估：ActivityNet-QA、NeXT-GQA、自定义 100 题人工标注集
- 幻觉基准：人工标注的计数类和动作类子集

```figure
cf-scene-index
```

## 构建它

1. **摄入遍历器。** 接受 YouTube URL 或本地 MP4。必要时降采样到 720p。持久化 `{video_id, file_path}`。

2. **场景切分。** 运行 TransNetV2 或 PySceneDetect 产出 `[{scene_id, start_ms, end_ms, keyframe_path}]`。目标 100 小时：约 6k-8k 个场景。

3. **ASR 阶段。** 对音频运行 Whisper-v3-turbo;导出词级时间戳；按场景切分转写片段。

4. **VLM 字幕生成。** 对每个场景，用关键帧和一个简短的字幕模板调用 Gemini 2.5 Pro(或 Qwen3-VL-Max)。产出字幕 + 帧嵌入。

5. **多向量索引。** 带三个命名向量的 Qdrant collection。Payload:`{video_id, scene_id, start_ms, end_ms, keyframe_url}`。

6. **查询。** 自然语言问题发起三个稠密向量查询；用倒数排序融合合并；top-k=5 个场景。

7. **时间定位。** 在顶部场景上运行 TimeLens 风格的适配器，在场景内细化 (start, end) 窗口。

8. **VLM 合成。** 用查询 + top-3 场景片段(图片或短视频)+ 转写调用 Gemini 2.5 Pro。要求 `(video_id, start_ms, end_ms)` 引用。

9. **评估。** 运行 ActivityNet-QA 和 NeXT-GQA。构建 100 条查询的自定义集。报告总体准确率 + 分类别细分(计数、动作、描述)。

## 使用它

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

## 交付它

`outputs/skill-video-qa.md` 是交付物。给定一个 YouTube URL 或上传的视频，流水线对场景建立索引，并带时间戳引用回答问题。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 时间定位 IoU | 在留出定位集上的交并比 |
| 20 | QA 准确率 | NeXT-GQA 和自定义 100 条查询 |
| 20 | 摄入吞吐量 | 每美元可处理的视频小时数 |
| 20 | UI 与引用体验 | 时间戳链接、缩略图条、跳转到帧 |
| 15 | 幻觉率 | 计数类和动作类准确率分开报告 |
| **100** | | |

## 练习

1. 在字幕生成阶段将 Gemini 2.5 Pro 换成 Qwen3-VL-Max。在人工评分的 50 场景样本上报告字幕质量差异。

2. 将逐场景帧嵌入缩减为一个池化向量，而非多向量。测量检索性能的退化。

3. 构建“严格计数”模式：合成器为每个被计数的实例提取带时间戳的条目，用户点击验证。测量用户验证是否能降低幻觉。

4. 基准测试摄入成本：比较三种 VLM 选择的每美元视频小时数。选择最佳平衡点。

5. 增加说话人分离转写：对音频运行 pyannote 说话人分离，并按说话人嵌入转写。演示“Alice 关于 X 说了什么？”这类查询。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 场景切分 | “镜头检测” | 在镜头边界处将视频切分为场景 |
| 多向量索引 | “字幕 + 帧 + 转写” | 带按表示划分的命名向量的 Qdrant collection |
| 时间定位 | “它到底发生在什么时候” | 为查询答案细化 (start, end) 窗口 |
| 帧嵌入 | “视觉表示” | 关键帧的向量嵌入；用于场景视觉相似度 |
| RRF 融合 | “倒数排序融合” | 跨多个排序列表的合并策略；经典的混合检索技巧 |
| 计数幻觉 | “数错” | VLM 在“有多少个 X”问题上的已知失败模式 |
| ActivityNet-QA | “视频问答基准” | 长视频问答准确率基准 |

## 延伸阅读

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) — 开源 VLM 检查点
- [TimeLens(CVPR 2026)](https://github.com/TencentARC/TimeLens) — 大规模时间定位
- [Gemini Video 长上下文](https://deepmind.google/technologies/gemini) — 托管参考实现
- [VideoDB](https://videodb.io) — 面向视频的 CRUD API 参考
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) — 商业参考
- [TransNetV2](https://github.com/soCzech/TransNetV2) — 场景切分模型
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — 经典开源替代方案
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) — 参考评估基准