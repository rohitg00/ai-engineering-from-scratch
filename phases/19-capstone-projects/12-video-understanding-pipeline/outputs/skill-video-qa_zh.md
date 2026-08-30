---
name: video-qa
description: 构建视频理解管道，具备场景分割、多向量索引、时间定位和带时间戳的引用。
version: 1.0.0
phase: 19
lesson: 12
tags: [capstone, video, multimodal, gemini, qwen-vl, molmo, transnet, qdrant]
---

给定100小时视频，构建摄取管道和查询系统，以(start, end)时间戳加帧预览回答自然语言问题。

构建计划：

1. 摄取视频（YouTube URL或MP4）；如需则降频到720p。
2. 用TransNetV2或PySceneDetect进行场景分割；发出`[{scene_id, start_ms, end_ms, keyframe_path}]`。
3. 用Whisper-v3-turbo（faster-whisper）进行ASR，产生词级时间戳；按场景切片。
4. 用Gemini 2.5 Pro或Qwen3-VL-Max或Molmo 2进行VLM字幕；发出字幕 + 帧嵌入。
5. Qdrant多向量索引，每场景三个命名向量（caption_emb、frame_emb、transcript_emb）和负载{video_id, scene_id, start_ms, end_ms, keyframe_url}。
6. 查询：三个并行密集查询；倒数排名融合合并；top-k=5场景。
7. 时间定位（TimeLens适配器或VideoITG）在top场景内细化(start, end)。
8. VLM合成（Gemini 2.5 Pro），含查询 + top-3场景片段 + 字幕；要求`(video_id, start_ms, end_ms)`引用。
9. 在ActivityNet-QA、NeXT-GQA及100查询手工标记自定义集上评估。报告整体准确率及每问题类别（描述性、计数、动作类型）。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | 时间定位IoU | 保留定位集上的IoU |
| 20 | QA准确率 | NeXT-GQA和100查询自定义集 |
| 20 | 摄取吞吐量 | 每美元索引的视频小时数 |
| 20 | UI和引用UX | 时间戳链接、缩略图条、跳转到帧 |
| 15 | 幻觉率 | 计数和动作类型准确率单独报告 |

硬性拒绝：
- 每场景池化单向量的管道。多向量是类别区分显示所必需的。
- 没有(start, end)引用的答案。
- 没有计数/动作子集分解的单一整体准确率报告。
- 不直接接收场景帧的VLM合成（纯文本输入失去视觉定位）。

拒绝规则：
- 拒绝提供许可证来源不明的视频；要求每个video_id的许可证标签。
- 拒绝声称在测量吞吐量之上的摄取速率下"实时"响应。
- 拒绝将计数/动作幻觉数字隐藏在整体准确率数字内。

输出：包含场景分割 + ASR + 字幕管道、多向量Qdrant集合、时间定位适配器、带时间戳深度链接的Next.js 15查看器、三基准评估结果（ActivityNet-QA、NeXT-GQA、自定义），以及一份说明观察到的三种计数或动作类型失败类别及减少每个的检索或合成变更的撰写的仓库。
