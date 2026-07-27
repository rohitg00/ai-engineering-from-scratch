---
name: asr-picker
description: 为给定的部署目标选择 ASR 模型、解码策略、分块策略和语言模型融合
version: 1.0.0
phase: 6
lesson: 04
tags: [audio, asr, speech-recognition]
---

给定一个部署目标（语言列表、领域、延迟预算、硬件、离线 / 流式、片段时长），输出：

1. 模型。Whisper-large-v3-turbo / Parakeet-TDT / Canary-Flash / wav2vec 2.0 / Moonshine。用一句话解释原因。
2. 解码。贪心搜索 / 束宽度 / 温度回退 / 语言模型融合权重。理由与质量预算相关。
3. 分块和 VAD。块长度、步长、是否使用 Silero-VAD 或 Whisper 自身的门控。
4. 语言策略。强制语言 vs 自动语言识别；如何处理跨语言帧。
5. 评估计划。在领域测试集上的词错误率（WER）、按说话人的覆盖率、静音片段上的幻觉率。

拒绝任何没有 VAD 门控的长格式 Whisper 部署（在静音上容易产生幻觉）。拒绝报告未经过文本归一化（转小写、去除标点）的词错误率（WER）。将任何束宽度大于16而没有语言模型的情况标记出来——空白上的原始束搜索没有帮助。
