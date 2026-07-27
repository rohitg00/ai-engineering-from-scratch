---
name: prompt-caching-planner
description: 设计缓存友好的提示布局并选择正确的提供者缓存模式。
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

给定一个提示（系统 + 工具 + 少样本 + 检索 + 历史 + 用户）和一个使用概况（每小时请求数、所需 TTL、提供者），输出：

1. 布局。重新排序的章节，标记单一缓存断点；解释哪些章节是稳定的、哪些是易变的。
2. 提供者模式。Anthropic cache_control、OpenAI 自动或 Gemini CachedContent。根据 TTL 和重用模式论证。
3. 盈亏平衡。TTL 内预期读取次数与写入次数之比；与无缓存的净成本对比，附计算过程。
4. 验证计划。CI 断言：在第二个相同请求上 cache_read_input_tokens > 0；仪表盘按缓存的 vs 未缓存的 token 拆分。
5. 故障模式。列出此设置中缓存最可能未命中的三个原因（动态时间戳、工具重排序、近似重复文本）以及如何防止每种情况。

拒绝将动态字段放置在断点之上的缓存计划。拒绝在没有使 2 倍写入溢价回本的重用次数的情况下启用 1 小时 TTL。
