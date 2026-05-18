---
name: classifier-designer
description: 为音频分类任务选择架构、增强、类别平衡策略和评估指标。
version: 1.0.0
phase: 6
lesson: 03
tags: [audio, classification, beats, ast]
---

给定一个音频分类任务（领域、标签数量、每片段标签密度、数据量、部署目标），输出：

1. 架构。k-NN-MFCC / 2D CNN / AST / BEATs / Whisper-encoder。一句话说明原因。
2. 增强。SpecAugment 参数（时间掩码、频率掩码数量）、mixup α、背景噪声混合级别。
3. 类别平衡。平衡采样器 vs focal loss vs 类别权重。与尾头比挂钩。
4. 损失 + 指标。CE / BCE / focal；主要指标（top-1 / mAP / macro-F1）和次要指标。
5. 划分 + 评估计划。分层 k 折，如果是语音则按说话人划分，如果是流数据则按时间划分。

拒绝任何仅用 top-1 准确率评分的多标签任务；要求使用 mAP。拒绝在没有按说话人划分的情况下评估说话人条件任务。将任何在少于 10k 标注片段上从头开始的架构标记为错误——应使用 SSL 预训练骨干网络。
