# MCP 网关与注册表 —— 企业控制平面

> 企业不能让每个开发者随意安装 MCP 服务器。网关集中管理认证、RBAC、审计、速率限制、缓存和工具投毒检测，然后将合并的工具表面暴露为单个 MCP 端点。官方 MCP 注册表（Anthropic + GitHub + PulseMCP + Microsoft，命名空间验证）是规范的上游。本课介绍网关的定位，演练最小实现，并调研 2026 年供应商格局。

**类型：** Learn
**语言：** Python（stdlib，最小网关）
**前置知识：** Phase 13 · 15（工具投毒），Phase 13 · 16（OAuth 2.1）
**时间：** ~45 分钟

## 学习目标

- 解释 MCP 网关的位置（位于 MCP 客户端和多个后端 MCP 服务器之间）。
- 实现网关的五项职责：认证、RBAC、审计、速率限制、策略。
- 在网关层强制执行固定的工具哈希清单。
- 区分官方 MCP 注册表与元注册表（Glama、MCPMarket、MCP.so、Smithery、LobeHub）。

## 问题所在

一家财富 500 强公司拥有 30 个批准的 MCP 服务器、5000 名开发者、合规和审计需求，以及一个希望集中策略的安全团队。让每个开发者在他们的 IDE 中随意安装服务器是不可行的。

网关模式：

1. 网关作为单个 Streamable HTTP 端点运行，开发者连接到此端点。
2. 网关持有每个后端 MCP 服务器的凭证。
3. 每个开发者请求都通过网关自己的 OAuth 进行认证和范围限定。
4. 网关将调用路由到后端服务器，应用策略。
5. 所有调用都记录用于审计。

Cloudflare MCP Portals、Kong AI Gateway、IBM ContextForge、MintMCP、TrueFoundry、Envoy AI Gateway —— 都在 2025-2026 年推出了网关或网关功能。

与此同时，官方 MCP 注册表作为规范上游推出：经过策划、命名空间验证、反向 DNS 命名的服务器，网关可以从中拉取。元注册表（Glama、MCPMarket、MCP.so、Smithery、LobeHub）聚合多个来源的服务器。

## 核心概念

### 网关的五项职责

1. **认证。** OAuth 2.1 识别开发者；映射到用户角色。
2. **RBAC。** 每用户策略：哪些服务器、哪些工具、哪些范围。
3. **审计。** 每次调用都记录谁、什么、何时、结果。
4. **速率限制。** 每用户 / 每工具 / 每服务器上限以防止滥用。
5. **策略。** 拒绝投毒描述、强制执行双重规则、脱敏 PII。

### 网关作为单个端点

对开发者来说，网关看起来像一个 MCP 服务器。内部它路由到 N 个后端。会话 ID（Phase 13 · 09）在边界处重写。

### 凭证保管

开发者永远看不到后端令牌。网关持有它们（或代理到持有它们的身份提供商）。网关上具有 `notes:read` 的开发者可能通过网关自己的后端凭证间接访问笔记 MCP 服务器 —— 但仅在绑定间接访问的策略下。

### 网关层的工具哈希固定

网关持有批准工具描述的清单（SHA256 哈希）。在发现时，它获取每个后端的 `tools/list`，将哈希与清单比较，并移除任何描述已突变的工具。这是 Phase 13 · 15 的拉地毯防御的集中应用。

### 策略即代码

高级网关使用 OPA/Rego、Kyverno 或 Styra 表达策略。像"用户 `alice` 只能在组织 `acme` 的仓库上调用 `github.open_pr`"这样的规则以声明方式编码。简单网关使用手写 Python。两种形式都有效。

### 会话感知路由

当用户的会话包含多个服务器时，网关进行多路复用：开发者的单个 MCP 会话持有 N 个后端会话，每个服务器一个。来自任何后端的通知通过网关路由到开发者的会话。

### 命名空间合并

网关合并所有后端的工具命名空间，通常在冲突时添加前缀。`github.open_pr`、`notes.search`。这使路由明确无误。

### 注册表

- **官方 MCP 注册表（`registry.modelcontextprotocol.io`）。** 在 Anthropic、GitHub、PulseMCP、Microsoft 的管理下推出。命名空间验证（反向 DNS：`io.github.user/server`）。预先筛选基本质量。
- **Glama。** 以搜索为中心的元注册表，聚合多个来源。
- **MCPMarket。** 偏向商业的目录，带有供应商列表。
- **MCP.so。** 社区目录；开放提交。
- **Smithery。** 包管理器风格的安装流程。
- **LobeHub。** 其 LobeChat 应用中的 UI 集成注册表。

企业网关默认从官方注册表拉取，允许从元注册表进行管理员策划的添加，并拒绝任何未固定的内容。

### 反向 DNS 命名

官方注册表要求公共服务器使用反向 DNS 名称：`io.github.alice/notes`。命名空间防止抢注并使信任委托更清晰。

### 供应商调研，2026 年 4 月

| 供应商 | 优势 |
|--------|----------|
| Cloudflare MCP Portals | 边缘托管；OAuth 集成；免费套餐 |
| Kong AI Gateway | K8s 原生；细粒度策略；日志到 OpenTelemetry |
| IBM ContextForge | 企业 IAM；合规；审计导出 |
| TrueFoundry | 偏向 DevOps；指标优先 |
| MintMCP | 面向开发者平台 |
| Envoy AI Gateway | 开源；可定制过滤器 |

Phase 17（生产基础设施）深入探讨网关运营。

## 使用它

`code/main.py` 提供一个约 150 行的最小网关：通过假 Bearer 令牌认证用户，持有每用户 RBAC 策略，将请求路由到两个后端 MCP 服务器，将每次调用写入审计日志，强制执行速率限制，并拒绝任何描述哈希与固定清单不匹配的后端工具。

需要查看的内容：

- `RBAC` 字典以 `user_id` 为键，带有允许的 `server_tool` 条目。
- `AUDIT_LOG` 是仅追加的事件列表。
- 速率限制对每个用户使用令牌桶。
- 固定清单是 `server::tool -> hash` 的字典。

## 交付它

本课产出 `outputs/skill-gateway-bootstrap.md`。给定一个企业 MCP 计划（用户、后端、合规），该技能产出网关配置规范。

## 练习

1. 运行 `code/main.py`。以允许的用户进行调用；然后以不允许的用户；然后以超出速率限制的突发。验证所有三个流程。

2. 添加一个在返回客户端之前从结果中脱敏 PII 的策略。对 SSN 形状的字符串使用简单的正则表达式传递；注意差距（电子邮件、电话号码）。

3. 将审计日志扩展为发出 OpenTelemetry GenAI 跨度。Phase 13 · 20 涵盖确切的属性。

4. 为拥有五个后端（笔记、github、postgres、jira、slack）的 50 人开发团队设计 RBAC 策略。谁在每个上获得只读权限？谁获得写入权限？

5. 从头到尾阅读 Cloudflare 企业 MCP 文章。识别 Cloudflare 提供的一个本 stdlib 网关没有的功能。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 网关 | "MCP 代理" | 位于客户端和后端之间的集中服务器 |
| 凭证保管 | "后端令牌留在服务器端" | 开发者永远看不到上游令牌 |
| 会话感知路由 | "多后端会话" | 网关为每个开发者会话多路复用 N 个后端会话 |
| 工具哈希固定 | "批准清单" | 每个批准工具描述的 SHA256；集中阻止拉地毯 |
| RBAC | "每用户策略" | 工具和服务器基于角色的访问控制 |
| 策略即代码 | "声明式规则" | 在网关强制执行的 OPA/Rego、Kyverno、Styra 策略 |
| 审计日志 | "谁、什么、何时" | 用于合规的仅追加事件日志 |
| 速率限制 | "每用户令牌桶" | 每分钟上限以防止滥用 |
| 官方 MCP 注册表 | "规范上游" | `registry.modelcontextprotocol.io`，命名空间验证 |
| 反向 DNS 命名 | "注册表命名空间" | `io.github.user/server` 约定 |

## 延伸阅读

- [官方 MCP 注册表](https://registry.modelcontextprotocol.io/) — 规范上游，命名空间验证
- [Cloudflare — 企业 MCP](https://blog.cloudflare.com/enterprise-mcp/) — 带 OAuth 和策略的网关模式
- [agentic-community — MCP 网关注册表](https://github.com/agentic-community/mcp-gateway-registry) — 开源参考网关
- [TrueFoundry — 什么是 MCP 网关？](https://www.truefoundry.com/blog/what-is-mcp-gateway) — 功能比较文章
- [IBM — MCP context forge](https://github.com/IBM/mcp-context-forge) — IBM 的企业网关
