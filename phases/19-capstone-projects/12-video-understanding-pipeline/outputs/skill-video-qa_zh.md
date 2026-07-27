---
name: video-qa
description: 构建一个视频理解管道，包含场景分割、多向量索引、时间定位和带时间戳的引用。
version: 1.0.0
phase: 19
lesson: 12
tags: [capstone, video, multimodal, gemini, qwen-vl, molmo, transnet, qdrant]
---

给定 100 小时的视频，构建一个摄取管道和一个查询系统，以自然语言问题回答（start, end）时间戳和帧预览。

构建计划：

1. 摄取视频（YouTube URL 或 MP4）；如果需要则降级到 720p。
2. 使用 TransNetV2 或 PySceneDetect 进行场景分割；输出 `[{scene_id, start_ms, end_ms, keyframe_path}]`。
3. 使用 Whisper-v3-turbo（faster-whisper）进行 ASR，生成词级时间戳；按场景切片。
4. 使用 Gemini 2.5 Pro 或 Qwen3-VL-Max 或 Molmo 2 进行 VLM 字幕生成；输出字幕 + 帧嵌入。
5. Qdrant 多向量索引，每个场景三个命名向量（caption_emb、frame_emb、transcript_emb）和负载 {video_id, scene_id, start_ms, end_ms, keyframe_url}。
6. 查询：三个并行稠密查询；倒数排名融合进行合并；top-k=5 个场景。
7. 时间定位（TimeLens 适配器或 VideoITG）在顶部场景内精炼（start, end）。
8. VLM 合成（Gemini 2.5 Pro），使用查询 + 前 3 个场景片段 + 转录；要求 `(video_id, start_ms, end_ms)` 引用。
9. 在 ActivityNet-QA、NeXT-GQA 以及 100 查询手工标记的自定义集上评估。报告总体准确率及按问题类别（描述性、计数、动作类型）的准确率。

评估量规：

| 权重 | 标准 | 衡量方法 |
|:-:|---|---|
| 25 | 时间定位 IoU | 在保留定位集上的 IoU |
| 20 | 问答准确率 | NeXT-GQA 和 100 查询自定义集 |
| 20 | 摄取吞吐量 | 每美元索引的视频小时数 |
| 20 | UI 和引用用户体验 | 时间戳链接、缩略图条、跳转到帧 |
| 15 | 幻觉率 | 分别报告的计数和动作类型准确率 |

硬性拒绝：

- 为每个场景池化单个向量的管道。多向量是显示类别区分所必需的。
- 没有（start, end）引用的答案。
- 报告一个总体准确率而不包含计数/动作子集分解。
- 不直接接收场景帧的 VLM 合成（仅文本输入丢失视觉定位）。

拒绝规则：

- 拒绝服务许可来源不清晰的视频；要求每个 video_id 都有许可标签。
- 拒绝在高于测量吞吐量的摄取速率下声称"实时"响应。
- 拒绝在总体准确率数字内隐藏计数/动作幻觉数字。

输出：一个包含场景分割 + ASR + 字幕生成管道、多向量 Qdrant 集合、时间定位适配器、带有时间戳深度链接的 Next.js 15 查看器、三基准评估结果（ActivityNet-QA、NeXT-GQA、自定义），以及一份指出您观察到的三种计数或动作类型失败类别及减少每种失败的检索或合成变更的仓库。
