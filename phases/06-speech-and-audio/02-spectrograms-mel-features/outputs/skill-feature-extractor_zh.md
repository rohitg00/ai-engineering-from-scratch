---
name: feature-extractor
description: 选择特征类型、mel 数量、帧长/帧移和归一化方式，以匹配下游音频模型。
version: 1.0.0
phase: 6
lesson: 02
tags: [audio, features, spectrogram, mel]
---

给定一个目标模型（ASR / TTS / 分类器 / 说话人 / 音乐）和输入音频（采样率、领域），输出：

1. 特征类型。Log-mel、mel、MFCC、原始波形，或离散编解码器（EnCodec、SoundStream）。一句话说明原因。
2. Mel 数量和频率范围。`n_mels`、`fmin`、`fmax`。原因与领域（语音 vs 音乐）和模型目标相关。
3. 帧长和帧移。`frame_len`、`hop_len`、窗函数类型。原因与所需的时间分辨率相关。
4. 归一化。逐 utterance 均值/方差、全局统计量，或具有固定参考值的 dB；特征化前或特征化后。
5. 验证代码片段。Python 代码，打印 1 秒参考片段的结果形状、最小值/最大值、均值/标准差，并断言它们与训练时匹配。

拒绝交付帧长/帧移/mel 数量与目标模型已发布训练配置不一致的特征流水线。将任何用于 Whisper 或 Parakeet 的基于 MFCC 的设置标记为错误——这些模型使用 log-mel。将任何没有归一化断言的特征提取器标记为错误。
