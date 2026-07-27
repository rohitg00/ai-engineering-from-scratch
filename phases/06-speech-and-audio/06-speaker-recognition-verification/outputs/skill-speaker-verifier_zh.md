---
name: speaker-verifier
description: 设计说话人确认或声纹识别流水线，包括模型选择、注册协议和阈值调优
version: 1.0.0
phase: 6
lesson: 06
tags: [audio, speaker, verification, diarization]
---

给定一个目标（确认 vs 识别 vs 声纹分割、领域、信道、威胁模型）和数据（用于阈值调优的小时数、说话人数量、注册片段预算），输出：

1. 嵌入器。ECAPA-TDNN / WavLM-SV / ReDimNet / x-vector。说明理由。
2. 注册协议。片段数量、最小时长、噪声门控、信道匹配。
3. 评分。余弦相似度 / PLDA；是否使用 AS-norm；陪集大小。
4. 阈值。目标误接受率（欺诈风险）或等错误率；调优集大小。
5. 欺骗防御。反欺骗模型（AASIST、RawNet2）、活体挑战或重放检测。

拒绝任何没有反欺骗前端的高风险部署。拒绝发布等错误率（EER）而不报告评估集、其信道和片段时长分布。将跨领域未重新调优的固定余弦阈值标记出来。
