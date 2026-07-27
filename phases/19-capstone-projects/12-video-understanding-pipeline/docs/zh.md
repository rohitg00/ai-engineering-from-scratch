# 顶点项目 12 — 视频理解流水线（场景、问答、搜索）

> Twelve Labs 将 Marengo + Pegasus 产品化。VideoDB 推出了视频 CRUD API。AI2 的 Molmo 2 发布了开源 VLM 检查点。Gemini 长上下文原生支持处理数小时的视频。TimeLens-100K 在大规模时间定位方面定义了标准。2026 年的流水线架构已趋于成熟：场景分割、逐场景字幕 + 嵌入、转录文本对齐、多向量索引，以及能够返回（开始、结束）时间戳和帧预览的查询。本顶点项目涉及摄取 100 小时视频、在公开基准上测试，并测量计数和动作类问题上的幻觉。

**类型：** 顶点项目
**语言：** Python（流水线）、TypeScript（UI）
**前置条件：** 阶段 4（计算机视觉）、阶段 6（语音）、阶段 7（Transformer）、阶段 11（大语言模型工程）、阶段 12（多模态）、阶段 17（基础设施）
**涉及阶段：** P4 · P6 · P7 · P11 · P12 · P17
**时间：** 30 小时

## 问题

长视频问答是 2026 年规模下带宽消耗最大的多模态问题。Gemini 2.5 Pro 可以原生读取 2 小时的视频，但要将 100 小时视频摄入到可查询的语料库中，仍然需要场景级别的索引。生产环境的方案结合了场景分割（TransNetV2 或 PySceneDetect）、使用 VLM（Gemini 2.5、Qwen3-VL-Max 或 Molmo 2）对每个场景进行字幕生成、转录文本对齐（带单词时间戳的 Whisper-v3-turbo），以及一个存储字幕、帧嵌入和转录文本的多向量索引。查询流水线返回（开始、结束）时间戳和帧预览。

基准测试包括公开数据集（ActivityNet-QA、NeXT-GQA）以及您自己定制的 100 条查询集。计数和动作类问题上的幻觉是已知的难点故障类别；本顶点项目将显式对其进行测量。

## 概念

三条流水线在摄入时并行运行。**场景分割**将视频切割成场景。**VLM 字幕生成**为每个场景生成字幕以及关键帧的帧嵌入。**ASR 对齐**生成单词级别的时间戳。三条流通过（scene_id，时间范围）进行连接。每个场景在多向量索引（Qdrant）中获得三种向量类型：字幕嵌入、关键帧嵌入、转录文本嵌入。

查询时，自然语言问题同时查询所有三个向量；结果使用 RRF 合并；一个时间定位适配器（TimeLens 风格）在最佳场景内细化（开始、结束）时间窗口。VLM 合成器（Gemini 2.5 Pro 或 Qwen3-VL-Max）接收查询 + 最佳场景 + 裁剪帧，并返回带引用时间戳和帧预览的答案。

幻觉测量至关重要。计数（"有多少人进入房间？"）和动作类（"厨师在搅拌之前倒水了吗？"）问题臭名昭著地不可靠。请将这类问题的准确率与描述性问题分开报告。

## 架构

```
视频文件 / URL
      |
      v
PySceneDetect / TransNetV2  （场景分割）
      |
      +--- 逐场景关键帧 --- VLM 字幕 + 帧嵌入
      |                       （Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2）
      |
      +--- 音频通道 --- Whisper-v3-turbo ASR + 单词时间戳
      |
      v
多向量 Qdrant：{caption_emb, keyframe_emb, transcript_emb}
      |
查询：
  Dense 查询针对所有三个向量 -> RRF 合并 -> top-k 场景
      |
      v
TimeLens / VideoITG 时间定位（在场景内细化开始/结束时间）
      |
      v
VLM 合成：查询 + 最佳场景 + 帧预览
      |
      v
答案 +（开始、结束）时间戳 + 帧缩略图 + 引用
```

## 技术栈

- 场景分割：TransNetV2（2024-2026 年最先进技术）或 PySceneDetect
- ASR：通过 faster-whisper 使用 Whisper-v3-turbo，带单词时间戳
- VLM 字幕生成 + 问答：Gemini 2.5 Pro 或 Qwen3-VL-Max 或 Molmo 2
- 时间定位：TimeLens-100K 训练的适配器或 VideoITG
- 索引：支持多向量的 Qdrant（字幕 / 帧 / 转录文本）
- UI：Next.js 15，带 HTML5 视频播放器和场景缩略图
- 评估：ActivityNet-QA、NeXT-GQA、自定义 100 条手工标注查询集
- 幻觉基准：计数和动作类子集，带手工标注标签

## 构建步骤

1. **摄入遍历器。** 接受 YouTube URL 或本地 MP4。如有需要，降采样至 720p。持久化 `{video_id, file_path}`。

2. **场景分割。** 运行 TransNetV2 或 PySceneDetect 生成 `[{scene_id, start_ms, end_ms, keyframe_path}]`。目标 100 小时视频：约 6000-8000 个场景。

3. **ASR 处理。** 在音频上运行 Whisper-v3-turbo；导出单词级别的时间戳；拆分为逐场景转录文本片段。

4. **VLM 字幕生成。** 对每个场景，使用关键帧和简短字幕模板调用 Gemini 2.5 Pro（或 Qwen3-VL-Max）。生成字幕 + 帧嵌入。

5. **多向量索引。** Qdrant 集合，包含三个命名向量。载荷：`{video_id, scene_id, start_ms, end_ms, keyframe_url}`。

6. **查询。** 自然语言问题触发三个 dense 查询；使用倒数排名融合进行合并；取 top-k=5 个场景。

7. **时间定位。** 在最佳场景上运行 TimeLens 风格适配器，细化场景内的（开始、结束）时间窗口。

8. **VLM 合成。** 使用查询 + top-3 场景片段（图像或短视频片段）+ 转录文本调用 Gemini 2.5 Pro。要求包含 `(video_id, start_ms, end_ms)` 引用。

9. **评估。** 运行 ActivityNet-QA 和 NeXT-GQA。构建 100 条自定义查询集。报告总体准确率 + 按类别（计数、动作、描述）的细分结果。

## 使用示例

```
$ video-qa ask --url=https://youtube.com/watch?v=X "第一分钟有多少辆车通过十字路口？"
[scene]    检测到 23 个场景
[asr]      转录完成，时长 4 分 12 秒
[index]    写入 69 个向量（23 个场景 × 3）
[query]    最佳场景：场景 3 [01:32-01:54]，置信度 0.84
[ground]   细化时间窗口：[00:12-00:58]
[synth]    gemini 2.5 pro，1.4 秒
answer:    在 00:12 到 00:58 之间有 5 辆车通过十字路口。
citations: [场景 3：00:12-00:58]
          [帧预览在 00:14, 00:27, 00:44, 00:51, 00:57]
```

## 交付物

`outputs/skill-video-qa.md` 为交付文件。给定 YouTube URL 或上传的视频，流水线将索引场景并回答带有时间戳引用的问题。

| 权重 | 评估标准 | 测量方式 |
|:-:|---|---|
| 25 | 时间定位 IoU | 在预留时间定位集上的交并比 |
| 20 | QA 准确率 | NeXT-GQA 和自定义 100 条查询 |
| 20 | 摄入吞吐量 | 每美元可处理的视频小时数 |
| 20 | UI 和引用体验 | 时间戳链接、缩略图条、跳转到帧 |
| 15 | 幻觉率 | 计数和动作类准确率单独统计 |
| **100** | | |

## 练习

1. 将字幕生成中的 Gemini 2.5 Pro 替换为 Qwen3-VL-Max。在人工评分的 50 场景样本上报告字幕质量差异。

2. 将每场景帧嵌入减少为一个池化向量而非多向量。测量检索性能的退化程度。

3. 构建"严格计数"模式：合成器提取每个计数实例及其时间戳，用户点击验证。测量用户验证是否能减少幻觉。

4. 基准测试摄入成本：三种 VLM 选择下的每美元视频小时数。找出最佳性价比方案。

5. 添加说话人分离转录文本：在音频上运行 pyannote 说话人分离并嵌入每说话人的转录文本。演示"关于 X，Alice 说了什么？"类型的查询。

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|----------|----------|
| 场景分割（Scene segmentation） | "镜头检测" | 在镜头边界处将视频切割成场景 |
| 多向量索引（Multi-vector index） | "字幕 + 帧 + 转录文本" | 每种表示对应一个命名向量的 Qdrant 集合 |
| 时间定位（Temporal grounding） | "确切发生在什么时候" | 细化查询答案的（开始、结束）时间窗口 |
| 帧嵌入（Frame embedding） | "视觉表示" | 关键帧的向量嵌入；用于场景视觉相似度 |
| RRF 融合（RRF fusion） | "倒数排名融合" | 跨多个排序列表的合并策略；经典的混合检索技巧 |
| 计数幻觉（Counting hallucination） | "数错" | VLM 在"有多少个 X"类问题上的已知失效模式 |
| ActivityNet-QA | "视频问答基准" | 长视频问答准确率基准 |

## 延伸阅读

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) — 开源 VLM 检查点
- [TimeLens（CVPR 2026）](https://github.com/TencentARC/TimeLens) — 大规模时间定位
- [Gemini 视频长上下文](https://deepmind.google/technologies/gemini) — 托管参考实现
- [VideoDB](https://videodb.io) — 视频 CRUD API 参考
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) — 商业参考
- [TransNetV2](https://github.com/soCzech/TransNetV2) — 场景分割模型
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — 经典开源替代方案
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) — 参考评估基准
