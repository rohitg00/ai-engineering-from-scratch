# 顶点项目 13 —— 带注册表和治理的 MCP 服务器

> 模型上下文协议（Model Context Protocol）不再是未来，而是成为了 2026 年默认的工具使用规范。Anthropic、OpenAI、Google 以及所有主流 IDE 都内置了 MCP 客户端。Pinterest 发布了其内部的 MCP 服务器生态系统。AAIF 注册表在 `.well-known` 路径下正式规范了能力元数据。AWS ECS 发布了无状态部署的参考方案。Block 的 goose-agent 将同一协议集成到了托管助手中。2026 年的生产形态是：StreamableHTTP 传输、OAuth 2.1 作用域、OPA 策略门控，以及一个允许平台团队发现、验证和启用服务器的注册表。端到端地构建它。

**类型：** 顶点项目
**语言：** Python（服务器，通过 FastMCP）或 TypeScript（@modelcontextprotocol/sdk），Go（注册表服务）
**先决条件：** Phase 11（LLM 工程）、Phase 13（工具与 MCP）、Phase 14（智能体）、Phase 17（基础设施）、Phase 18（安全）
**涉及阶段：** P11 · P13 · P14 · P17 · P18
**时间：** 25 小时

## 问题

MCP 已成为工具使用的通用语言。Claude Code、Cursor 3、Amp、OpenCode、Gemini CLI 以及每个托管智能体现在都消费 MCP 服务器。生产挑战不在于编写服务器（FastMCP 让这变得简单），而在于在企业需求下大规模部署它们：每租户 OAuth 作用域、针对破坏性工具的 OPA 策略、StreamableHTTP 无状态扩展、用于发现的注册表、每次工具调用的审计日志。Pinterest 的内部 MCP 生态系统和 AAIF 注册表规范设定了 2026 年的标准。

你将构建一个 MCP 服务器，暴露 10 个内部工具（Postgres 只读、S3 列表、Jira、Linear、Datadog 等），一个用于平台发现的注册表 UI，以及一个针对破坏性工具的人工审批门。负载测试演示 StreamableHTTP 的水平扩展。审计追踪满足企业安全审查。

## 概念

MCP 2026 修订版强制规定 StreamableHTTP 为默认传输协议。与早期的 stdio 和 SSE 形态不同，StreamableHTTP 默认是无状态的：单个 HTTP 端点接受 JSON-RPC 请求，流式传输响应，并支持用于通知的长连接。无状态意味着在负载均衡器后面可水平扩展。

授权采用 OAuth 2.1，带每工具作用域。令牌携带如 `jira:read`、`s3:list`、`postgres:query:readonly` 等作用域。MCP 服务器在工具调用时检查作用域，而不仅仅是在会话开始时。对于高风险工具，服务器拒绝任何在过去 N 分钟内未将作用域提升为 `approved:by:human` 的调用——该提升来自 Slack 审批卡片。

注册表是一个独立的服务。每个 MCP 服务器暴露一个 `.well-known/mcp-capabilities` 文档，包含其工具清单、传输 URL、认证要求。注册表轮询、验证并索引。平台团队使用注册表 UI 查看可用工具、所需作用域以及所属团队。

## 架构

```
MCP 客户端（Claude Code、Cursor 3、...）
          |
          v
通过 HTTPS 的 StreamableHTTP（JSON-RPC + 流式传输）
          |
          v
MCP 服务器（FastMCP）位于负载均衡器后面
          |
   +------+------+---------+----------+------------+
   v             v         v          v            v
Postgres    S3 列表   Jira       Linear     Datadog
（只读）    （分页）    （读取）     （读取）     （查询）
          |
   +------+-------------+
   v                    v
 OPA 策略门控   破坏性工具 MCP（独立服务器）
                        |
                        v
                   通过 Slack 进行人工审批
                        |
                        v
                   审计日志（仅追加，每租户）

  注册表服务
     |
     v  从每个服务器 GET /.well-known/mcp-capabilities
     v
     UI：搜索 / 验证 / 启用-禁用 / 所有权
```

## 技术栈

- 服务器框架：FastMCP（Python）或 `@modelcontextprotocol/sdk`（TypeScript）
- 传输：通过 HTTPS 的 StreamableHTTP（无状态）
- 认证：OAuth 2.1，通过 SPIFFE / SPIRE 进行工作负载身份验证
- 策略：每个工具的 OPA / Rego 规则；每次请求的策略决策服务
- 注册表：自托管，消费 `.well-known/mcp-capabilities` 清单
- 人工审批：针对破坏性工具的 Slack 交互式消息
- 部署：AWS ECS Fargate 或 Fly.io，每租户一个服务器或带租户作用域的共享服务器
- 审计：每租户桶的结构化 JSONL，带每次调用谱系

## 构建它

1. **工具表面。** 暴露 10 个内部工具：Postgres 只读查询、S3 列出对象、Jira 搜索/获取、Linear 搜索/获取、Datadog 指标查询、PagerDuty 值班查询、GitHub 只读、Notion 搜索、Slack 搜索、Salesforce 读取。每个工具都有类型化模式和作用域标签。

2. **FastMCP 服务器。** 挂载工具。配置 StreamableHTTP 传输。添加用于 OAuth 令牌内省和作用域强制执行的中间件。

3. **OPA 策略。** 每个工具的 Rego 策略：允许调用的作用域、应用的 PII 脱敏、有效负载大小上限。每次工具调用时调用决策服务。

4. **注册表服务。** 独立的 Go 或 TS 服务，从已注册服务器轮询 `.well-known/mcp-capabilities`，用 JSON Schema 验证，并暴露列表/搜索/验证/启用-禁用 UI。

5. **能力清单。** 每个服务器暴露 `.well-known/mcp-capabilities`，包含：工具列表、认证要求、传输 URL、所属团队、SLO。

6. **破坏性工具分离。** 改变状态的工具（Jira 创建、Linear 创建、Postgres 写入）位于第二个 MCP 服务器上，带有更严格的认证流程：令牌必须在 15 分钟内通过 Slack 卡片提升为 `approved:by:human` 作用域。

7. **审计日志。** 每租户仅追加 JSONL：`{timestamp, user, tool, args_redacted, response_redacted, outcome}`。写入前通过 Presidio 进行 PII 脱敏。

8. **负载测试。** 100 个并发客户端在 StreamableHTTP 上。通过添加第二个副本演示水平扩展；展示负载均衡器无需会话粘性即可重新分配。

9. **一致性测试。** 针对两个服务器运行官方 MCP 一致性套件。通过所有强制部分。

## 使用它

```
$ curl -H "Authorization: Bearer eyJhbGc..." \
       -X POST https://mcp.internal.example.com/ \
       -d '{"jsonrpc":"2.0","method":"tools/call",
            "params":{"name":"postgres.readonly","arguments":{"sql":"SELECT 1"}}}'
[注册表]   能力已验证：postgres.readonly v1.2
[策略]    作用域 postgres:query:readonly 存在；允许
[审计]     已记录：user=u42 tool=postgres.readonly outcome=ok
响应：    { "result": { "rows": [[1]] } }
```

## 交付它

`outputs/skill-mcp-server.md` 描述可交付成果。一个生产级 MCP 服务器 + 注册表 + 审计层，用于内部工具，带 OAuth 2.1 作用域和 OPA 门控。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 规范一致性 | StreamableHTTP + 能力清单通过 MCP 一致性测试 |
| 20 | 安全性 | 作用域强制执行、每个工具的 OPA 覆盖、密钥卫生 |
| 20 | 可观察性 | 带 PII 脱敏的每次工具调用审计日志 |
| 20 | 扩展性 | 100 客户端负载测试水平扩展演示 |
| 15 | 注册表用户体验 | 发现 / 验证 / 启用-禁用工作流 |
| **100** | | |

## 练习

1. 添加一个新工具（Confluence 搜索）。通过注册表验证流程发布它，无需触及核心服务器。

2. 编写一个 OPA 策略，脱敏包含名为 `email`、`ssn` 或 `phone` 列的 Postgres 查询结果。用探测查询测试。

3. 基准测试 StreamableHTTP 与本地 stdio 的延迟。报告每次调用的 p50/p95。

4. 实现每租户配额：每工具每租户每分钟最多 N 次调用。通过第二个 OPA 规则强制执行。

5. 运行 [mcp-conformance-tests](https://github.com/modelcontextprotocol/conformance) 中的 MCP 一致性套件并修复每个失败。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| StreamableHTTP | "2026 MCP 传输" | 无状态 HTTP + 流式传输；替代网络服务器的 SSE + stdio |
| 能力清单 | "知名文档" | `.well-known/mcp-capabilities`，包含工具列表、认证、传输 URL |
| OPA / Rego | "策略引擎" | 开放策略代理，用于根据外部规则授权工具调用 |
| 作用域提升 | "人工批准" | 通过 Slack 审批授予的短期作用域，破坏性工具所需 |
| 注册表 | "工具发现" | 从能力清单索引 MCP 服务器的服务 |
| 工作负载身份 | "SPIFFE / SPIRE" | 用于 OAuth 令牌发行的加密服务身份 |
| 一致性套件 | "规范测试" | 针对 StreamableHTTP + 工具清单正确性的官方 MCP 测试套件 |

## 延伸阅读

- [Model Context Protocol 2026 路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) —— StreamableHTTP、能力元数据、注册表
- [AAIF MCP 注册表规范](https://github.com/modelcontextprotocol/registry) —— 2026 年注册表规范
- [AWS ECS 参考部署](https://aws.amazon.com/blogs/containers/deploying-model-context-protocol-mcp-servers-on-amazon-ecs/) —— 参考生产部署
- [Pinterest 内部 MCP 生态系统](https://www.infoq.com/news/2026/04/pinterest-mcp-ecosystem/) —— 参考内部部署
- [Block `goose` MCP 使用](https://block.github.io/goose/) —— 参考智能体消费模式
- [FastMCP](https://github.com/jlowin/fastmcp) —— Python 服务器框架
- [Open Policy Agent](https://www.openpolicyagent.org/) —— 策略引擎参考
- [SPIFFE / SPIRE](https://spiffe.io) —— 工作负载身份参考
