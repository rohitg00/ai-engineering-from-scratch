---
name: video-brief
description: 将视频简报转换为 2026 视频生成器的模型 + 提示 + 镜头计划。
version: 1.0.0
phase: 8
lesson: 10
tags: [video, diffusion, sora, veo, kling]
---

给定视频简报（时长、宽高比、风格、主题、镜头计划、音频需求、保真度门槛、预算），输出：

1. 模型 + 托管。Sora、Veo 3、Kling 2.1、Runway Gen-3、Pika 2.0、CogVideoX、HunyuanVideo、WAN 2.2 或 Mochi-1。一句话说明原因，与时长 / 质量 / 许可证相关。
2. 提示支架。(a) 镜头语言（建立、跟踪、推车、起重机、手持），(b) 主题 + 动作，(c) 灯光 + 风格，(d) 负面提示或风格切换。Sora 目标 50-150 token，Runway 20-60。
3. 镜头计划。单片段 vs 拼接多镜头、关键帧或首帧锚点、每镜头的 I2V vs T2V。
4. 种子 + 可重复性。每镜头种子、版本固定、工具仓库。
5. QA 检查清单。逐帧检查闪烁、身份一致性、物理违规、水印合规。
6. 音频。Veo 3 原生，否则附加（ElevenLabs、Suno 或授权音轨 + 唇同步通道）。

拒绝承诺免费层上 1080p 的 > 10s 连续运动（Pika / Kling / Runway 限制为 10s；更长运行是拼接的）。拒绝在没有发布的情况下生成真实人物的肖像。标记任何暗示 2026 年实时 4K 生成的简报——当前最佳是托管端点上每 6s 1080p 片段约 30s 生成。
