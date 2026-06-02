# MCP 网关与注册中心 —— 企业级控制面（MCP Gateways and Registries — Enterprise Control Planes）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 企业不可能让每个开发者随便装 MCP server。网关（gateway）把 auth、RBAC、审计、限流、缓存、tool-poisoning 检测集中起来，再以单一 MCP 端点的形式对外暴露合并后的 tool 表面。Official MCP Registry（由 Anthropic、GitHub、PulseMCP、Microsoft 共同维护，命名空间已验证）是规范上游。本节明确网关的位置，走一遍最小实现，并梳理 2026 年的厂商版图。

**Type:** Learn
**Languages:** Python (stdlib, minimal gateway)
**Prerequisites:** Phase 13 · 15 (tool poisoning), Phase 13 · 16 (OAuth 2.1)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 说清楚 MCP 网关的位置（在 MCP 客户端与多个后端 MCP server 之间）。
- 实现网关的五大职责：auth、RBAC、审计、限流、policy。
- 在网关层强制执行 pinned-tool-hash（钉死的工具哈希）清单。
- 区分 Official MCP Registry 与各类 metaregistry（Glama、MCPMarket、MCP.so、Smithery、LobeHub）。

## 问题（Problem）

某 Fortune 500 企业有 30 个已审批的 MCP server、5000 名开发者、合规与审计要求，安全团队还想要集中化 policy。让每位开发者在自己的 IDE 里随意装任意 server，这条路根本走不通。

网关模式：

1. 网关以单一 Streamable HTTP 端点的形式运行，开发者只连这个端点。
2. 网关替每个后端 MCP server 持有凭据。
3. 每一次开发者请求都通过网关自身的 OAuth 完成认证与作用域限定。
4. 网关把调用路由到后端 server，并施加 policy。
5. 所有调用写入审计日志。

Cloudflare MCP Portals、Kong AI Gateway、IBM ContextForge、MintMCP、TrueFoundry、Envoy AI Gateway —— 都在 2025–2026 年陆续发布了网关产品或网关功能。

与此同时，Official MCP Registry 作为规范上游上线：经过策展、命名空间验证、采用反向 DNS 命名的 server，网关可以从这里拉取。Metaregistry（Glama、MCPMarket、MCP.so、Smithery、LobeHub）则跨多个来源聚合 server。

## 概念（Concept）

### 网关的五大职责（Five gateway responsibilities）

1. **Auth。** OAuth 2.1 用来识别开发者身份，并映射到用户角色。
2. **RBAC。** 按用户的 policy：能用哪些 server、哪些 tool、哪些 scope。
3. **审计（Audit）。** 每次调用都记录 who、what、when、result。
4. **限流（Rate limit）。** 按用户 / 按 tool / 按 server 的上限，防止滥用。
5. **Policy。** 拒绝被投毒的描述、强制 Rule of Two、对 PII 做脱敏。

### 网关即单一端点（Gateway as a single endpoint）

在开发者眼里，网关就是一个 MCP server。内部它会把请求路由到 N 个后端。Session id（见 Phase 13 · 09）在网关边界处被改写。

### 凭据保险库（Credential vaulting）

开发者从来看不到后端 token。网关替他们持有（或代理给一个负责持有的身份提供方）。一个在网关上拥有 `notes:read` 的开发者，可以借助网关自身的后端凭据传递性地访问 notes MCP server —— 但前提是 policy 已经为这种传递访问设好绑定。

### 网关层的 tool-hash pinning（Tool-hash pinning at the gateway）

网关持有一份已审批的 tool 描述清单（以 SHA256 哈希存储）。在 discovery 阶段，它会拉取每个后端的 `tools/list`，比对哈希与清单，把任何描述发生改动的 tool 移除。这就是 Phase 13 · 15 里的反「rug-pull」防御，集中化执行。

### Policy-as-code（声明式 policy）

进阶网关用 OPA/Rego、Kyverno 或 Styra 来表达 policy。诸如「用户 `alice` 仅能在组织 `acme` 下的 repo 上调用 `github.open_pr`」这类规则，全部以声明式编码。简单网关则用手写 Python，两种形态都成立。

### 会话感知路由（Session-aware routing）

当用户的 session 跨多个 server 时，网关会做多路复用：开发者那一个 MCP session，内部承载着 N 个后端 session，每个 server 一个。任何后端发出的 notification 都会经网关回流到开发者的 session。

### 命名空间合并（Namespace merging）

网关把所有后端的 tool 命名空间合并起来，通常采用「冲突时加前缀」的策略：`github.open_pr`、`notes.search`。这样路由就毫不含糊。

### 注册中心（Registries）

- **Official MCP Registry（`registry.modelcontextprotocol.io`）。** 由 Anthropic、GitHub、PulseMCP、Microsoft 共同治理上线。命名空间经过验证（反向 DNS：`io.github.user/server`）。已做基础质量预筛。
- **Glama。** 以搜索为中心、聚合多源的 metaregistry。
- **MCPMarket。** 偏商业的目录，列有厂商条目。
- **MCP.so。** 社区目录，开放提交。
- **Smithery。** 类似包管理器的安装流。
- **LobeHub。** 集成在 LobeChat 应用 UI 里的注册中心。

企业网关默认从 Official Registry 拉取，允许管理员从 metaregistry 策展性地添加，未 pin 的一律拒绝。

### 反向 DNS 命名（Reverse-DNS naming）

Official Registry 强制公共 server 使用反向 DNS 命名：`io.github.alice/notes`。命名空间防止抢注，也让信任委派更清晰。

### 厂商概览，2026 年 4 月（Vendor survey, April 2026）

| 厂商 | 强项 |
|--------|----------|
| Cloudflare MCP Portals | 边缘托管；集成 OAuth；有免费档 |
| Kong AI Gateway | K8s 原生；细粒度 policy；日志接 OpenTelemetry |
| IBM ContextForge | 企业 IAM；合规；审计可导出 |
| TrueFoundry | 偏 DevOps；指标优先 |
| MintMCP | 面向开发者平台 |
| Envoy AI Gateway | 开源；filter 可定制 |

Phase 17（生产基础设施）会更深入地讲网关运维。

## 用起来（Use It）

`code/main.py` 用约 150 行实现了一个最小网关：通过假的 Bearer token 认证用户，按用户持有 RBAC policy，把请求路由到两个后端 MCP server，把每次调用写入审计日志，强制限流，并拒绝任何描述哈希与 pinned 清单不匹配的后端 tool。

可以重点看：

- `RBAC` 字典以 `user_id` 为键，值里是允许的 `server_tool` 条目。
- `AUDIT_LOG` 是只追加的事件列表。
- 限流采用按用户的 token bucket。
- Pinned 清单是 `server::tool -> hash` 的字典。

## 上线部署（Ship It）

本节产出 `outputs/skill-gateway-bootstrap.md`。给定一份企业 MCP 计划（用户、后端、合规），该 skill 会输出一份网关配置规格。

## 练习（Exercises）

1. 运行 `code/main.py`。先以允许的用户身份调用一次；再以未授权用户身份调用一次；最后用突发流量触发限流。验证这三条路径都符合预期。

2. 加一条 policy，在结果返回客户端前对其中的 PII 做脱敏。用一个简单正则覆盖 SSN 形态的字符串即可；同时记下这种做法的盲区（邮箱、电话号码）。

3. 把审计日志扩展成发出 OpenTelemetry GenAI span。Phase 13 · 20 会给出具体的 attribute。

4. 为一个 50 人的开发团队、五个后端（notes、github、postgres、jira、slack）设计 RBAC policy。每个后端谁拿只读？谁拿写？

5. 把 Cloudflare 那篇企业 MCP 文章从头读到尾。指出 Cloudflare 提供、而本节这个 stdlib 网关没有的某项特性。

## 关键术语（Key Terms）

| 术语 | 大家嘴上说的 | 实际含义 |
|------|----------------|------------------------|
| Gateway | 「MCP proxy」 | 位于客户端与后端之间的集中化 server |
| Credential vaulting | 「后端 token 留在 server 侧」 | 开发者看不到上游 token |
| Session-aware routing | 「多后端 session」 | 网关在每个开发者 session 里多路复用 N 个后端 session |
| Tool-hash pinning | 「已审批清单」 | 每个已审批 tool 描述的 SHA256；集中阻断 rug-pull |
| RBAC | 「按用户的 policy」 | 针对 tool 与 server 的基于角色的访问控制 |
| Policy-as-code | 「声明式规则」 | OPA/Rego、Kyverno、Styra 在网关侧强制执行的 policy |
| Audit log | 「who、what、when」 | 用于合规的只追加事件日志 |
| Rate limit | 「按用户的 token bucket」 | 按分钟的上限，防止滥用 |
| Official MCP Registry | 「规范上游」 | `registry.modelcontextprotocol.io`，命名空间已验证 |
| Reverse-DNS naming | 「注册中心命名空间」 | `io.github.user/server` 约定 |

## 延伸阅读（Further Reading）

- [Official MCP Registry](https://registry.modelcontextprotocol.io/) — 规范上游，命名空间已验证
- [Cloudflare — Enterprise MCP](https://blog.cloudflare.com/enterprise-mcp/) — 带 OAuth 与 policy 的网关模式
- [agentic-community — MCP gateway registry](https://github.com/agentic-community/mcp-gateway-registry) — 开源参考网关
- [TrueFoundry — What is an MCP gateway?](https://www.truefoundry.com/blog/what-is-mcp-gateway) — 特性对比文章
- [IBM — MCP context forge](https://github.com/IBM/mcp-context-forge) — IBM 的企业网关
