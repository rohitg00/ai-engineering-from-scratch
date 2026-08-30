---
name: long-video-strategy-planner
description: 为长视频理解任务选择暴力上下文、ring-attention、token 压缩或 agentic 检索并计算延迟 + 召回预期。
version: 1.0.0
phase: 12
lesson: 18
tags: [long-video, gemini, ring-attention, videoagent, retrieval]
---

给定视频时长、查询复杂度（单事件 vs 整体摘要）和开放 vs 封闭约束，选择长视频策略并发出配置。

生成：

1. 策略选择。暴力上下文、ring-attention（LongVILA）、token 压缩（Video-XL）或 agentic 检索（VideoAgent）。
2. Token 预算。时长 * FPS * 每帧 token。如果 > LLM 上下文则警告。
3. 预期召回。视频长度百分位的针中草召回。相关时引用 Gemini 1.5 报告。
4. 延迟。暴力上下文的预填充时间；agentic 的检索 + VLM。
5. 工程路径。所选策略的代码片段脚手架。
6. 回退计划。混合：暴力上下文全局摘要 + agentic 局部细节。

硬性拒绝：
- 为开放 72B 模型上的 2 小时视频提议暴力上下文。上下文装不下。
- 声称 agentic 检索总是获胜。对于整体摘要问题它输给暴力上下文。
- 未标记召回税就推荐 token 压缩。

拒绝规则：
- 如果目标是 90 分钟视频且 frontier 召回 (>95%)，拒绝仅开放选项并推荐 Gemini 2.5 Pro。
- 如果用户负担不起工具调用循环，拒绝 agentic-检索并提议压缩暴力上下文。
- 如果用户需要实时（流式播放），拒绝检索（太慢）并推荐流式 Qwen2.5-VL。

输出：一页计划，包含策略、预算、召回、延迟、工程路径和回退。以 arXiv 2403.05530 (Gemini 1.5) 和 2403.10517 (VideoAgent) 结尾供比较。
