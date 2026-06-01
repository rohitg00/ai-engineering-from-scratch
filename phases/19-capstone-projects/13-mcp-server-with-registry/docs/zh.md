# 13 · 带注册中心与治理的 MCP 服务器

> 模型上下文协议（Model Context Protocol，MCP）不再是未来，它已成为 2026 年的默认工具调用规范。Anthropic、OpenAI、Google 以及所有主流 IDE 都提供了 MCP 客户端。Pinterest 公开了其内部的 MCP 服务器生态。AAIF 注册中心通过 `.well-known` 端点将能力元数据正式标准化。AWS ECS 发布了无状态部署的参考实现。Block 的 goose-agent 将同一协议嵌入了托管助手之中。2026 年的生产级形态是：StreamableHTTP 传输、OAuth 2.1 权限作用域、OPA 策略门控，以及一个让平台团队能够发现、验证和启用服务器的注册中心。从头到尾构建这一整套体系。

**类型：** 综合项目
**语言：** Python（服务器，基于 FastMCP）或 TypeScript（`@modelcontextprotocol/sdk`）、Go（注册中心服务）
**前置：** 第 11 阶段（大语言模型工程）、第 13 阶段（工具与 MCP）、第 14 阶段（智能体）、第 17 阶段（基础设施）、第 18 阶段（安全）
**覆盖阶段：** P11 · P13 · P14 · P17 · P18
**时长：** 25 小时

## 问题

MCP 已成为工具调用的通用语言。Claude Code、Cursor 3、Amp、OpenCode、Gemini CLI 以及所有托管智能体现在都消费 MCP 服务器。生产环境的挑战不在于编写服务器（FastMCP 让这变得简单），而在于以企业级要求进行规模化部署：按租户划分的 OAuth 作用域、对破坏性工具的 OPA 策略控制、StreamableHTTP 无状态水平扩展、用于服务发现的注册中心、以及每次工具调用的审计日志。Pinterest 的内部 MCP 生态和 AAIF 注册中心规范设定了 2026 年的标准。

你将构建一个暴露 10 个内部工具的 MCP 服务器（Postgres 只读查询、S3 对象列表、Jira、Linear、Datadog 等）、一个用于平台服务发现的注册中心 UI，以及一个用于破坏性工具的人工审批门控。负载测试将演示 StreamableHTTP 的水平扩展能力。审计追踪将满足企业安全审查的要求。

## 概念

MCP 2026 修订版将 StreamableHTTP 定为默认传输协议。与早期的 stdio 加 SSE 形态不同，StreamableHTTP 默认为无状态：单个 HTTP 端点接收 JSON-RPC 请求、流式传输响应，并支持用于通知的长连接。无状态意味着可以在负载均衡器后方进行水平扩展。

授权采用 OAuth 2.1，并支持按工具划分的作用域（per-tool scopes）。令牌携带诸如 `jira:read`、`s3:list`、`postgres:query:readonly` 等作用域。MCP 服务器在工具调用时检查作用域，而不仅仅在会话开始时检查。对于高风险工具，服务器会拒绝任何在最近 N 分钟内未将作用域提升至 `approved:by:human` 的调用——该提升通过 Slack 审批卡片获得。

注册中心是一个独立的服务。每个 MCP 服务器暴露一个 `.well-known/mcp-capabilities` 文档，包含其工具清单、传输 URL 和认证要求。注册中心对其进行轮询、验证和索引。平台团队通过注册中心 UI 查看可用的工具、所需的作用域以及工具的归属团队。

## 架构

```
MCP 客户端 (Claude Code, Cursor 3, ...)
           |
           v
StreamableHTTP over HTTPS (JSON-RPC + 流式传输)
           |
           v
MCP 服务器 (FastMCP) 位于负载均衡器后方
           |
    +------+------+---------+----------+------------+
    v             v         v          v            v
Postgres      S3 列表    Jira       Linear      Datadog
(只读)        (分页)     (读取)     (读取)      (查询)
           |
    +------+-------------+
    v                    v
 OPA 策略门控     破坏性工具 MCP（独立服务器）
                         |
                         v
                    通过 Slack 人工审批
                         |
                         v
                    审计日志（仅追加，按租户）

  注册中心服务
      |
      v  GET /.well-known/mcp-capabilities 从每台服务器获取
      v
      UI：搜索 / 验证 / 启用-禁用 / 归属
```

## 技术栈

- 服务器框架：FastMCP（Python）或 `@modelcontextprotocol/sdk`（TypeScript）
- 传输：StreamableHTTP over HTTPS（无状态）
- 认证：OAuth 2.1，通过 SPIFFE / SPIRE 提供工作负载身份（workload identity）
- 策略：OPA / Rego 规则按工具划分；每个请求调用策略决策服务
- 注册中心：自托管，消费 `.well-known/mcp-capabilities` 清单
- 人工审批：针对破坏性工具的 Slack 交互式消息
- 部署：AWS ECS Fargate 或 Fly.io，每租户一台服务器或共享服务器并做租户作用域隔离
- 审计：按租户结构化的 JSONL 存储桶，包含每次调用的血缘信息

## 构建步骤

1. **工具面（Tool surface）。** 暴露 10 个内部工具：Postgres 只读查询、S3 对象列表、Jira 搜索/获取、Linear 搜索/获取、Datadog 指标查询、PagerDuty 值班查询、GitHub 只读、Notion 搜索、Slack 搜索、Salesforce 读取。每个工具具备类型化的 schema 和作用域标签。

2. **FastMCP 服务器。** 挂载工具。配置 StreamableHTTP 传输。添加用于 OAuth 令牌自省和作用域强制执行的中间件。

3. **OPA 策略。** 按工具编写 Rego 策略：哪些作用域允许调用、应用何种 PII 脱敏、适用的负载大小上限。每次工具调用时调用策略决策服务。

4. **注册中心服务。** 独立的 Go 或 TypeScript 服务，轮询已注册服务器的 `.well-known/mcp-capabilities`，使用 JSON Schema 进行验证，并提供列表 / 搜索 / 验证 / 启用-禁用 UI。

5. **能力清单（Capability manifest）。** 每台服务器暴露 `.well-known/mcp-capabilities`，包含：工具列表、认证要求、传输 URL、归属团队、SLO。

6. **破坏性工具分离。** 执行变更操作的工具（Jira 创建、Linear 创建、Postgres 写入）部署在第二台 MCP 服务器上，采用更严格的认证流程：令牌必须具有在 15 分钟内通过 Slack 卡片提升的 `approved:by:human` 作用域。

7. **审计日志。** 按租户仅追加的 JSONL：`{timestamp, user, tool, args_redacted, response_redacted, outcome}`。写入前通过 Presidio 进行 PII 脱敏。

8. **负载测试。** 在 StreamableHTTP 上进行 100 个并发客户端测试。通过添加第二个副本来演示水平扩展能力；展示负载均衡器在无会话粘滞的情况下重新分配流量。

9. **兼容性测试。** 针对两台服务器运行官方 MCP 兼容性测试套件。通过所有强制项目。

## 使用示例

```
$ curl -H "Authorization: Bearer eyJhbGc..." \
       -X POST https://mcp.internal.example.com/ \
       -d '{"jsonrpc":"2.0","method":"tools/call",
            "params":{"name":"postgres.readonly","arguments":{"sql":"SELECT 1"}}}'
[registry]   能力已验证: postgres.readonly v1.2
[policy]    作用域 postgres:query:readonly 存在; 允许
[audit]     已记录: user=u42 tool=postgres.readonly outcome=ok
response:    { "result": { "rows": [[1]] } }
```

## 交付标准

`outputs/skill-mcp-server.md` 描述了可交付物。一个面向内部工具的生产级 MCP 服务器 + 注册中心 + 审计层，配备 OAuth 2.1 作用域和 OPA 门控。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 规范兼容性 | StreamableHTTP + 能力清单通过 MCP 兼容性测试 |
| 20 | 安全性 | 作用域强制执行、OPA 覆盖所有工具、密钥卫生 |
| 20 | 可观测性 | 每次工具调用的审计日志，含 PII 脱敏 |
| 20 | 规模 | 100 客户端负载测试的水平扩展演示 |
| 15 | 注册中心体验 | 发现 / 验证 / 启用-禁用工作流 |
| **100** | | |

## 练习

1. 添加一个新工具（Confluence 搜索）。将其通过注册中心验证流程发布，无需修改核心服务器。

2. 编写一条 OPA 策略，对查询结果中包含名为 `email`、`ssn` 或 `phone` 的列的 Postgres 结果进行脱敏。使用探测查询进行验证。

3. 在本地延迟上对比 StreamableHTTP 与 stdio 的性能。报告每次调用的 p50/p95。

4. 实现按租户配额：每工具每租户每分钟最多 N 次调用。通过第二条 OPA 规则强制执行。

5. 从 [mcp-conformance-tests](https://github.com/modelcontextprotocol/conformance) 运行 MCP 兼容性测试套件，修复所有失败项。

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|--------|----------|
| StreamableHTTP | "2026 MCP 传输协议" | 无状态 HTTP + 流式传输；替代 SSE + stdio，用于网络化服务器 |
| 能力清单（Capability manifest） | "Well-known 文档" | `.well-known/mcp-capabilities`，包含工具列表、认证、传输 URL |
| OPA / Rego | "策略引擎" | 开放策略代理（Open Policy Agent），根据外部规则对工具调用进行授权 |
| 作用域提升（Scope elevation） | "人工审批" | 通过 Slack 审批授予的短时作用域，破坏性工具必需 |
| 注册中心（Registry） | "工具发现" | 从各服务器的能力清单中索引 MCP 服务器的服务 |
| 工作负载身份（Workload identity） | "SPIFFE / SPIRE" | 用于 OAuth 令牌签发的加密服务身份 |
| 兼容性测试套件（Conformance suite） | "规范测试" | 官方 MCP 测试集，针对 StreamableHTTP + 工具清单正确性 |

## 延伸阅读

- [Model Context Protocol 2026 Roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP、能力元数据、注册中心
- [AAIF MCP Registry spec](https://github.com/modelcontextprotocol/registry) — 2026 注册中心规范
- [AWS ECS reference deployment](https://aws.amazon.com/blogs/containers/deploying-model-context-protocol-mcp-servers-on-amazon-ecs/) — 参考生产部署方案
- [Pinterest internal MCP ecosystem](https://www.infoq.com/news/2026/04/pinterest-mcp-ecosystem/) — 参考内部部署案例
- [Block `goose` MCP usage](https://block.github.io/goose/) — 参考智能体消费模式
- [FastMCP](https://github.com/jlowin/fastmcp) — Python 服务器框架
- [Open Policy Agent](https://www.openpolicyagent.org/) — 策略引擎参考
- [SPIFFE / SPIRE](https://spiffe.io) — 工作负载身份参考
