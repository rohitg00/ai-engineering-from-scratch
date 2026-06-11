---
name: modality-bridge-picker
description: 给定 token 预算、质量目标和训练计算量，为 VLM 配置推荐 Q-Former vs MLP projector vs Perceiver resampler。
version: 1.0.0
phase: 12
lesson: 03
tags: [blip2, qformer, vlm, modality-bridge, architecture]
---

给定视觉编码器每张图像的 token 计数、LLM 的上下文预算、每张提示词的目标图像数和训练计算预算，推荐使用哪种模态桥并用参数计数和 token 经济学论证。

生成：

1. Token 预算审计。报告视觉编码器每张图像的原始 token、每种桥选项后每张图像的 token，以及声明的每张提示词图像数所消耗的 LLM 上下文比例。
2. 桥比较。对于 Q-Former（32 token，~188M 参数）、MLP projector（所有 patch，~20M 参数）和 Perceiver resampler（通过 N 层交叉注意力的 K 个可学习查询，可变），给出参数、质量代理和训练成本大致。
3. 推荐。针对声明约束的单一最佳选择，带一行论证。标记约束矛盾时（高质量 + 紧 token 预算 + 低训练计算）。
4. 两阶段训练轨迹。如果选择 Q-Former，概述阶段 1 的 ITC + ITM + ITG 损失和阶段 2 的 LM 损失。为每个命名代表性数据集（COCO、LAION、Visual Genome）。
5. 消融清单。调用者在锁定桥之前应运行的五个实验（查询计数、两阶段 vs 单阶段、projector 深度、冻结计划、微调子集）。

硬性拒绝：
- 任何忽略 token 预算的推荐。"使用 MLP"且每张图像 576 token 在 4k 上下文中 10 张图像时失败。
- 声称 Q-Former 严格优于 MLP。在单图像高质量任务且上下文无限时，MLP 获胜。
- 将 Perceiver resampler 视为与 Q-Former 等价。Flamingo 在每个 LLM 层应用它；BLIP-2 应用一次。

拒绝规则：
- 如果调用者要求处理视频的桥而没有指定多少帧及帧率，拒绝——视频桥与单图像桥在规范上不同，不仅仅是规模。
- 如果范围内的 LLM 是从头训练的视觉塔（early-fusion，Chameleon 风格），拒绝——Lesson 12.11 单独涵盖该情况。
- 如果未声明训练计算，拒绝并询问调用者是否能负担 BLIP-2 阶段 2（~几百 A100 小时）或仅 projector-only 训练。

输出：一页桥推荐，包含 token 数学、参数计数、推荐架构、训练大纲和消融清单。以"接下来阅读什么"段落结尾，指向 Lesson 12.04 (Flamingo) 了解 cross-attention-everywhere、Lesson 12.05 (LLaVA) 了解 MLP-only，或 Lesson 12.07 (ablations) 了解数据 vs 架构权衡。
