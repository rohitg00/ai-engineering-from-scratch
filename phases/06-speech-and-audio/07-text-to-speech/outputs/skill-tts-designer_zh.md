---
name: tts-designer
description: 为给定的语言、风格和延迟目标选择 TTS 模型、音色、文本归一化范围和评估计划
version: 1.0.0
phase: 6
lesson: 07
tags: [audio, tts, speech-synthesis]
---

给定一个目标（语言、音色风格、延迟预算、CPU vs GPU、许可约束）和内容（领域、未登录词密度、标点丰富度），输出：

1. 模型。Kokoro / XTTS v2 / F5-TTS / VITS / StyleTTS 2 / 商业 API。一句话解释原因。
2. 文本前端。归一化范围（数字、日期、URL）、音素化工具（espeak-ng vs g2p-en）、未登录词回退。
3. 音色。预设名称或参考片段规格（时长、噪声底限、口音匹配）。
4. 质量目标。目标 UTMOS、通过 Whisper 的词错误率（CER）、克隆时的 SECS。
5. 评估计划。20句话的测试集，涵盖数字、同形异义词、专有名词、长句。

拒绝任何没有文本归一化器的生产级 TTS。拒绝未经用户同意和添加水印的音色克隆。将任何被要求说英语以外语言的 Kokoro 部署标记出来。
