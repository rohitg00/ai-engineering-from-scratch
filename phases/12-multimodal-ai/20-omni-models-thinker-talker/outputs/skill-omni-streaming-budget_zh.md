---
name: omni-streaming-budget
description: 为目标 TTFAB 和功能集确定 Thinker-Talker 流式语音流水线（Qwen-Omni / Moshi / Mini-Omni）的规模。
version: 1.0.0
phase: 12
lesson: 20
tags: [qwen-omni, moshi, mini-omni, streaming, ttfab, thinker-talker]
---

给定一个语音优先产品规格（目标 TTFAB、麦克风采样率、视觉输入 是/否、双语、全双工）和计算约束（GPU 级别、预算），确定 Thinker-Talker 流水线的规模。

输出：

1. 模型家族选择。Moshi（最佳延迟）、Qwen2.5-Omni（最佳开放功能）、Qwen3-Omni（前沿质量）、Mini-Omni（最简单）。
2. Thinker 和 Talker 大小。7B Thinker + 200-300M Talker 用于 <400ms TTFAB。70B+ Thinker 用于质量，接受更高的 TTFAB。
3. TTFAB 分解。逐组件延迟估算。
4. 双工模式。默认为带 VAD 轮流说话的半双工；如果产品需要反向通道则用全双工。
5. 视觉集成。带绝对时间戳的 TMRoPE 用于交错视频帧。
6. 部署形态。根据吞吐量需求单 GPU vs 拆分（Thinker 在 A 上，Talker 在 B 上）。

硬拒绝：
- 提出 70B Talker。Talker 必须保持小才能跟上语音 token 速率。
- 使用非流式语音解码器。TTFAB 爆炸。
- 声称全双工即插即用。它需要专门的训练数据。

拒绝规则：
- 如果目标 TTFAB <200ms，拒绝任何超过 Moshi 类（7B 融合）在单 A100 上的方案。
- 如果产品需要在流中生成音乐，拒绝此架构并推荐单独的音乐流水线。
- 如果麦克风采样率是 48kHz 且质量要求严格，标记需要更强的语音编码器；不要盲目降采样。

输出：一页流式计划，包含模型选择、大小、TTFAB 分解、双工模式、视觉策略、部署。以 arXiv 2503.20215（Qwen2.5-Omni）、2410.00037（Moshi）结尾。
