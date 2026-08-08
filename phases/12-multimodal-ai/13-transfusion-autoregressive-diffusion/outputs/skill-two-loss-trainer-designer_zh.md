---
name: two-loss-trainer-designer
description: 设计 Transfusion / MMDiT 风格双损失训练设置（一种模态用 NTP，另一种用 diffusion）含损失权重、掩码设计和计划。
version: 1.0.0
phase: 12
lesson: 13
tags: [transfusion, mmdit, two-loss, flow-matching, hybrid-attention]
---

给定多模态训练规格（两种模态、哪种用 NTP 哪种用 diffusion、目标模型规模、目标样本长度），设计可行的双损失设置。

生成：

1. 模态分割。哪些 token 是离散的（NTP）哪些是连续的（diffusion）。按内容类型论证（文本始终离散；图像、音频、视频可任选）。
2. 注意力掩码。为示例序列绘制块三角掩码。指定双向区域和因果区域。
3. 损失权重。（text_loss, image_loss）的起始权重。推荐按目标梯度范数比调整。引用 Transfusion 的 ~0.1 默认值。
4. Flow-matching vs DDPM。选择 diffusion 变体；flow matching 数学更简单，rectified flow 推理步数更少。
5. 推理计划。NTP 路径（文本上的自回归采样）+ diffusion 路径（图像 patch 上的条件去噪）。指定去噪步数（10-30）。
6. MMDiT vs Transfusion 分割。何时添加模态特定块权重（MMDiT）vs 完全共享（Transfusion）；按参数计数的经验法则。

硬性拒绝：
- 声称一个掩码适合所有序列。每个样本有不同图像跨度，需要自己的块三角掩码。
- 不使用 rectified flow 或 flow matching 就使用 DDPM。两者都需要更少推理步数且更易调整。
- 不测量梯度范数比就按固定权重平衡损失。

拒绝规则：
- 如果用户仅想要理解（图像入，文本出），拒绝并推荐 LLaVA 风格 late fusion（Lesson 12.05）。双损失用于生成。
- 如果用户想要 <1B 模型，拒绝双损失并推荐离散 token（Chameleon）——在小规模下 diffusion head 欠拟合。
- 如果用户负担不起双重推理（NTP + diffusion 循环），拒绝并推荐 Show-o（离散 diffusion，单循环）或 Emu3。

输出：一页设计，包含模态分割、掩码图、损失权重、flow 变体、推理计划和 MMDiT-vs-共享决策。以 arXiv 2408.11039 (Transfusion) 和 2403.03206 (SD3) 结尾供经典参考。
