---
name: audio-loader
description: 验证原始音频文件是否符合目标模型的期望，并安全地重采样
version: 1.0.0
phase: 6
lesson: 01
tags: [audio, speech, preprocessing]
---

给定一个音频文件（路径、声道数、采样率、位深度、编解码器）和一个目标模型（ASR / TTS / 分类器，具有所需的采样率和声道数），输出：

1. 不匹配项。列出文件与目标不匹配的每个维度（采样率、声道数、时长下限、削波检查）。
2. 重采样计划。源采样率、目标采样率、重采样库（`torchaudio.transforms.Resample` 或 `librosa.resample`）、抗混叠滤波器类型。
3. 声道计划。单声道折叠策略（均值 vs 仅左声道），或在模型支持多声道时直通。
4. 归一化。峰值 vs RMS 归一化、dBFS 目标、削波保护。
5. 验证代码片段。加载文件、运行变换并断言最终数组满足 `(target_sr, dtype, channel_count, range)` 的 Python 代码。

拒绝在没有抗混叠滤波器的情况下进行降采样。拒绝在没有重建滤波器的情况下进行超过2倍的上采样。将任何输入文件中削波峰值超过 ±0.999 或直流偏移超过 ±0.01 的情况标记出来。
