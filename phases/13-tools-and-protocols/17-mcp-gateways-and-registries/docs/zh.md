# MCP 网关与注册中心——企业控制平面

> 企业不能让每个开发者随意安装随机的 MCP 服务器。网关集中管理认证、RBAC、审计、限流、缓存和工具投毒检测，然后将合并后的工具面暴露为一个单一的 MCP 端点。官方 MCP 注册中心（Anthropic + GitHub + PulseMCP + Microsoft，命名空间已验证）是规范的上游源。本节课阐述网关的定位，演示一个最小实现，并概述 2026 年的厂商格局。

**类型：** 学习
**语言：** Python（标准库，最小网关）
**前置知识：** 第 13 阶段 · 15（工具投毒），第 13 阶段 · 16（OAuth 2.1）
**用时：** 约 45 分钟

## 学习目标

- 解释 MCP 网关的定位（位于 MCP 客户端与多个后端 MCP 服务器之间）。
- 实现网关的五项职责：认证、RBAC、审计、限流、策略。
- 在网关层强制执行固定工具哈希清单。
- 区分官方 MCP 注册中心与元注册中心（Glama、MCPMarket、MCP.so、Smithery、LobeHub）。

## 问题

一家《财富》500 强企业拥有 30 个已批准的 MCP 服务器、5000 名开发者、合规与审计要求，以及一个希望集中管控的安全团队。让每个开发者在 IDE 中随意安装任意服务器是不可行的。

网关模式：

1. 网关作为一个单一的 Streamable HTTP 端点运行，开发者连接至此。
2. 网关持有每个后端 MCP 服务器的凭证。
3. 每个开发者请求都通过网关自身的 OAuth 进行认证和作用域限定。
4. 网关将调用路由到后端服务器，并应用策略。
5. 所有调用均已记录以供审计。

Cloudflare MCP Portals、Kong AI Gateway、IBM ContextForge、MintMCP、TrueFoundry、Envoy AI Gateway——均在 2025-2026 年间发布了网关或网关功能。

与此同时，官方 MCP 注册中心作为规范上游源推出：经过精选、命名空间验证、采用反向 DNS 命名的服务器，网关可从中拉取。元注册中心（Glama、MCPMarket、MCP.so、Smithery、LobeHub）则聚合来自多个来源的服务器。

## 概念

### 网关的五项职责

1. **认证。** 使用 OAuth 2.1 识别开发者；映射到用户角色。
2. **RBAC。** 按用户策略：允许访问哪些服务器、哪些工具、哪些作用域。
3. **审计。** 每次调用均记录谁、做了什么、何时、结果如何。
4. **限流。** 按用户/按工具/按服务器设置上限以防止滥用。
5. **策略。** 拒绝被投毒的描述、强制执行"二对一"原则、脱敏 PII。

### 网关作为单一端点

对开发者而言，网关看起来就像一个 MCP 服务器。内部则路由到 N 个后端。会话 ID（第 13 阶段 · 09）在边界处被重写。

### 凭证保险库

开发者永远看不到后端令牌。网关持有这些令牌（或代理到持有令牌的身份提供者）。拥有网关 `notes:read` 权限的开发者，可以使用网关自身的后端凭证转接访问 notes MCP 服务器——但仅受绑定转接访问的策略约束。

### 网关层的工具哈希固定

网关持有一个已批准工具描述的清单（SHA256 哈希）。在发现阶段，它获取每个后端的 `tools/list`，将哈希值与清单进行比较，并移除描述已发生变化的任何工具。这是第 13 阶段 · 15 中的"抽地毯"防御在中心层面的应用。

### 策略即代码

高级网关使用 OPA/Rego、Kyverno 或 Styra 表达策略。像"用户 `alice` 只能在 `acme` 组织的仓库中调用 `github.open_pr`"这样的规则以声明式方式编码。简单的网关使用手写 Python。两种形式都是有效的。

### 会话感知路由

当用户的会话包含多个服务器的混合时，网关进行多路复用：开发者的单个 MCP 会话持有 N 个后端会话，每个服务器一个。来自任何后端的通知都通过网关路由到开发者的会话。

### 命名空间合并

网关合并所有后端的工具命名空间，通常在冲突时添加前缀。例如 `github.open_pr`、`notes.search`。这使得路由不会产生歧义。

### 注册中心

- **官方 MCP 注册中心（`registry.modelcontextprotocol.io`）。** 由 Anthropic、GitHub、PulseMCP、Microsoft 共同管理推出。命名空间已验证（反向 DNS：`io.github.user/server`）。已预先过滤以保证基本质量。
- **Glama。** 以搜索为中心的元注册中心，聚合多个来源。
- **MCPMarket。** 倾向商业的目录，含有厂商列表。
- **MCP.so。** 社区目录；开放提交。
- **Smithery。** 包管理器式的安装流程。
- **LobeHub。** 集成在其 LobeChat 应用中的 UI 注册中心。

企业网关默认从官方注册中心拉取，允许管理员从元注册中心添加经过审核的内容，并拒绝任何未固定的内容。

### 反向 DNS 命名

官方注册中心要求公共服务器使用反向 DNS 名称：`io.github.alice/notes`。命名空间可防止抢注，并使信任委托更加清晰。

### 2026 年 4 月厂商调查

| 厂商 | 优势 |
|--------|----------|
| Cloudflare MCP Portals | 边缘托管；OAuth 集成；免费层 |
| Kong AI Gateway | 原生 Kubernetes；细粒度策略；日志输出至 OpenTelemetry |
| IBM ContextForge | 企业 IAM；合规；审计导出 |
| TrueFoundry | 面向 DevOps；指标优先 |
| MintMCP | 面向开发者平台 |
| Envoy AI Gateway | 开源；可定制过滤器 |

第 17 阶段（生产基础设施）将更深入地讨论网关运维。

## 使用它

`code/main.py` 提供了一个约 150 行的最小网关：通过伪造的 Bearer 令牌认证用户，持有按用户的 RBAC 策略，将请求路由到两个后端 MCP 服务器，将每次调用写入审计日志，强制执行限流，并拒绝任何描述哈希与固定清单不匹配的后端工具。

需要关注的内容：

- `RBAC` 字典以 `user_id` 为键，包含允许的 `server_tool` 条目。
- `AUDIT_LOG` 是一个仅可追加的事件列表。
- 限流使用每个用户的令牌桶。
- 固定清单是一个 `server::tool -> hash` 的字典。

## 输出

本节课生成 `outputs/skill-gateway-bootstrap.md`。给定一个企业 MCP 计划（用户、后端、合规要求），该技能将生成一份网关配置规范。

## 练习

1. 运行 `code/main.py`。作为允许的用户发起调用；然后作为不允许的用户发起调用；接着以超过限流阈值的爆发频率发起调用。验证这三种流程。

2. 添加一条策略，在将结果返回给客户端之前脱敏其中的 PII。使用简单的正则表达式匹配 SSN 格式的字符串；注意差距（电子邮件、电话号码）。

3. 扩展审计日志，使其能够输出 OpenTelemetry GenAI spans。第 13 阶段 · 20 涵盖了确切的属性。

4. 为一个拥有 50 名开发者和五个后端（notes、github、postgres、jira、slack）的团队设计 RBAC 策略。谁对每个系统拥有只读权限？谁拥有写入权限？

5. 从头到尾阅读 Cloudflare 的企业 MCP 博文。找出 Cloudflare 提供的、而本 stdlib 网关没有的一个功能。

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|----------------|------------------------|
| 网关 | "MCP 代理" | 位于客户端和后端之间的集中式服务器 |
| 凭证保险库 | "后端令牌留在服务端" | 开发者永远看不到上游令牌 |
| 会话感知路由 | "多后端会话" | 网关为每个开发者会话多路复用 N 个后端会话 |
| 工具哈希固定 | "已批准清单" | 每个已批准工具描述的 SHA256 哈希；在中心层面阻止"抽地毯"攻击 |
| RBAC | "按用户策略" | 基于角色的工具和服务器访问控制 |
| 策略即代码 | "声明式规则" | 在网关上执行的 OPA/Rego、Kyverno、Styra 策略 |
| 审计日志 | "谁、做了什么、何时" | 仅可追加的事件日志，用于合规 |
| 限流 | "按用户的令牌桶" | 每分钟上限以防止滥用 |
| 官方 MCP 注册中心 | "规范上游源" | `registry.modelcontextprotocol.io`，命名空间已验证 |
| 反向 DNS 命名 | "注册中心命名空间" | `io.github.user/server` 命名约定 |

## 延伸阅读

- [官方 MCP 注册中心](https://registry.modelcontextprotocol.io/)——规范上游源，命名空间已验证
- [Cloudflare——企业 MCP](https://blog.cloudflare.com/enterprise-mcp/)——采用 OAuth 和策略的网关模式
- [agentic-community——MCP 网关注册中心](https://github.com/agentic-community/mcp-gateway-registry)——开源参考网关
- [TrueFoundry——什么是 MCP 网关？](https://www.truefoundry.com/blog/what-is-mcp-gateway)——功能对比文章
- [IBM——MCP Context Forge](https://github.com/IBM/mcp-context-forge)——IBM 的企业级网关
