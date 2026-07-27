---
name: text-encoder-picker
description: 在给定的约束条件下选择文本编码器架构
phase: 5
lesson: 08
---

给定约束条件（任务、数据量、延迟预算、部署目标、计算预算），输出：

1. 编码器架构：TextCNN、BiLSTM、BiLSTM-CRF、Transformer 微调或"预训练 Transformer 作为冻结编码器 + 小规模头网络"。
2. 嵌入输入：随机初始化、GloVe 或 fastText 冻结、或上下文相关的 Transformer 嵌入向量。
3. 5 行训练方案：优化器、学习率、批大小、轮数、正则化。
4. 一个监控信号。RNN/CNN 模型：检查按序列长度的准确性，以发现长依赖失败。Transformer 微调：关注学习率过高时的微调崩溃；在前100步内检查训练损失。

拒绝在用户标注示例不足约500条且尚未证明 TextCNN / BiLSTM 基线已趋于平稳时推荐微调 Transformer。将边缘部署（手机、微控制器、浏览器）标记为需要优先做出架构决策。
