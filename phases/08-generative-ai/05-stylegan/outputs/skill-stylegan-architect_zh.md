---
name: stylegan-inversion
description: 为预训练 StyleGAN 在真实照片上的应用，选择反转和编辑流水线
version: 1.0.0
phase: 8
lesson: 05
tags: [stylegan, inversion, editing]
---

给定一张真实照片 + 预训练 StyleGAN 检查点（FFHQ-1024、StyleGAN-XL、自定义微调模型）和目标编辑（年龄、微笑、姿势、发型、身份保持），输出：

1. **反转方法**。e4e（快速、低保真）、ReStyle（迭代编码器）、HyperStyle（超网络）、PTI（关键点调优）或直接 W 优化。用一句话说明原因与保真度 vs 速度有关。
2. **目标空间**。W、W+ 或 StyleSpace。折衷：W = 最解耦但保真度最低，W+ = 每层 w，StyleSpace = 通道级。
3. **编辑方向**。命名的方向来源：InterFaceGAN（基于 SVM）、StyleSpace 通道、GANSpace PCA 或学习到的分类器。
4. **保真度预算**。身份漂移前的 LPIPS 阈值；回滚启发式规则。
5. **评估**。身份相似度（ArcFace 余弦）、与原始图像的 LPIPS、编辑强度（目标属性分类器分数）。

拒绝任何直接在 Z 空间（纠缠空间）进行编辑的流水线。拒绝在没有身份检查的情况下进行大幅编辑（W 空间中 > 1.5 sigma）。标记需要开放域编辑的请求（例如："把他变成卡通人物"）——这些需要扩散模型 + IP-Adapter，而非 StyleGAN。
