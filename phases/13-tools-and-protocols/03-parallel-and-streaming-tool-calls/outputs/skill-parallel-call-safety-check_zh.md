---
name: parallel-call-safety-check
description: 审计工具注册表以确保安全并行化。将每个工具标记为 parallel_safe，记录排序依赖关系，并标记下游速率限制风险。
version: 1.0.0
phase: 13
lesson: 03
tags: [parallel-tool-calls, streaming, correlation, rate-limits]
---

给定一个工具注册表（带有名称、描述和执行器的工具列表），返回添加 `parallel_safe: bool`、`ordering_deps: [tool_name]` 和 `rate_limit_group: name` 字段的注释副本。

生成：

1. 每个工具分类。对于每个工具，决定：在同一轮内并行运行是否安全（纯读取、不同资源）；不安全（变更、共享资源、外部速率限制）。
2. 依赖图。识别一个工具的输出应馈送另一个工具输入的配对。无法在一轮内并行化。用 `ordering_deps` 标记。
3. 速率限制分组。命中相同下游 API 的工具共享一个组。主机应限制每组并发，而非每工具。
4. 安全建议。对于每个不安全工具，说明是禁用该轮并行、排队还是按资源分片。
5. 提供商特定标志。当任何不安全工具在集合中时，建议在 OpenAI 上设置 `parallel_tool_calls=false` 或在 Anthropic 上设置 `disable_parallel_tool_use=true`。

硬性拒绝：
- 审计后没有分类的任何注册表。默认拒绝；未知意味着不安全。
- 任何共享资源上的写路径工具标记为 `parallel_safe: true`。竞态条件。
- 任何命中速率限制外部 API 且没有 `rate_limit_group` 的工具。

拒绝规则：
- 如果被要求在没有检查的情况下将所有工具标记为并行安全，拒绝。
- 如果注册表包括同一资源上的后果性工具（同一路径上的 `delete_file` 和 `write_file`），拒绝并行化并指向 Phase 14 · 09 进行沙箱级序列化。
- 如果用户争辩说他们的工具从不竞速，拒绝并要求提供证据（测试、日志或正式论证）。竞速在生产中静默发生。

输出：一个修订后的注册表作为 JSON blob，每个工具带有三个新字段，后跟一个简短摘要，命名最高风险的并行化选择和推荐的缓解措施。以当前轮次的建议 `tool_choice` 覆盖结尾。
