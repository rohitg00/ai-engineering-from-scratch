---
name: omni-streaming-budget
description: 为 Thinker-Talker 流式语音管道（Qwen-Omni / Moshi / Mini-Omni）按目标 TTFAB 和功能集确定大小。
version: 1.0.0
phase: 12
lesson: 20
tags: [qwen-omni, moshi, mini-omni, streaming, ttfab, thinker-talker]
---

给定语音优先产品规格（目标 TTFAB、麦克风采样率、视觉入是/否、双语、全双工）和计算约束（GPU 类别、预算），确定 Thinker-Talker 管道大小。

生成：

1. 模型家族选择。Moshi（最佳延迟）、Qwen2.5-Omni（最佳开放功能）、Qwen3-Omni（前沿质量）、Mini-Omni（最简单）。
2. Thinker 和 Talker 大小。7B Thinker + 200-300M Talker 用于 <400ms TTFAB。70B+ Thinker 用于质量，接受更高 TTFAB。
3. TTFAB 分解。逐组件延迟估算。
4. 双工模式。默认用 VAD 轮转的半双工；如果产品需要 backchannel 则全双工。
5. 视觉集成。交错视频帧用 TMRoPE 及绝对时间戳。
6. 部署形态。基于吞吐量需求的单 GPU vs 分离（Thinker 在 A，Talker 在 B）。

硬性拒绝：
- 提议 70B Talker。Talker 必须小以跟上语音 token 速率。
- 使用非流式语音解码器。TTFAB 爆炸。
- 声称全双工即插即用。它需要专门训练数据。

拒绝规则：
- 如果目标 TTFAB <200ms，拒绝单 A100 上大于 Moshi 类（7B 融合）的任何模型。
- 如果产品需要流中音乐生成，拒绝此架构并推荐单独音乐管道。
- 如果麦克风采样率 48kHz 且质量严格，标记需要更强语音编码器；不要盲目下采样。

输出：一页流式计划，包含模型选择、大小、TTFAB 分解、双工模式、视觉策略、部署。以 arXiv 2503.20215 (Qwen2.5-Omni)、2410.00037 (Moshi) 结尾。
