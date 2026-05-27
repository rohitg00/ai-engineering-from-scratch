# 综合项目 12 — 视频理解管道（场景、QA、搜索）

> Twelve Labs 产品化了 Marengo + Pegasus。VideoDB 发布了视频 CRUD API。AI2 的 Molmo 2 发布了开源 VLM 检查点。Gemini 长上下文原生处理数小时视频。TimeLens-100K 定义了大规模时间定位。2026 年的管道形态已定：场景分割、每场景描述 + 嵌入、字幕对齐、多向量索引，以及一个用（开始、结束）时间戳加上帧预览来回答的查询。本综合项目是摄取 100 小时，冲击公共基准测试，并测量计数和动作问题的幻觉。

**类型：** 综合项目
**语言：** Python（管道）、TypeScript（UI）
**前置条件：** 第 4 阶段（CV）、第 6 阶段（语音）、第 7 阶段（Transformer）、第 11 阶段（LLM 工程）、第 12 阶段（多模态）、第 17 阶段（基础设施）
**涉及阶段：** P4 · P6 · P7 · P11 · P12 · P17
**时间：** 30 小时

## 问题描述

长格式视频 QA 是 2026 年规模下最消耗带宽的多模态问题。Gemini 2.5 Pro 可以原生读取 2 小时视频，但将 100 小时视频摄取到可查询语料库仍然需要场景级索引。生产形态结合了场景分割（TransNetV2 或 PySceneDetect）、使用 VLM（Gemini 2.5、Qwen3-VL-Max 或 Molmo 2）的每场景描述、字幕对齐（带有词级时间戳的 Whisper-v3-turbo），以及存储描述、帧嵌入和字幕侧 by side 的多向量索引。查询管道用（开始、结束）时间戳加上帧预览来回答。

基准测试是公开的（ActivityNet-QA、NeXT-GQA）加上你自己的 100 查询自定义集。计数和动作类型问题的幻觉是已知的困难失败类别；本综合项目明确测量它。

## 核心概念

三个管道在摄取时并行运行。**场景分割**将视频切割成场景。**VLM 描述**为每个场景生成描述和关键帧嵌入。**ASR 对齐**产生词级时间戳。三个流通过（scene_id、时间范围）连接。每个场景在多向量索引（Qdrant）中获得三种向量类型：描述嵌入、关键帧嵌入、字幕嵌入。

在查询时，自然语言问题针对所有三个向量触发；结果用 RRF 合并；时间定位适配器（TimeLens 风格）在 top 场景内优化（开始、结束）窗口。VLM 合成器（Gemini 2.5 Pro 或 Qwen3-VL-Max）接收查询 + top 场景 + 裁剪的帧，并用引用的时间戳和帧预览来回答。

幻觉测量很重要。计数（"有多少人进入房间？"）和动作类型（"厨师在搅拌前倒吗？"）问题出了名地不可靠。与描述性问题分开报告准确性。

## 架构

```
视频文件 / URL
      |
      v
PySceneDetect / TransNetV2  （场景分割）
      |
      +--- 每场景关键帧 --- VLM 描述 + 帧嵌入
      |                            （Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2）
      |
      +--- 音频通道 --- Whisper-v3-turbo ASR + 词级时间戳
      |
      v
多向量 Qdrant：{caption_emb, keyframe_emb, transcript_emb}
      |
查询：
  针对所有三个的稠密查询 -> RRF 合并 -> top-k 场景
      |
      v
TimeLens / VideoITG 时间定位（优化场景内的开始/结束）
      |
      v
VLM 合成：查询 + top 场景 + 帧预览
      |
      v
回答 +（开始，结束）时间戳 + 帧缩略图 + 引用
```

## 技术栈

- 场景分割：TransNetV2（2024-26 年最先进）或 PySceneDetect
- ASR：通过 faster-whisper 的 Whisper-v3-turbo，带有词级时间戳
- VLM 描述器 + 回答器：Gemini 2.5 Pro 或 Qwen3-VL-Max 或 Molmo 2
- 时间定位：TimeLens-100K 训练的适配器或 VideoITG
- 索引：支持多向量的 Qdrant（描述 / 帧 / 字幕）
- UI：带有 HTML5 视频播放器和场景缩略图的 Next.js 15
- 评估：ActivityNet-QA、NeXT-GQA、自定义 100 问题手工标注集
- 幻觉基准测试：带有手工标签的计数和动作类型子集

## 构建步骤

1. **摄取遍历器。** 接受 YouTube URL 或本地 MP4。必要时下缩到 720p。持久化 `{video_id, file_path}`。

2. **场景分割。** 运行 TransNetV2 或 PySceneDetect 以产生 `[{scene_id, start_ms, end_ms, keyframe_path}]`。目标 100 小时：约 6k-8k 个场景。

3. **ASR 传递。** 在音频上运行 Whisper-v3-turbo；导出词级时间戳；分割成每场景字幕切片。

4. **VLM 描述。** 每个场景，使用关键帧和短描述模板调用 Gemini 2.5 Pro（或 Qwen3-VL-Max）。生成描述 + 帧嵌入。

5. **多向量索引。** 带有三个命名向量的 Qdrant 集合。载荷：`{video_id, scene_id, start_ms, end_ms, keyframe_url}`。

6. **查询。** 自然语言问题触发三个稠密查询；用倒数排名融合合并；top-k=5 个场景。

7. **时间定位。** 在 top 场景上运行 TimeLens 风格的适配器，以优化场景内的（开始，结束）窗口。

8. **VLM 合成。** 使用查询 + top-3 场景剪辑（作为图像或短剪辑）+ 字幕调用 Gemini 2.5 Pro。要求 `(video_id, start_ms, end_ms)` 引用。

9. **评估。** 运行 ActivityNet-QA 和 NeXT-GQA。构建一个 100 查询的自定义集。报告总体准确性 + 每类别细分（计数、动作、描述）。

## 使用示例

```
$ video-qa ask --url=https://youtube.com/watch?v=X "在第一分钟有多少辆车通过十字路口？"
[scene]    检测到 23 个场景
[asr]       字幕完成，4 分 12 秒
[index]    写入 69 个向量（23 个场景 x 3）
[query]     top 场景：场景 3 [01:32-01:54]，置信度 0.84
[ground]   优化窗口：[00:12-00:58]
[synth]     gemini 2.5 pro，1.4s
回答：      5 辆车在 00:12 和 00:58 之间通过十字路口。
引用：[场景 3：00:12-00:58]
           [00:14、00:27、00:44、00:51、00:57 处的帧预览]
```

## 交付成果

`outputs/skill-video-qa.md` 是可交付成果。给定一个 YouTube URL 或上传的视频，管道索引场景并用带有时间戳的引用回答问题。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 时间定位 IoU | 在留出定位集上的交并比 |
| 20 | QA 准确性 | NeXT-GQA 和自定义 100 查询 |
| 20 | 摄取吞吐量 | 每花费美元的视频小时数 |
| 20 | UI 和引用 UX | 时间戳链接、缩略图条、跳转到帧 |
| 15 | 幻觉率 | 分开的计数和动作类型准确性 |
| **100** | | |

## 练习

1. 在描述传递上将 Gemini 2.5 Pro 换为 Qwen3-VL-Max。在人工评级的 50 场景样本上报告描述质量差异。

2. 将每场景帧嵌入减少到单个池化向量，而不是多向量。测量检索回归。

3. 构建一个"严格计数"模式：合成器用时间戳提取每个计数的实例，用户点击验证。测量用户验证是否减少幻觉。

4. 基准测试摄取成本：跨三个 VLM 选择的每美元视频小时数。挑选最佳点。

5. 添加说话人分类字幕：在音频上运行 pyannote 说话人分类，并嵌入每说话人字幕。演示"Alice 对 X 说了什么？"查询。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 场景分割 | "镜头检测" | 在镜头边界将视频切割成场景 |
| 多向量索引 | "描述+帧+字幕" | 每个表示带有命名向量的 Qdrant 集合 |
| 时间定位 | "确切发生在什么时候" | 为查询回答优化（开始，结束）窗口 |
| 帧嵌入 | "视觉表示" | 关键帧的向量嵌入；用于场景视觉相似性 |
| RRF 融合 | "倒数排名融合" | 跨多个排序列表的合并策略；经典的混合检索技巧 |
| 计数幻觉 | "计数错误" | VLM 在"多少 X"问题上的已知失败模式 |
| ActivityNet-QA | "视频 QA 基准" | 长格式视频 QA 准确性基准测试 |

## 延伸阅读

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) — 开源 VLM 检查点
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) — 大规模时间定位
- [Gemini 视频长上下文](https://deepmind.google/technologies/gemini) — 托管参考
- [VideoDB](https://videodb.io) — 视频 CRUD API 参考
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) — 商业参考
- [TransNetV2](https://github.com/soCzech/TransNetV2) — 场景分割模型
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — 经典开源替代方案
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) — 参考评估基准
