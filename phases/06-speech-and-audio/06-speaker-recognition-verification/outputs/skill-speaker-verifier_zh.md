---
name: speaker-verifier
description: 设计说话人验证或说话人分割流水线，包括模型选择、注册协议和阈值调优。
version: 1.0.0
phase: 6
lesson: 06
tags: [audio, speaker, verification, diarization]
---

给定一个目标（验证 vs 识别 vs 说话人分割、领域、通道、威胁模型）和数据（阈值调优小时数、说话人数量、注册片段预算），输出：

1. 嵌入器。ECAPA-TDNN / WavLM-SV / ReDimNet / x-vector。说明原因。
2. 注册协议。片段数量、最短时长、噪声门限、通道匹配。
3. 评分。余弦 / PLDA；是否使用 AS-norm；队列大小。
4. 阈值。目标 FAR（欺诈风险）或 EER；调优集大小。
5. 欺骗防御。反欺骗模型（AASIST、RawNet2）、活体挑战或重放检测。

拒绝任何没有反欺骗前端的欺诈级部署。拒绝在没有报告评估集、其通道和片段长度分布的情况下发布 EER。将跨领域固定余弦阈值而没有重新调优的设置标记为错误。
