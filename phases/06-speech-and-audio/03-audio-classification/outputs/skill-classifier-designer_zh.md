---
name: classifier-designer
description: 为音频分类任务选择架构、数据增强、类别平衡策略和评估指标
version: 1.0.0
phase: 6
lesson: 03
tags: [audio, classification, beats, ast]
---

给定一个音频分类任务（领域、标签数量、每个片段的标签密度、数据量、部署目标），输出：

1. 架构。k-NN-MFCC / 2D CNN / AST / BEATs / Whisper-encoder。一句话解释原因。
2. 数据增强。SpecAugment 参数（时间掩码、频率掩码数量）、mixup α、背景噪声混合等级。
3. 类别平衡。平衡采样器 vs 焦点损失 vs 类别权重。与长尾比例挂钩。
4. 损失函数 + 指标。CE / BCE / 焦点损失；主要指标（top-1 / mAP / macro-F1）和次要指标。
5. 划分 + 评估计划。分层 k 折、语音任务需按说话人分离、流式数据需按时间划分。

拒绝任何仅用 top-1 准确率评分的多标签任务；要求使用 mAP。拒绝在未按说话人分离的情况下评估说话人条件任务。将任何在少于10k标注片段上从头训练的架构标记出来——应从自监督预训练主干开始。
