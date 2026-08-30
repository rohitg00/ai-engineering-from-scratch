---
name: alm-picker
description: 为音频理解任务选择音频语言模型、基准子集、输出模态（文本 vs 语音）和防护栏。
version: 1.0.0
phase: 6
lesson: 10
tags: [alm, lalm, qwen-omni, audio-flamingo, gemini-audio, mmau]
---

给定任务（语音 / 声音 / 音乐 / 多音频 / 长音频、输出模态、延迟、许可证），输出：

1. 模型。Qwen2.5-Omni-7B · Qwen3-Omni · SALMONN · Audio Flamingo 3 · AF-Next · LTU · GAMA · Gemini 2.5 Pro (API) · GPT-4o Audio (API)。一句话说明原因。
2. 验证用的基准子集。MMAU-Pro 语音 / 声音 / 音乐 / 多音频 · LongAudioBench · AudioCaps · ClothoAQA。选择与用户任务匹配的轴。
3. 输出模态。仅文本 · 文本 + 语音（Qwen-Omni、GPT-4o Audio）。如需要，为额外的语音解码器预留预算。
4. 防护栏。当模型的多音频分数 &lt; 30%（接近随机）时，拒绝需要多音频比较的提示。对于 &gt; 10 分钟的输入，在 LALM 之前进行说话人分割。
5. 升级策略。何时应将任务回退到专用模型——Whisper 用于转录、BEATs 用于分类、pyannote 用于说话人分割。LALM 不是每个任务的最佳选择。

拒绝在没有验证模型在 MMAU-Pro 多音频子集上分数 &gt; 40% 的情况下交付多音频比较任务。拒绝没有上游说话人分割的长音频（&gt; 10 分钟）。标记任何使用供应商报告数字而没有独立重新验证的部署。

示例输入："合规审计：转录 10 分钟银行通话录音 + 检测客服是否阅读了强制披露声明。"

示例输出：
- 模型：Whisper-large-v3-turbo 用于转录 + Gemini 2.5 Pro（通过 API）用于转录文本上的披露检查 QA。直接在原始音频上使用 LALM 很诱人，但长音频 LALM 的准确性在 10 分钟后下降。
- 基准子集：MMAU-Pro 语音子集（Gemini 2.5 Pro = 73.4%）——涵盖语音推理轴。也在你自己的 50 通黄金通话集上进行抽查。
- 输出模态：仅文本。审计报告不需要语音输出。
- 防护栏：首先使用 pyannote 3.1 进行说话人分割；分别发送每说话人片段；记录每通电话的置信度分数。
- 升级策略：如果某通电话未通过披露检查，路由给人工审核员而不是自动标记。
