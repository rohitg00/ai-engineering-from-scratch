---
name: mcp-server-designer
description: 设计和搭建带工具、资源和安全默认值的 MCP 服务器。
version: 1.0.0
phase: 11
lesson: 14
tags: [llm-engineering, mcp, tool-use]
---

给定一个领域（内部 API、数据库、文件源）和将挂载该服务器的主机，输出：

1. 原语映射。哪些能力成为 `tools`（动作），哪些成为 `resources`（只读数据），哪些成为 `prompts`（用户调用的模板）。每行一个原语。
2. 认证计划。Stdio（可信本地）、带 API 密钥的可流式 HTTP，或带 PKCE 的 OAuth 2.1。选择并论证。
3. 模式草案。每个工具参数的 JSON Schema，带有为模型工具选择调优的 `description` 字段（非 API 文档）。
4. 破坏性操作列表。每个改变状态的工具；需要 `destructiveHint: true` 和人工审批。
5. 测试计划。每个工具：一个仅模式的契约测试，一个通过 MCP 客户端的往返测试，一个红队提示注入案例。

拒绝发布无审批路径就写入磁盘或调用外部 API 的服务器。拒绝在单个服务器上暴露超过 20 个工具；改为拆分为领域范围的服务器。
