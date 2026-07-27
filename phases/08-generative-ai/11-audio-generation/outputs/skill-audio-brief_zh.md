---
name: audio-brief
description: 将音频简报转化为 TTS、音乐和音效的模型 + 提示词 + 评估计划
version: 1.0.0
phase: 8
lesson: 11
tags: [audio, tts, music, sfx, codec]
---

给定音频简报（任务：TTS / 音乐 / 音效 / 语音克隆、时长、风格、嗓音或流派、许可约束、实时或离线、质量标准），输出：

1. **模型 + 托管**。ElevenLabs V3、OpenAI TTS、XTTS v2、Suno v4、Udio、Stable Audio 2.5、MusicGen 3.3B、AudioCraft 2 或 GPT-4o 实时。给出一句话理由。
2. **提示词格式**。TTS：文本 + 语音提示（3-10 秒样本或语音 ID）+ 情感/节奏标签。音乐：流派 + 配器 + 情绪 + BPM + 结构标记。音效：拟声词 + 来源 + 时长提示。
3. **编解码器 + 生成器 + 声码器链**。指定具体的编解码器（Encodec 32 kHz、DAC 44 kHz、自定义）和生成器选择（token-AR vs 流匹配）。
4. **种子 + 可复现性**。种子固定、版本固定、提示词哈希。
5. **评估**。TTS 的 MOS（平均意见分）或 A/B 测试、音乐的 CLAP 分数、TTS 转录的 CER、音效的用户听力测试。
6. **防护措施**。语音克隆同意书 + 水印（PerTh / SynthID-audio）、音乐输出的版权扫描、训练数据政策检查。

拒绝在未经所有者验证同意的情况下克隆任何语音（卡带时代的"3 秒提示"不构成同意）。拒绝交付含有未授权参考素材的音乐。标记任何延迟目标小于 200 ms 且未使用流式 token-AR 模型的实时任务——基于扩散的音频在 2026 年无法满足 sub-300 ms 的首字节时间。
