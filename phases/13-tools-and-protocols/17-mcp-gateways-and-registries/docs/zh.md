# 17 · MCP 网关与注册中心——企业级控制平面

> 企业不能任由每个开发者随意安装来历不明的 MCP 服务器。网关（gateway）集中管理认证、RBAC、审计、限流、缓存以及工具投毒（tool poisoning）检测，然后把合并后的工具面（tool surface）作为单一 MCP 端点对外暴露。官方 MCP 注册中心（Official MCP Registry，由 Anthropic + GitHub + PulseMCP + Microsoft 共同维护，并经过命名空间验证）是规范的上游来源。本课讲清网关在体系中的位置，演示一个最小实现，并概览 2026 年的厂商格局。

**类型：** 学习
**语言：** Python（标准库，最小网关）
**前置：** 阶段 13 · 15（工具投毒）、阶段 13 · 16（OAuth 2.1）
**时长：** 约 45 分钟

## 学习目标

- 解释 MCP 网关所处的位置（位于 MCP 客户端与多个后端 MCP 服务器之间）。
- 实现网关的五项职责：认证、RBAC、审计、限流、策略。
- 在网关层强制执行「固定工具哈希清单（pinned-tool-hash manifest）」。
- 区分官方 MCP 注册中心与各类元注册中心（metaregistry）：Glama、MCPMarket、MCP.so、Smithery、LobeHub。

## 问题所在

一家《财富》500 强企业拥有 30 个已批准的 MCP 服务器、5000 名开发者、合规与审计要求，以及一支希望集中管控策略的安全团队。让每位开发者在自己的 IDE 里随意安装任意服务器，是绝对行不通的。

网关模式：

1. 网关作为单一的 Streamable HTTP 端点运行，开发者连接到它。
2. 网关持有每个后端 MCP 服务器的凭据。
3. 每个开发者请求都通过网关自身的 OAuth 进行认证并限定范围（scope）。
4. 网关在施加策略的同时，把调用路由到后端服务器。
5. 所有调用都被记录以供审计。

Cloudflare MCP Portals、Kong AI Gateway、IBM ContextForge、MintMCP、TrueFoundry、Envoy AI Gateway——这些产品都在 2025-2026 年发布了网关产品或网关功能。

与此同时，官方 MCP 注册中心作为规范的上游来源上线：经过精选、命名空间验证、采用反向 DNS 命名（reverse-DNS）的服务器，网关可以从中拉取。元注册中心（Glama、MCPMarket、MCP.so、Smithery、LobeHub）则跨多个来源聚合服务器。

## 核心概念

### 网关的五项职责

1. **认证（Auth）。** 用 OAuth 2.1 识别开发者身份；映射到用户角色。
2. **RBAC。** 按用户的策略：允许哪些服务器、哪些工具、哪些范围（scope）。
3. **审计（Audit）。** 每次调用都记录下「谁、做了什么、何时、结果如何」。
4. **限流（Rate limit）。** 按用户 / 按工具 / 按服务器设置上限，防止滥用。
5. **策略（Policy）。** 拒绝被投毒的描述、强制执行二人规则（Rule of Two）、对 PII 进行脱敏。

### 网关作为单一端点

在开发者看来，网关就像一个 MCP 服务器。在内部，它把请求路由到 N 个后端。会话 id（session id，阶段 13 · 09）会在边界处被重写。

### 凭据保险库（Credential vaulting）

开发者永远看不到后端令牌。网关持有这些令牌（或代理到一个持有它们的身份提供方）。一个在网关上拥有 `notes:read` 权限的开发者，可以借助网关自身的后端凭据传递性地（transitively）访问 notes MCP 服务器——但仅限于约束该传递性访问的策略之下。

### 网关层的工具哈希固定（Tool-hash pinning）

网关持有一份已批准工具描述的清单（manifest，即 SHA256 哈希）。在发现（discovery）阶段，它会拉取每个后端的 `tools/list`，将哈希与清单比对，并移除任何描述已发生变更的工具。这就是把阶段 13 · 15 中的「抽地毯（rug-pull）」防御集中化施加的做法。

### 策略即代码（Policy-as-code）

高级网关用 OPA/Rego、Kyverno 或 Styra 来表达策略。诸如「用户 `alice` 仅可对组织 `acme` 下的仓库调用 `github.open_pr`」这类规则被声明式地编码。简单的网关则使用手写的 Python。两种形态都是合理的。

### 会话感知路由（Session-aware routing）

当一个用户的会话混合了多个服务器时，网关会进行多路复用（multiplex）：开发者的单个 MCP 会话内含 N 个后端会话，每个服务器一个。来自任意后端的通知都会经由网关路由到开发者的会话。

### 命名空间合并（Namespace merging）

网关会合并来自所有后端的工具命名空间，通常采用「冲突时加前缀（prefix-on-collision）」的策略。例如 `github.open_pr`、`notes.search`。这使得路由没有歧义。

### 注册中心

- **官方 MCP 注册中心（`registry.modelcontextprotocol.io`）。** 在 Anthropic、GitHub、PulseMCP、Microsoft 的共同维护下上线。经过命名空间验证（反向 DNS：`io.github.user/server`）。已做基本质量预筛。
- **Glama。** 以搜索为核心、聚合众多来源的元注册中心。
- **MCPMarket。** 偏商业化的目录，含厂商列表。
- **MCP.so。** 社区目录；开放提交。
- **Smithery。** 类似包管理器（package-manager）风格的安装流程。
- **LobeHub。** 集成在其 LobeChat 应用中的 UI 注册中心。

企业网关默认从官方注册中心拉取，允许由管理员精选地从元注册中心补充，并拒绝任何未固定（unpinned）的内容。

### 反向 DNS 命名（Reverse-DNS naming）

官方注册中心要求公共服务器使用反向 DNS 命名：`io.github.alice/notes`。命名空间可防止抢注（squatting），并让信任委派（trust delegation）更清晰。

### 厂商概览，2026 年 4 月

| 厂商 | 优势 |
|--------|----------|
| Cloudflare MCP Portals | 边缘托管；集成 OAuth；有免费档位 |
| Kong AI Gateway | K8s 原生；细粒度策略；日志输出到 OpenTelemetry |
| IBM ContextForge | 企业级 IAM；合规；审计导出 |
| TrueFoundry | 偏 DevOps；指标优先 |
| MintMCP | 面向开发者平台 |
| Envoy AI Gateway | 开源；可定制过滤器 |

阶段 17（生产基础设施）会更深入地讲解网关运维。

## 动手用

`code/main.py` 提供了一个约 150 行的最小网关：用一个伪造的 Bearer 令牌认证用户、持有按用户的 RBAC 策略、把请求路由到两个后端 MCP 服务器、把每次调用写入审计日志、执行限流，并拒绝任何描述哈希与固定清单不匹配的后端工具。

需要重点看的地方：

- 以 `user_id` 为键、含允许的 `server_tool` 条目的 `RBAC` 字典。
- `AUDIT_LOG` 是一个只追加（append-only）的事件列表。
- 限流使用按用户的令牌桶（token bucket）。
- 固定清单是一个 `server::tool -> hash` 的字典。

## 交付

本课产出 `outputs/skill-gateway-bootstrap.md`。给定一份企业 MCP 方案（用户、后端、合规要求），该 skill 会产出一份网关配置规格。

## 练习

1. 运行 `code/main.py`。以一个被允许的用户发起调用；然后以一个不被允许的用户发起调用；再发起一次超出限流的突发请求。验证这三条流程。

2. 添加一条策略：在把结果返回给客户端之前对其中的 PII 进行脱敏。用一个简单的正则去匹配类似 SSN 形状的字符串；注意其中的缺口（邮箱、电话号码）。

3. 扩展审计日志，使其发出 OpenTelemetry GenAI 跨度（span）。阶段 13 · 20 会介绍确切的属性。

4. 为一个 50 人开发团队、五个后端（notes、github、postgres、jira、slack）设计一份 RBAC 策略。每个后端上谁拥有只读权限？谁拥有写权限？

5. 从头到尾通读 Cloudflare 的企业 MCP 博文。找出一个 Cloudflare 提供、而这个标准库网关不具备的功能。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 网关（Gateway） | “MCP 代理” | 位于客户端与后端之间的集中化服务器 |
| 凭据保险库（Credential vaulting） | “后端令牌留在服务端” | 开发者永远看不到上游令牌 |
| 会话感知路由（Session-aware routing） | “多后端会话” | 网关在每个开发者会话中多路复用 N 个后端会话 |
| 工具哈希固定（Tool-hash pinning） | “已批准清单” | 每个已批准工具描述的 SHA256；集中阻断抽地毯（rug-pull） |
| RBAC | “按用户的策略” | 针对工具与服务器的基于角色的访问控制 |
| 策略即代码（Policy-as-code） | “声明式规则” | 在网关处执行的 OPA/Rego、Kyverno、Styra 策略 |
| 审计日志（Audit log） | “谁、做了什么、何时” | 用于合规的只追加事件日志 |
| 限流（Rate limit） | “按用户的令牌桶” | 按分钟的上限，防止滥用 |
| 官方 MCP 注册中心（Official MCP Registry） | “规范上游” | `registry.modelcontextprotocol.io`，经过命名空间验证 |
| 反向 DNS 命名（Reverse-DNS naming） | “注册中心命名空间” | `io.github.user/server` 约定 |

## 延伸阅读

- [官方 MCP 注册中心](https://registry.modelcontextprotocol.io/) —— 规范上游，经过命名空间验证
- [Cloudflare —— 企业 MCP](https://blog.cloudflare.com/enterprise-mcp/) —— 带 OAuth 与策略的网关模式
- [agentic-community —— MCP 网关注册中心](https://github.com/agentic-community/mcp-gateway-registry) —— 开源参考网关
- [TrueFoundry —— 什么是 MCP 网关？](https://www.truefoundry.com/blog/what-is-mcp-gateway) —— 功能对比文章
- [IBM —— MCP context forge](https://github.com/IBM/mcp-context-forge) —— 来自 IBM 的企业级网关
