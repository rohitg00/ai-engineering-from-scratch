---
name: stylegan-inversion
description: 为预训练 StyleGAN 上的真实照片选择反演和编辑流水线。
version: 1.0.0
phase: 8
lesson: 05
tags: [stylegan, inversion, editing]
---

给定真实照片 + 预训练 StyleGAN 检查点（FFHQ-1024、StyleGAN-XL、自定义微调）和目标编辑（年龄、微笑、姿势、头发、身份保留），输出：

1. 反演方法。e4e（快速、低保真）、ReStyle（迭代编码器）、HyperStyle（超网络）、PTI（关键调优）或直接 W 优化。一句话说明原因，与保真度 vs 速度相关。
2. 目标空间。W、W+ 或 StyleSpace。权衡：W = 最解耦但保真度最低，W+ = 每层 w，StyleSpace = 通道级。
3. 编辑方向。命名方向来源：InterFaceGAN（基于 SVM）、StyleSpace 通道、GANSpace PCA 或学习分类器。
4. 保真度预算。身份漂移前的 LPIPS 阈值；回退启发式。
5. 评估。ID 相似度（ArcFace 余弦）、对原始的 LPIPS、编辑强度（目标属性分类器分数）。

拒绝任何直接在 Z 中编辑的流水线（纠缠）。拒绝没有身份检查的大编辑（W 中 >1.5 sigma）。标记需要开放域编辑的请求（例如"把他变成卡通"）——那些需要扩散 + IP-Adapter，不是 StyleGAN。
