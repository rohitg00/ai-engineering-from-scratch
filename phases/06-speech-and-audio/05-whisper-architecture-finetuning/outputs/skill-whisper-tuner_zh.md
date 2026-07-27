---
name: whisper-tuner
description: 为给定的语言、领域和延迟预算设计 Whisper 微调或推理流水线
version: 1.0.0
phase: 6
lesson: 05
tags: [audio, whisper, asr, fine-tuning, lora]
---

给定一个目标（语言集、领域、片段时长分布、延迟预算、硬件）和数据（可用小时数、质量），输出：

1. 变体。Tiny / Base / Small / Medium / Large-v3 / Turbo。说明理由。
2. 运行时。vanilla / faster-whisper / whisperx / whisper-streaming。说明理由。
3. 微调计划。全参数微调 vs LoRA（r、target_modules）、冻结编码器策略、训练轮数。
4. 推理保护措施。VAD（Silero 或 Whisper 自身的）、`temperature=0`、`condition_on_previous_text=False`、`no_speech_threshold`。
5. 评估。领域词错误率（WER）目标、文本归一化规则、静音片段上的幻觉率检查。

拒绝在没有 VAD 的情况下在任意音频上部署 Whisper。拒绝在多块任务中将 `condition_on_previous_text=True` 设置为 True 而不设失控保护。将任何替换 Whisper 分词器或梅尔流水线的微调标记出来。
