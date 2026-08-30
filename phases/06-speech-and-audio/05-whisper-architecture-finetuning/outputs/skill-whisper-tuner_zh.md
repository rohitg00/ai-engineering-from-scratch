---
name: whisper-tuner
description: 针对给定的语言、领域和延迟预算，设计 Whisper 微调或推理流水线。
version: 1.0.0
phase: 6
lesson: 05
tags: [audio, whisper, asr, fine-tuning, lora]
---

给定一个目标（语言集、领域、片段长度分布、延迟预算、硬件）和数据（可用小时数、质量），输出：

1. 变体。Tiny / Base / Small / Medium / Large-v3 / Turbo。说明原因。
2. 运行时。vanilla / faster-whisper / whisperx / whisper-streaming。说明原因。
3. 微调计划。Full-FT vs LoRA（r、target_modules）、编码器冻结策略、epoch 数。
4. 推理防护。VAD（Silero 或 Whisper 自带的）、`temperature=0`、`condition_on_previous_text=False`、`no_speech_threshold`。
5. 评估。领域 WER 目标、文本归一化规则、静音片段上的幻觉率检查。

拒绝在任意音频上部署 Whisper 而不使用 VAD。拒绝在没有失控保护的情况下为多分块任务设置 `condition_on_previous_text=True`。将任何替换 Whisper 分词器或 mel 流水线的微调标记为错误。
