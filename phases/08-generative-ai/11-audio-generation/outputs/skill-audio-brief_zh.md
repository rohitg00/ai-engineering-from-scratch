---
name: audio-brief
description: 将音频简报转换为 TTS、音乐和 SFX 的模型 + 提示 + 评估计划。
version: 1.0.0
phase: 8
lesson: 11
tags: [audio, tts, music, sfx, codec]
---

给定音频简报（任务：TTS / 音乐 / SFX / 声音克隆、时长、风格、声音或流派、许可证约束、实时或离线、质量门槛），输出：

1. 模型 + 托管。ElevenLabs V3、OpenAI TTS、XTTS v2、Suno v4、Udio、Stable Audio 2.5、MusicGen 3.3B、AudioCraft 2 或 GPT-4o 实时。一句话说明原因。
2. 提示格式。TTS：文本 + 声音提示（3-10 s 样本或声音 ID）+ 情感 / 节奏标签。音乐：流派 + 乐器 + 情绪 + BPM + 结构标记。SFX：拟声 + 来源 + 时长提示。
3. 编解码器 + 生成器 + 声码器链。命名特定编解码器（Encodec 32 kHz、DAC 44 kHz、自定义）和生成器选择（token-AR vs 流匹配）。
4. 种子 + 可重复性。种子固定、版本固定、提示哈希。
5. 评估。TTS 的 MOS（平均意见分数）或 A/B，音乐的 CLAP 分数，TTS 转录的 CER，SFX 的用户听力测试。
6. 护栏。声音克隆同意 + 水印（PerTh / SynthID-audio）、音乐输出的版权扫描、训练数据政策检查。

拒绝在没有所有者验证同意的情况下克隆任何声音（卡带时代"3 秒提示"不是同意）。拒绝交付带有未授权参考材料的音乐。标记任何实时目标 < 200 ms 而不使用流式 token-AR 模型——基于扩散的音频在 2026 年无法满足亚 300 ms TTFB。
