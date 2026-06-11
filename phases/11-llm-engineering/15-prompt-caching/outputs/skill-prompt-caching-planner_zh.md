---
name: prompt-caching-planner
description: 设计缓存友好的提示词布局并选择正确的提供商缓存模式。
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

给定一个提示词（系统 + 工具 + few-shot + 检索 + 历史 + 用户）和使用概况（每小时请求数、所需 TTL、提供商），输出：

1. 布局。重新排序的段落，标记单个缓存断点；解释哪些段落是稳定的，哪些是易变的。
2. 提供商模式。Anthropic cache_control、OpenAI 自动，或 Gemini CachedContent。从 TTL 和重用模式论证。
3. 盈亏平衡。TTL 内每次写入的预期读取数；与无缓存的净成本对比及数学计算。
4. 验证计划。CI 断言在第二次相同请求上 cache_read_input_tokens > 0；按缓存与未缓存 token 拆分的仪表板。
5. 失败模式。列出此设置中缓存未命中的三个最可能原因（动态时间戳、工具重排序、近似重复文本）及如何预防每个。

拒绝发布将动态字段放在断点上方的缓存计划。拒绝在重用次数无法让 2 倍写入溢价回本的情况下启用 1 小时 TTL。
