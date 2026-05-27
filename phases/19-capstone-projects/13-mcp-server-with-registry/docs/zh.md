# 综合项目 13 — 带注册表和治理的 MCP 服务器

> 模型上下文协议不再是未来，而是在 2026 年成为默认工具使用规范。Anthropic、OpenAI、Google 和每个主流 IDE 都发布了 MCP 客户端。Pinterest 发布了其内部 MCP 服务器生态系统。AAIF 注册表将能力元数据形式化在 `.well-known`。AWS ECS 发布了参考无状态部署。Block 的 goose-agent 将同一协议放入托管助手中。2026 年的生产形态是：StreamableHTTP 传输、OAuth 2.1 作用域、OPA 策略门控，以及一个让平台团队发现、验证和启用服务器的注册表。端到端构建它。

**类型：** 综合项目
**语言：** Python（服务器，通过 FastMCP）或 TypeScript（@modelcontextprotocol/sdk）、Go（注册表服务）
**前置条件：** 第 11 阶段（LLM 工程）、第 13 阶段（工具和 MCP）、第 14 阶段（智能体）、第 17 阶段（基础设施）、第 18 阶段（安全）
**涉及阶段：** P11 · P13 · P14 · P17 · P18
**时间：** 25 小时

## 问题描述

MCP 成为了工具使用通用语。Claude Code、Cursor 3、Amp、OpenCode、Gemini CLI 和每个托管智能体现在都使用 MCP 服务器。生产挑战不是创作服务器（FastMCP 使其简单），而是以企业需求大规模部署它们：每租户 OAuth 作用域、破坏性工具上的 OPA 策略、StreamableHTTP 无状态扩展、用于发现的注册表、每次工具调用的审计日志。Pinterest 的内部 MCP 生态系统和 AAIF 注册表规范设定了 2026 年的标准。

你将构建一个暴露 10 个内部工具的 MCP 服务器（Postgres 只读、S3 列表、Jira、Linear、Datadog 等）、一个用于平台发现的注册表 UI，以及破坏性工具的人工批准门。负载测试演示 StreamableHTTP 水平扩展。审计跟踪满足企业安全审查。

## 核心概念

MCP 2026 修订版强制使用 StreamableHTTP 作为默认传输。与早期的 stdio-and-SSE 形态不同，StreamableHTTP 默认无状态：单个 HTTP 端点接受 JSON-RPC 请求，流式传输响应，并支持用于通知的长连接。无状态意味着在负载均衡器后面可水平扩展。

授权是带有每工具作用域的 OAuth 2.1。Token 携带诸如 `jira:read`、`s3:list`、`postgres:query:readonly` 的作用域。MCP 服务器在工具调用时检查作用域，而不仅仅是会话开始。对于高风险工具，服务器拒绝任何在最近 N 分钟内未将作用域提升到 `approved:by:human` 的调用——该提升来自 Slack 审查卡片。

注册表是一个独立的服务。每个 MCP 服务器暴露一个带有其工具清单、传输 URL、认证要求的 `.well-known/mcp-capabilities` 文档。注册表轮询、验证和索引。平台团队使用注册表 UI 查看哪些工具可用、它们需要什么作用域，以及哪些团队拥有它们。

## 架构

```
MCP 客户端（Claude Code、Cursor 3、...）
          |
          v
StreamableHTTP over HTTPS (JSON-RPC + 流式传输)
          |
          v
MCP 服务器（FastMCP）在负载均衡器后面
          |
   +------+------+---------+----------+------------+
   v             v         v          v            v
Postgres    S3 列表   Jira       Linear     Datadog
(只读)    (分页)    (读取)     (读取)     (查询)
          |
   +------+-------------+
   v                    v
 OPA 策略门         破坏性工具 MCP（独立服务器）
                        |
                        v
                   通过 Slack 人工批准
                        |
                        v
                   审计日志（仅追加，每租户）
```

## 技术栈

- 服务器框架：FastMCP（Python）或 `@modelcontextprotocol/sdk`（TypeScript）
- 传输：HTTPS 上的 StreamableHTTP（无状态）
- 认证：通过 SPIFFE / SPIRE 的工作负载身份 OAuth 2.1
- 策略：每工具的 OPA / Rego 规则；每个请求的决策服务
- 注册表：自托管，消费 `.well-known/mcp-capabilities` 清单
- 人工批准：用于破坏性工具的 Slack 交互式消息
- 部署：AWS ECS Fargate 或 Fly.io，每租户一个服务器或通过租户范围共享
- 审计：每租户存储桶的仅追加结构化 JSONL，带每调用谱系

## 构建步骤

1. **工具表面。** 暴露 10 个内部工具：Postgres 只读查询、S3 列出对象、Jira 搜索/获取、Linear 搜索/获取、Datadog 指标查询、PagerDuty 值班查询、GitHub 只读、Notion 搜索、Slack 搜索、Salesforce 读取。每个工具都有类型化 schema 和作用域标签。

2. **FastMCP 服务器。** 挂载工具。配置 StreamableHTTP 传输。添加用于 OAuth token 自检和作用域强制的中间件。

3. **OPA 策略。** 每工具的 Rego 策略：什么作用域允许调用、什么 PII 编辑适用、什么载荷大小上限适用。每个工具调用时调用决策服务。

4. **注册表服务。** 独立的 Go 或 TS 服务，从已注册服务器轮询 `.well-known/mcp-capabilities`，使用 JSON Schema 验证，并暴露列表 / 搜索 / 验证 / 启用-禁用 UI。

5. **能力清单。** 每个服务器暴露 `.well-known/mcp-capabilities`，包含：工具列表、认证要求、传输 URL、所属团队、SLO。

6. **破坏性工具分离。** 改变状态的工具（Jira 创建、Linear 创建、Postgres 写入）位于第二个 MCP 服务器上，带有更严格的认证流程：token 必须在 15 分钟内通过 Slack 卡片提升 `approved:by:human` 作用域。

7. **审计日志。** 每租户仅追加 JSONL：`{timestamp, user, tool, args_redacted, response_redacted, outcome}`。写入前通过 Presidio 进行 PII 编辑。

8. **负载测试。** 在 StreamableHTTP 上 100 个并发客户端。通过添加第二个副本来演示水平扩展；显示负载均衡器无需会话粘性即可重新分发。

9. **一致性测试。** 针对两个服务器运行官方 MCP 一致性测试套件。通过所有强制部分。

## 使用示例

```
$ curl -H "Authorization: Bearer eyJhbGc..." \
       -X POST https://mcp.internal.example.com/ \
       -d '{"jsonrpc":"2.0","method":"tools/call",
            "params":{"name":"postgres.readonly","arguments":{"sql":"SELECT 1"}}}'
[registry]   能力验证：postgres.readonly v1.2
[policy]    作用域 postgres:query:readonly 存在；允许
[audit]     已记录：user=u42 tool=postgres.readonly outcome=ok
response:    { "result": { "rows": [[1]] } }
```

## 交付成果

`outputs/skill-mcp-server.md` 描述了可交付成果。一个生产级 MCP 服务器 + 注册表 + 审计层，用于带有 OAuth 2.1 作用域和 OPA 门控的内部工具。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 规范一致性 | StreamableHTTP + 能力清单通过 MCP 一致性测试 |
| 20 | 安全性 | 作用域强制、跨所有工具的 OPA 覆盖率、密钥卫生 |
| 20 | 可观测性 | 带有 PII 编辑的每工具调用审计日志 |
| 20 | 规模 | 100 客户端负载测试水平扩展演示 |
| 15 | 注册表 UX | 发现 / 验证 / 启用-禁用工作流 |
| **100** | | |

## 练习

1. 添加新工具（Confluence 搜索）。通过注册表验证流程交付它，无需触及核心服务器。

2. 编写一个 OPA 策略，编辑包含名为 `email`、`ssn` 或 `phone` 的列的 Postgres 查询结果。用探测查询演练。

3. 在本地延迟上对标 StreamableHTTP 与 stdio。报告每调用 p50/p95。

4. 实现每租户配额：每工具每租户每分钟最多 N 次调用。通过第二个 OPA 规则强制。

5. 运行 [mcp-conformance-tests](https://github.com/modelcontextprotocol/conformance) 中的 MCP 一致性测试套件，并修复每次失败。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| StreamableHTTP | "2026 MCP 传输" | 无状态 HTTP + 流式传输；取代用于网络服务器的 SSE + stdio |
| 能力清单 | "知名文档" | 带有工具列表、认证、传输 URL 的 `.well-known/mcp-capabilities` |
| OPA / Rego | "策略引擎" | 用于根据外部规则授权工具调用的开放策略代理 |
| 作用域提升 | "人工批准" | 通过 Slack 批准授予的生存期短的 scope；破坏性工具需要 |
| 注册表 | "工具发现" | 从其能力清单索引 MCP 服务器的服务 |
| 工作负载身份 | "SPIFFE / SPIRE" | 用于 OAuth token 颁发的加密服务身份 |
| 一致性套件 | "规范测试" | 用于 StreamableHTTP + 工具清单正确性的官方 MCP 测试套件 |

## 延伸阅读

- [模型上下文协议 2026 路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP、能力元数据、注册表
- [AAIF MCP 注册表规范](https://github.com/modelcontextprotocol/registry) — 2026 年注册表规范
- [AWS ECS 参考部署](https://aws.amazon.com/blogs/containers/deploying-model-context-protocol-mcp-servers-on-amazon-ecs/) — 参考生产部署
- [Pinterest 内部 MCP 生态系统](https://www.infoq.com/news/2026/04/pinterest-mcp-ecosystem/) — 参考内部部署
- [Block `goose` MCP 用法](https://block.github.io/goose/) — 参考智能体消费模式
- [FastMCP](https://github.com/jlowin/fastmcp) — Python 服务器框架
- [开放策略代理](https://www.openpolicyagent.org/) — 策略引擎参考
- [SPIFFE / SPIRE](https://spiffe.io) — 工作负载身份参考
