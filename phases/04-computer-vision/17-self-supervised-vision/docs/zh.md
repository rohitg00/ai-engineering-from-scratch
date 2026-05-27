# 自监督视觉 — SimCLR、DINO、MAE

> 标注是监督视觉的瓶颈。自监督预训练消除了这一瓶颈：从1亿张无标签图像中学习视觉特征，然后在1万张有标签图像上微调。

**类型：** 学习 + 构建  
**语言：** Python  
**前置条件：** Phase 4 Lesson 04（图像分类）、Phase 4 Lesson 14（ViT）  
**时间：** 约75分钟

## 学习目标

- 梳理三大自监督方法家族 —— 对比学习（SimCLR）、师生网络（DINO）、掩码重建（MAE），并说明每种方法优化什么
- 从头实现InfoNCE损失，并解释为什么batch为512时有效，而batch为32时失败
- 解释为何MAE的75%掩码率不是随意的，以及它与文本BERT的15%掩码率的区别
- 使用DINOv2或MAE## ImageNet checkpoint for linear probing and zero-shot retrieval.paraphrase for clarity and fluency: DINOv2 ImageNet套件进行线性