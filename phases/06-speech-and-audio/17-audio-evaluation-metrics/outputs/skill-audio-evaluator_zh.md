---
name: audio-evaluator
description: 为任何音频模型发布选择指标、基准、归一化规则和报告格式
version: 1.0.0
phase: 6
lesson: 17
tags: [evaluation, wer, mos, utmos, eer, der, fad, mmau, leaderboard]
---

给定任务（ASR / TTS / 克隆 / 说话人确认 / 声纹分割 / 分类 / 音乐 / 音频语言模型 / 流式语音到语音），输出：

1. 主要指标。WER · MOS · UTMOS · SECS · EER · DER · mAP · FAD · MMAU-Pro 准确率 · 延迟 P95。选择一个。
2. 次要指标。1-3个额外维度（速度、多样性、鲁棒性）及理由。
3. 归一化规则。转小写、去除标点、数字扩展、空白折叠。使用 Whisper-normalizer 或自定义规则，并记录文档。
4. 公开基准。用于对标的标准排行榜（Open ASR、TTS Arena、MMAU-Pro、VoxCeleb1-O、AudioSet、LongAudioBench 等）。
5. 内部测试集。保留的领域数据，包含 N 个样本；按人口统计/声学切片细分。
6. 报告格式。分布情况（延迟的 P50/P95/P99；分类的每类召回率；MMAU 的每类准确率）。发布说明模板。

拒绝使用单一数值评估延迟（应报告百分位数）。拒绝仅聚合报告（分类应报告每类指标）。拒绝发布没有同时包含 MOS/UTMOS 和 SECS（涉及克隆时）的 TTS。拒绝发布没有词错误率归一化规范的 ASR。拒绝仅使用 FAD 的音乐发布——始终配以人工 MOS 评审小组。

示例输入："发布一个新的英-西多语种对话式 TTS。需要说服团队它优于现有的 Cartesia-Sonic 基线。"

示例输出：
- 主要指标：UTMOS（每种语言50个提示的配对音频样本）+ 人工评审 MOS（每种语言20名听众，与基线进行盲测 A/B 对比）。
- 次要指标：TTFA 中位数和 P95（必须匹配基线）；SECS > 0.80 对比固定语音参考（无说话人回归）；往返 ASR（Whisper-large-v3-turbo）的词错误率 < 2%。
- 归一化：往返词错误率使用 Whisper-normalizer 英语 + Hugging Face 多语言归一化器西班牙语。
- 公开基准：TTS Arena（英语）和 Artificial Analysis Speech 用于相对 ELO 定位。目标：与最接近的竞争对手相差50个 ELO 以内。
- 内部测试：200个保留提示（每种语言100个），涵盖金额、日期、产品名称、双句叙述、情感朗读、语码混合。10个不同人口统计特征的声音。
- 报告：发布说明包含头条指标（UTMOS + MOS）、P50/P95 TTFA 直方图、SECS CDF、按类别的词错误率细分、失败模式分析（语码混合提示失败率为 X%）。
