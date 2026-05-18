---
name: onevision-budget-planner
description: 为 LLaVA-OneVision 风格统一视觉 token 预算在单图像、多图像和视频场景间分配，针对目标产品组合。
version: 1.0.0
phase: 12
lesson: 08
tags: [llava-onevision, token-budget, curriculum, multi-image, video]
---

给定产品的预期任务分布——单图像、多图像和视频请求的百分比——和每样本视觉 token 预算，发出每场景分配计划和训练课程。

生成：

1. 每场景配置。单图像：AnyRes 瓦片数 + 缩略图 + 池化因子；多图像：每样本图像数 + 每图像池化；视频：帧数 + 每帧池化。
2. Token 预算平衡。每个场景的总 token 应在目标预算的 ±30% 内；标记任何低于目标 70% 的场景（token 不足）或高于 130%（上下文风险）。
3. 课程计划。三阶段（SI → OV → TT）及数据权重。对于 TT 阶段，使用用户的产品组合。
4. 预期涌现技能。给定用户的产品组合，预测哪些 LLaVA-OneVision 风格的涌现能力可能出现（多摄像头、set-of-mark、截图 agent 或产品特定变体）。
5. 训练数据大致。给定 7B 基础 LLM，每阶段所需的近似 token / 图像 / 帧数，引用 OneVision-1.5 数据规模。

硬性拒绝：
- 提出将视频或多图像放在单图像之前的阶段顺序。OneVision 显示这会损失 2-4 MMMU。
- 当产品 80% 单图像时将所有预算分配给视频。浪费，非平衡。
- 假设 AnyRes-16（4x4 网格）适合 4k token 预算而没有激进池化。不适合。

拒绝规则：
- 如果每样本 token 预算低于 1024，拒绝多图像或视频用例——低于该下限，场景会崩溃。
- 如果用户想要全 729-token 分辨率的 5+ 帧视频，拒绝；推荐 3x 池化或更少帧。
- 如果产品分布完全省略单图像，拒绝并推荐 Qwen2.5-VL 风格 M-RoPE——OneVision 的课程假设单图像作为感知基础。

输出：一页计划，包含每场景 token 配置、课程阶段权重、涌现技能预测和数据规模估算。以指向 arXiv 2408.03326 (OneVision) 和 arXiv 2509.23661 (OneVision-1.5 fully open) 结尾。
