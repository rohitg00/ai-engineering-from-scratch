# MCP 网关和注册表 — 企业控制平面

> 企业不能让每个开发人员安装随机 MCP 服务器。网关集中了身份验证、RBAC、审计、速率限制、缓存和工具中毒检测，然后将合并的工具表面作为单个 MCP 端点暴露。官方 MCP 注册表（Anthropic + GitHub + PulseMCP + Microsoft，命名空间验证）是权威的上游。本课命名了网关的合适位置，演练了最小实现，并调查了 2026 年的供应商格局。

**类型：** 学习
**语言：** Python (stdlib, 最小网关)
**前置条件：** 阶段 13 · 15 (工具中毒), 阶段 13 · 16 (OAuth 2.1)
**时间：** ~45 分钟

## 学习目标

- 解释 MCP 网关的位置（在 MCP 客户端和多个后端 MCP 服务器之间）。
- 实现五个网关职责：身份验证、RBAC、审计、速率限制、策略。
- 在网关层强制执行固定工具哈希清单。
- 区分官方 MCP 注册表和元注册表（Glama、MCPMarket、MCP.so、Smithery、LobeHub）。

## 问题背景

一家财富 500 强公司有 30 个已批准的 MCP 服务器、5000 名开发人员、合规性和审计要求，以及一个想要集中策略的安全团队。让每个开发人员在他们的 IDE 中安装任意服务器是一个非开始。

网关模式：

1. 网关作为开发人员连接的单个 Streamable HTTP 端点运行。
2. 网关持有每个后端 MCP 服务器的凭据。
3. 每个开发人员请求都通过网关自己的 OAuth 进行身份验证和作用域限定。
4. 网关将调用路由到后端服务器，应用策略。
5. 所有调用都记录用于审计。

Cloudflare MCP Portals、Kong AI Gateway、IBM ContextForge、MintMCP、TrueFoundry、Envoy AI Gateway — 都在 2025-2026 年发布了网关或网关功能。

与此同时，官方 MCP 注册表作为权威上游发布：经过策划、命名空间验证、反向 DNS 命名，网关可以从中拉取。元注册表（Glama、MCPMarket、MCP.so、Smithery、LobeHub）聚合多个来源的服务器。

## 概念详解

### 五个网关职责

1. **身份验证。** OAuth 2.1 以识别开发人员；映射到用户角色。
2. **RBAC。** 每用户策略：哪些服务器、哪些工具、哪些作用域。
3. **审计日志。** 记录谁、什么、何时、结果的每次调用。
4. **速率限制。** 每用户 / 每工具 / 每服务器上限以防止滥用。
5. **策略。** 拒绝中毒描述、强制执行二则规则、编辑 PII。

### 网关作为单个端点

对于开发人员来说，网关看起来像一个 MCP 服务器。内部它路由到 N 个后端。会话 ID（阶段 13 · 09）在边界处被重写。

### 凭证保管

开发人员永远不会看到后端令牌。网关持有它们（或代理到执行此操作的身份提供者）。在网关上具有 `notes:read` 的开发人员可以传递访问带有网关自己的后端凭据的笔记 MCP 服务器 — 但仅在绑定传递访问的策略下。

### 网关处的工具哈希固定

网关持有已批准工具描述（SHA256 哈希）的清单。在发现时，它获取每个后端的 `tools/list`，将哈希与清单进行比较，并移除任何描述已变异的工具。这是从阶段 13 · 15 应用于中心的拉 Rug 防御。

### 策略即代码

高级网关在 OPA/Rego、Kyverno 或 Styra 中表达策略。像"用户 `alice` 只能在 org `acme` 的仓库上调用 `github.open_pr`"这样的规则被声明性地编码。简单网关使用手写 Python。两种形态都有效。

### 感知会话的路由

当用户的会话包含混合服务器时，网关多路复用：开发人员的单个 MCP 会话持有 N 个后端会话，每个服务器一个。来自任何后端的通知通过网关路由到开发人员的会话。

### 命名空间合并

网关从所有后端合并工具命名空间，通常在冲突时带前缀。`github.open_pr`、`notes.search`。这使得路由明确。

### 注册表

- **官方 MCP 注册表（`registry.modelcontextprotocol.io`）。** 在 Anthropic、GitHub、PulseMCP、Microsoft 管理下发布。命名空间验证（反向 DNS：`io.github.user/server`）。预过滤基本质量。
- **Glama。** 以搜索为中心的元注册表，聚合许多来源。
- **MCPMarket。** 倾向商业的目录，带供应商列表。
- **MCP.so。** 社区目录；开放提交。
- **Smithery。** 包管理器风格的安装流程。
- **LobeHub。** 其 LobeChat 应用中的 UI 集成注册表。

企业网关默认从官方注册表拉取，允许管理员从元注册表策划的添加，并拒绝任何未固定的。

### 反向 DNS 命名

官方注册表强制公共服务器的反向 DNS 名称：`io.github.alice/notes`。命名空间防止 squatting 并使信任委托更清晰。

### 供应商调查，2026 年 4 月

| 供应商 | 优势 |
|--------|------|
| Cloudflare MCP Portals | 边缘托管；OAuth 集成；免费层 |
| Kong AI Gateway | K8s 原生；细粒度策略；日志到 OpenTelemetry |
| IBM ContextForge | 企业 IAM；合规性；审计导出 |
| TrueFoundry | DevOps 倾向；指标优先 |
| MintMCP | 面向开发者平台 |
| Envoy AI Gateway | 开源；可定制过滤器 |

阶段 17（生产基础设施）深入探讨了网关操作。

## 使用示例

`code/main.py` 在约 150 行中提供了一个最小网关：通过假 Bearer 令牌验证用户，持有每用户 RBAC 策略，将请求路由到两个后端 MCP 服务器，将每次调用写入审计日志，强制执行速率限制，并拒绝任何描述哈希与固定清单不匹配的后端工具。

需要关注的点：

- `RBAC` 字典按 `user_id` 键控，带有允许的 `server_tool` 条目。
- `AUDIT_LOG` 是一个仅追加的事件列表。
- 速率限制使用每用户的令牌桶。
- 固定清单是一个 `server::tool -> hash` 的字典。

## 实战输出

本课生成 `outputs/skill-gateway-bootstrap.md`。给定一个企业 MCP 计划（用户、后端、合规性），该技能生成网关配置规范。

## 练习

1. 运行 `code/main.py`。以允许的用户身份进行调用；然后以不允许的用户身份；然后进行超出速率限制的突发。验证所有三个流程。

2. 添加一个在返回客户端之前编辑结果中 PII 的策略。对 SSN 形状的字符串使用简单的正则表达式传递；注意差距（电子邮件、电话号码）。

3. 扩展审计日志以发出 OpenTelemetry GenAI span。阶段 13 · 20 涵盖了确切的属性。

4. 为具有五个后端（笔记、github、postgres、jira、slack）的 50 人开发团队设计 RBAC 策略。谁在每个上获得只读？谁获得写入？

5. 从头到尾阅读 Cloudflare 企业 MCP 文章。识别此 stdlib 网关没有的 Cloudflare 发布的一个功能。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| 网关 | "MCP 代理" | 客户端和后端之间的集中服务器 |
| 凭证保管 | "后端令牌保持在服务器端" | 开发人员永远不会看到上游令牌 |
| 感知会话的路由 | "多后端会话" | 网关为每个开发人员会话多路复用 N 个后端会话 |
| 工具哈希固定 | "已批准的清单" | 每个已批准工具描述的 SHA256；在中央阻止拉 Rug |
| RBAC | "每用户策略" | 工具和服务器的基于角色的访问控制 |
| 策略即代码 | "声明性规则" | 在网关强制执行的 OPA/Rego、Kyverno、Styra 策略 |
| 审计日志 | "谁、什么、何时" | 用于合规性的仅追加事件日志 |
| 速率限制 | "每用户令牌桶" | 每分钟上限以防止滥用 |
| 官方 MCP 注册表 | "权威上游" | `registry.modelcontextprotocol.io`，命名空间验证 |
| 反向 DNS 命名 | "注册表命名空间" | `io.github.user/server` 约定 |

## 延伸阅读

- [官方 MCP 注册表](https://registry.modelcontextprotocol.io/) — 权威上游，命名空间验证
- [Cloudflare — 企业 MCP](https://blog.cloudflare.com/enterprise-mcp/) — 带 OAuth 和策略的网关模式
- [agentic-community — MCP 网关注册表](https://github.com/agentic-community/mcp-gateway-registry) — 开源参考网关
- [TrueFoundry — 什么是 MCP 网关？](https://www.truefoundry.com/blog/what-is-mcp-gateway) — 功能比较文章
- [IBM — MCP 上下文锻造](https://github.com/IBM/mcp-context-forge) — IBM 的企业网关
