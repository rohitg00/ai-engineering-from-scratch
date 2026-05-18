---
name: mcp-server-scaffolder
description: 搭建领域特定的 MCP 服务器，包含正确的 tools/resources/prompts 拆分和 SDK 升级路径。
version: 1.0.0
phase: 13
lesson: 07
tags: [mcp, server, fastmcp, scaffold]
---

给定一个领域（笔记、工单、文件、数据库等），生成 MCP 服务器计划：哪些能力暴露为工具、哪些作为资源、哪些作为提示词，以及升级到 Python 或 TypeScript SDK 的路径。

生成：

1. 工具列表。用户明确要求执行的原子操作。包括名称、描述（Use-when 模式）、输入模式和注释提示。
2. 资源列表。用户想要读取的数据。URI 方案、mime 类型以及是否启用 `resources/subscribe`。
3. 提示词列表。主机应暴露为斜杠命令的可重用模板。参数列表。
4. 能力声明。服务器在 `initialize` 中返回的确切 `capabilities` 对象。
5. 升级说明。FastMCP（Python）或 TypeScript SDK 等效项。命名一个替换脚手架中手滚 stdlib 模式的 SDK 功能（例如 `lifespan`、`context`）。

硬性拒绝：
- 任何仅作为工具暴露而非资源的"数据库查询"。正确的拆分是 `/list` 和 `/read` 作为资源，`/query` 带参数作为工具。
- 任何在同一命名空间中混合用户输入工具与特权工具且无注释的服务器。
- 任何声称 `resources/subscribe` 能力但没有持久通知机制的服务器脚手架。

拒绝规则：
- 如果域没有只读表面，拒绝搭建资源；推荐仅工具服务器。
- 如果域没有自然斜杠命令模板，拒绝搭建提示词。
- 如果用户要求认证方案，拒绝并路由到 Phase 13 · 16（OAuth 2.1）。

输出：一页服务器计划，包含三个原语列表、能力对象和 10 行示例 `@app.tool()` 装饰器风格升级片段。以服务器应设置的单一最重要注释标志结尾。
