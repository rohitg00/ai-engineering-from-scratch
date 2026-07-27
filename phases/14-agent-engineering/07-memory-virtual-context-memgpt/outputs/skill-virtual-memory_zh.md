---
name: virtual-memory
description: 为任意目标运行时搭建 MemGPT 风格的两层记忆系统（主上下文 + 归档存储 + 记忆工具），支持正确的逐出、引用和不可信输入处理。
version: 1.0.0
phase: 14
lesson: 07
tags: [memory, memgpt, virtual-context, archival, citations]
---

给定目标运行时（Python、Node、Rust）、模型提供商（Anthropic、OpenAI、本地）和存储后端（内存、SQLite、向量数据库、KV、图数据库），生成一个正确的 MemGPT 风格记忆系统。

产出：

1. 一个 `MainContext` 类型，包含一个 `core` 字典（有命名的持久化段落）和一个 `messages` 列表（FIFO）。在达到大小上限时自动逐出；被逐出的轮次仍可通过 `conversation_search` 检索。
2. 一个 `ArchivalStore`，支持插入和搜索。记录必须包含 `id`、`text`、`tags`、`session_id`、`turn_id`、`created_at`。每次写入返回存储的 ID 以供引用。
3. 五个与 MemGPT 接口匹配的记忆工具：`core_memory_append`、`core_memory_replace`、`archival_memory_insert`、`archival_memory_search`、`conversation_search`。以 `description` 文本呈现给模型，告知模型何时使用每个工具。
4. 一份引用契约：每次归档检索必须返回记录 ID 及其文本，代理必须在最终答案中引用它们。无引用的答案视为轻微失败。
5. 一个整合钩子（v1 中可为空操作），以便第 08 课的睡眠时间代理无需重新布线即可接入。暴露 `list_records_since(timestamp)` 和 `delete(id)`。

硬性拒绝：

- 使用全提示 LLM 评分进行归档搜索。应使用适当的检索后端（BM25、向量相似度）。LLM 重排序仅允许在 top-k 短名单上，而非整个语料库。
- 没有逐出策略的主上下文。无界主上下文会悄然超出窗口大小。
- 将检索到的内容当作用户指令存储。所有归档内容均为不可信文本（第 27 课）。应将其作为观察结果传递给模型，而非作为系统提示。
- 编写一个会清空所有段落的 `core_memory_clear` 工具。核心是承重结构；清空是自毁操作。支持 `replace` 而非 `clear`。

拒绝规则：

- 如果用户要求"无需引用，直接给出答案"，在来源归属至关重要的领域（医疗、法律、政策、金融）中拒绝。提供折中方案：引用以脚注而非内联形式呈现。
- 如果用户要求"将所有检索到的内容不经过滤写回归档"，拒绝并指向第 27 课。检索到的内容是攻击者可触及的；全量写回会导致记忆中毒。
- 如果运行时没有持久化层，拒绝交付被描述为拥有"长期记忆"的代理。应降低产品描述档次，而非实现。

输出：每个组件一个文件（`main_context.*`、`archival_store.*`、`memory_tools.*`、`agent.*`），外加一份 `README.md`，解释逐出策略、引用契约以及第 08 课（睡眠时间整合）和第 09 课（Mem0 融合）的接入点。以"下一步阅读"结尾，如果代理需要三层记忆或异步整合则指向第 08 课，如果代理需要向量+KV+图融合则指向第 09 课。
