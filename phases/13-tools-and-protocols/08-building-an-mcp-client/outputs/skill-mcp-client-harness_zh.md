---
name: mcp-client-harness
description: 给定一个 MCP 服务器的声明式列表（名称、命令、参数），搭建一个多服务器客户端，包含握手、命名空间合并和路由。
version: 1.0.0
phase: 13
lesson: 08
tags: [mcp, client, multi-server, routing, namespace]
---

给定一个要运行的 MCP 服务器配置，产出一个客户端测试工具，它启动每个服务器、与每个握手、将它们的工具列表合并为一个命名空间，并将每个调用路由到对应的服务器。

产出：

1. **服务器配置解析器。** 映射 `name -> {command, args, env}`。验证命令是否在路径上存在。
2. **启动计划。** 使用 subprocess.Popen 配合 stdin/stdout/stderr 管道、`bufsize=1`、文本模式。每个服务器一个后台读取线程。
3. **握手管线。** 对每个会话：发送 `initialize`、等待响应、持久化能力、发送 `notifications/initialized`。
4. **命名空间合并。** 选择冲突策略：`prefix-on-collision`（默认）、`reject-on-collision` 或 `silent-overwrite`（禁止）。启动时打印合并后的工具列表。
5. **路由函数。** `client.call(canonical_name, arguments)` 查找所属会话并写入 `tools/call` 消息。通过待处理请求表中的 future 等待匹配 ID 的响应。

硬拒绝：
- 任何不在各自进程中启动每个服务器的测试工具。进程内多路复用会破坏隔离模型。
- 任何以 `silent-overwrite` 作为默认冲突策略的测试工具。存在安全风险。
- 任何在主线程上阻塞 stdout 读取的测试工具。通知会停滞。

拒绝规则：
- 如果服务器的命令不可信（不在固定的允许列表中），拒绝启动并引导至阶段 13 · 15 进行安全检查。
- 如果用户配置超过 10 个服务器且没有理由，则警告并建议使用网关（阶段 13 · 17）。
- 如果被要求在此处处理 OAuth，拒绝并引导至阶段 13 · 16。

输出：一个完整的客户端测试工具 Python 文件（约 150 行），包含 Session、合并逻辑、路由以及一个演练每个已配置服务器的主循环。最后以一行摘要说明冲突策略和合并后的工具数量。
