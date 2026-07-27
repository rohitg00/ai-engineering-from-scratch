---
name: mcp-server-designer
description: 设计并搭建一个包含工具、资源和安全默认值的 MCP 服务器。
version: 1.0.0
phase: 11
lesson: 14
tags: [llm-engineering, mcp, tool-use]
---

给定一个领域（内部 API、数据库、文件源）以及将挂载此服务器的主机，输出：

1. 原语映射。哪些能力成为 `tools`（操作）、哪些成为 `resources`（只读数据）、哪些成为 `prompts`（用户调用的模板）。每个原语一行。
2. 认证计划。Stdio（受信任的本地）、带 API 密钥的可流式 HTTP、或带 PKCE 的 OAuth 2.1。选择并论证。
3. 模式草稿。每个工具参数的 JSON Schema，其中 `description` 字段针对模型工具选择（而非 API 文档）调优。
4. 破坏性操作列表。每个改变状态的工具；要求 `destructiveHint: true` 和人工批准。
5. 测试计划。每个工具：一个仅模式契约测试、一个通过 MCP 客户端的往返测试、一个红队提示注入案例。

拒绝发布一个没有批准路径就写入磁盘或调用外部 API 的服务器。拒绝在一个服务器上暴露超过 20 个工具；改为拆分为领域范围的服务器。
