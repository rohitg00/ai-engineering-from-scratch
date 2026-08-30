---
name: virtual-memory
description: 为任何目标运行时搭建 MemGPT 风格的两层内存系统（主上下文 + 归档存储 + 内存工具），具有正确的驱逐、引用和不受信任输入处理。
version: 1.0.0
phase: 14
lesson: 07
tags: [memory, memgpt, virtual-context, archival, citations]
---

给定目标运行时（Python、Node、Rust）、模型提供商（Anthropic、OpenAI、local）和存储后端（in-memory、SQLite、vector DB、KV、graph），生成正确的 MemGPT 风格内存系统。

生成：

1. 一个 `MainContext` 类型，带有 `core` dict（命名的持久节）和 `messages` 列表（FIFO）。在大小上限时自动驱逐；驱逐的轮次仍可通过 `conversation_search` 检索。
2. 一个 `ArchivalStore`，具有插入和搜索功能。记录必须携带 `id`、`text`、`tags`、`session_id`、`turn_id`、`created_at`。每次写入返回存储的 id 以供引用。
3. 五个匹配 MemGPT 表面的内存工具：`core_memory_append`、`core_memory_replace`、`archival_memory_insert`、`archival_memory_search`、`conversation_search`。向模型展示它们，并附带 `description` 文本，告诉模型何时使用每个工具。
4. 引用契约：每次归档检索必须返回记录 id 以及文本，并且代理必须在最终答案中引用它们。没有引用的答案是软失败。
5. 合并钩子（在 v1 中可以是 no-op），以便 Lesson 08 的 sleep-time agents 可以插入而无需重新布线。暴露 `list_records_since(timestamp)` 和 `delete(id)`。

硬性拒绝：

- 使用 full-prompt LLM 评分搜索归档。使用适当的检索后端（BM25、vector similarity）。允许在 top-k 短名单上使用 LLM 重新排序，而不是在整个语料库上。
- 主上下文没有驱逐策略。无界主上下文会默默增长超过窗口。
- 将检索到的内容存储为好像它是用户指令。所有归档内容都是不受信任的文本（Lesson 27）。将其作为观察传递给模型，而不是作为 system prompt。
- 编写 `core_memory_clear` 工具来清除所有节。Core 是 load-bearing；清除是一个 foot-gun。支持 `replace` 而不是 `clear`。

拒绝规则：

- 如果用户要求"没有引用，只要答案"，对于任何源归属重要的域（medical、legal、policy、financial）拒绝。提供一个折中方案：引用以脚注形式呈现，而不是内联。
- 如果用户要求"将所有检索到的内容写回归档而不进行过滤"，拒绝并指向 Lesson 27。检索到的内容是攻击者可访问的；批量写回是 memory poisoning。
- 如果运行时没有持久层，拒绝发布被描述为具有"长期记忆"的代理。降级产品描述，而不是实现。

输出：每个组件一个文件（`main_context.*`、`archival_store.*`、`memory_tools.*`、`agent.*`）加上一个 `README.md`，解释驱逐策略、引用契约，以及在哪里插入 Lesson 08（sleep-time consolidation）和 Lesson 09（Mem0 fusion）。以"what to read next"结束，指向 Lesson 08（如果代理需要三层或异步合并）或 Lesson 09（如果代理需要 vector+KV+graph fusion）。
