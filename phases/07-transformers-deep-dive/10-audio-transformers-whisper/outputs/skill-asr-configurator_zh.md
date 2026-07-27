---
name: asr-configurator
description: 为新的语音流水线选择ASR模型（Whisper变体 / Moonshine / faster-whisper）和解码参数
version: 1.0.0
phase: 7
lesson: 10
tags: [transformers, whisper, asr, speech]
---

给定一个语音任务（转录 / 翻译 / 流式 / 设备端）、语言、音频特征（噪声、口音、时长）和延迟/质量目标，输出：

1. **模型选择**。选择以下之一：faster-whisper large-v3-turbo（生产环境默认）、whisper large-v3（最高质量、多语言）、whisper medium（中端）、Moonshine base（边缘设备）、distil-whisper（英文快2倍）。用一句话说明原因。

2. **量化**。int8_float16（CPU默认）、float16（GPU默认）、fp32（研究用途）。标记VRAM影响。

3. **解码**。束宽（典型值5，流式场景1）、温度回退策略、对数概率阈值、无语音阈值、VAD门控开关。

4. **分块**。30秒固定窗口 vs 流式分块（通常10秒+2秒重叠）+ 基于VAD的分段。说明重叠区域的后合并策略。

5. **后处理**。时间戳对齐（WhisperX强制对齐）、标点恢复、说话人分离（pyannote）。标记哪些是任务必需的。

拒绝在生产环境中推荐普通OpenAI Whisper（参考实现）——`faster-whisper`速度快4倍且输出相同。拒绝在没有VAD的情况下交付流式ASR，除非有文档化理由。标记任何单说话人假设，当输入可能为多人对话时。
