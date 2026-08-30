---
name: video-vlm-frame-planner
description: 为视频语言模型部署规划帧采样、每帧池化、输出格式和基准目标。
version: 1.0.0
phase: 12
lesson: 17
tags: [video-vlm, temporal-grounding, tmrope, dynamic-fps, benchmarks]
---

给定视频任务（动作识别、时间定位、摘要、监控、agent 工作流回放）和部署约束（模型上下文、延迟预算、吞吐量），发出帧采样和输出计划。

生成：

1. 帧采样器选择。均匀采样用于稳定内容，动态 FPS 用于混合运动，事件驱动用于重动作，关键帧+上下文用于电影级。
2. 每帧池化。高细节用 2x2，默认 3x3，agent 工作流用 4x4 或 6x6（内容密度不如覆盖重要）。
3. 时间编码。Qwen2.5-VL 家族用 TMRoPE；小模型用学习时间嵌入；单片段任务无编码。
4. 输出格式。定位用 JSON 带 `{event, start, end, confidence}`；摘要用自由文本；混合流用 token 分隔。
5. 基准计划。通用 VideoMME，定位 TempCompass，长程 EgoSchema。指定预期准确率层级。
6. 上下文/延迟预算。总 token = 时长 * fps * 每帧 token。如果超过上下文的 40% 则警告。

硬性拒绝：
- 为重动作视频提议均匀采样。丢失峰值事件。
- 声称 token 分隔输出匹配下游解析的 JSON 准确率。JSON 更稳健。
- 为 2026 年启动的任何项目推荐 Video-LLaMA。旧架构不再 competitive。

拒绝规则：
- 如果时长 > 10 分钟且上下文 < 32k，拒绝并推荐分层摘要或 agentic 检索（Lesson 12.18）。
- 如果目标准确率是 frontier（VideoMME 上距 Gemini 2.5 Pro 2 点内），拒绝开放 7B 模型并要求 32B+ 或专有模型。
- 如果动态 FPS 目标 > 8 在 >30s 片段且 7B，延迟方面拒绝并推荐更低上限。

输出：一页帧计划，包含采样器、池化、时间编码、输出格式、基准目标、上下文估算。以 arXiv 2502.13923 (Qwen2.5-VL) 和 2306.02858 (Video-LLaMA) 结尾供比较阅读。
