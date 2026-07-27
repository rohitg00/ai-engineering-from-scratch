# Capstone 13 —— 带注册表与治理的 MCP 服务器

> 模型上下文协议（MCP）在 2026 年已不再只是未来趋势，而成为了默认的工具调用规范。Anthropic、OpenAI、Google 以及所有主流 IDE 均已搭载 MCP 客户端。Pinterest 发布了其内部 MCP 服务器生态系统。AAIF 注册表通过 `.well-known` 形式标准化了能力元数据。AWS ECS 发布了参考性的无状态部署方案。Block 的 goose-agent 将同一协议内置于托管助手之中。2026 年生产环境的形态是：StreamableHTTP 传输、OAuth 2.1 作用域、OPA 策略门控，以及一个让平台团队能够发现、验证和启用服务器的注册表。你需要端到端地构建这一切。

**类型：** Capstone
**语言：** Python（服务器，使用 FastMCP）或 TypeScript（@modelcontextprotocol/sdk），Go（注册表服务）
**前置条件：** 阶段 11（LLM 工程）、阶段 13（工具与 MCP）、阶段 14（智能体）、阶段 17（基础设施）、阶段 18（安全）
**涉及阶段：** P11 · P13 · P14 · P17 · P18
**时间：** 25 小时

## 问题

MCP 已成为工具调用的通用语言。Claude Code、Cursor 3、Amp、OpenCode、Gemini CLI 以及所有受管智能体现在都使用 MCP 服务器。生产环境的挑战不在于编写服务器（FastMCP 让这变得很容易），而在于以企业级要求进行规模化部署：每租户 OAuth 作用域、针对破坏性工具的 OPA 策略、StreamableHTTP 无状态扩缩容、用于服务发现的注册表，以及每次工具调用的审计日志。Pinterest 的内部 MCP 生态系统和 AAIF 注册表规范设定了 2026 年的行业标杆。

你需要构建一个 MCP 服务器，暴露 10 个内部工具（Postgres 只读查询、S3 文件列表、Jira、Linear、Datadog 等）、一个供平台团队进行服务发现的注册表 UI，以及一个用于破坏性工具的人工审批网关。压力测试将展示 StreamableHTTP 的水平扩展能力。审计轨迹需满足企业安全审查的要求。

## 概念

MCP 2026 修订版强制要求 StreamableHTTP 作为默认传输协议。与早期的 stdio 加 SSE 方案不同，StreamableHTTP 默认是无状态的：一个单一的 HTTP 端点接受 JSON-RPC 请求、流式传输响应，并支持用于通知的长连接。无状态意味着可以在负载均衡器后水平扩展。

授权方面采用 OAuth 2.1 并搭配按工具划分的作用域。令牌携带诸如 `jira:read`、`s3:list`、`postgres:query:readonly` 等作用域。MCP 服务器在工具调用时检查作用域，而非仅在会话开始时。对于高风险工具，服务器会拒绝任何在过去 N 分钟内未将作用域提升为 `approved:by:human` 的调用——这种提升来自 Slack 审批卡片。

注册表是一个独立的服务。每个 MCP 服务器暴露一个 `.well-known/mcp-capabilities` 文档，其中包含工具清单、传输 URL 和认证要求。注册表负责轮询、验证和索引。平台团队通过注册表 UI 查看有哪些工具可用、需要哪些作用域以及由哪个团队维护。

## 架构

```
MCP 客户端 (Claude Code, Cursor 3, ...)
          |
          v
StreamableHTTP over HTTPS (JSON-RPC + 流式传输)
          |
          v
位于负载均衡器后的 MCP 服务器 (FastMCP)
          |
   +------+------+---------+----------+------------+
   v             v         v          v            v
Postgres    S3 文件列表  Jira       Linear     Datadog
(只读)      (分页)     (读取)     (读取)     (查询)
          |
   +------+-------------+
   v                    v
 OPA 策略门控    破坏性工具 MCP (独立服务器)
                        |
                        v
                   通过 Slack 人工审批
                        |
                        v
                   审计日志 (仅追加，按租户隔离)

  注册表服务
     |
     v  从每个服务器获取 GET /.well-known/mcp-capabilities
     v
     UI: 搜索 / 验证 / 启用-禁用 / 归属管理
```

## 技术栈

- 服务器框架：FastMCP (Python) 或 `@modelcontextprotocol/sdk` (TypeScript)
- 传输协议：StreamableHTTP over HTTPS（无状态）
- 认证：OAuth 2.1，结合 SPIFFE / SPIRE 工作负载身份
- 策略：OPA / Rego 规则（按工具划分）；每次请求进行策略决策
- 注册表：自托管，消费 `.well-known/mcp-capabilities` 清单
- 人工审批：针对破坏性工具的 Slack 交互式消息
- 部署：AWS ECS Fargate 或 Fly.io，支持每租户独立服务器或共享服务器加租户作用域隔离
- 审计：按租户的结构化 JSONL 存储桶，包含每次调用的完整链路追踪

## 构建步骤

1. **工具接口。** 暴露 10 个内部工具：Postgres 只读查询、S3 对象列表、Jira 搜索/获取、Linear 搜索/获取、Datadog 指标查询、PagerDuty 值班查询、GitHub 只读、Notion 搜索、Slack 搜索、Salesforce 读取。每个工具都有类型化的 schema 和作用域标签。

2. **FastMCP 服务器。** 挂载以上工具。配置 StreamableHTTP 传输。添加用于 OAuth 令牌内省和作用域强制检查的中间件。

3. **OPA 策略。** 为每个工具编写 Rego 策略：哪些作用域允许调用、应用哪些 PII 脱敏规则、payload 大小上限是多少。每次工具调用都需经过策略决策服务。

4. **注册表服务。** 一个独立的 Go 或 TS 服务，负责轮询已注册服务器的 `.well-known/mcp-capabilities`、使用 JSON Schema 进行验证，并提供列表/搜索/验证/启用-禁用 UI。

5. **能力清单。** 每个服务器暴露 `.well-known/mcp-capabilities`，包含：工具列表、认证要求、传输 URL、所属团队、SLO。

6. **破坏性工具分离。** 变更状态的工具（Jira 创建、Linear 创建、Postgres 写入）运行在另一个独立的 MCP 服务器上，采用更严格的认证流程：令牌必须在 15 分钟内通过 Slack 卡片获得 `approved:by:human` 作用域提升。

7. **审计日志。** 每个租户的仅追加 JSONL：`{timestamp, user, tool, args_redacted, response_redacted, outcome}`。写入前通过 Presidio 进行 PII 脱敏。

8. **压力测试。** 100 个并发客户端通过 StreamableHTTP 连接。通过增加第二个副本演示水平扩展能力；展示负载均衡器在无需会话粘性的情况下重新分配请求。

9. **一致性测试。** 针对两个服务器运行官方 MCP 一致性测试套件。通过所有强制性测试项。

## 使用示例

```
$ curl -H "Authorization: Bearer eyJhbGc..." \
       -X POST https://mcp.internal.example.com/ \
       -d '{"jsonrpc":"2.0","method":"tools/call",
            "params":{"name":"postgres.readonly","arguments":{"sql":"SELECT 1"}}}'
[registry]   能力已验证: postgres.readonly v1.2
[policy]     作用域 postgres:query:readonly 存在；允许通过
[audit]      已记录: user=u42 tool=postgres.readonly outcome=ok
响应:         { "result": { "rows": [[1]] } }
```

## 交付标准

`outputs/skill-mcp-server.md` 描述了交付物：一个生产级 MCP 服务器 + 注册表 + 审计层，适用于内部工具，具备 OAuth 2.1 作用域和 OPA 门控。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 规范一致性 | StreamableHTTP + 能力清单通过 MCP 一致性测试 |
| 20 | 安全性 | 作用域强制、OPA 覆盖所有工具、密钥管理规范 |
| 20 | 可观测性 | 每次工具调用的审计日志，包含 PII 脱敏 |
| 20 | 可扩展性 | 100 客户端压力测试的水平扩展演示 |
| 15 | 注册表用户体验 | 发现 / 验证 / 启用-禁用工作流 |
| **100** | | |

## 练习

1. 添加一个新工具（Confluence 搜索）。在不触碰核心服务器的情况下，通过注册表验证流程完成发布。

2. 编写一个 OPA 策略，用于脱敏包含 `email`、`ssn` 或 `phone` 列名的 Postgres 查询结果。使用探测查询进行验证。

3. 在本地延迟方面对 StreamableHTTP 与 stdio 进行基准测试。报告每次调用的 p50/p95 指标。

4. 实现每租户配额：每个租户每分钟每个工具最多 N 次调用。通过第二条 OPA 规则强制执行。

5. 从 [mcp-conformance-tests](https://github.com/modelcontextprotocol/conformance) 运行 MCP 一致性测试套件，修复所有失败项。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| StreamableHTTP | "2026 MCP 传输协议" | 无状态 HTTP + 流式传输；替代面向网络服务器的 SSE + stdio |
| 能力清单 (Capability manifest) | "Well-known 文档" | `.well-known/mcp-capabilities`，包含工具列表、认证信息、传输 URL |
| OPA / Rego | "策略引擎" | Open Policy Agent，用于根据外部规则授权工具调用 |
| 作用域提升 (Scope elevation) | "人工批准" | 通过 Slack 审批授予的短期作用域，破坏性工具必须使用 |
| 注册表 (Registry) | "工具发现" | 从能力清单索引 MCP 服务器的服务 |
| 工作负载身份 (Workload identity) | "SPIFFE / SPIRE" | 用于 OAuth 令牌签发的加密服务身份 |
| 一致性测试套件 (Conformance suite) | "规范测试" | 官方的 MCP 测试套件，验证 StreamableHTTP + 工具清单的正确性 |

## 延伸阅读

- [Model Context Protocol 2026 路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP、能力元数据、注册表
- [AAIF MCP 注册表规范](https://github.com/modelcontextprotocol/registry) — 2026 注册表规范
- [AWS ECS 参考部署](https://aws.amazon.com/blogs/containers/deploying-model-context-protocol-mcp-servers-on-amazon-ecs/) — 参考生产部署方案
- [Pinterest 内部 MCP 生态系统](https://www.infoq.com/news/2026/04/pinterest-mcp-ecosystem/) — 参考内部部署案例
- [Block `goose` MCP 使用](https://block.github.io/goose/) — 参考智能体消费模式
- [FastMCP](https://github.com/jlowin/fastmcp) — Python 服务器框架
- [Open Policy Agent](https://www.openpolicyagent.org/) — 策略引擎参考
- [SPIFFE / SPIRE](https://spiffe.io) — 工作负载身份参考
