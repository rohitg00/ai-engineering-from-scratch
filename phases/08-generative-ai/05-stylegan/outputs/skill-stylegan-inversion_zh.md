---
name: stylegan-inversion
description: 为真实照片上的预训练 StyleGAN 选择反转和编辑流程
version: 1.0.0
phase: 8
lesson: 05
tags: [stylegan, inversion, editing]
---

给定一张真实照片 + 预训练 StyleGAN 检查点（FFHQ-1024、StyleGAN-XL、自定义微调模型）和目标编辑（年龄、微笑、姿势、发型、身份保持），输出：

1. **反转方法**。e4e（快速、低保真度）、ReStyle（迭代编码器）、HyperStyle（超网络）、PTI（关键点调优）或直接 W 优化。结合保真度与速度给出一句话理由。
2. **目标空间**。W、W+ 或 StyleSpace。权衡：W = 最解纠缠但保真度最低，W+ = 每层 w，StyleSpace = 通道级。
3. **编辑方向**。命名的方向来源：InterFaceGAN（基于 SVM）、StyleSpace 通道、GANSpace PCA 或学习到的分类器。
4. **保真度预算**。身份漂移前的 LPIPS 阈值；回退启发式规则。
5. **评估**。身份相似度（ArcFace 余弦相似度）、与原图的 LPIPS、编辑强度（目标属性分类器分数）。

拒绝任何直接在 Z 空间（纠缠的）中编辑的流程。拒绝未进行身份检查的大幅编辑（W 空间中 > 1.5 sigma）。标记需要开放域编辑的请求（例如"把他变成卡通人物"）——这需要扩散 + IP-Adapter，而非 StyleGAN。
