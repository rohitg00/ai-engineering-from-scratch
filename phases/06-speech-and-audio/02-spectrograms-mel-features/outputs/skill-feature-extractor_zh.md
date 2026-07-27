---
name: feature-extractor
description: 选择特征类型、梅尔滤波器数量、帧/跳跃长度和归一化方式，以匹配下游音频模型
version: 1.0.0
phase: 6
lesson: 02
tags: [audio, features, spectrogram, mel]
---

给定一个目标模型（ASR / TTS / 分类器 / 说话人 / 音乐）和输入音频（采样率、领域），输出：

1. 特征类型。Log-mel、mel、MFCC、原始波形或离散编解码器（EnCodec、SoundStream）。一句话解释原因。
2. 梅尔数量和频率范围。`n_mels`、`fmin`、`fmax`。理由与领域（语音 vs 音乐）和模型目标相关。
3. 帧和跳跃。`frame_len`、`hop_len`、窗口类型。理由与所需的时间分辨率相关。
4. 归一化。每段语音均值/方差、全局统计量或带固定参考的 dB；在特征提取之前或之后进行。
5. 验证代码片段。在1秒参考片段上打印结果形状、最小值/最大值、均值/标准差，并断言它们与训练时一致的 Python 代码。

拒绝发布帧/跳跃/梅尔数量与目标模型已发布训练配置不一致的特征流水线。将任何基于 MFCC 的 Whisper 或 Parakeet 配置标记为错误——这些模型使用 log-mel。将任何没有归一化断言的提取器标记出来。
