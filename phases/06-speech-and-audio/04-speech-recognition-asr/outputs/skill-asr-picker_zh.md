---
name: asr-picker
description: 为给定的部署目标选择 ASR 模型、解码策略、分块和 LM 融合方案。
version: 1.0.0
phase: 6
lesson: 04
tags: [audio, asr, speech-recognition]
---

给定一个部署目标（语言列表、领域、延迟预算、硬件、离线/流式、片段时长），输出：

1. 模型。Whisper-large-v3-turbo / Parakeet-TDT / Canary-Flash / wav2vec 2.0 / Moonshine。一句话说明原因。
2. 解码。贪心 / 束宽 / 温度回退 / LM 融合权重。原因与质量预算相关。
3. 分块和 VAD。分块长度、步幅，是否使用 Silero-VAD 或 Whisper 自带的 VAD 进行门控。
4. 语言策略。强制语言 vs 自动语言识别；如何处理跨语言帧。
5. 评估计划。领域测试集上的 WER、每说话人覆盖率、静音片段上的幻觉率。

拒绝任何没有 VAD 门控的长篇 Whisper 部署（在静音上容易产生幻觉）。拒绝在没有文本归一化（小写、去除标点）的情况下报告 WER。将任何束宽 > 16 但没有 LM 的设置标记为错误；原始束搜索对空白没有帮助。
