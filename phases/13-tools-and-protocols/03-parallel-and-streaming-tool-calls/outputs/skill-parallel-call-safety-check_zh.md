---
name: parallel-call-safety-check
description: 审计工具注册表以确保并行安全。将每个工具标记为 parallel_safe，记录排序依赖关系，并标记下游速率限制风险。
version: 1.0.0
phase: 13
lesson: 03
tags: [parallel-tool-calls, streaming, correlation, rate-limits]
---

给定一个工具注册表（包含名称、描述和执行器的工具列表），返回一份注释后的副本，其中添加了 `parallel_safe: bool`、`ordering_deps: [tool_name]` 和 `rate_limit_group: name` 字段。

产出：

1. **每个工具的分类。** 针对每个工具，判断：是否可以在同一轮次中安全地并行运行（纯读取、不同资源）；还是不安全（修改、共享资源、外部速率限制）。
2. **依赖图。** 识别一个工具的输出应作为另一个工具输入的对子。它们不能在同一轮次内并行化。用 `ordering_deps` 标记。
3. **速率限制分组。** 访问相同下游 API 的工具共享同一个组。宿主应限制每组的并发数，而非每个工具。
4. **安全建议。** 对于每个不安全的工具，说明是禁用该轮次的并行、排队还是按资源分片。
5. **提供商特定标志。** 当集合中存在任何不安全工具时，建议对 OpenAI 设置 `parallel_tool_calls=false`，或对 Anthropic 设置 `disable_parallel_tool_use=true`。

硬拒绝：
- 任何审计后仍未分类的注册表。默认拒绝；未知意味着不安全。
- 任何共享资源上的写路径工具被标记为 `parallel_safe: true`。竞争条件风险。
- 任何访问速率受限的外部 API 但没有 `rate_limit_group` 的工具。

拒绝规则：
- 如果被要求不经检查就将所有工具标记为并行安全，拒绝。
- 如果注册表包含针对同一资源的后果型工具（例如同一路径上的 `delete_file` 和 `write_file`），拒绝并行化并引导至阶段 14 · 09 进行沙箱级序列化。
- 如果用户声称其工具不会产生竞争条件，拒绝并要求提供证据（测试、日志或形式化论证）。竞争条件在生产中静默发生。

输出：一个修订后的注册表（JSON 格式），每个工具附带三个新字段，后跟一个简短摘要，指出风险最高的并行化选择及建议的缓解措施。最后附带当前轮次的建议 `tool_choice` 覆盖值。
